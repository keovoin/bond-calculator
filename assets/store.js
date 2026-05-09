/* =========================================================================
   Client-side store — everything lives in localStorage.
   Keys:
     bc.bonds        JSON array of bond definitions
     bc.adminPwHash  SHA-256 hash of the admin password (null until set)
   ========================================================================= */

const BC = (() => {
  const BONDS_KEY = 'bc.bonds';
  const PW_KEY = 'bc.adminPwHash';

  // Default credentials used only when the admin hasn't set their own.
  // NOT displayed anywhere in the UI.
  const DEFAULT_USERNAME = 'keovoin';
  const DEFAULT_PASSWORD = 'admin';

  /* ---------- password hashing (SHA-256 via SubtleCrypto) ---------- */
  async function hash(text) {
    const buf = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function verifyCredentials(username, password) {
    if (username !== DEFAULT_USERNAME) return false;
    const stored = localStorage.getItem(PW_KEY);
    if (stored) {
      return (await hash(password)) === stored;
    }
    return password === DEFAULT_PASSWORD;
  }

  async function setPassword(newPassword) {
    const h = await hash(newPassword);
    localStorage.setItem(PW_KEY, h);
  }

  function isDefaultPassword() {
    return !localStorage.getItem(PW_KEY);
  }

  /* ---------- bonds ---------- */
  function listBonds() {
    try {
      const raw = localStorage.getItem(BONDS_KEY);
      if (!raw) return seedBonds();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : seedBonds();
    } catch {
      return seedBonds();
    }
  }

  function saveBonds(bonds) {
    localStorage.setItem(BONDS_KEY, JSON.stringify(bonds));
  }

  function getBond(id) {
    return listBonds().find(b => b.id === id) || null;
  }

  function upsertBond(bond) {
    const bonds = listBonds();
    if (bond.id) {
      const idx = bonds.findIndex(b => b.id === bond.id);
      if (idx >= 0) bonds[idx] = bond;
      else bonds.push(bond);
    } else {
      bond.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      bonds.push(bond);
    }
    saveBonds(bonds);
    return bond;
  }

  function deleteBond(id) {
    saveBonds(listBonds().filter(b => b.id !== id));
  }

  function seedBonds() {
    // Preload one sample bond so staff immediately see something useful.
    const seed = [{
      id: 'seed-csx-usd-001',
      code: 'CSX-USD-001',
      name: 'Series A — 5-Year Fixed Interest',
      issuer: 'Sample Issuer Plc.',
      bond_type: 'Unsecured and Subordinated in Registered Form Bond (Fixed Interest)',
      currency: 'USD',
      nominal_price: 25,
      coupon_rate: 8.5,
      default_spread: 2,
      tenor_years: 5,
      day_count: 365,
      min_investment: 500000,
      bonds_offered: 4100000,
      wht_resident: 6,
      wht_non_resident: 14,
      amort_percents: [20, 25, 33.33, 50, 100],
      market: 'Cambodia Securities Exchange (CSX)',
      broker: 'Royal Group Securities Plc.',
      purpose: 'General Corporate purpose',
      proof: 'Bond Certificate',
      oracle_module: 'Money Market Module',
      is_active: true,
    }];
    saveBonds(seed);
    return seed;
  }

  /* ---------- settings (credit text, logo) ---------- */
  const SETTINGS_KEY = 'bc.settings';

  const DEFAULT_SETTINGS = {
    creditText: 'Banking Operation - DBP (For Preview & Testing only)',
    logoBase64: '', // data:image/... string
  };

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function resetAll() {
    localStorage.removeItem(BONDS_KEY);
    localStorage.removeItem(PW_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }

  /* ---------- auth session (sessionStorage = per-tab) ---------- */
  const SESSION_KEY = 'bc.session';
  function setSession(username) {
    sessionStorage.setItem(SESSION_KEY, username);
  }
  function getSession() {
    return sessionStorage.getItem(SESSION_KEY);
  }
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  return {
    verifyCredentials,
    setPassword,
    isDefaultPassword,
    listBonds,
    getBond,
    upsertBond,
    deleteBond,
    getSettings,
    saveSettings,
    resetAll,
    setSession,
    getSession,
    clearSession,
    DEFAULT_USERNAME,
  };
})();
