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
const peso = n => '\u20b1' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d).toLocaleDateString() : '-';
const fmtDateTime = d => d ? new Date(d).toLocaleString() : '-';
function toast(msg, isError, linkText, linkHref) {
  const t = document.createElement('div');
  t.className = 'sy-toast' + (isError ? ' err' : '');
  t.append(msg);
  if (linkHref) { const a = document.createElement('a'); a.href = linkHref; a.textContent = linkText; t.appendChild(a); }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), linkHref ? 5000 : 3200);
}
async function logoutUser() {
  try { await api('/api/auth/logout', 'POST'); } catch (e) { /* already logged out */ }
  location.href = '/index.html';
}
// ---- pop-up layer (product details, order confirmation) ----
function showModal(html) {
  const ov = document.createElement('div');
  ov.className = 'sy-ov';
  ov.innerHTML = '<div class="sy-ovbox" role="dialog" aria-modal="true"><button class="sy-ovx" aria-label="Close">&times;</button>' + html + '</div>';
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.sy-ovx')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
  return { el: ov, close };
}
// ---- cart counter on the header cart icon, and the footer (customer pages only) ----
async function refreshCartBadge() {
  const icon = document.querySelector('.cart-icon'); if (!icon) return;
  const link = icon.closest('a'); if (!link || link.style.display === 'none') return;
  try {
    const items = await api('/api/cart'), n = items.reduce((s, i) => s + i.qty, 0);
    let b = link.querySelector('.sy-badge');
    if (!b) { link.style.position = 'relative'; b = document.createElement('span'); b.className = 'sy-badge'; link.appendChild(b); }
    b.textContent = n; b.style.display = n ? 'flex' : 'none';
  } catch (e) { /* not a customer page */ }
}
function addFooter() {
  if (document.querySelector('.sy-footer') || !document.querySelector('.cart-icon')) return;
  const f = document.createElement('footer'); f.className = 'sy-footer';
  f.innerHTML = '<div class="sy-fcols"><div><b>Web-Syscle</b><p>Shop &amp; Customize. Quality bicycle parts for every ride.</p></div>' +
    '<div><b>Shop</b><p><a href="homepage.html">All parts</a><br><a href="cart.html">My cart</a><br><a href="account.html">My account &amp; orders</a></p></div>' +
    '<div><b>How it works</b><p>1. Pick your parts<br>2. Review your cart<br>3. Pick up at the store and pay in Cash or GCash</p></div></div>' +
    '<div class="sy-fcopy">&copy; ' + new Date().getFullYear() + ' Web-Syscle. All rights reserved.</div>';
  document.body.appendChild(f);
}
// Header search: onSearch(text) filters the current page; with no handler, a customer search jumps to the home page results.
function initHeader(onSearch) {
  const isShop = !!document.querySelector('.cart-icon');
  if (isShop) { refreshCartBadge(); addFooter(); }
  const input = document.getElementById('main-search-input');
  if (!input) return;
  const run = () => { if (onSearch) onSearch(input.value.trim().toLowerCase()); };
  const submit = () => { if (!onSearch && isShop) location.href = 'homepage.html?q=' + encodeURIComponent(input.value.trim()); else run(); };
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  const go = document.getElementById('execute-search'), clr = document.getElementById('clear-search');
  if (go) go.addEventListener('click', submit);
  if (clr) clr.addEventListener('click', () => { input.value = ''; input.focus(); run(); });
}
// ---- Shared product card (Decathlon style). Clicking Buy / the picture / the name opens the product layer. ----
const BASKET_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 8H6"/></svg>';
const stockTag = s => s === 0 ? 'Sold out' : s <= 5 ? 'Only ' + s + ' left' : '';
function productCard(p) {
  return `<article class="sy-pcard" data-id="${p.id}">
    <div class="sy-pimg" data-open="1">${stockTag(p.stock) ? `<span class="sy-ptag">${stockTag(p.stock)}</span>` : ''}${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : '<span class="sy-pnone">No photo yet</span>'}</div>
    <div class="sy-pprice">${peso(p.price)}</div>
    <div class="sy-pname" data-open="1">${esc(p.name)}</div>
    <div class="sy-pbrand">${esc(p.itemType)}</div>
    <div class="sy-pbuy"><span class="sy-pstock">${p.stock > 0 ? p.stock + ' in stock' : ''}</span>
      <button class="sy-add" data-open="1" aria-label="Buy ${esc(p.name)}"${p.stock > 0 ? '' : ' disabled'}><span>Buy</span>${BASKET_SVG}</button></div>
  </article>`;
}
function bindProductCards(box, getItems) {
  box.addEventListener('click', e => {
    const card = e.target.closest('.sy-pcard');
    if (!card || !e.target.closest('[data-open]')) return;
    const p = getItems().find(x => x.id === +card.dataset.id);
    if (p) openProduct(p);
  });
}
function openProduct(p) {
  const ok = p.stock > 0, maxQ = Math.max(1, p.stock);
  const m = showModal(`<div class="sy-pm">
    <div class="sy-pm-img">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : '<span class="sy-pnone">No photo yet</span>'}</div>
    <div class="sy-pm-info">
      <div class="sy-pbrand">${esc(p.category || '')}${p.category ? ' &middot; ' : ''}${esc(p.itemType)}</div>
      <h2>${esc(p.name)}</h2>
      <div class="sy-pm-price">${peso(p.price)}</div>
      <div class="sy-pm-stock${p.stock <= 5 ? ' low' : ''}">${ok ? (p.stock <= 5 ? 'Only ' + p.stock + ' left' : 'In stock') : 'Sold out'}</div>
      <div class="sy-pm-row"><span>Quantity</span><div class="sy-qty"><button data-q="-1" aria-label="Less">-</button><span id="pm-qty">1</span><button data-q="1" aria-label="More">+</button></div></div>
      <div class="sy-pm-total">Subtotal: <b id="pm-sub">${peso(p.price)}</b></div>
      <ul class="sy-pm-perks"><li>Store pick-up, pay with Cash or GCash</li><li>Genuine bicycle parts</li><li>Review everything in your cart before you pay</li></ul>
      <div class="sy-pm-actions"><button class="sy-btn ghost" id="pm-add"${ok ? '' : ' disabled'}>Add to Cart</button><button class="sy-btn accent" id="pm-buy"${ok ? '' : ' disabled'}>Buy Now</button></div>
    </div></div>`);
  let q = 1;
  const upd = () => { m.el.querySelector('#pm-qty').textContent = q; m.el.querySelector('#pm-sub').textContent = peso(p.price * q); };
  m.el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { q = Math.max(1, Math.min(maxQ, q + (+b.dataset.q))); upd(); }));
  const add = async goCart => {
    try {
      await api('/api/cart', 'POST', { productId: p.id, qty: q });
      m.close();
      if (goCart) location.href = 'cart.html';
      else { toast('Added ' + q + ' x ' + p.name + '.', false, 'View cart', 'cart.html'); refreshCartBadge(); }
    } catch (e) { toast(e.message, true); }
  };
  m.el.querySelector('#pm-add').addEventListener('click', () => add(false));
  m.el.querySelector('#pm-buy').addEventListener('click', () => add(true));
}
function sortItems(list, mode) {
  const a = list.slice();
  if (mode === 'low') a.sort((x, y) => x.price - y.price);
  else if (mode === 'high') a.sort((x, y) => y.price - x.price);
  else if (mode === 'name') a.sort((x, y) => x.name.localeCompare(y.name));
  return a;
}
