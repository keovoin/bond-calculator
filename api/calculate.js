// POST /api/calculate — generate a schedule for a given bond + inputs.
const { getBond } = require('../lib/db');
const { buildSchedule } = require('../lib/calc');
const { methodNotAllowed, readBody, handleError } = require('../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { bondId, investAmount, issueDate, residency, customer } = readBody(req);

    const errors = [];
    const bond = bondId ? await getBond(Number(bondId)) : null;
    if (!bond || !bond.is_active) errors.push('Please select a valid bond.');
    const amt = Number(investAmount);
    if (!amt || amt <= 0) errors.push('Investment amount is required.');
    if (bond && amt && amt < bond.min_investment) {
      errors.push(`Minimum investment for ${bond.name} is ${bond.currency} ${bond.min_investment.toLocaleString()}.`);
    }
    if (bond && amt && bond.nominal_price > 0) {
      const rem = Math.abs(amt / bond.nominal_price - Math.round(amt / bond.nominal_price));
      if (rem > 0.0001) {
        errors.push(`Amount must be a multiple of the nominal price (${bond.currency} ${bond.nominal_price}).`);
      }
    }
    if (!issueDate) errors.push('Issue date is required.');
    if (!['resident', 'non-resident'].includes(residency)) errors.push('Residency is required.');

    if (errors.length) return res.status(400).json({ errors });

    const result = buildSchedule(bond, { investAmount: amt, issueDate, residency });
    res.json({
      bond: {
        id: bond.id,
        code: bond.code,
        name: bond.name,
        issuer: bond.issuer,
        currency: bond.currency,
        bond_type: bond.bond_type,
        coupon_rate: bond.coupon_rate,
        tenor_years: bond.tenor_years,
        nominal_price: bond.nominal_price,
        default_spread: bond.default_spread,
      },
      customer: customer || null,
      ...result,
    });
  } catch (e) { handleError(res, e); }
};
