// POST /api/admin/logout
const { clearSessionCookie } = require('../../lib/auth');
const { methodNotAllowed, handleError } = require('../../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (e) { handleError(res, e); }
};
