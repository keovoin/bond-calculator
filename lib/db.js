/**
 * Serverless-friendly SQLite access via Turso (libSQL over HTTP).
 *
 * Why Turso: Vercel serverless functions have an ephemeral filesystem, so a
 * local SQLite file would be wiped on every cold start. Turso stores the data
 * remotely while keeping the same SQL we're already using. Free tier is
 * plenty for this app.
 *
 * Required env vars (set them in Vercel > Project > Settings > Environment Variables):
 *   TURSO_DATABASE_URL  libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN    token from `turso db tokens create`
 */

const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

let clientPromise;

function getClient() {
  if (!clientPromise) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error('TURSO_DATABASE_URL env var is not set');
    clientPromise = (async () => {
      const client = createClient({ url, authToken });
      await migrate(client);
      await seedAdminIfNeeded(client);
      return client;
    })();
  }
  return clientPromise;
}

/**
 * If no admin exists AND SEED_ADMIN_USERNAME + SEED_ADMIN_PASSWORD env vars
 * are set, create that admin automatically. Lets the user skip /admin/setup
 * on fresh deployments.
 *
 * The seeded admin is flagged with `password_changed_at = NULL`, which the
 * UI uses to show a "change your password" banner until it's rotated.
 */
async function seedAdminIfNeeded(client) {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) return;
  const { rows } = await client.execute('SELECT COUNT(*) AS c FROM admins');
  if (Number(rows[0].c) > 0) return;
  const hash = await bcrypt.hash(password, 10);
  await client.execute({
    sql: 'INSERT INTO admins (username, password_hash, password_changed_at) VALUES (?, ?, NULL)',
    args: [username.trim(), hash],
  });
}

async function migrate(client) {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_changed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS bonds (
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
        market TEXT DEFAULT '',
        broker TEXT DEFAULT '',
        purpose TEXT DEFAULT '',
        proof TEXT DEFAULT '',
        oracle_module TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bonds_active ON bonds (is_active)`,
    ],
    'write'
  );

  // Additive migration: older DBs may not have password_changed_at.
  // ALTER TABLE ADD COLUMN fails if the column already exists — swallow that case.
  try {
    await client.execute(`ALTER TABLE admins ADD COLUMN password_changed_at TEXT`);
  } catch (e) {
    if (!/duplicate column/i.test(e.message || '')) throw e;
  }
}

function hydrateBond(row) {
  if (!row) return null;
  return {
    ...row,
    amort_percents: JSON.parse(row.amort_percents || '[]'),
    is_active: !!row.is_active,
  };
}

async function countAdmins() {
  const client = await getClient();
  const r = await client.execute('SELECT COUNT(*) AS c FROM admins');
  return Number(r.rows[0].c);
}

async function createAdmin(username, passwordHash) {
  const client = await getClient();
  return client.execute({
    sql: 'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
    args: [username, passwordHash],
  });
}

async function getAdminByUsername(username) {
  const client = await getClient();
  const r = await client.execute({
    sql: 'SELECT * FROM admins WHERE username = ?',
    args: [username],
  });
  return r.rows[0] || null;
}

async function getAdminById(id) {
  const client = await getClient();
  const r = await client.execute({
    sql: 'SELECT * FROM admins WHERE id = ?',
    args: [id],
  });
  return r.rows[0] || null;
}

async function updateAdminPassword(id, passwordHash) {
  const client = await getClient();
  return client.execute({
    sql: "UPDATE admins SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?",
    args: [passwordHash, id],
  });
}

async function listBonds({ activeOnly = false } = {}) {
  const client = await getClient();
  const sql = activeOnly
    ? 'SELECT * FROM bonds WHERE is_active = 1 ORDER BY created_at DESC'
    : 'SELECT * FROM bonds ORDER BY created_at DESC';
  const r = await client.execute(sql);
  return r.rows.map(hydrateBond);
}

async function getBond(id) {
  const client = await getClient();
  const r = await client.execute({
    sql: 'SELECT * FROM bonds WHERE id = ?',
    args: [id],
  });
  return hydrateBond(r.rows[0]);
}

async function createBond(data) {
  const client = await getClient();
  const args = bondArgs(data);
  const r = await client.execute({
    sql: `INSERT INTO bonds (
      code, name, issuer, bond_type, currency, nominal_price, coupon_rate,
      default_spread, tenor_years, day_count, min_investment, bonds_offered,
      wht_resident, wht_non_resident, amort_percents, market, broker,
      purpose, proof, oracle_module, is_active
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args,
  });
  return getBond(Number(r.lastInsertRowid));
}

async function updateBond(id, data) {
  const existing = await getBond(id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  const args = bondArgs(merged);
  args.push(id);
  const client = await getClient();
  await client.execute({
    sql: `UPDATE bonds SET
      code=?, name=?, issuer=?, bond_type=?, currency=?, nominal_price=?, coupon_rate=?,
      default_spread=?, tenor_years=?, day_count=?, min_investment=?, bonds_offered=?,
      wht_resident=?, wht_non_resident=?, amort_percents=?, market=?, broker=?,
      purpose=?, proof=?, oracle_module=?, is_active=?, updated_at=datetime('now')
      WHERE id = ?`,
    args,
  });
  return getBond(id);
}

async function deleteBond(id) {
  const client = await getClient();
  return client.execute({ sql: 'DELETE FROM bonds WHERE id = ?', args: [id] });
}

function bondArgs(d) {
  return [
    d.code,
    d.name,
    d.issuer,
    d.bond_type || 'Unsecured and Subordinated in Registered Form Bond (Fixed Interest)',
    d.currency || 'USD',
    Number(d.nominal_price),
    Number(d.coupon_rate),
    Number(d.default_spread ?? 2),
    Number(d.tenor_years),
    Number(d.day_count ?? 365),
    Number(d.min_investment ?? 0),
    Number(d.bonds_offered ?? 0),
    Number(d.wht_resident ?? 6),
    Number(d.wht_non_resident ?? 14),
    typeof d.amort_percents === 'string'
      ? d.amort_percents
      : JSON.stringify(d.amort_percents || []),
    d.market || '',
    d.broker || '',
    d.purpose || '',
    d.proof || '',
    d.oracle_module || '',
    d.is_active ? 1 : 0,
  ];
}

module.exports = {
  countAdmins,
  createAdmin,
  getAdminByUsername,
  getAdminById,
  updateAdminPassword,
  listBonds,
  getBond,
  createBond,
  updateBond,
  deleteBond,
};
