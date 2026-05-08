const path = require('path');
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const { initDb, countAdmins } = require('./src/db');
const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

initDb();

const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
  name: 'bc.sid',
}));

// Serve static assets (css, js, images) but NOT the html files directly —
// we route those explicitly so we can gate admin pages.
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// Public pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin HTML routing with setup-gate
app.get('/admin', (req, res) => {
  if (countAdmins() === 0) return res.redirect('/admin/setup');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/setup', (req, res) => {
  // Setup page is only accessible when there is no admin yet.
  if (countAdmins() > 0) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// API
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Bond Calculator running on http://localhost:${PORT}`);
  if (countAdmins() === 0) {
    console.log('No admin account yet — visit /admin/setup to create one.');
  }
});
