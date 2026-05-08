// GET    /api/admin/bonds   — list all bonds (including inactive)
// POST   /api/admin/bonds   — create a new bond
const { listBonds, createBond } = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { sanitiseBondPayload, validateBondPayload } = require('../../lib/bondValidation');
const { methodNotAllowed, readBody, handleError } = require('../../lib/util');

module.exports = async (req, res) => {
  try {
    const session = requireAdmin(req, res);
    if (!session) return;

    if (req.method === 'GET') {
      const bonds = await listBonds();
      return res.json({ bonds });
    }

    if (req.method === 'POST') {
      const payload = sanitiseBondPayload(readBody(req));
      const errs = validateBondPayload(payload);
      if (errs.length) return res.status(400).json({ errors: errs });
      try {
        const bond = await createBond(payload);
        return res.status(201).json({ bond });
      } catch (e) {
        if (e && /UNIQUE/i.test(e.message || '')) {
          return res.status(409).json({ error: 'A bond with that code already exists.' });
        }
        throw e;
      }
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (e) { handleError(res, e); }
};
