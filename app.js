const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getDb, initDatabase } = require('./database');

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' }
}));
app.use(express.static(path.join(__dirname, 'static')));

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  res.redirect('/login');
}

const MAX_USERS = 2;
function userCount() { return getDb().prepare('SELECT COUNT(*) as count FROM users').get().count; }

// Auth routes
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'templates', 'login.html'));
});

app.post('/auth/register', authLimiter, (req, res) => {
  if (userCount() >= MAX_USERS) return res.status(403).json({ error: `Max ${MAX_USERS} accounts` });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const db = getDb();
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username.trim(), bcrypt.hashSync(password, 10));
  req.session.userId = result.lastInsertRowid;
  req.session.username = username.trim();
  res.json({ status: 'ok' });
});

app.post('/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username?.trim());
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ status: 'ok' });
});

app.post('/auth/logout', (req, res) => { req.session.destroy(); res.json({ status: 'ok' }); });

app.post('/auth/change-password', requireAuth, authLimiter, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'Min 4 characters' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: 'Current password incorrect' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.session.userId);
  res.json({ status: 'ok' });
});

app.get('/auth/status', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.userId), username: req.session?.username || null, needsSetup: userCount() < MAX_USERS });
});

// Protected routes
app.use(requireAuth);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'index.html')));

// Apps API
app.get('/api/apps', (req, res) => {
  const apps = getDb().prepare('SELECT * FROM apps WHERE is_active = 1 ORDER BY sort_order').all();
  res.json(apps);
});

app.post('/api/apps', (req, res) => {
  const { name, description, url, icon, color } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });
  const db = getDb();
  const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM apps').get().m || 0;
  db.prepare('INSERT INTO apps (name, description, url, icon, color, sort_order) VALUES (?,?,?,?,?,?)')
    .run(name.trim(), (description || '').trim(), url.trim(), icon || '📦', color || '#7986cb', maxSort + 1);
  res.json({ status: 'ok' });
});

app.put('/api/apps/:id', (req, res) => {
  const { name, description, url, icon, color } = req.body;
  getDb().prepare('UPDATE apps SET name=COALESCE(?,name), description=COALESCE(?,description), url=COALESCE(?,url), icon=COALESCE(?,icon), color=COALESCE(?,color) WHERE id=?')
    .run(name||null, description||null, url||null, icon||null, color||null, req.params.id);
  res.json({ status: 'ok' });
});

app.delete('/api/apps/:id', (req, res) => {
  getDb().prepare('DELETE FROM apps WHERE id = ?').run(req.params.id);
  res.json({ status: 'ok' });
});

// Health check for other apps
app.get('/api/apps/:id/health', async (req, res) => {
  const app_entry = getDb().prepare('SELECT url FROM apps WHERE id = ?').get(req.params.id);
  if (!app_entry) return res.status(404).json({ error: 'Not found' });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(app_entry.url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    res.json({ status: 'up', code: r.status });
  } catch {
    res.json({ status: 'down' });
  }
});

const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Home Portal running at http://localhost:${PORT}\n`);
  });
}).catch(err => { console.error('Failed:', err); process.exit(1); });
