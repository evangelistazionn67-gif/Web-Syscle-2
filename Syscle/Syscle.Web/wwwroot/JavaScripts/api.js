// Shared helpers for every page. Public file with no secrets: the server checks every request itself.
async function api(url, method = 'GET', body) {
  const opt = { method, headers: { 'X-Requested-With': 'syscle' } };
  if (body instanceof FormData) opt.body = body;
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(url, opt);
  let data = null;
  try { data = await r.json(); } catch (e) { /* empty body */ }
  if (r.status === 401) { location.href = '/index.html'; throw new Error('Please log in again.'); }
  if (!r.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
  return data;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d).toLocaleDateString() : '-';
const fmtDateTime = d => d ? new Date(d).toLocaleString() : '-';
function toast(msg, isError) {
  const t = document.createElement('div');
  t.className = 'sy-toast' + (isError ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
async function logoutUser() {
  try { await api('/api/auth/logout', 'POST'); } catch (e) { /* already logged out */ }
  location.href = '/index.html';
}
function initHeader(onSearch) {
  const input = document.getElementById('main-search-input');
  if (!input) return;
  const run = () => onSearch && onSearch(input.value.trim().toLowerCase());
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  const go = document.getElementById('execute-search'), clr = document.getElementById('clear-search');
  if (go) go.addEventListener('click', run);
  if (clr) clr.addEventListener('click', () => { input.value = ''; input.focus(); run(); });
}

// ---- Shared product card (Decathlon style) used by the storefront, the category pages and the home shelf ----
const BASKET_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 8H6"/></svg>';
const stockTag = s => s === 0 ? 'Sold out' : s <= 5 ? 'Only ' + s + ' left' : '';
function productCard(p) {
  return `<article class="sy-pcard" data-id="${p.id}" data-stock="${p.stock}">
    <div class="sy-pimg">${stockTag(p.stock) ? `<span class="sy-ptag">${stockTag(p.stock)}</span>` : ''}${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : '<span class="sy-pnone">No photo yet</span>'}</div>
    <div class="sy-pprice">${peso(p.price)}</div>
    <div class="sy-pname">${esc(p.name)}</div>
    <div class="sy-pbrand">${esc(p.itemType)}</div>
    <div class="sy-pbuy">
      <div class="sy-qty"><button data-d="-1" aria-label="Less">-</button><span>1</span><button data-d="1" aria-label="More">+</button></div>
      <button class="sy-add" aria-label="Buy"${p.stock > 0 ? '' : ' disabled'}><span>Buy</span>${BASKET_SVG}</button>
    </div></article>`;
}
function bindProductCards(box) {
  box.addEventListener('click', async e => {
    const card = e.target.closest('.sy-pcard'); if (!card) return;
    const span = card.querySelector('.sy-qty span'), stock = +card.dataset.stock;
    const d = e.target.closest('[data-d]');
    if (d) { span.textContent = Math.max(1, Math.min(stock || 1, (parseInt(span.textContent) || 1) + (+d.dataset.d))); return; }
    if (e.target.closest('.sy-add')) {
      const qty = parseInt(span.textContent) || 1, name = card.querySelector('.sy-pname').textContent;
      try { await api('/api/cart', 'POST', { productId: +card.dataset.id, qty }); toast('Added ' + qty + ' x ' + name + ' to your cart.'); span.textContent = 1; }
      catch (err) { toast(err.message, true); }
    }
  });
}
