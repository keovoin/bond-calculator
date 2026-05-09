/* Shared UI helpers */

const fmt = {
  number(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return new Intl.NumberFormat('en-US').format(n);
  },
  money2(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n);
  },
  date(iso) {
    if (!iso) return '-';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  },
};

function toast(msg, type = 'info', ms = 2800) {
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

function withLoading(btn, promise) {
  btn.classList.add('loading');
  btn.disabled = true;
  return Promise.resolve(promise).finally(() => {
    btn.classList.remove('loading');
    btn.disabled = false;
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
