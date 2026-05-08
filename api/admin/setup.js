// POST /api/admin/setup — create the first admin account.
// Permanently locked after the first account exists.
const bcrypt = require('bcryptjs');
const { countAdmins, createAdmin } = require('../../lib/db');
const { methodNotAllowed, readBody, handleError } = require('../../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    if ((await countAdmins()) > 0) {
      return res.status(403).json({ error: 'Setup has already been completed.' });
    }
    const { username, password } = readBody(req);
    if (!username || String(username).trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    await createAdmin(String(username).trim(), hash);
    res.json({ ok: true });
  } catch (e) { handleError(res, e); }
};
