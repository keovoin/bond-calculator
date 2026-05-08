const express = require('express');
const { listBonds, getBond } = require('../db');
const { buildSchedule } = require('../calc');

const router = express.Router();

// Public summary of active bonds for the staff dropdown
router.get('/bonds', (req, res) => {
  const bonds = listBonds({ activeOnly: true }).map(b => ({
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
});

router.get('/bonds/:id', (req, res) => {
  const bond = getBond(Number(req.params.id));
  if (!bond || !bond.is_active) return res.status(404).json({ error: 'Bond not found' });
  res.json({ bond });
});

router.post('/calculate', (req, res) => {
  const { bondId, investAmount, issueDate, residency, customer } = req.body || {};

  const errors = [];
  const bond = getBond(Number(bondId));
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
  if (!['resident', 'non-resident'].includes(residency)) {
    errors.push('Residency is required.');
  }

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
});

module.exports = router;
