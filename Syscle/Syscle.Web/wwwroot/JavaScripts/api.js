let signedOutShown = false;
async function api(url, method = 'GET', body) {
    const opt = { method, headers: { 'X-Requested-With': 'syscle' } };
    if (body instanceof FormData) opt.body = body;
    else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    let data = null; try { data = await r.json(); } catch (e) { }
    if (r.status === 401 && window.SY_ME === null) { const g = new Error('Please log in first.'); g.status = 401; g.guest = true; throw g; }
    if (r.status === 401) { handleSignedOut(r.headers.get('X-Session-Reason')); throw new Error('Please log in again.'); }
    if (!r.ok) { const err = new Error((data && data.error) || 'Something went wrong.'); err.status = r.status; err.data = data; throw err; }
    return data;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '\u20b1' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d).toLocaleDateString() : '-';
const fmtDateTime = d => d ? new Date(d).toLocaleString() : '-';
function toast(msg, isError, linkText, linkHref) {
    const t = document.createElement('div'); t.className = 'sy-toast' + (isError ? ' err' : ''); t.append(msg);
    if (linkHref) { const a = document.createElement('a'); a.href = linkHref; a.textContent = linkText; t.appendChild(a); }
    document.body.appendChild(t); setTimeout(() => t.remove(), linkHref ? 5000 : 3200);
}
async function logoutUser() { signedOutShown = true; try { await api('/api/auth/logout', 'POST'); } catch (e) { } location.href = '/index.html'; }
const loginUrl = () => '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
const chipClass = st => ({ Completed: 'ok', Ready: 'ok', Preparing: 'info', 'Out for Delivery': 'info', Pending: 'warn', Cancelled: 'bad' }[st] || 'mute');
const statusChip = st => `<span class="sy-chip ${chipClass(st)}">${esc(st)}</span>`;
const payChip = o => o.paymentStatus === 'Paid' ? '<span class="sy-chip ok">Paid</span>' : (o.status === 'Cancelled' || !/online|gcash|maya/i.test(o.payment || '')) ? '' : '<span class="sy-chip warn">Unpaid</span>';
const stars = r => r ? '<span class="st">' + '\u2605'.repeat(Math.round(r)) + '\u2606'.repeat(5 - Math.round(r)) + '</span>' : '';

function showModal(html, onClose) {
    const ov = document.createElement('div'); ov.className = 'sy-ov';
    ov.innerHTML = '<div class="sy-ovbox" role="dialog" aria-modal="true"><button class="sy-ovx" aria-label="Close">&times;</button>' + html + '</div>';
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.sy-ovx')) close(); });
    document.addEventListener('keydown', onKey); document.body.appendChild(ov);
    return { el: ov, close };
}

async function refreshCartBadge() {
    await (window.SY_READY || Promise.resolve());
    if (!window.SY_ME) return;
    const icon = document.querySelector('.cart-icon'); if (!icon) return;
    const link = icon.closest('a'); if (!link) return;
    try {
        const items = await api('/api/cart'), n = items.reduce((s, i) => s + i.qty, 0);
        let b = link.querySelector('.sy-badge');
        if (!b) { b = document.createElement('span'); b.className = 'sy-badge'; link.appendChild(b); }
        b.textContent = n; b.classList.toggle('show', n > 0); b.style.display = n ? 'flex' : 'none';
    } catch (e) { }
}

function initHeader(onSearch) {
    (window.SY_READY || Promise.resolve()).then(() => {
        const isShop = document.body.dataset.area === 'shop';
        if (isShop) refreshCartBadge();
        const input = document.getElementById('main-search-input');
        if (!input) return;
        const run = () => { if (onSearch) onSearch(input.value.trim().toLowerCase()); };
        const submit = () => { if (!onSearch && isShop) location.href = '/Pages/homepage.html?q=' + encodeURIComponent(input.value.trim()); else run(); };
        input.addEventListener('input', run);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        const go = document.getElementById('execute-search'), clr = document.getElementById('clear-search');
        if (go) go.addEventListener('click', submit);
        if (clr) clr.addEventListener('click', () => { input.value = ''; input.focus(); run(); });
        const q0 = new URLSearchParams(location.search).get('q'); if (q0 && !input.value) input.value = q0;
    });
}

const BASKET_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 8H6"/></svg>';
const stockTag = s => s === 0 ? 'Sold out' : s <= 5 ? 'Only ' + s + ' left' : '';

function productCard(p) {
    const tag = p.stock === 0 ? '<span class="sy-ptag out">Sold out</span>' : p.stock <= 5 ? `<span class="sy-ptag">Only ${p.stock} left</span>` : '';
    return `<article class="sy-pcard" data-id="${p.id}">
    <div class="sy-pimg" data-open="1">${tag}${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : '<span class="sy-pnone">No photo</span>'}</div>
    <div class="sy-pbrand">${esc(p.itemType)}</div>
    <div class="sy-pname" data-open="1">${esc(p.name)}</div>
    <div class="sy-prate">${p.reviews ? stars(p.rating) + ' ' + p.rating + ' (' + p.reviews + ')' : '<span>No reviews yet</span>'}${p.sold ? ' &middot; ' + p.sold + ' sold' : ''}</div>
    <div class="sy-pprice">${peso(p.price)}</div>
    ${p.sizes ? `<div class="sy-psizes">Sizes: ${p.sizes.split(',').map(s => esc(s.trim())).join(' &middot; ')}</div>` : ''}
    <div class="sy-pbuy"><span class="sy-pstock">${p.stock > 0 ? p.stock + ' in stock' : ''}</span>
      <button class="sy-add" data-open="1" aria-label="Buy ${esc(p.name)}"${p.stock > 0 ? '' : ' disabled'}><span>Buy</span>${BASKET_SVG}</button></div>
  </article>`;
}

function bindProductCards(box, getItems) {
    box.addEventListener('click', e => {
        const card = e.target.closest('.sy-pcard'); if (!card || !e.target.closest('[data-open]')) return;
        const p = getItems().find(x => x.id === +card.dataset.id); if (p) openProduct(p);
    });
}

function openProduct(p) {
    const ok = p.stock > 0, maxQ = Math.max(1, p.stock), sizes = (p.sizes || '').split(',').map(s => s.trim()).filter(Boolean);
    const variants = p.variants || []; let selectedColor = '', size = '', q = 1;
    const m = showModal(`<div class="sy-pm">
    <div class="sy-pm-img"><img id="pm-img" src="${esc(p.image)}" alt="${esc(p.name)}"></div>
    <div class="sy-pm-info">
      <div class="sy-pbrand">${esc(p.category || '')}${p.category ? ' &middot; ' : ''}${esc(p.itemType)}</div>
      <h2>${esc(p.name)}</h2>
      <div class="sy-prate">${p.reviews ? stars(p.rating) + ' ' + p.rating + ' (' + p.reviews + ' reviews)' : 'No reviews yet'}${p.sold ? ' &middot; ' + p.sold + ' sold' : ''}</div>
      <div class="sy-pm-price">${peso(p.price)}</div>
      <div class="sy-pm-stock${p.stock <= 5 ? ' low' : ''}">${ok ? (p.stock <= 5 ? 'Only ' + p.stock + ' left' : 'In stock (' + p.stock + ')') : 'Sold out'}</div>
      ${variants.length ? `<div class="sy-pm-row"><span>Color</span><select class="sy-select" id="pm-color"><option value="">Choose a color</option>${variants.map(v => `<option value="${esc(v.colorName)}" data-img="${esc(v.image)}">${esc(v.colorName)}</option>`).join('')}</select></div>` : ''}
      ${sizes.length ? `<div class="sy-pm-row"><span>Size</span><select class="sy-select" id="pm-size"><option value="">Choose a size</option>${sizes.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>` : ''}
      <div class="sy-pm-row"><span>Quantity</span><div class="sy-qty"><button type="button" data-q="-1" aria-label="Less">-</button><span id="pm-qty">1</span><button type="button" data-q="1" aria-label="More">+</button></div></div>
      <div class="sy-pm-total">Subtotal: <b id="pm-sub">${peso(p.price)}</b></div>
      <div class="sy-pm-actions"><button class="sy-btn ghost" id="pm-add"${ok ? '' : ' disabled'}>Add to Cart</button><button class="sy-btn accent" id="pm-buy"${ok ? '' : ' disabled'}>Buy Now</button></div>
      ${window.SY_ME ? '' : '<p class="sy-sub" style="margin:12px 0 0">You are browsing as a guest. <a href="' + loginUrl() + '">Log in</a> to buy.</p>'}
    </div>
    <div class="sy-pm-rev"><h3>Reviews</h3><div class="list" id="pm-reviews">Loading...</div>
      ${window.SY_ME ? `<div class="form"><select id="rev-rating" class="sy-input"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select><input id="rev-text" class="sy-input" placeholder="Write a review..." maxlength="300"><button class="sy-btn" id="rev-submit">Post</button></div>` : ''}
    </div></div>`);
    const $ = id => m.el.querySelector(id);
    if ($('#pm-color')) $('#pm-color').addEventListener('change', e => { selectedColor = e.target.value; const o = e.target.selectedOptions[0]; if (o && o.dataset.img) $('#pm-img').src = o.dataset.img; });
    if ($('#pm-size')) $('#pm-size').addEventListener('change', e => { size = e.target.value; });
    const upd = () => { $('#pm-qty').textContent = q; $('#pm-sub').textContent = peso(p.price * q); };
    m.el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { q = Math.max(1, Math.min(maxQ, q + (+b.dataset.q))); upd(); }));
    const add = async goCart => {
        if (!window.SY_ME) { location.href = loginUrl(); return; }
        if (sizes.length && !size) { toast('Please choose a size.', true); return; }
        if (variants.length && !selectedColor) { toast('Please choose a color.', true); return; }
        try {
            await api('/api/cart', 'POST', { productId: p.id, qty: q, size, color: selectedColor });
            m.close();
            if (goCart) location.href = '/Pages/cart.html';
            else { toast('Added to cart.', false, 'View cart', '/Pages/cart.html'); refreshCartBadge(); }
        } catch (e) { toast(e.message, true); }
    };
    $('#pm-add').addEventListener('click', () => add(false));
    $('#pm-buy').addEventListener('click', () => add(true));
    api('/api/products/' + p.id + '/reviews').then(reviews => {
        $('#pm-reviews').innerHTML = reviews.length ? reviews.map(r => `<div class="it"><b>${esc(r.username)}</b> ${stars(r.rating)} <small class="sy-muted">${fmtDate(r.date)}</small><br>${esc(r.comment)}</div>`).join('') : 'No reviews yet. Be the first!';
    }).catch(() => { $('#pm-reviews').textContent = 'Could not load reviews.'; });
    const rs = $('#rev-submit');
    if (rs) rs.addEventListener('click', async () => {
        try { await api('/api/products/' + p.id + '/reviews', 'POST', { rating: +$('#rev-rating').value, comment: $('#rev-text').value }); toast('Review posted!'); m.close(); openProduct(p); }
        catch (e) { toast(e.message, true); }
    });
}

function sortItems(list, mode) {
    const a = list.slice();
    if (mode === 'low') a.sort((x, y) => x.price - y.price);
    else if (mode === 'high') a.sort((x, y) => y.price - x.price);
    else if (mode === 'top') a.sort((x, y) => (y.sold || 0) - (x.sold || 0));
    else if (mode === 'rated') a.sort((x, y) => (y.rating || 0) - (x.rating || 0) || (y.reviews || 0) - (x.reviews || 0));
    else if (mode === 'name') a.sort((x, y) => x.name.localeCompare(y.name));
    return a;
}

function handleSignedOut(reason) {
    if (signedOutShown) return; signedOutShown = true;
    const msg = reason === 'suspended' ? 'Account suspended.' : (reason === 'replaced' || reason === 'changed') ? 'Signed in elsewhere.' : 'Session ended.';
    showModal(`<div class="sy-done"><h2>Signed Out</h2><p>${msg}</p><div class="sy-pm-actions"><a class="sy-btn accent" href="/login.html">Log in</a></div></div>`, () => { location.href = '/login.html'; });
}
function startSessionWatch() { (window.SY_READY || Promise.resolve(window.SY_ME)).then(me => { if (!me) return; watch(); }); }
function watch() { const ping = async () => { try { await api('/api/auth/ping'); } catch (e) { } }; setInterval(ping, 5000); document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); }); }
startSessionWatch();

// Chart helper: the server only returns days/months/years that had sales, so fill the empty ones with zero (otherwise the chart skips them).
function fillSeries(series, period, from, to) {
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const m = new Map((series || []).map(s => [s.label, s])), out = [], d = new Date(from + 'T00:00'), end = new Date(to + 'T00:00');
    if (isNaN(d) || isNaN(end)) return series || [];
    const add = k => out.push(m.get(k) || { label: k, sales: 0, orders: 0 });
    if (period === 'daily') for (; d <= end && out.length < 400; d.setDate(d.getDate() + 1)) add(iso(d));
    else if (period === 'weekly') {
        const key = x => { const t = new Date(x.getFullYear(), x.getMonth(), x.getDate()); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); const w1 = new Date(t.getFullYear(), 0, 4); const wk = 1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); return t.getFullYear() + '-W' + String(wk).padStart(2, '0'); };
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); for (; d <= end && out.length < 400; d.setDate(d.getDate() + 7)) add(key(d));
    }
    else if (period === 'monthly') { d.setDate(1); for (; d <= end && out.length < 400; d.setMonth(d.getMonth() + 1)) add(iso(d).slice(0, 7)); }
    else for (let y = d.getFullYear(); y <= end.getFullYear() && out.length < 400; y++) add(String(y));
    return out;
}
