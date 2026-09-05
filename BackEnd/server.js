const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple in-process cache of state, persisted to data.json on every write.
let state = db.load();
const getState = () => state;
const saveState = (next) => {
  state = next;
  db.save(state);
};

app.use('/api/agents', require('./routes/agents')(getState, saveState));
app.use('/api/transactions', require('./routes/transactions')(getState, saveState));
app.use('/api/dashboard', require('./routes/dashboard')(getState, saveState));

app.get('/api/health', (req, res) => res.json({ status: 'ok', product: 'PayPilot AI' }));

// Serve the static frontend if it's been copied alongside the backend.
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.listen(PORT, () => {
  console.log(`PayPilot AI backend running on http://localhost:${PORT}`);
});
