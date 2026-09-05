// db.js — lightweight JSON-file-backed store.
// Swappable for Postgres/Mongo later; kept simple for the demo.
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

function defaultState() {
  return {
    agents: [],       // { id, name, ownerName, status, limits, allowedMerchantCategories, createdAt }
    transactions: [],  // { id, agentId, merchant, category, amount, status, riskScore, reasons, createdAt, decidedAt }
    merchants: [
      { name: 'CloudCompute Inc',   category: 'software',    riskScore: 5 },
      { name: 'QuickMart',          category: 'groceries',   riskScore: 8 },
      { name: 'TravelNow',          category: 'travel',      riskScore: 35 },
      { name: 'LuxuryWatches Co',   category: 'luxury',      riskScore: 70 },
      { name: 'UnknownVendorXYZ',   category: 'unknown',     riskScore: 90 },
      { name: 'OfficeSupplyHub',    category: 'office',      riskScore: 10 },
      { name: 'StreamFlix',         category: 'software',    riskScore: 4 },
      { name: 'CryptoQuickBuy',     category: 'crypto',      riskScore: 95 }
    ]
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    save(defaultState());
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function save(state) {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

module.exports = { load, save };
