// CUSTOMER HOME: bike-type tiles, then a shelf of every part with filter buttons, sorting and an in-stock switch.
(async function () {
  const grid = document.querySelector('.category-grid'), shelf = document.getElementById('shelf-products'), chips = document.getElementById('shelf-chips'), count = document.getElementById('shelf-count');
  const sortEl = document.getElementById('shelf-sort'), stockEl = document.getElementById('shelf-instock'), input = document.getElementById('main-search-input');
  const start = new URLSearchParams(location.search).get('q') || '';
  let cats = [], items = [], q = start.toLowerCase(), filter = '', mode = '', inStock = false;
  if (input && start) input.value = start;
  function renderCats() {
    grid.innerHTML = '';
    const list = cats.filter(c => c.name.toLowerCase().includes(q));
    if (!list.length) { grid.innerHTML = '<div class="sy-empty">No categories found.</div>'; return; }
    list.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-card default-category';
      if (cat.image) card.style.backgroundImage = 'url(' + JSON.stringify(cat.image) + ')';
      const h = document.createElement('h3'); h.textContent = cat.name;
      card.appendChild(h);
      card.addEventListener('click', () => { location.href = 'category-view.html?cat=' + encodeURIComponent(cat.name); });
      grid.appendChild(card);
    });
  }
  function renderShelf() {
    chips.innerHTML = [''].concat(cats.map(c => c.name)).map(n => `<button class="sy-fbtn${filter === n ? ' on' : ''}" data-cat="${esc(n)}">${n ? esc(n) : 'All'}</button>`).join('');
    const list = sortItems(items.filter(p => (!filter || p.category === filter) && (!inStock || p.stock > 0) && (p.name + ' ' + p.itemType + ' ' + p.category).toLowerCase().includes(q)), mode);
    count.textContent = '(' + list.length + ')';
    shelf.innerHTML = list.map(productCard).join('') || '<div class="sy-empty">No parts found. Try another search or filter.</div>';
  }
  function bundleCard(b) {
    return `<article class="sy-bcard"><div class="sy-bsave">Save ${b.discountPercent}%</div>
      <div class="sy-bimgs">${b.items.map(i => `<div class="sy-bimg">${i.image ? `<img src="${esc(i.image)}" alt="${esc(i.name)}" loading="lazy">` : ''}</div>`).join('<span class="sy-bplus">+</span>')}</div>
      <div class="sy-bnames">${b.items.map(i => esc(i.name)).join('<br>')}</div>
      <div class="sy-bprice"><s>${peso(b.listPrice)}</s> <b>${peso(b.price)}</b><small>You save ${peso(b.saving)}</small></div>
      <button class="sy-btn accent" data-addbundle="${b.id}">Add bundle to cart</button></article>`;
  }
  const bundleBox = document.getElementById('bundle-list');
  bundleBox.addEventListener('click', async e => {
    const id = e.target.dataset.addbundle; if (!id) return;
    try { await api('/api/cart/bundle', 'POST', { bundleId: +id, qty: 1 }); toast('Bundle added. The discount shows in your cart.', false, 'View cart', 'cart.html'); refreshCartBadge(); }
    catch (err) { toast(err.message, true); }
  });
  chips.addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { filter = b.dataset.cat; renderShelf(); } });
  if (sortEl) sortEl.addEventListener('change', () => { mode = sortEl.value; renderShelf(); });
  if (stockEl) stockEl.addEventListener('change', () => { inStock = stockEl.checked; renderShelf(); });
  try { [cats, items] = await Promise.all([api('/api/categories'), api('/api/products')]); renderCats(); renderShelf(); }
  catch (e) { location.href = 'error.html'; return; }
  try {
    const bundles = await api('/api/bundles');
    if (bundles.length) { bundleBox.innerHTML = bundles.map(bundleCard).join(''); document.getElementById('bundles').hidden = false; }
  } catch (e) { /* bundles are optional */ }
  initHeader(t => { q = t; renderCats(); renderShelf(); });
  bindProductCards(shelf, () => items);
})();
