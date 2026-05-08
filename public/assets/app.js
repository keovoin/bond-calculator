/* Staff-facing calculator */

const state = {
  bonds: [],
  selectedBond: null,
  lastResult: null,
};

/* ---------- Tabs ---------- */
function activateTab(name) {
  document.querySelectorAll('.tabs .tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  document.querySelectorAll('.panel').forEach(p =>
    p.classList.toggle('active', p.id === `tab-${name}`)
  );
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.tabs .tab').forEach(btn =>
  btn.addEventListener('click', () => activateTab(btn.dataset.tab))
);

/* ---------- Bond loading ---------- */
async function loadBonds() {
  const wrap = document.getElementById('bondSelectWrap');
  try {
    const { bonds } = await fetchJson('/api/bonds');
    state.bonds = bonds;
    renderBondPicker();
  } catch (e) {
    wrap.innerHTML = `<div class="bond-empty">Could not load bonds: ${escapeHtml(e.message)}</div>`;
  }
}

function renderBondPicker() {
  const wrap = document.getElementById('bondSelectWrap');
  if (!state.bonds.length) {
    wrap.innerHTML = `
      <div class="bond-empty">
        <strong>No bonds available yet.</strong><br />
        An administrator needs to add a bond in the admin panel before calculations can be run.
      </div>`;
    return;
  }

  wrap.innerHTML = `<div class="bond-grid">${state.bonds.map(bondChip).join('')}</div>`;
  wrap.querySelectorAll('.bond-chip').forEach(el => {
    el.addEventListener('click', () => selectBond(Number(el.dataset.id)));
  });
  // Auto-select first
  if (!state.selectedBond && state.bonds[0]) selectBond(state.bonds[0].id);
}

function bondChip(b) {
  return `
    <button type="button" class="bond-chip" data-id="${b.id}">
      <span class="check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <span class="code">${escapeHtml(b.code)}</span>
      <div class="name">${escapeHtml(b.name)}</div>
      <div class="meta">
        <span><b>Coupon</b> ${b.coupon_rate}% p.a.</span>
        <span><b>Tenor</b> ${b.tenor_years}y</span>
        <span><b>Unit</b> ${b.currency} ${fmt.number(b.nominal_price)}</span>
      </div>
    </button>`;
}

function selectBond(id) {
  const b = state.bonds.find(x => x.id === id);
  if (!b) return;
  state.selectedBond = b;
  document.querySelectorAll('.bond-chip').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.id) === id);
  });
  document.getElementById('minHint').textContent =
    `Minimum: ${b.currency} ${fmt.number(b.min_investment)}`;
  document.getElementById('unitHint').textContent =
    `Each unit = ${b.currency} ${fmt.number(b.nominal_price)}`;
  syncUnitsFromAmount();
}

/* ---------- Amount <-> units two-way sync ---------- */
const amountEl = document.getElementById('investAmount');
const unitsEl = document.getElementById('bondUnits');

function syncUnitsFromAmount() {
  const b = state.selectedBond;
  if (!b) return;
  const v = parseFloat(amountEl.value);
  if (!isNaN(v) && b.nominal_price > 0) {
    unitsEl.value = Math.round(v / b.nominal_price);
  } else {
    unitsEl.value = '';
  }
}
function syncAmountFromUnits() {
  const b = state.selectedBond;
  if (!b) return;
  const v = parseFloat(unitsEl.value);
  if (!isNaN(v)) amountEl.value = (v * b.nominal_price).toFixed(2);
  else amountEl.value = '';
}
amountEl.addEventListener('input', syncUnitsFromAmount);
unitsEl.addEventListener('input', syncAmountFromUnits);

/* ---------- Calculate ---------- */
document.getElementById('calcBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const errBox = document.getElementById('calcError');
  errBox.classList.add('hidden');

  if (!state.selectedBond) {
    errBox.textContent = 'Please select a bond first.';
    errBox.classList.remove('hidden');
    return;
  }

  const payload = {
    bondId: state.selectedBond.id,
    investAmount: parseFloat(amountEl.value),
    issueDate: document.getElementById('issueDate').value,
    residency: document.getElementById('residency').value,
    customer: {
      name: document.getElementById('custName').value.trim(),
      ref: document.getElementById('custRef').value.trim(),
    },
  };

  try {
    const result = await withLoading(btn, fetchJson('/api/calculate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
    state.lastResult = result;
    renderSchedule(result);
    activateTab('schedule');
    toast('Schedule generated', 'success');
  } catch (err) {
    const errs = err.data && err.data.errors ? err.data.errors : [err.message];
    errBox.innerHTML = errs.map(e => `<div>&bull; ${escapeHtml(e)}</div>`).join('');
    errBox.classList.remove('hidden');
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('custName').value = '';
  document.getElementById('custRef').value = '';
  amountEl.value = '';
  unitsEl.value = '';
  document.getElementById('issueDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('residency').value = 'resident';
  document.getElementById('calcError').classList.add('hidden');
});

/* ---------- Schedule rendering ---------- */
function renderSchedule(res) {
  const { bond, customer, inputs, rows, totals } = res;
  const currency = bond.currency;

  document.getElementById('schedTitle').textContent =
    `${bond.issuer} — ${bond.name}`;
  document.getElementById('schedSubtitle').textContent =
    `Issued ${fmt.date(inputs.issueDate)} · Matures ${fmt.date(inputs.maturityDate)} · ${inputs.tenor} year${inputs.tenor > 1 ? 's' : ''} · Coupon ${inputs.couponRate}% p.a.`;

  const meta = [
    metaItem('Customer', customer && customer.name ? customer.name : '—'),
    customer && customer.ref ? metaItem('Customer Ref', customer.ref) : '',
    metaItem('Principal', `${currency} ${fmt.number(inputs.investAmount)}`),
    metaItem('Units', fmt.number(inputs.bondUnits)),
    metaItem('Residency / WHT', `${inputs.residency} · ${inputs.whtPct}%`),
    metaItem('Default rate', `${inputs.defaultRate}% p.a.`),
  ].join('');
  document.getElementById('customerMeta').innerHTML = meta;

  // Summary
  const sum = document.getElementById('summaryGrid');
  sum.innerHTML = [
    summaryItem('Principal', `${currency} ${fmt.number(inputs.investAmount)}`),
    summaryItem('Coupon rate', `${inputs.couponRate}% p.a.`),
    summaryItem('Maturity', fmt.date(inputs.maturityDate)),
    summaryItem('Total gross interest', `${currency} ${fmt.number(totals.totalGrossInterest.toFixed(2))}`),
    summaryItem('Total WHT', `${currency} ${fmt.number(totals.totalTax.toFixed(2))}`),
    summaryItem('Total net interest', `${currency} ${fmt.number(totals.totalNetInterest.toFixed(2))}`),
    summaryItem('Principal repaid', `${currency} ${fmt.number(totals.totalPrincipalRepaid.toFixed(2))}`),
    summaryItem('Total cash to customer', `${currency} ${fmt.number(totals.totalCashToCustomer.toFixed(2))}`, true),
  ].join('');

  // Table
  const body = rows.map(r => `
    <tr class="${r.isAnniversary ? 'anniversary' : ''}" style="animation-delay: ${Math.min(r.period, 30) * 12}ms">
      <td class="num">${r.period}</td>
      <td>${fmt.date(r.date)}</td>
      <td class="num">${r.daysInPeriod}</td>
      <td class="num">${fmt.number(r.openingPrincipal.toFixed(2))}</td>
      <td class="num">${fmt.number(r.grossInterest.toFixed(2))}</td>
      <td class="num">${fmt.number(r.tax.toFixed(2))}</td>
      <td class="num">${fmt.number(r.netInterest.toFixed(2))}</td>
      <td class="num">${r.principalRepaid > 0 ? fmt.number(r.principalRepaid.toFixed(2)) : '—'}</td>
      <td class="num">${fmt.number(r.totalCashToCustomer.toFixed(2))}</td>
      <td class="num">${fmt.number(r.closingPrincipal.toFixed(2))}</td>
    </tr>`).join('');

  document.getElementById('scheduleWrap').innerHTML = `
    <div class="table-wrap">
      <table class="schedule">
        <thead>
          <tr>
            <th>#</th>
            <th>Payment Date</th>
            <th>Days</th>
            <th>Opening (${currency})</th>
            <th>Gross Interest</th>
            <th>WHT</th>
            <th>Net Interest</th>
            <th>Principal Repaid</th>
            <th>Total Cash</th>
            <th>Closing (${currency})</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right">Totals</td>
            <td class="num">${fmt.number(totals.totalGrossInterest.toFixed(2))}</td>
            <td class="num">${fmt.number(totals.totalTax.toFixed(2))}</td>
            <td class="num">${fmt.number(totals.totalNetInterest.toFixed(2))}</td>
            <td class="num">${fmt.number(totals.totalPrincipalRepaid.toFixed(2))}</td>
            <td class="num">${fmt.number(totals.totalCashToCustomer.toFixed(2))}</td>
            <td class="num">—</td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  document.getElementById('printBtn').disabled = false;
  document.getElementById('exportCsvBtn').disabled = false;
}

function metaItem(label, value) {
  return `<div class="meta-item"><span class="label">${escapeHtml(label)}</span><span class="val">${escapeHtml(value)}</span></div>`;
}
function summaryItem(label, value, highlight = false) {
  return `<div class="summary-item${highlight ? ' highlight' : ''}"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

/* ---------- Print / CSV ---------- */
document.getElementById('printBtn').addEventListener('click', () => window.print());
document.getElementById('exportCsvBtn').addEventListener('click', () => {
  if (!state.lastResult) return;
  const { rows, bond, customer } = state.lastResult;
  const headers = ['Period','Payment Date','Days','Opening Principal','Gross Interest','WHT','Net Interest','Principal Repaid','Total Cash','Closing Principal'];
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push([
      r.period,
      r.date,
      r.daysInPeriod,
      r.openingPrincipal.toFixed(2),
      r.grossInterest.toFixed(2),
      r.tax.toFixed(2),
      r.netInterest.toFixed(2),
      r.principalRepaid.toFixed(2),
      r.totalCashToCustomer.toFixed(2),
      r.closingPrincipal.toFixed(2),
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = ((customer && customer.name) || bond.code || 'schedule').replace(/[^a-z0-9]+/gi, '_');
  a.href = url;
  a.download = `bond_schedule_${safe}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV downloaded', 'success');
});

/* ---------- Init ---------- */
document.getElementById('issueDate').value = new Date().toISOString().slice(0, 10);
loadBonds();
