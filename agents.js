const express = require('express');
const { v4: uuid } = require('uuid');
const { signAgentToken } = require('../utils/jwt');

module.exports = function agentsRouter(getState, saveState) {
  const router = express.Router();

  // Create / authorize a new agent
  router.post('/', (req, res) => {
    const {
      name,
      ownerName,
      perTransactionCap = 100,
      dailySpendCap = 500,
      hourlyTransactionRateLimit = 5,
      allowedMerchantCategories = []
    } = req.body || {};

    if (!name || !ownerName) {
      return res.status(400).json({ error: 'name and ownerName are required' });
    }

    const state = getState();
    const agent = {
      id: uuid(),
      name,
      ownerName,
      status: 'active',
      limits: {
        perTransactionCap: Number(perTransactionCap),
        dailySpendCap: Number(dailySpendCap),
        hourlyTransactionRateLimit: Number(hourlyTransactionRateLimit)
      },
      allowedMerchantCategories,
      createdAt: new Date().toISOString()
    };

    state.agents.push(agent);
    saveState(state);

    const token = signAgentToken(agent);
    res.status(201).json({ agent, token });
  });

  // List all agents
  router.get('/', (req, res) => {
    const state = getState();
    res.json(state.agents);
  });

  // Revoke an agent (kill switch)
  router.post('/:id/revoke', (req, res) => {
    const state = getState();
    const agent = state.agents.find((a) => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.status = 'revoked';
    saveState(state);
    res.json(agent);
  });

  // Reactivate a previously revoked agent
  router.post('/:id/reactivate', (req, res) => {
    const state = getState();
    const agent = state.agents.find((a) => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.status = 'active';
    saveState(state);
    res.json(agent);
  });

  // Reissue a fresh identity token for an agent
  router.post('/:id/token', (req, res) => {
    const state = getState();
    const agent = state.agents.find((a) => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.status !== 'active') {
      return res.status(403).json({ error: 'Agent is not active' });
    }
    res.json({ token: signAgentToken(agent) });
  });

  return router;
};
