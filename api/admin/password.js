// POST /api/admin/password — change own password.
const bcrypt = require('bcryptjs');
const { getAdminById, updateAdminPassword } = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { methodNotAllowed, readBody, handleError } = require('../../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const session = requireAdmin(req, res);
    if (!session) return;

    const { currentPassword, newPassword } = readBody(req);
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    const admin = await getAdminById(session.adminId);
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });
    const ok = await bcrypt.compare(String(currentPassword || ''), admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(String(newPassword), 10);
    await updateAdminPassword(admin.id, hash);
    res.json({ ok: true });
  } catch (e) { handleError(res, e); }
};
