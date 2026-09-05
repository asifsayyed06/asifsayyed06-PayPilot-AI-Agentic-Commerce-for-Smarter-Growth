const express = require('express');
const { v4: uuid } = require('uuid');
const { verifyAgentToken } = require('../utils/jwt');
const { evaluateTransaction } = require('../riskEngine');

function authenticateAgent(getState) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing agent identity token' });

    let payload;
    try {
      payload = verifyAgentToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired agent identity token' });
    }

    const state = getState();
    const agent = state.agents.find((a) => a.id === payload.sub);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.status !== 'active') {
      return res.status(403).json({ error: `Agent is ${agent.status}; payment blocked` });
    }

    req.agent = agent;
    next();
  };
}

module.exports = function transactionsRouter(getState, saveState) {
  const router = express.Router();

  // Agent submits a payment request
  router.post('/', authenticateAgent(getState), (req, res) => {
    const { merchantName, amount } = req.body || {};
    if (!merchantName || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'merchantName and a positive numeric amount are required' });
    }

    const state = getState();
    const merchant = state.merchants.find(
      (m) => m.name.toLowerCase() === String(merchantName).toLowerCase()
    ) || { name: merchantName, category: 'unknown', riskScore: 80 };

    const { decision, score, reasons } = evaluateTransaction({
      agent: req.agent,
      merchant,
      amount,
      allTransactions: state.transactions
    });

    const transaction = {
      id: uuid(),
      agentId: req.agent.id,
      agentName: req.agent.name,
      merchant: merchant.name,
      category: merchant.category,
      amount,
      status: decision, // 'approved' | 'declined' | 'held'
      riskScore: score,
      reasons,
      createdAt: new Date().toISOString(),
      decidedAt: decision === 'held' ? null : new Date().toISOString()
    };

    state.transactions.unshift(transaction);
    saveState(state);

    res.status(201).json(transaction);
  });

  // List transactions (the ledger), newest first
  router.get('/', (req, res) => {
    const state = getState();
    let txs = state.transactions;
    if (req.query.status) txs = txs.filter((t) => t.status === req.query.status);
    if (req.query.agentId) txs = txs.filter((t) => t.agentId === req.query.agentId);
    res.json(txs);
  });

  // Human owner approves a held transaction
  router.post('/:id/approve', (req, res) => {
    const state = getState();
    const tx = state.transactions.find((t) => t.id === req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'held') return res.status(400).json({ error: 'Only held transactions can be approved' });
    tx.status = 'approved';
    tx.decidedAt = new Date().toISOString();
    tx.reasons.push('Manually approved by human owner');
    saveState(state);
    res.json(tx);
  });

  // Human owner declines a held transaction
  router.post('/:id/decline', (req, res) => {
    const state = getState();
    const tx = state.transactions.find((t) => t.id === req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'held') return res.status(400).json({ error: 'Only held transactions can be declined' });
    tx.status = 'declined';
    tx.decidedAt = new Date().toISOString();
    tx.reasons.push('Manually declined by human owner');
    saveState(state);
    res.json(tx);
  });

  return router;
};
