/* Admin panel (fully client-side) */

const admin = {
  bonds: [],
  editing: null,
};

/* ---------- Session check on load ---------- */
(function init() {
  if (BC.getSession()) showDashboard(BC.getSession());
})();

/* ---------- Login ---------- */
document.getElementById('loginBtn').addEventListener('click', doLogin);
['loginUsername','loginPassword'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

async function doLogin() {
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  err.classList.add('hidden');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  await withLoading(btn, new Promise(r => setTimeout(r, 200)));

  const ok = await BC.verifyCredentials(username, password);
  if (!ok) {
    err.textContent = 'Invalid username or password.';
    err.classList.remove('hidden');
    return;
  }
  BC.setSession(username);
  showDashboard(username);
}

function showDashboard(username) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminScreen').classList.remove('hidden');
  document.getElementById('adminUsername').textContent = username;

  const banner = document.getElementById('mustChangeBanner');
  if (BC.isDefaultPassword()) {
    banner.classList.remove('hidden');
    switchTab('account');
    setTimeout(() => {
      const el = document.getElementById('newPw');
      if (el) el.focus();
    }, 200);
  } else {
    banner.classList.add('hidden');
  }

  loadBonds();
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  BC.clearSession();
  window.location.href = '/admin';
});

/* ---------- Tabs ---------- */
function switchTab(name) {
  document.querySelectorAll('[data-admin-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.adminTab === name)
  );
  document.querySelectorAll('#admin-bonds, #admin-settings, #admin-account').forEach(p =>
    p.classList.toggle('active', p.id === `admin-${name}`)
  );
}
document.querySelectorAll('[data-admin-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.adminTab));
});

document.getElementById('changePwHeaderBtn').addEventListener('click', () => {
  switchTab('account');
  setTimeout(() => {
    const el = document.getElementById('newPw');
    if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, 150);
});

/* ---------- Bonds list ---------- */
function loadBonds() {
  admin.bonds = BC.listBonds();
  renderBondsList();
}

function renderBondsList() {
  const wrap = document.getElementById('bondListWrap');
  if (!admin.bonds.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="icon">&#128181;</span>
        <p><strong>No bonds yet.</strong><br />Click "New bond" to create the first one.</p>
      </div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Issuer</th><th>Currency</th>
            <th class="num">Unit</th><th class="num">Coupon</th>
            <th class="num">Tenor</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${admin.bonds.map(b => `
            <tr>
              <td><code>${escapeHtml(b.code)}</code></td>
              <td>${escapeHtml(b.name)}</td>
              <td>${escapeHtml(b.issuer)}</td>
              <td>${escapeHtml(b.currency)}</td>
              <td class="num">${fmt.number(b.nominal_price)}</td>
              <td class="num">${b.coupon_rate}%</td>
              <td class="num">${b.tenor_years}y</td>
              <td><span class="pill ${b.is_active ? 'active' : 'inactive'}">${b.is_active ? 'Active' : 'Hidden'}</span></td>
              <td class="num"><button class="btn small ghost" data-edit="${escapeHtml(b.id)}">Edit</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  wrap.querySelectorAll('[data-edit]').forEach(el => {
    el.addEventListener('click', () => openBondEditor(el.dataset.edit));
  });
}

/* ---------- Bond editor modal ---------- */
const modal = document.getElementById('bondModal');
document.getElementById('newBondBtn').addEventListener('click', () => openBondEditor(null));
document.getElementById('bondModalClose').addEventListener('click', closeModal);
document.getElementById('cancelBondBtn').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

function openBondEditor(id) {
  admin.editing = id ? admin.bonds.find(b => b.id === id) : null;
  const isNew = !admin.editing;

  document.getElementById('bondModalTitle').textContent = isNew ? 'New bond' : `Edit: ${admin.editing.name}`;
  document.getElementById('deleteBondBtn').classList.toggle('hidden', isNew);
  document.getElementById('bondFormError').classList.add('hidden');

  const d = admin.editing || defaultBond();
  setVal('f_code', d.code);
  setVal('f_name', d.name);
  setVal('f_issuer', d.issuer);
  setVal('f_bond_type', d.bond_type);
  setVal('f_currency', d.currency);
  setVal('f_nominal_price', d.nominal_price);
  setVal('f_min_investment', d.min_investment);
  setVal('f_bonds_offered', d.bonds_offered);
  setVal('f_coupon_rate', d.coupon_rate);
  setVal('f_default_spread', d.default_spread);
  setVal('f_day_count', d.day_count);
  setVal('f_tenor_years', d.tenor_years);
  setVal('f_wht_resident', d.wht_resident);
  setVal('f_wht_non_resident', d.wht_non_resident);
  setVal('f_market', d.market || '');
  setVal('f_broker', d.broker || '');
  setVal('f_purpose', d.purpose || '');
  setVal('f_proof', d.proof || '');
  setVal('f_oracle_module', d.oracle_module || '');
  document.getElementById('f_is_active').value = d.is_active ? '1' : '0';

  renderAmortGrid(d.amort_percents);
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('f_code').focus(), 80);
}

function closeModal() {
  modal.classList.add('hidden');
  admin.editing = null;
}

function defaultBond() {
  return {
    code: '', name: '', issuer: '',
    bond_type: 'Unsecured and Subordinated in Registered Form Bond (Fixed Interest)',
    currency: 'USD',
    nominal_price: 25, min_investment: 500000, bonds_offered: 4100000,
    coupon_rate: 8.5, default_spread: 2, day_count: 365, tenor_years: 5,
    wht_resident: 6, wht_non_resident: 14,
    amort_percents: [20, 25, 33.33, 50, 100],
    market: 'Cambodia Securities Exchange (CSX)',
    broker: 'Royal Group Securities Plc.',
    purpose: 'General Corporate purpose',
    proof: 'Bond Certificate',
    oracle_module: 'Money Market Module',
    is_active: true,
  };
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

/* ---------- Amortization grid ---------- */
document.getElementById('f_tenor_years').addEventListener('input', () => {
  const tenor = Number(document.getElementById('f_tenor_years').value) || 0;
  const current = readAmort();
  const next = [];
  for (let i = 0; i < tenor; i++) {
    next.push(current[i] !== undefined ? current[i] : (i === tenor - 1 ? 100 : 0));
  }
  renderAmortGrid(next);
});

function renderAmortGrid(values) {
  const grid = document.getElementById('amortGrid');
  grid.innerHTML = '';
  values.forEach((v, i) => {
    const wrap = document.createElement('label');
    wrap.innerHTML = `Year ${i + 1}
      <input type="number" step="0.01" min="0" max="100" data-amort="${i}" value="${v}" />
      <span class="hint">% of remaining</span>`;
    grid.appendChild(wrap);
  });
  grid.querySelectorAll('input[data-amort]').forEach(inp => {
    inp.addEventListener('input', refreshAmortCheck);
  });
  refreshAmortCheck();
}

function readAmort() {
  return Array.from(document.querySelectorAll('#amortGrid input[data-amort]'))
    .map(i => Number(i.value) || 0);
}

function refreshAmortCheck() {
  const arr = readAmort();
  let rem = 100, total = 0;
  const perYear = arr.map(p => {
    const r = rem * (p / 100);
    total += r;
    rem -= r;
    return r;
  });
  const el = document.getElementById('amortCheck');
  const fmtArr = perYear.map(x => x.toFixed(2) + '%').join(', ');
  const ok = Math.abs(total - 100) < 0.1;
  el.innerHTML = `Drawdown per year (of original): ${fmtArr}. Total: <strong style="color:${ok ? 'var(--success)' : 'var(--danger)'}">${total.toFixed(2)}%</strong> ${ok ? '&#10003;' : '&#9888; must equal 100%'}`;
}

function validate(p) {
  const errs = [];
  if (!p.code) errs.push('Bond code is required.');
  if (!p.name) errs.push('Bond name is required.');
  if (!p.issuer) errs.push('Issuer is required.');
  if (!(p.nominal_price > 0)) errs.push('Unit price must be greater than 0.');
  if (!(p.coupon_rate >= 0)) errs.push('Coupon rate must be 0 or greater.');
  if (!(Number.isInteger(p.tenor_years) && p.tenor_years > 0)) errs.push('Tenor must be a whole number of years.');
  if (p.amort_percents.length !== p.tenor_years) errs.push('Amortization list must match the tenor.');
  let rem = 100, total = 0;
  p.amort_percents.forEach(pc => { const r = rem * (pc / 100); total += r; rem -= r; });
  if (Math.abs(total - 100) > 0.1) errs.push(`Amortization percentages must fully repay the principal (currently ${total.toFixed(2)}%).`);

  // Unique code check
  const dup = BC.listBonds().some(b => b.code === p.code && b.id !== (admin.editing && admin.editing.id));
  if (dup) errs.push('A bond with that code already exists.');
  return errs;
}

/* ---------- Save / delete ---------- */
document.getElementById('saveBondBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const err = document.getElementById('bondFormError');
  err.classList.add('hidden');

  const payload = {
    id: admin.editing ? admin.editing.id : null,
    code: v('f_code'),
    name: v('f_name'),
    issuer: v('f_issuer'),
    bond_type: v('f_bond_type'),
    currency: v('f_currency').toUpperCase() || 'USD',
    nominal_price: Number(v('f_nominal_price')),
    min_investment: Number(v('f_min_investment')),
    bonds_offered: Number(v('f_bonds_offered')),
    coupon_rate: Number(v('f_coupon_rate')),
    default_spread: Number(v('f_default_spread')),
    day_count: Number(v('f_day_count')),
    tenor_years: Number(v('f_tenor_years')),
    wht_resident: Number(v('f_wht_resident')),
    wht_non_resident: Number(v('f_wht_non_resident')),
    amort_percents: readAmort(),
    market: v('f_market'),
    broker: v('f_broker'),
    purpose: v('f_purpose'),
    proof: v('f_proof'),
    oracle_module: v('f_oracle_module'),
    is_active: v('f_is_active') === '1',
  };

  const errs = validate(payload);
  if (errs.length) {
    err.innerHTML = errs.map(m => `<div>&bull; ${escapeHtml(m)}</div>`).join('');
    err.classList.remove('hidden');
    err.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  await withLoading(btn, new Promise(r => setTimeout(r, 150)));
  BC.upsertBond(payload);
  toast(admin.editing ? 'Bond updated' : 'Bond created', 'success');
  closeModal();
  loadBonds();
});

document.getElementById('deleteBondBtn').addEventListener('click', () => {
  if (!admin.editing) return;
  if (!confirm(`Delete bond "${admin.editing.name}"? This cannot be undone.`)) return;
  BC.deleteBond(admin.editing.id);
  toast('Bond deleted', 'success');
  closeModal();
  loadBonds();
});

function v(id) { return (document.getElementById(id).value || '').toString().trim(); }

/* ---------- Change password ---------- */
document.getElementById('changePwBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const err = document.getElementById('pwError');
  const ok = document.getElementById('pwOk');
  err.classList.add('hidden');
  ok.classList.add('hidden');

  const n1 = document.getElementById('newPw').value;
  const n2 = document.getElementById('newPw2').value;

  if (n1.length < 4) { err.textContent = 'New password must be at least 4 characters.'; err.classList.remove('hidden'); return; }
  if (n1 !== n2) { err.textContent = 'New passwords do not match.'; err.classList.remove('hidden'); return; }

  await withLoading(btn, BC.setPassword(n1));
  ok.textContent = 'Password updated.';
  ok.classList.remove('hidden');
  document.getElementById('newPw').value = '';
  document.getElementById('newPw2').value = '';
  document.getElementById('mustChangeBanner').classList.add('hidden');
  toast('Password changed', 'success');
});

/* ---------- Reset all (danger zone) ---------- */
document.getElementById('resetDataBtn').addEventListener('click', () => {
  if (!confirm('This will delete all bonds and reset the admin password. Continue?')) return;
  BC.resetAll();
  toast('All data cleared', 'success');
  setTimeout(() => window.location.reload(), 600);
});

/* ---------- Site Settings ---------- */
(function initSettings() {
  const s = BC.getSettings();
  document.getElementById('settingsCreditText').value = s.creditText || '';
  renderLogoPreview(s.logoBase64);
})();

function renderLogoPreview(base64) {
  const el = document.getElementById('logoPreview');
  if (base64) {
    el.innerHTML = `<img src="${base64}" alt="Logo preview" style="max-height:80px; max-width:200px;" />`;
  } else {
    el.innerHTML = `<span class="muted small">No logo uploaded</span>`;
  }
}

document.getElementById('logoFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 300000) {
    toast('File too large. Please use an image under 200KB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result;
    const s = BC.getSettings();
    s.logoBase64 = base64;
    BC.saveSettings(s);
    renderLogoPreview(base64);
    toast('Logo uploaded', 'success');
  };
  reader.readAsDataURL(file);
});

document.getElementById('removeLogoBtn').addEventListener('click', () => {
  const s = BC.getSettings();
  s.logoBase64 = '';
  BC.saveSettings(s);
  renderLogoPreview('');
  document.getElementById('logoFileInput').value = '';
  toast('Logo removed', 'success');
});

document.getElementById('saveSettingsBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const s = BC.getSettings();
  s.creditText = document.getElementById('settingsCreditText').value.trim();
  await withLoading(btn, new Promise(r => setTimeout(r, 150)));
  BC.saveSettings(s);
  const ok = document.getElementById('settingsOk');
  ok.textContent = 'Settings saved.';
  ok.classList.remove('hidden');
  setTimeout(() => ok.classList.add('hidden'), 3000);
  toast('Settings saved', 'success');
});
