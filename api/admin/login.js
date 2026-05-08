// POST /api/admin/login
const bcrypt = require('bcryptjs');
const { getAdminByUsername } = require('../../lib/db');
const { signSession, setSessionCookie } = require('../../lib/auth');
const { methodNotAllowed, readBody, handleError } = require('../../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { username, password } = readBody(req);
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const admin = await getAdminByUsername(String(username).trim());
    // Still run bcrypt.compare even if missing to mitigate timing attacks.
    const hash = admin ? admin.password_hash : '$2a$10$invalidsaltinvalidsalt.invalidsaltinvalidsaltinvalid';
    const ok = await bcrypt.compare(String(password), hash);
    if (!admin || !ok) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = signSession({ adminId: Number(admin.id), username: admin.username });
    setSessionCookie(res, token);
    res.json({
      ok: true,
      username: admin.username,
      mustChangePassword: !admin.password_changed_at,
    });
  } catch (e) { handleError(res, e); }
};
