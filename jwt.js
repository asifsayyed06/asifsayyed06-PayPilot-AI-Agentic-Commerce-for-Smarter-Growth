const jwt = require('jsonwebtoken');

// In production this must come from a secrets manager / env var.
const SECRET = process.env.PAYPILOT_JWT_SECRET || 'paypilot-demo-secret-change-me';

function signAgentToken(agent) {
  return jwt.sign(
    {
      sub: agent.id,
      name: agent.name,
      owner: agent.ownerName,
      type: 'agent-identity'
    },
    SECRET,
    { expiresIn: '12h' }
  );
}

function verifyAgentToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signAgentToken, verifyAgentToken, SECRET };
