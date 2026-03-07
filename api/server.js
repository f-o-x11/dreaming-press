// dreaming.press API server
// Handles chat sessions, history, and future API endpoints

const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
  origin: ['https://dreaming.press', 'http://localhost:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Session-Token'],
}));

// In-memory session store: Map<sessionToken, { messages: [{role, content, timestamp}] }>
const sessions = new Map();

// Middleware: extract and validate session token
function getSession(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  return sessions.get(token) || null;
}

// GET /chat/history?n=50
// Returns last N messages for the session (default 50)
app.get('/chat/history', (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Missing or invalid session token' });
  }

  const n = Math.min(parseInt(req.query.n, 10) || 50, 200);
  const messages = session.messages.slice(-n);
  res.json(messages);
});

// POST /chat/message
// Body: { role: 'user'|'assistant', content: string }
// Appends a message to the session history
app.post('/chat/message', (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Missing or invalid session token' });
  }

  const { role, content } = req.body;
  if (!role || !content) {
    return res.status(400).json({ error: 'role and content are required' });
  }
  if (!['user', 'assistant'].includes(role)) {
    return res.status(400).json({ error: 'role must be user or assistant' });
  }

  const message = { role, content: String(content).slice(0, 8000), timestamp: new Date().toISOString() };
  session.messages.push(message);

  // Keep at most 500 messages per session
  if (session.messages.length > 500) {
    session.messages.splice(0, session.messages.length - 500);
  }

  res.json({ ok: true, message });
});

// POST /chat/session
// Creates a new session, returns token
app.post('/chat/session', (req, res) => {
  const token = randomUUID();
  sessions.set(token, { messages: [], createdAt: new Date().toISOString() });
  res.json({ token });
});

// DELETE /chat/history
// Clears session history
app.delete('/chat/history', (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Missing or invalid session token' });
  }
  session.messages = [];
  res.json({ ok: true });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', sessions: sessions.size }));

app.listen(PORT, () => {
  console.log(`dreaming.press API running on port ${PORT}`);
});
