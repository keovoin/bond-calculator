// GET    /api/admin/bonds/:id
// PUT    /api/admin/bonds/:id
// DELETE /api/admin/bonds/:id
const { getBond, updateBond, deleteBond } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');
const { sanitiseBondPayload, validateBondPayload } = require('../../../lib/bondValidation');
const { methodNotAllowed, readBody, handleError } = require('../../../lib/util');

module.exports = async (req, res) => {
  try {
    const session = requireAdmin(req, res);
    if (!session) return;

    const id = Number(req.query.id);
    if (!id) return res.status(400).json({ error: 'Invalid bond id.' });

    const existing = await getBond(id);
    if (!existing) return res.status(404).json({ error: 'Bond not found.' });

    if (req.method === 'GET') {
      return res.json({ bond: existing });
    }

    if (req.method === 'PUT') {
      const payload = sanitiseBondPayload(readBody(req));
      const errs = validateBondPayload(payload);
      if (errs.length) return res.status(400).json({ errors: errs });
      try {
        const bond = await updateBond(id, payload);
        return res.json({ bond });
      } catch (e) {
        if (e && /UNIQUE/i.test(e.message || '')) {
          return res.status(409).json({ error: 'A bond with that code already exists.' });
        }
        throw e;
      }
    }

    if (req.method === 'DELETE') {
      await deleteBond(id);
      return res.json({ ok: true });
    }

    return methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
  } catch (e) { handleError(res, e); }
};
