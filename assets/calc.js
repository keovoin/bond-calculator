/* =========================================================================
   Bond schedule calculation engine (client-side).
   ========================================================================= */

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const originalDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(originalDay, lastDay));
  return d;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function parseDateUTC(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function buildSchedule(bond, { investAmount, issueDate, residency }) {
  const couponRate = Number(bond.coupon_rate) / 100;
  const dayCount = Number(bond.day_count) || 365;
  const tenor = Number(bond.tenor_years);
  const whtPct =
    (residency === 'non-resident'
      ? Number(bond.wht_non_resident)
      : Number(bond.wht_resident)) / 100;
  const amort = (bond.amort_percents || []).slice(0, tenor);

  const totalMonths = tenor * 12;
  const issueDt = issueDate instanceof Date ? issueDate : parseDateUTC(issueDate);

  let outstanding = investAmount;
  let prevDate = issueDt;

  const rows = [];
  let tGross = 0, tTax = 0, tPrincipal = 0;

  for (let i = 1; i <= totalMonths; i++) {
    const paymentDate = addMonths(issueDt, i);
    const days = daysBetween(prevDate, paymentDate);

    const gross = outstanding * couponRate * (days / dayCount);
    const tax = gross * whtPct;
    const net = gross - tax;

    let principal = 0;
    const isAnnv = i % 12 === 0;
    if (isAnnv) {
      const year = i / 12;
      const pct = (amort[year - 1] ?? 0) / 100;
      principal = outstanding * pct;
      if (year === tenor) principal = outstanding;
    }

    const closing = outstanding - principal;

    rows.push({
      period: i,
      year: Math.ceil(i / 12),
      date: paymentDate.toISOString().slice(0, 10),
      daysInPeriod: days,
      openingPrincipal: round2(outstanding),
      grossInterest: round2(gross),
      tax: round2(tax),
      netInterest: round2(net),
      principalRepaid: round2(principal),
      totalCashToCustomer: round2(net + principal),
      closingPrincipal: round2(closing),
      isAnniversary: isAnnv,
    });

    tGross += gross;
    tTax += tax;
    tPrincipal += principal;

    outstanding = closing;
    prevDate = paymentDate;
  }

  return {
    rows,
    totals: {
      totalGrossInterest: round2(tGross),
      totalTax: round2(tTax),
      totalNetInterest: round2(tGross - tTax),
      totalPrincipalRepaid: round2(tPrincipal),
      totalCashToCustomer: round2((tGross - tTax) + tPrincipal),
    },
    inputs: {
      investAmount,
      issueDate: issueDt.toISOString().slice(0, 10),
      maturityDate: rows[rows.length - 1].date,
      residency,
      whtPct: whtPct * 100,
      couponRate: bond.coupon_rate,
      defaultRate: round2(Number(bond.coupon_rate) + Number(bond.default_spread)),
      tenor,
      dayCount,
      currency: bond.currency,
      bondUnits: Math.round(investAmount / Number(bond.nominal_price)),
    },
  };
}
