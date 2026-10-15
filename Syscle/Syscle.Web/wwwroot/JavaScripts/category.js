// CATEGORY VIEW: Decathlon-style product cards from SQL Server (parts and pictures the admin adds show up right away).
(async function () {
  const cat = new URLSearchParams(location.search).get('cat');
  if (!cat) { location.href = 'error.html'; return; }
  document.getElementById('dynamic-category-title').textContent = cat;
  const box = document.getElementById('product-body');
  let items = [];
  function render(q) {
    const list = items.filter(p => (p.name + ' ' + p.itemType).toLowerCase().includes(q || ''));
    box.innerHTML = list.map(productCard).join('') || '<div class="sy-empty">No items in this category yet.</div>';
  }
  try { items = await api('/api/products?category=' + encodeURIComponent(cat)); render(''); }
  catch (e) { location.href = 'error.html'; return; }
  initHeader(render);
  bindProductCards(box);
})();
