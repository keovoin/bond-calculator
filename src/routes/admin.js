const express = require('express');
const bcrypt = require('bcryptjs');

const {
  countAdmins,
  createAdmin,
  getAdminByUsername,
  updateAdminPassword,
  listBonds,
  getBond,
  createBond,
  updateBond,
  deleteBond,
} = require('../db');

const { requireAdmin } = require('../auth');

const router = express.Router();

/* ---------- Setup (one-time) ---------- */
router.post('/setup', async (req, res) => {
  if (countAdmins() > 0) return res.status(403).json({ error: 'Setup has already been completed.' });
  const { username, password } = req.body || {};
  if (!username || String(username).trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const hash = await bcrypt.hash(password, 10);
  createAdmin(String(username).trim(), hash);
  res.json({ ok: true });
});

/* ---------- Auth ---------- */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const admin = getAdminByUsername(String(username).trim());
  // Always run bcrypt.compare even if user missing to mitigate timing attacks
  const hash = admin ? admin.password_hash : '$2a$10$invalidsaltinvalidsalt.invalidsaltinvalidsaltinvalid';
  const ok = await bcrypt.compare(String(password), hash);
  if (!admin || !ok) return res.status(401).json({ error: 'Invalid credentials.' });
  req.session.adminId = admin.id;
  req.session.username = admin.username;
  res.json({ ok: true, username: admin.username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/session', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ authenticated: true, username: req.session.username });
  }
  res.json({ authenticated: false });
});

/* ---------- Password change ---------- */
router.post('/password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const admin = getAdminByUsername(req.session.username);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  const ok = await bcrypt.compare(String(currentPassword || ''), admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
  const hash = await bcrypt.hash(String(newPassword), 10);
  updateAdminPassword(admin.id, hash);
  res.json({ ok: true });
});

/* ---------- Bonds CRUD ---------- */
router.get('/bonds', requireAdmin, (req, res) => {
  res.json({ bonds: listBonds() });
});

router.get('/bonds/:id', requireAdmin, (req, res) => {
  const bond = getBond(Number(req.params.id));
  if (!bond) return res.status(404).json({ error: 'Bond not found.' });
  res.json({ bond });
});

router.post('/bonds', requireAdmin, (req, res) => {
  try {
    const payload = sanitiseBondPayload(req.body);
    const validation = validateBondPayload(payload);
    if (validation.length) return res.status(400).json({ errors: validation });
    const bond = createBond(payload);
    res.status(201).json({ bond });
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A bond with that code already exists.' });
    }
    res.status(500).json({ error: 'Failed to create bond.' });
  }
});

router.put('/bonds/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = getBond(id);
  if (!existing) return res.status(404).json({ error: 'Bond not found.' });
  try {
    const payload = sanitiseBondPayload(req.body);
    const validation = validateBondPayload(payload);
    if (validation.length) return res.status(400).json({ errors: validation });
    const bond = updateBond(id, payload);
    res.json({ bond });
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A bond with that code already exists.' });
    }
    res.status(500).json({ error: 'Failed to update bond.' });
  }
});

router.delete('/bonds/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = getBond(id);
  if (!existing) return res.status(404).json({ error: 'Bond not found.' });
  deleteBond(id);
  res.json({ ok: true });
});

/* ---------- helpers ---------- */
function sanitiseBondPayload(body = {}) {
  const amort = Array.isArray(body.amort_percents)
    ? body.amort_percents.map(Number)
    : [];
  return {
    code: String(body.code || '').trim(),
    name: String(body.name || '').trim(),
    issuer: String(body.issuer || '').trim(),
    bond_type: String(body.bond_type || '').trim(),
    currency: String(body.currency || 'USD').trim().toUpperCase(),
    nominal_price: Number(body.nominal_price),
    coupon_rate: Number(body.coupon_rate),
    default_spread: Number(body.default_spread ?? 2),
    tenor_years: Number(body.tenor_years),
    day_count: Number(body.day_count ?? 365),
    min_investment: Number(body.min_investment),
    bonds_offered: Number(body.bonds_offered ?? 0),
    wht_resident: Number(body.wht_resident ?? 6),
    wht_non_resident: Number(body.wht_non_resident ?? 14),
    amort_percents: amort,
    market: String(body.market || '').trim(),
    broker: String(body.broker || '').trim(),
    purpose: String(body.purpose || '').trim(),
    proof: String(body.proof || '').trim(),
    oracle_module: String(body.oracle_module || '').trim(),
    is_active: body.is_active === undefined ? true : !!body.is_active,
  };
}

function validateBondPayload(p) {
  const errs = [];
  if (!p.code) errs.push('Bond code is required.');
  if (!p.name) errs.push('Bond name is required.');
  if (!p.issuer) errs.push('Issuer is required.');
  if (!(p.nominal_price > 0)) errs.push('Nominal price must be greater than 0.');
  if (!(p.coupon_rate >= 0)) errs.push('Coupon rate must be 0 or greater.');
  if (!(p.tenor_years > 0 && Number.isInteger(p.tenor_years))) errs.push('Tenor must be a whole number of years.');
  if (!(p.min_investment >= 0)) errs.push('Minimum investment must be 0 or greater.');
  if (!Array.isArray(p.amort_percents) || p.amort_percents.length !== p.tenor_years) {
    errs.push('Amortization percentages must match the tenor in years.');
  } else {
    // Check that cumulative drawdown reaches 100% (within 0.1%)
    let remaining = 100;
    let total = 0;
    p.amort_percents.forEach(pc => {
      const r = remaining * (pc / 100);
      total += r;
      remaining -= r;
    });
    if (Math.abs(total - 100) > 0.1) {
      errs.push(`Amortization percentages must fully repay the principal (currently ${total.toFixed(2)}%).`);
    }
  }
  return errs;
}

module.exports = router;
