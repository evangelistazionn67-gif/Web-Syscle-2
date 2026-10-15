// ADMIN: STORE-FRONT CONFIG. Add / delete the category cards customers see (saved in SQL Server, images uploaded).
(async function () {
  const grid = document.querySelector('.category-grid'), modal = document.getElementById('add-category-modal');
  let cats = [];
  const picInput = document.createElement('input');
  picInput.type = 'file'; picInput.accept = 'image/*'; picInput.style.display = 'none'; document.body.appendChild(picInput);
  let pendingCat = null;
  picInput.addEventListener('change', async () => {
    const f = picInput.files[0]; if (!f || !pendingCat) return;
    const fd = new FormData(); fd.append('image', f);
    try { await api('/api/admin/categories/' + pendingCat + '/image', 'POST', fd); await load(); toast('Picture saved. Customers see it now.'); }
    catch (e) { toast(e.message, true); }
    picInput.value = '';
  });
  async function load() { try { cats = await api('/api/categories'); render(); } catch (e) { toast(e.message, true); } }
  function render() {
    grid.innerHTML = '';
    cats.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-card default-category';
      if (cat.image) card.style.backgroundImage = 'url(' + JSON.stringify(cat.image) + ')';
      const h = document.createElement('h3'); h.textContent = cat.name;
      const del = document.createElement('div'); del.className = 'delete-category-btn'; del.innerHTML = '&times;'; del.title = 'Delete category';
      del.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Delete the "${cat.name}" category and every item inside it? Past orders are kept.`)) return;
        try { await api('/api/admin/categories/' + cat.id, 'DELETE'); await load(); toast('Category deleted.'); } catch (err) { toast(err.message, true); }
      });
      const pic = document.createElement('div'); pic.className = 'sy-catpic'; pic.textContent = cat.image ? 'Change picture' : 'Add picture';
      pic.addEventListener('click', e => { e.stopPropagation(); pendingCat = cat.id; picInput.click(); });
      card.append(h, del, pic); grid.appendChild(card);
    });
    const add = document.createElement('div');
    add.className = 'category-card add-category'; add.innerHTML = '<h3>(Add Category)</h3>';
    add.addEventListener('click', () => { modal.style.display = 'flex'; });
    grid.appendChild(add);
  }
  document.getElementById('close-modal-btn').addEventListener('click', () => { modal.style.display = 'none'; });
  document.getElementById('btn-save-category').addEventListener('click', async () => {
    const name = document.getElementById('new-category-name').value.trim(), file = document.getElementById('new-category-file').files[0];
    if (!name) return toast('Please enter a category title.', true);
    const fd = new FormData(); fd.append('name', name); if (file) fd.append('image', file);
    try {
      await api('/api/admin/categories', 'POST', fd);
      document.getElementById('new-category-name').value = ''; document.getElementById('new-category-file').value = '';
      modal.style.display = 'none'; await load(); toast('Category added.');
    } catch (e) { toast(e.message, true); }
  });
  initHeader(null); load();
})();
