const express = require('express');
const { v4: uuid } = require('uuid');
const { evaluateTransaction } = require('../riskEngine');

module.exports = function dashboardRouter(getState, saveState) {
  const router = express.Router();

  router.get('/summary', (req, res) => {
    const state = getState();
    const totalAgents = state.agents.length;
    const activeAgents = state.agents.filter((a) => a.status === 'active').length;
    const approved = state.transactions.filter((t) => t.status === 'approved');
    const held = state.transactions.filter((t) => t.status === 'held');
    const declined = state.transactions.filter((t) => t.status === 'declined');
    const totalVolume = approved.reduce((s, t) => s + t.amount, 0);

    res.json({
      totalAgents,
      activeAgents,
      totalTransactions: state.transactions.length,
      approvedCount: approved.length,
      heldCount: held.length,
      declinedCount: declined.length,
      totalApprovedVolume: Number(totalVolume.toFixed(2)),
      merchants: state.merchants
    });
  });

  // Simulate an agent making a batch of purchases, to demo the risk engine live.
  router.post('/simulate', (req, res) => {
    const { agentId, count = 5 } = req.body || {};
    const state = getState();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.status !== 'active') return res.status(403).json({ error: 'Agent is not active' });

    const created = [];
    for (let i = 0; i < count; i++) {
      const merchant = state.merchants[Math.floor(Math.random() * state.merchants.length)];
      const amount = Number((Math.random() * agent.limits.perTransactionCap * 1.3 + 1).toFixed(2));

      const { decision, score, reasons } = evaluateTransaction({
        agent,
        merchant,
        amount,
        allTransactions: state.transactions
      });

      const transaction = {
        id: uuid(),
        agentId: agent.id,
        agentName: agent.name,
        merchant: merchant.name,
        category: merchant.category,
        amount,
        status: decision,
        riskScore: score,
        reasons,
        createdAt: new Date().toISOString(),
        decidedAt: decision === 'held' ? null : new Date().toISOString()
      };
      state.transactions.unshift(transaction);
      created.push(transaction);
    }
    saveState(state);
    res.status(201).json(created);
  });

  return router;
};
