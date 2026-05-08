/**
 * Shared bond-payload sanitisation and validation — used by both
 * /api/admin/bonds and /api/admin/bonds/[id].
 */

function sanitiseBondPayload(body = {}) {
  const amort = Array.isArray(body.amort_percents)
    ? body.amort_percents.map(Number)
    : [];
  return {
    code: String(body.code || '').trim(),
    name: String(body.name || '').trim(),
    issuer: String(body.issuer || '').trim(),
    bond_type: String(body.bond_type || '').trim(),
    currency: String(body.currency || 'USD').trim().toUpperCase(),
    nominal_price: Number(body.nominal_price),
    coupon_rate: Number(body.coupon_rate),
    default_spread: Number(body.default_spread ?? 2),
    tenor_years: Number(body.tenor_years),
    day_count: Number(body.day_count ?? 365),
    min_investment: Number(body.min_investment),
    bonds_offered: Number(body.bonds_offered ?? 0),
    wht_resident: Number(body.wht_resident ?? 6),
    wht_non_resident: Number(body.wht_non_resident ?? 14),
    amort_percents: amort,
    market: String(body.market || '').trim(),
    broker: String(body.broker || '').trim(),
    purpose: String(body.purpose || '').trim(),
    proof: String(body.proof || '').trim(),
    oracle_module: String(body.oracle_module || '').trim(),
    is_active: body.is_active === undefined ? true : !!body.is_active,
  };
}

function validateBondPayload(p) {
  const errs = [];
  if (!p.code) errs.push('Bond code is required.');
  if (!p.name) errs.push('Bond name is required.');
  if (!p.issuer) errs.push('Issuer is required.');
  if (!(p.nominal_price > 0)) errs.push('Nominal price must be greater than 0.');
  if (!(p.coupon_rate >= 0)) errs.push('Coupon rate must be 0 or greater.');
  if (!(p.tenor_years > 0 && Number.isInteger(p.tenor_years))) errs.push('Tenor must be a whole number of years.');
  if (!(p.min_investment >= 0)) errs.push('Minimum investment must be 0 or greater.');
  if (!Array.isArray(p.amort_percents) || p.amort_percents.length !== p.tenor_years) {
    errs.push('Amortization percentages must match the tenor in years.');
  } else {
    let remaining = 100;
    let total = 0;
    p.amort_percents.forEach(pc => {
      const r = remaining * (pc / 100);
      total += r;
      remaining -= r;
    });
    if (Math.abs(total - 100) > 0.1) {
      errs.push(`Amortization percentages must fully repay the principal (currently ${total.toFixed(2)}%).`);
    }
  }
  return errs;
}

module.exports = { sanitiseBondPayload, validateBondPayload };
