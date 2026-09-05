const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateTransaction } = require('../riskEngine');

function makeAgent(overrides = {}) {
  return {
    id: 'agent-1',
    limits: {
      perTransactionCap: 100,
      dailySpendCap: 500,
      hourlyTransactionRateLimit: 5
    },
    allowedMerchantCategories: [],
    ...overrides
  };
}

function makeMerchant(overrides = {}) {
  return { name: 'TestMerchant', category: 'software', riskScore: 5, ...overrides };
}

test('declines a transaction over the per-transaction cap', () => {
  const result = evaluateTransaction({
    agent: makeAgent(),
    merchant: makeMerchant(),
    amount: 150,
    allTransactions: []
  });
  assert.equal(result.decision, 'declined');
  assert.equal(result.score, 100);
});

test('approves a small, low-risk transaction with no history', () => {
  const result = evaluateTransaction({
    agent: makeAgent(),
    merchant: makeMerchant({ riskScore: 5 }),
    amount: 10,
    allTransactions: []
  });
  assert.equal(result.decision, 'approved');
});

test('declines when projected daily spend exceeds the daily cap', () => {
  const priorTx = {
    agentId: 'agent-1',
    amount: 480,
    status: 'approved',
    createdAt: new Date().toISOString()
  };
  const result = evaluateTransaction({
    agent: makeAgent(),
    merchant: makeMerchant(),
    amount: 50,
    allTransactions: [priorTx]
  });
  assert.equal(result.decision, 'declined');
});

test('declines once the hourly transaction-rate limit is hit', () => {
  const now = new Date().toISOString();
  const recentTx = Array.from({ length: 5 }, () => ({
    agentId: 'agent-1',
    amount: 1,
    status: 'approved',
    createdAt: now
  }));
  const result = evaluateTransaction({
    agent: makeAgent({ limits: { perTransactionCap: 100, dailySpendCap: 500, hourlyTransactionRateLimit: 5 } }),
    merchant: makeMerchant(),
    amount: 10,
    allTransactions: recentTx
  });
  assert.equal(result.decision, 'declined');
});

test('holds a transaction to a merchant outside the allow-list', () => {
  const result = evaluateTransaction({
    agent: makeAgent({ allowedMerchantCategories: ['groceries'] }),
    merchant: makeMerchant({ category: 'luxury', riskScore: 20 }),
    amount: 30,
    allTransactions: []
  });
  assert.equal(result.decision, 'held');
});

test('holds a transaction to a high-risk merchant even within limits', () => {
  const result = evaluateTransaction({
    agent: makeAgent(),
    merchant: makeMerchant({ riskScore: 90, category: 'crypto' }),
    amount: 20,
    allTransactions: []
  });
  assert.equal(result.decision, 'held');
});

test('every decision includes at least one explanatory reason', () => {
  const result = evaluateTransaction({
    agent: makeAgent(),
    merchant: makeMerchant(),
    amount: 20,
    allTransactions: []
  });
  assert.ok(result.reasons.length > 0);
});
