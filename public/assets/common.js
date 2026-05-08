/* Shared UI helpers: toast, fetchJson, formatters */

const fmt = {
  money(n, currency = 'USD') {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  },
  number(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return new Intl.NumberFormat('en-US').format(n);
  },
  pct(n, digits = 2) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return `${Number(n).toFixed(digits)}%`;
  },
  date(iso) {
    if (!iso) return '-';
    // Render as DD MMM YYYY for humans
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  },
};

function toast(msg, type = 'info', ms = 3200) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
    ...options,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg =
      (data && (data.error || (data.errors && data.errors.join(' · ')))) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function withLoading(btn, promise) {
  btn.classList.add('loading');
  btn.disabled = true;
  return promise.finally(() => {
    btn.classList.remove('loading');
    btn.disabled = false;
  });
}

// Compact helper to create DOM nodes from HTML string safely scoped
function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
