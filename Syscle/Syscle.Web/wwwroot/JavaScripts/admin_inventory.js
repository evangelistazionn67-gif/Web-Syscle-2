// ADMIN: INVENTORY. Add / edit / delete parts with pictures. What you save here is exactly what customers see.
(async function () {
  const $ = id => document.getElementById(id);
  let items = [], cats = [], editId = null, editImage = '', q = '', catFilter = '';
  const tag = s => s === 0 ? 'Out of stock' : s <= 5 ? 'Only ' + s + ' left' : '';
  function render() {
    const rows = items.filter(p => (!catFilter || String(p.categoryId) === catFilter) && (p.name + ' ' + p.category + ' ' + p.itemType).toLowerCase().includes(q));
    $('inventory-count').textContent = rows.length + ' item(s)';
    $('inventory-grid').innerHTML = rows.length ? rows.map(p => `
      <article class="sy-pcard" data-id="${p.id}">
        <div class="sy-pimg">${tag(p.stock) ? `<span class="sy-ptag">${tag(p.stock)}</span>` : ''}${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : '<span class="sy-pnone">No photo yet</span>'}</div>
        <div class="sy-pprice">${peso(p.price)}</div><div class="sy-pname">${esc(p.name)}</div><div class="sy-pbrand">${esc(p.category)} · ${esc(p.itemType)}</div>
        <div class="sy-pbuy"><div class="sy-qty" title="Stock on hand"><button data-d="-1" aria-label="Remove one">-</button><span>${p.stock}</span><button data-d="1" aria-label="Add one">+</button></div>
          <div class="sy-pactions"><button class="sy-btn small" data-edit="1">Edit</button><button class="sy-x" data-del="1">Delete</button></div></div>
      </article>`).join('') : '<div class="sy-empty">No items here yet. Click ADD ITEM to create one.</div>';
  }
  async function load() {
    try {
      [items, cats] = await Promise.all([api('/api/admin/products'), api('/api/categories')]);
      $('cat-filter').innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
      $('cat-filter').value = catFilter; render();
    } catch (e) { toast(e.message, true); }
  }
  function showPreview(src) { const i = $('f-preview'); i.src = src || ''; i.style.display = src ? 'block' : 'none'; }
  function openModal(p) {
    if (!cats.length) return toast('Create a category first (Store-front Config).', true);
    editId = p ? p.id : null; editImage = p && p.image ? p.image : '';
    $('item-modal-title').textContent = p ? 'Edit item' : 'Add item';
    $('f-cat').innerHTML = cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    $('f-cat').value = p ? p.categoryId : cats[0].id;
    $('f-type').value = p ? p.itemType : ''; $('f-name').value = p ? p.name : '';
    $('f-price').value = p ? p.price : ''; $('f-stock').value = p ? p.stock : '';
    $('f-image').value = ''; showPreview(editImage);
    $('item-modal').style.display = 'flex';
  }
  $('f-image').addEventListener('change', () => { const f = $('f-image').files[0]; showPreview(f ? URL.createObjectURL(f) : editImage); });
  $('cat-filter').addEventListener('change', () => { catFilter = $('cat-filter').value; render(); });
  $('btn-add-item').addEventListener('click', () => openModal(null));
  $('f-cancel').addEventListener('click', () => { $('item-modal').style.display = 'none'; });
  $('f-save').addEventListener('click', async () => {
    const body = { categoryId: +$('f-cat').value, itemType: $('f-type').value, name: $('f-name').value, price: parseFloat($('f-price').value), stock: parseInt($('f-stock').value) };
    if (isNaN(body.price) || isNaN(body.stock)) return toast('Enter a price and a stock number.', true);
    try {
      const res = await api(editId ? '/api/admin/products/' + editId : '/api/admin/products', editId ? 'PUT' : 'POST', body);
      const file = $('f-image').files[0];
      if (file) { const fd = new FormData(); fd.append('image', file); await api('/api/admin/products/' + (editId || res.id) + '/image', 'POST', fd); }
      $('item-modal').style.display = 'none'; await load(); toast('Saved. Customers see it now.');
    } catch (e) { toast(e.message, true); }
  });
  $('inventory-grid').addEventListener('click', async e => {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const id = +card.dataset.id, p = items.find(x => x.id === id);
    try {
      const d = e.target.closest('[data-d]');
      if (d) { await api(`/api/admin/products/${id}/stock`, 'POST', { delta: +d.dataset.d }); await load(); }
      else if (e.target.dataset.edit) openModal(p);
      else if (e.target.dataset.del && confirm(`Delete "${p.name}"? Past orders keep their record.`)) { await api('/api/admin/products/' + id, 'DELETE'); await load(); toast('Item deleted.'); }
    } catch (err) { toast(err.message, true); }
  });
  initHeader(t => { q = t; render(); }); load();
})();
