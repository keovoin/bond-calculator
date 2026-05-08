// GET /api/bonds — public list of active bonds for the staff calculator.
const { listBonds } = require('../lib/db');
const { methodNotAllowed, handleError } = require('../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const bonds = (await listBonds({ activeOnly: true })).map(b => ({
      id: b.id,
      code: b.code,
      name: b.name,
      issuer: b.issuer,
      currency: b.currency,
      coupon_rate: b.coupon_rate,
      tenor_years: b.tenor_years,
      nominal_price: b.nominal_price,
      min_investment: b.min_investment,
      bond_type: b.bond_type,
    }));
    res.json({ bonds });
  } catch (e) { handleError(res, e); }
};
