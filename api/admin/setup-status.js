// GET /api/admin/setup-status — tells the frontend whether setup is still available.
// Used by the admin login page to redirect first-time visitors to /admin/setup.
const { countAdmins } = require('../../lib/db');
const { methodNotAllowed, handleError } = require('../../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const n = await countAdmins();
    res.json({ setupRequired: n === 0 });
  } catch (e) { handleError(res, e); }
};
