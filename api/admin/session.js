// GET /api/admin/session
const { readSession } = require('../../lib/auth');
const { getAdminById } = require('../../lib/db');
const { methodNotAllowed, handleError } = require('../../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const s = readSession(req);
    if (s && s.adminId) {
      const admin = await getAdminById(s.adminId);
      return res.json({
        authenticated: true,
        username: s.username,
        mustChangePassword: admin ? !admin.password_changed_at : false,
      });
    }
    res.json({ authenticated: false });
  } catch (e) { handleError(res, e); }
};
