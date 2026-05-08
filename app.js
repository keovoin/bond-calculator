/* =========================================================================
   Bond Calculator — Core Logic
   =========================================================================
   Terms (per issuer config):
     - Fixed Interest Bond, USD, Tenor 5 years from issue date.
     - Coupon 8.5% p.a., paid monthly to customer current account.
       Coupons are accrued daily (interest & tax) and credited on schedule
       date with no holiday delay.
     - Principal is amortized annually on a straight-line basis by repaying
       a percentage of the REMAINING principal each anniversary:
         Y1: 20%, Y2: 25%, Y3: 33.33%, Y4: 50%, Y5: 100%
       That sequence reduces principal in equal 20% chunks of the original.
     - WHT: Resident 6%, Non-Resident 14% — applied to each coupon payment.
     - Default rate (Coupon + 2%) is noted for admin reference only; it is
     - applied manually case-by-case when a coupon payment is late.
   ========================================================================= */

/* ---------- Default Configuration ---------- */
const DEFAULT_CONFIG = {
  issuer: "",
  bondType: "Unsecured and Subordinated in Registered Form Bond (Fixed Interest)",
  currency: "USD",
  market: "Cambodia Securities Exchange (CSX)",
  broker: "Royal Group Securities Plc.",
  purpose: "General Corporate purpose",
  proof: "Bond Certificate",
  oracle: "Money Market Module",

  couponRate: 8.5,        // % per annum
  defaultSpread: 2.0,     // % over coupon rate for late-payment default rate
  tenorYears: 5,
  dayCount: 365,
  whtResident: 6,
  whtNonResident: 14,

  nominalUsd: 25,
  nominalKhr: 100000,
  minInvest: 500000,
  bondsOffered: 4100000,
  offerKhr: "410,000,000,000",
  offerUsd: "100,000,000",

  // Percentage of REMAINING principal repaid each anniversary year
  amortPercents: [20, 25, 33.33, 50, 100],

  adminPassword: "admin",
};

const STORAGE_KEY = "bondCalcConfig.v1";

/* ---------- State ---------- */
let config = loadConfig();
let lastResult = null; // persisted calculation used by schedule tab

/* ---------- Helpers ---------- */
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    // Merge to pick up any new default fields introduced later
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function fmtMoney(n, currency = "USD") {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n) {
  return `${Number(n).toFixed(2)}%`;
}

function fmtDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return "-";
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const MS = 86400000;
  return Math.round((b - a) / MS);
}

function addMonths(date, months) {
  // Preserve day-of-month. If target month is shorter, fall back to last day.
  const d = new Date(date.getTime());
  const originalDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(originalDay, lastDay));
  return d;
}

function parseDateUTC(yyyyMmDd) {
  const parts = yyyyMmDd.split("-").map(Number);
  if (parts.length !== 3) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ---------- Core Calculation ---------- */
/**
 * Generate the monthly coupon + annual principal schedule.
 *
 * @param {Object} opts
 * @param {number} opts.investAmount  USD principal invested
 * @param {Date}   opts.issueDate     UTC date
 * @param {"resident"|"non-resident"} opts.residency
 * @returns {Object}
 */
function buildSchedule({ investAmount, issueDate, residency }) {
  const couponRate = config.couponRate / 100;
  const dayCount = config.dayCount;
  const tenorYears = config.tenorYears;
  const whtPct = (residency === "non-resident" ? config.whtNonResident : config.whtResident) / 100;
  const amort = config.amortPercents.slice(0, tenorYears);

  const totalMonths = tenorYears * 12;

  let outstanding = investAmount;
  let prevDate = new Date(issueDate.getTime());

  const rows = [];

  let totalGrossInterest = 0;
  let totalTax = 0;
  let totalNetInterest = 0;
  let totalPrincipalRepaid = 0;

  for (let i = 1; i <= totalMonths; i++) {
    const paymentDate = addMonths(issueDate, i);
    const days = daysBetween(prevDate, paymentDate);

    // Daily-accrued coupon interest on current outstanding principal
    const gross = outstanding * couponRate * (days / dayCount);
    const tax = gross * whtPct;
    const net = gross - tax;

    // Principal repayment: only on anniversaries (every 12th month)
    let principalRepaid = 0;
    let yearIndex = null;
    const isAnniversary = i % 12 === 0;
    if (isAnniversary) {
      yearIndex = i / 12;
      const pct = (amort[yearIndex - 1] ?? 0) / 100;
      principalRepaid = outstanding * pct;
      // Avoid floating drift on final redemption
      if (yearIndex === tenorYears) principalRepaid = outstanding;
    }

    const outstandingAfter = outstanding - principalRepaid;

    rows.push({
      period: i,
      year: Math.ceil(i / 12),
      date: paymentDate,
      daysInPeriod: days,
      openingPrincipal: outstanding,
      grossInterest: round2(gross),
      tax: round2(tax),
      netInterest: round2(net),
      principalRepaid: round2(principalRepaid),
      totalCashToCustomer: round2(net + principalRepaid),
      closingPrincipal: round2(outstandingAfter),
      isAnniversary,
    });

    totalGrossInterest += gross;
    totalTax += tax;
    totalNetInterest += (gross - tax);
    totalPrincipalRepaid += principalRepaid;

    outstanding = outstandingAfter;
    prevDate = paymentDate;
  }

  return {
    rows,
    totals: {
      totalGrossInterest: round2(totalGrossInterest),
      totalTax: round2(totalTax),
      totalNetInterest: round2(totalNetInterest),
      totalPrincipalRepaid: round2(totalPrincipalRepaid),
      totalCashToCustomer: round2(totalNetInterest + totalPrincipalRepaid),
    },
    inputs: {
      investAmount,
      issueDate,
      residency,
      whtPct: whtPct * 100,
      couponRate: config.couponRate,
      tenorYears,
      dayCount,
    },
  };
}

/* ============================================================
   UI — Tabs
   ============================================================ */
function activateTab(name) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.classList.toggle("active", p.id === `tab-${name}`);
  });
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

/* ============================================================
   UI — Staff Calculator
   ============================================================ */
const elInvest = document.getElementById("investAmount");
const elUnits = document.getElementById("bondUnits");
const elMinHint = document.getElementById("minHint");
const elUnitHint = document.getElementById("unitHint");

function syncHints() {
  elMinHint.textContent = `Minimum: ${fmtMoney(config.minInvest)}`;
  elUnitHint.textContent = `Each unit = ${fmtMoney(config.nominalUsd)}`;
  document.getElementById("headerIssuer").textContent =
    config.issuer ? `${config.issuer} — ${config.bondType}` : config.bondType;
}

// Two-way sync between amount and units
elInvest.addEventListener("input", () => {
  const v = parseFloat(elInvest.value);
  if (!isNaN(v) && config.nominalUsd > 0) {
    elUnits.value = Math.round(v / config.nominalUsd);
  } else {
    elUnits.value = "";
  }
});
elUnits.addEventListener("input", () => {
  const v = parseFloat(elUnits.value);
  if (!isNaN(v)) {
    elInvest.value = (v * config.nominalUsd).toFixed(2);
  } else {
    elInvest.value = "";
  }
});

document.getElementById("calcBtn").addEventListener("click", () => {
  const errBox = document.getElementById("calcError");
  errBox.classList.add("hidden");

  const name = document.getElementById("custName").value.trim();
  const ref = document.getElementById("custRef").value.trim();
  const amount = parseFloat(elInvest.value);
  const dateStr = document.getElementById("issueDate").value;
  const residency = document.getElementById("residency").value;

  const errs = [];
  if (!amount || amount <= 0) errs.push("Investment amount is required.");
  if (amount && amount < config.minInvest) errs.push(`Minimum investment is ${fmtMoney(config.minInvest)}.`);
  if (config.nominalUsd > 0 && amount) {
    const rem = Math.abs((amount / config.nominalUsd) - Math.round(amount / config.nominalUsd));
    if (rem > 0.0001) errs.push(`Amount must be a multiple of the nominal value (${fmtMoney(config.nominalUsd)} per unit).`);
  }
  if (!dateStr) errs.push("Issue date is required.");

  if (errs.length) {
    errBox.innerHTML = errs.map(e => `<div>• ${e}</div>`).join("");
    errBox.classList.remove("hidden");
    return;
  }

  const issueDate = parseDateUTC(dateStr);
  const result = buildSchedule({ investAmount: amount, issueDate, residency });

  lastResult = {
    ...result,
    customer: { name, ref, issueDateStr: dateStr },
  };

  renderSummary(lastResult);
  renderSchedule(lastResult);
  activateTab("schedule");
});

document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("custName").value = "";
  document.getElementById("custRef").value = "";
  elInvest.value = "";
  elUnits.value = "";
  document.getElementById("issueDate").value = "";
  document.getElementById("residency").value = "resident";
  document.getElementById("calcError").classList.add("hidden");
  document.getElementById("summaryCard").style.display = "none";
});

function renderSummary(result) {
  const card = document.getElementById("summaryCard");
  const grid = document.getElementById("summaryGrid");
  const { inputs, totals, rows } = result;
  const maturity = rows[rows.length - 1].date;
  const units = Math.round(inputs.investAmount / config.nominalUsd);

  grid.innerHTML = `
    ${summaryItem("Customer", result.customer.name || "—")}
    ${summaryItem("Principal (USD)", fmtMoney(inputs.investAmount))}
    ${summaryItem("Bond Units", units.toLocaleString())}
    ${summaryItem("Issue Date", fmtDate(inputs.issueDate))}
    ${summaryItem("Maturity Date", fmtDate(maturity))}
    ${summaryItem("Coupon Rate", `${inputs.couponRate}% p.a.`)}
    ${summaryItem("WHT", `${inputs.whtPct}% (${inputs.residency})`)}
    ${summaryItem("Total Gross Interest", fmtMoney(totals.totalGrossInterest))}
    ${summaryItem("Total WHT", fmtMoney(totals.totalTax))}
    ${summaryItem("Total Net Interest", fmtMoney(totals.totalNetInterest))}
    ${summaryItem("Principal Repaid", fmtMoney(totals.totalPrincipalRepaid))}
    ${summaryItem("Total Cash to Customer", fmtMoney(totals.totalCashToCustomer))}
  `;
  card.style.display = "";
}

function summaryItem(label, value) {
  return `<div class="summary-item"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

/* ============================================================
   UI — Customer Schedule
   ============================================================ */
function renderSchedule(result) {
  const wrap = document.getElementById("scheduleWrap");
  const sub = document.getElementById("schedSubtitle");
  const title = document.getElementById("schedIssuerTitle");
  const meta = document.getElementById("customerMeta");

  title.textContent = (config.issuer ? `${config.issuer} — ` : "") + "Bond Investment Schedule";

  const { inputs, rows, totals, customer } = result;
  const maturity = rows[rows.length - 1].date;

  sub.textContent = `Issued ${fmtDate(inputs.issueDate)} · Matures ${fmtDate(maturity)} · Tenor ${inputs.tenorYears} years · Coupon ${inputs.couponRate}% p.a.`;

  meta.innerHTML = `
    ${metaItem("Customer", customer.name || "—")}
    ${customer.ref ? metaItem("Customer Ref", customer.ref) : ""}
    ${metaItem("Principal", fmtMoney(inputs.investAmount))}
    ${metaItem("Units", Math.round(inputs.investAmount / config.nominalUsd).toLocaleString())}
    ${metaItem("Currency", config.currency)}
    ${metaItem("Residency / WHT", `${inputs.residency} · ${inputs.whtPct}%`)}
  `;

  const body = rows.map(r => `
    <tr class="${r.isAnniversary ? "anniversary" : ""}">
      <td class="num">${r.period}</td>
      <td>${fmtDate(r.date)}</td>
      <td class="num">${r.daysInPeriod}</td>
      <td class="num">${fmtMoney(r.openingPrincipal)}</td>
      <td class="num">${fmtMoney(r.grossInterest)}</td>
      <td class="num">${fmtMoney(r.tax)}</td>
      <td class="num">${fmtMoney(r.netInterest)}</td>
      <td class="num">${r.principalRepaid > 0 ? fmtMoney(r.principalRepaid) : "—"}</td>
      <td class="num">${fmtMoney(r.totalCashToCustomer)}</td>
      <td class="num">${fmtMoney(r.closingPrincipal)}</td>
    </tr>
  `).join("");

  wrap.classList.remove("empty-state");
  wrap.innerHTML = `
    <div class="schedule-table-wrap">
      <table class="schedule">
        <thead>
          <tr>
            <th>#</th>
            <th>Payment Date</th>
            <th>Days</th>
            <th>Opening Principal</th>
            <th>Gross Interest</th>
            <th>WHT</th>
            <th>Net Interest</th>
            <th>Principal Repaid</th>
            <th>Total Cash</th>
            <th>Closing Principal</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right">Totals</td>
            <td class="num">${fmtMoney(totals.totalGrossInterest)}</td>
            <td class="num">${fmtMoney(totals.totalTax)}</td>
            <td class="num">${fmtMoney(totals.totalNetInterest)}</td>
            <td class="num">${fmtMoney(totals.totalPrincipalRepaid)}</td>
            <td class="num">${fmtMoney(totals.totalCashToCustomer)}</td>
            <td class="num">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="muted small" style="margin-top:0.75rem">
      Coupon interest is accrued daily and credited on the scheduled date (no holiday delay).
      Principal is repaid annually on the anniversary of the issue date.
      Default rate (Coupon + ${config.defaultSpread}% = ${(config.couponRate + config.defaultSpread).toFixed(2)}% p.a.) applies only to late coupon payments and is calculated manually case by case.
    </p>
  `;

  document.getElementById("printBtn").disabled = false;
  document.getElementById("exportCsvBtn").disabled = false;
}

function metaItem(label, value) {
  return `<div class="meta-item"><span class="label">${label}</span><span class="val">${value}</span></div>`;
}

document.getElementById("printBtn").addEventListener("click", () => window.print());

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  if (!lastResult) return;
  const headers = ["Period","Payment Date","Days","Opening Principal","Gross Interest","WHT","Net Interest","Principal Repaid","Total Cash","Closing Principal"];
  const lines = [headers.join(",")];
  lastResult.rows.forEach(r => {
    lines.push([
      r.period,
      fmtDate(r.date),
      r.daysInPeriod,
      r.openingPrincipal.toFixed(2),
      r.grossInterest.toFixed(2),
      r.tax.toFixed(2),
      r.netInterest.toFixed(2),
      r.principalRepaid.toFixed(2),
      r.totalCashToCustomer.toFixed(2),
      r.closingPrincipal.toFixed(2),
    ].join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (lastResult.customer.name || "schedule").replace(/[^a-z0-9]+/gi, "_");
  a.href = url;
  a.download = `bond_schedule_${safe}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ============================================================
   UI — Admin Panel
   ============================================================ */
const adminLogin = document.getElementById("adminLogin");
const adminContent = document.getElementById("adminContent");

document.getElementById("loginBtn").addEventListener("click", () => {
  const pw = document.getElementById("adminPassword").value;
  const err = document.getElementById("loginError");
  if (pw === config.adminPassword) {
    err.classList.add("hidden");
    adminLogin.classList.add("hidden");
    adminContent.classList.remove("hidden");
    populateAdminForm();
  } else {
    err.textContent = "Incorrect password.";
    err.classList.remove("hidden");
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  adminLogin.classList.remove("hidden");
  adminContent.classList.add("hidden");
  document.getElementById("adminPassword").value = "";
});

function populateAdminForm() {
  const keys = [
    "issuer","bondType","currency","market","broker","purpose","proof","oracle",
    "couponRate","defaultSpread","tenorYears","dayCount","whtResident","whtNonResident",
    "nominalUsd","nominalKhr","minInvest","bondsOffered","offerKhr","offerUsd",
  ];
  keys.forEach(k => {
    const el = document.getElementById("cfg_" + k);
    if (el) el.value = config[k];
  });

  // Amortization dynamic grid
  renderAmortGrid();

  document.getElementById("cfg_newPassword").value = "";
  document.getElementById("cfgStatus").classList.add("hidden");
}

function renderAmortGrid() {
  const grid = document.getElementById("amortGrid");
  const n = Number(document.getElementById("cfg_tenor").value) || config.tenorYears;
  // Ensure array length matches tenor
  while (config.amortPercents.length < n) config.amortPercents.push(100);
  config.amortPercents = config.amortPercents.slice(0, n);

  grid.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const wrap = document.createElement("label");
    wrap.innerHTML = `Year ${i + 1} (% of remaining)
      <input type="number" step="0.01" min="0" max="100" data-amort-year="${i}" value="${config.amortPercents[i] ?? 0}" />`;
    grid.appendChild(wrap);
  }
  grid.querySelectorAll("input[data-amort-year]").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.amortYear);
      config.amortPercents[idx] = parseFloat(inp.value) || 0;
      refreshAmortCheck();
    });
  });
  refreshAmortCheck();
}

function refreshAmortCheck() {
  // Simulate cumulative drawdown from 100% principal
  let remaining = 100;
  const drawdown = [];
  config.amortPercents.forEach(p => {
    const repaid = remaining * (p / 100);
    drawdown.push(repaid);
    remaining -= repaid;
  });
  const total = drawdown.reduce((a, b) => a + b, 0);
  const msg = `Each year repays ${drawdown.map(d => d.toFixed(2) + "%").join(", ")} of original. Total ${total.toFixed(2)}%.`;
  document.getElementById("amortCheck").textContent = msg +
    (Math.abs(total - 100) < 0.01 ? " ✓" : " ⚠ must equal 100%");
}

document.getElementById("cfg_tenor").addEventListener("input", () => renderAmortGrid());

document.getElementById("saveCfgBtn").addEventListener("click", () => {
  const status = document.getElementById("cfgStatus");
  // Collect values
  const textKeys = ["issuer","bondType","currency","market","broker","purpose","proof","oracle","offerKhr","offerUsd"];
  textKeys.forEach(k => { config[k] = document.getElementById("cfg_" + k).value.trim(); });

  const numKeys = ["couponRate","defaultSpread","tenorYears","dayCount","whtResident","whtNonResident","nominalUsd","nominalKhr","minInvest","bondsOffered"];
  numKeys.forEach(k => {
    const v = parseFloat(document.getElementById("cfg_" + k).value);
    if (!isNaN(v)) config[k] = v;
  });

  const newPw = document.getElementById("cfg_newPassword").value;
  if (newPw) config.adminPassword = newPw;

  // Validate amort totals (cumulative drawdown must be 100%)
  let remaining = 100;
  let total = 0;
  config.amortPercents.forEach(p => {
    const r = remaining * (p / 100);
    total += r;
    remaining -= r;
  });
  if (Math.abs(total - 100) > 0.05) {
    status.textContent = `Warning: amortization percentages only repay ${total.toFixed(2)}% of original principal. Saved anyway — please review.`;
    status.className = "error-box";
  } else {
    status.textContent = "Configuration saved.";
    status.className = "status-box";
  }

  saveConfig();
  syncHints();
  status.classList.remove("hidden");
  setTimeout(() => status.classList.add("hidden"), 4000);
});

document.getElementById("resetCfgBtn").addEventListener("click", () => {
  if (!confirm("Restore all configuration to factory defaults? This also resets the admin password to 'admin'.")) return;
  config = { ...DEFAULT_CONFIG };
  saveConfig();
  populateAdminForm();
  syncHints();
});

/* ============================================================
   Init
   ============================================================ */
(function init() {
  syncHints();

  // Default issue date = today
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  document.getElementById("issueDate").value = iso;
})();
