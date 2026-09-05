// riskEngine.js
// A transparent, rule-based risk engine (no black-box ML) so every
// decision the platform makes can be explained to the human owner.

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getWindowTransactions(transactions, agentId, windowMs, now) {
  return transactions.filter(
    (t) => t.agentId === agentId && now - new Date(t.createdAt).getTime() < windowMs
  );
}

/**
 * Evaluate a proposed transaction against an agent's guardrails.
 * Returns { decision: 'approved'|'declined'|'held', score: 0-100, reasons: string[] }
 */
function evaluateTransaction({ agent, merchant, amount, allTransactions }) {
  const now = Date.now();
  const reasons = [];
  let score = 0; // 0 = totally safe, 100 = certainly fraudulent/blocked

  // --- Hard limit checks (instant decline) ---
  if (amount > agent.limits.perTransactionCap) {
    reasons.push(
      `Amount $${amount} exceeds per-transaction cap of $${agent.limits.perTransactionCap}`
    );
    return { decision: 'declined', score: 100, reasons };
  }

  const dailyTx = getWindowTransactions(allTransactions, agent.id, ONE_DAY_MS, now).filter(
    (t) => t.status === 'approved'
  );
  const dailySpend = dailyTx.reduce((sum, t) => sum + t.amount, 0);
  if (dailySpend + amount > agent.limits.dailySpendCap) {
    reasons.push(
      `Would push daily spend to $${(dailySpend + amount).toFixed(2)}, over cap of $${agent.limits.dailySpendCap}`
    );
    return { decision: 'declined', score: 100, reasons };
  }

  const hourlyTx = getWindowTransactions(allTransactions, agent.id, ONE_HOUR_MS, now);
  if (hourlyTx.length >= agent.limits.hourlyTransactionRateLimit) {
    reasons.push(
      `Hit hourly transaction-rate limit of ${agent.limits.hourlyTransactionRateLimit}`
    );
    return { decision: 'declined', score: 100, reasons };
  }

  // --- Soft signals (contribute to score, can lead to hold) ---

  // Merchant category allow-list
  if (
    agent.allowedMerchantCategories.length > 0 &&
    !agent.allowedMerchantCategories.includes(merchant.category)
  ) {
    score += 40;
    reasons.push(`Merchant category "${merchant.category}" is not on the agent's allow-list`);
  }

  // Merchant intrinsic risk score (0-100, from merchant directory)
  score += merchant.riskScore * 0.4;
  if (merchant.riskScore >= 60) {
    reasons.push(`Merchant "${merchant.name}" has a high risk score (${merchant.riskScore})`);
  }

  // Amount relative to per-transaction cap
  const capRatio = amount / agent.limits.perTransactionCap;
  if (capRatio > 0.8) {
    score += 20;
    reasons.push(`Amount is ${(capRatio * 100).toFixed(0)}% of the per-transaction cap`);
  } else if (capRatio > 0.5) {
    score += 10;
  }

  // Velocity signal — many transactions in the last hour, even under the hard cap
  if (hourlyTx.length >= Math.ceil(agent.limits.hourlyTransactionRateLimit * 0.7)) {
    score += 15;
    reasons.push(`Elevated transaction velocity (${hourlyTx.length} in the last hour)`);
  }

  score = Math.min(100, Math.round(score));

  let decision;
  if (score >= 60) {
    decision = 'held';
  } else if (score >= 1 && reasons.length > 0 && score >= 35) {
    decision = 'held';
  } else {
    decision = 'approved';
  }

  if (reasons.length === 0) {
    reasons.push('All checks passed within guardrails');
  }

  return { decision, score, reasons };
}

module.exports = { evaluateTransaction };
