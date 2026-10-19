// CATEGORY VIEW: product cards for one bike type, with sorting. Buy opens the product layer.
(async function () {
  const cat = new URLSearchParams(location.search).get('cat');
  if (!cat) { location.href = 'error.html'; return; }
  document.getElementById('dynamic-category-title').textContent = cat;
  const box = document.getElementById('product-body'), sortEl = document.getElementById('sort-select');
  let items = [], q = '', mode = '';
  function render() {
    const list = sortItems(items.filter(p => (p.name + ' ' + p.itemType).toLowerCase().includes(q)), mode);
    box.innerHTML = list.map(productCard).join('') || '<div class="sy-empty">No items in this category yet.</div>';
  }
  try { items = await api('/api/products?category=' + encodeURIComponent(cat)); render(); }
  catch (e) { location.href = 'error.html'; return; }
  initHeader(t => { q = t; render(); });
  if (sortEl) sortEl.addEventListener('change', () => { mode = sortEl.value; render(); });
  bindProductCards(box, () => items);
})();
