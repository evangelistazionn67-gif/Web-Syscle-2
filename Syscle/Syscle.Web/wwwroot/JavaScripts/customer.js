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
  chips.addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { filter = b.dataset.cat; renderShelf(); } });
  if (sortEl) sortEl.addEventListener('change', () => { mode = sortEl.value; renderShelf(); });
  if (stockEl) stockEl.addEventListener('change', () => { inStock = stockEl.checked; renderShelf(); });
  try { [cats, items] = await Promise.all([api('/api/categories'), api('/api/products')]); renderCats(); renderShelf(); }
  catch (e) { location.href = 'error.html'; return; }
  initHeader(t => { q = t; renderCats(); renderShelf(); });
  bindProductCards(shelf, () => items);
})();
