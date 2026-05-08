const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_DIR = path.join(__dirname, '..', 'db');
const DB_PATH = path.join(DB_DIR, 'bonds.db');

let db;

function initDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bonds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      issuer TEXT NOT NULL,
      bond_type TEXT NOT NULL DEFAULT 'Unsecured and Subordinated in Registered Form Bond (Fixed Interest)',
      currency TEXT NOT NULL DEFAULT 'USD',
      nominal_price REAL NOT NULL DEFAULT 25,
      coupon_rate REAL NOT NULL DEFAULT 8.5,
      default_spread REAL NOT NULL DEFAULT 2.0,
      tenor_years INTEGER NOT NULL DEFAULT 5,
      day_count INTEGER NOT NULL DEFAULT 365,
      min_investment REAL NOT NULL DEFAULT 500000,
      bonds_offered INTEGER NOT NULL DEFAULT 4100000,
      wht_resident REAL NOT NULL DEFAULT 6,
      wht_non_resident REAL NOT NULL DEFAULT 14,
      amort_percents TEXT NOT NULL DEFAULT '[20,25,33.33,50,100]',
      market TEXT DEFAULT 'Cambodia Securities Exchange (CSX)',
      broker TEXT DEFAULT 'Royal Group Securities Plc.',
      purpose TEXT DEFAULT 'General Corporate purpose',
      proof TEXT DEFAULT 'Bond Certificate',
      oracle_module TEXT DEFAULT 'Money Market Module',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bonds_active ON bonds (is_active);
  `);
}

function getDb() {
  if (!db) initDb();
  return db;
}

function countAdmins() {
  return getDb().prepare('SELECT COUNT(*) AS c FROM admins').get().c;
}

/* ---------- Admin helpers ---------- */
function createAdmin(username, passwordHash) {
  return getDb()
    .prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);
}

function getAdminByUsername(username) {
  return getDb().prepare('SELECT * FROM admins WHERE username = ?').get(username);
}

function updateAdminPassword(id, passwordHash) {
  return getDb()
    .prepare('UPDATE admins SET password_hash = ? WHERE id = ?')
    .run(passwordHash, id);
}

/* ---------- Bond helpers ---------- */
function listBonds({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  const rows = getDb().prepare(`SELECT * FROM bonds ${where} ORDER BY created_at DESC`).all();
  return rows.map(hydrate);
}

function getBond(id) {
  const row = getDb().prepare('SELECT * FROM bonds WHERE id = ?').get(id);
  return row ? hydrate(row) : null;
}

function createBond(data) {
  const stmt = getDb().prepare(`
    INSERT INTO bonds (
      code, name, issuer, bond_type, currency, nominal_price, coupon_rate,
      default_spread, tenor_years, day_count, min_investment, bonds_offered,
      wht_resident, wht_non_resident, amort_percents, market, broker,
      purpose, proof, oracle_module, is_active
    ) VALUES (
      @code, @name, @issuer, @bond_type, @currency, @nominal_price, @coupon_rate,
      @default_spread, @tenor_years, @day_count, @min_investment, @bonds_offered,
      @wht_resident, @wht_non_resident, @amort_percents, @market, @broker,
      @purpose, @proof, @oracle_module, @is_active
    )
  `);
  const info = stmt.run(normaliseForInsert(data));
  return getBond(info.lastInsertRowid);
}

function updateBond(id, data) {
  const existing = getBond(id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  const stmt = getDb().prepare(`
    UPDATE bonds SET
      code = @code, name = @name, issuer = @issuer, bond_type = @bond_type,
      currency = @currency, nominal_price = @nominal_price, coupon_rate = @coupon_rate,
      default_spread = @default_spread, tenor_years = @tenor_years, day_count = @day_count,
      min_investment = @min_investment, bonds_offered = @bonds_offered,
      wht_resident = @wht_resident, wht_non_resident = @wht_non_resident,
      amort_percents = @amort_percents, market = @market, broker = @broker,
      purpose = @purpose, proof = @proof, oracle_module = @oracle_module,
      is_active = @is_active, updated_at = datetime('now')
    WHERE id = @id
  `);
  stmt.run({ ...normaliseForInsert(merged), id });
  return getBond(id);
}

function deleteBond(id) {
  return getDb().prepare('DELETE FROM bonds WHERE id = ?').run(id);
}

/* ---------- internals ---------- */
function hydrate(row) {
  return {
    ...row,
    amort_percents: JSON.parse(row.amort_percents || '[]'),
    is_active: !!row.is_active,
  };
}

function normaliseForInsert(d) {
  return {
    code: d.code,
    name: d.name,
    issuer: d.issuer,
    bond_type: d.bond_type || 'Unsecured and Subordinated in Registered Form Bond (Fixed Interest)',
    currency: d.currency || 'USD',
    nominal_price: Number(d.nominal_price),
    coupon_rate: Number(d.coupon_rate),
    default_spread: Number(d.default_spread ?? 2),
    tenor_years: Number(d.tenor_years),
    day_count: Number(d.day_count ?? 365),
    min_investment: Number(d.min_investment),
    bonds_offered: Number(d.bonds_offered ?? 0),
    wht_resident: Number(d.wht_resident ?? 6),
    wht_non_resident: Number(d.wht_non_resident ?? 14),
    amort_percents: typeof d.amort_percents === 'string'
      ? d.amort_percents
      : JSON.stringify(d.amort_percents || []),
    market: d.market || '',
    broker: d.broker || '',
    purpose: d.purpose || '',
    proof: d.proof || '',
    oracle_module: d.oracle_module || '',
    is_active: d.is_active ? 1 : 0,
  };
}

module.exports = {
  initDb,
  getDb,
  countAdmins,
  createAdmin,
  getAdminByUsername,
  updateAdminPassword,
  listBonds,
  getBond,
  createBond,
  updateBond,
  deleteBond,
};
