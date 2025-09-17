import express from 'express';

const router = express.Router();

// Relay base URL from env
const RELAY_URL = process.env.RAT_RELAY_URL || 'http://localhost:8080';

// POST /api/rat2e/complete { user_code, browser_pubkey? }
router.post('/complete', async (req, res) => {
  try {
    const { user_code, browser_pubkey } = req.body || {};
    if (!user_code) {
      res.status(400).json({ error: 'user_code is required' });
      return;
    }
    const url = `${RELAY_URL}/v1/pair/complete`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_code, browser_pubkey })
    });
    if (!r.ok) {
      res.status(r.status).json({ error: 'pair complete failed' });
      return;
    }
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'internal error', message: err?.message || String(err) });
  }
});

// GET /api/rat2e/presence -> proxy to relay
router.get('/presence', async (_req, res) => {
  try {
    const url = `${RELAY_URL}/v1/presence`;
    const r = await fetch(url);
    if (!r.ok) {
      res.status(r.status).json({ error: 'presence fetch failed' });
      return;
    }
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'internal error', message: err?.message || String(err) });
  }
});

export default router;

