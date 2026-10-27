(async function () {
    const $ = id => document.getElementById(id);
    if (!$('inventory-grid')) return;
    let items = [], cats = [], editId = null, editImage = '', q = '', catFilter = '', firstLoad = true;
    let currentVariants = []; // { ColorName, ImagePath, File }

    let stockFilter = '';
    const statusOf = s => s === 0 ? '<span class="sy-chip bad">Out of stock</span>' : s <= 5 ? '<span class="sy-chip warn">Low</span>' : '<span class="sy-chip ok">In stock</span>';

    function render() {
        const rows = items.filter(p => (!catFilter || String(p.categoryId) === catFilter) && (!stockFilter || (stockFilter === 'out' ? p.stock === 0 : stockFilter === 'low' ? p.stock > 0 && p.stock <= 5 : p.stock > 5)) && (p.name + ' ' + p.category + ' ' + p.itemType).toLowerCase().includes(q));
        $('inventory-count').textContent = rows.length + ' of ' + items.length + ' items';
        const units = items.reduce((s, p) => s + p.stock, 0), value = items.reduce((s, p) => s + p.stock * p.price, 0);
        $('inv-stats').innerHTML = `<div class="sy-stat">Products<b>${items.length}</b></div><div class="sy-stat">Units in stock<b>${units}</b></div><div class="sy-stat">Stock value<b>${peso(value)}</b></div><div class="sy-stat ${items.some(p => p.stock > 0 && p.stock <= 5) ? 'hot' : ''}">Low stock<b>${items.filter(p => p.stock > 0 && p.stock <= 5).length}</b></div><div class="sy-stat ${items.some(p => p.stock === 0) ? 'hot' : ''}">Out of stock<b>${items.filter(p => p.stock === 0).length}</b></div>`;
        $('inventory-grid').innerHTML = rows.length ? rows.map(p => `
      <tr data-id="${p.id}"><td><div class="sy-prod">${p.image ? `<img class="sy-thumb" src="${esc(p.image)}" alt="">` : '<div class="sy-thumb"></div>'}<div><b>${esc(p.name)}</b><br><small class="sy-muted">${esc(p.itemType)} &middot; #${p.id}</small></div></div></td>
        <td>${esc(p.category)}</td><td>${p.sizes ? esc(p.sizes.split(',').map(s => s.trim()).join(', ')) : '-'}</td>
        <td>${(p.variants || []).length ? (p.variants || []).map(v => `<span class="sy-sizetag">${esc(v.colorName)}</span>`).join('') : '-'}</td>
        <td class="r">${peso(p.price)}</td>
        <td><div class="sy-qty"><button data-d="-1" aria-label="Remove one">-</button><span>${p.stock}</span><button data-d="1" aria-label="Add one">+</button></div></td>
        <td>${statusOf(p.stock)}</td>
        <td><div class="sy-actions"><button class="sy-btn small ${p.featured ? '' : 'ghost'}" data-feat="1" title="Show this item in the Featured row on the shop homepage">${p.featured ? '&#9733; Featured' : '&#9734; Feature'}</button><button class="sy-btn small" data-edit="1">Edit</button><button class="sy-x small" data-del="1">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="8" class="sy-empty">No items match. Try clearing the filters.</td></tr>';
    }

    async function load() {
        try {
            [items, cats] = await Promise.all([api('/api/admin/products'), api('/api/categories')]);
            $('cat-filter').innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
            $('cat-filter').value = catFilter; render();
            if (firstLoad) {
                firstLoad = false;
                const sp = new URLSearchParams(location.search);
                if (sp.get('cat')) { catFilter = sp.get('cat'); $('cat-filter').value = catFilter; render(); }
                if (sp.get('add')) openModal(null);
            }
        } catch (e) { toast(e.message, true); }
    }


    const TYPES = ['Frame','Fork','Handlebar','Stem','Seatpost','Saddle','Grips','Pedals','Crankset','Chain','Cassette','Derailleur','Shifter','Brake','Brake pad','Rotor','Wheel','Rim','Hub','Tire','Tube','Helmet','Gloves','Jersey','Lights','Bell','Pump','Lock','Bottle & cage','Rack','Fender','Tool','Other'];
    const SIZES = { '': '— No sizes —', 'S,M,L': 'Frame: S, M, L', '13,15,17,19,21': 'Frame: 13–21 in', '26,27.5,29': 'Wheel: 26, 27.5, 29', '700c': 'Wheel: 700c', '26x1.95,27.5x2.1,29x2.2': 'Tire: MTB sizes', '700x25c,700x28c,700x32c': 'Tire: road sizes', 'XS,S,M,L,XL': 'Clothing: XS–XL', 'Custom': 'Custom (type my own)…' };
    function fillTypeSel(cur) {
        const used = items.map(x => x.itemType).filter(Boolean);
        const list = [...new Set([...TYPES.filter(t => t !== 'Other'), ...used])].sort((a, b) => a.localeCompare(b));
        const sel = $('f-type-sel');
        sel.innerHTML = '<option value="">— Pick item type —</option>' + list.map(t => `<option>${esc(t)}</option>`).join('') + '<option value="__other">Other (type a new one)…</option>';
        const known = cur && list.some(t => t.toLowerCase() === cur.toLowerCase());
        sel.value = !cur ? '' : known ? list.find(t => t.toLowerCase() === cur.toLowerCase()) : '__other';
        $('f-type').style.display = sel.value === '__other' ? '' : 'none';
        $('f-type').value = !cur ? '' : known ? list.find(t => t.toLowerCase() === cur.toLowerCase()) : cur;
    }
    function fillSizeSel(cur) {
        const sel = $('f-size-sel');
        sel.innerHTML = Object.entries(SIZES).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
        sel.value = !cur ? '' : (SIZES[cur] !== undefined ? cur : 'Custom');
        $('f-sizes').style.display = sel.value === 'Custom' ? '' : 'none';
        $('f-sizes').value = cur || '';
    }
    $('f-type-sel').addEventListener('change', () => { const v = $('f-type-sel').value; const o = v === '__other'; $('f-type').style.display = o ? '' : 'none'; $('f-type').value = o ? '' : v; });
    $('f-size-sel').addEventListener('change', () => { const v = $('f-size-sel').value; const c = v === 'Custom'; $('f-sizes').style.display = c ? '' : 'none'; $('f-sizes').value = c ? '' : v; });
    const COLORS = ['Black','White','Red','Blue','Green','Yellow','Orange','Pink','Purple','Gray','Silver','Gold','Brown'];

    function renderVariants() {
        const box = $('variant-container');
        box.innerHTML = currentVariants.map((v, i) => `
      <div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">
        <select class="sy-input" style="margin:0; flex:1;" onchange="updateVariantName(${i}, this.value); renderVariants()"><option value="">— Pick color —</option>${[...new Set([...COLORS, ...(v.ColorName ? [v.ColorName] : [])])].map(c => `<option${c === v.ColorName ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <input type="file" class="sy-input" style="margin:0; width:150px;" accept="image/*" onchange="updateVariantFile(${i}, this)">
        ${v.ImagePath ? `<img src="${v.ImagePath}" style="height:30px; width:30px; object-fit:cover;">` : ''}
        <button type="button" class="sy-x" onclick="removeVariant(${i})">X</button>
      </div>
    `).join('');
    }

    window.updateVariantName = (i, val) => { currentVariants[i].ColorName = val; };
    window.updateVariantFile = (i, input) => { if (input.files[0]) currentVariants[i].File = input.files[0]; };
    window.removeVariant = (i) => { currentVariants.splice(i, 1); renderVariants(); };

    $('btn-add-variant').addEventListener('click', () => { currentVariants.push({ ColorName: '', ImagePath: '' }); renderVariants(); });

    function openModal(p) {
        if (!cats.length) return toast('Create a category first.', true);
        editId = p ? p.id : null; editImage = p && p.image ? p.image : '';
        currentVariants = p && p.variants ? p.variants.map(v => ({ ColorName: v.colorName, ImagePath: v.image })) : [];
        renderVariants();
        $('item-modal-title').textContent = p ? 'Edit item' : 'Add item';
        $('f-cat').innerHTML = cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
        $('f-cat').value = p ? p.categoryId : (catFilter || cats[0].id);
        fillTypeSel(p ? p.itemType : ''); $('f-name').value = p ? p.name : '';
        $('f-price').value = p ? p.price : ''; $('f-stock').value = p ? p.stock : ''; fillSizeSel(p && p.sizes ? p.sizes : '');
        $('f-image').value = '';
        const preview = $('f-preview'); if (preview) { preview.src = editImage || ''; preview.style.display = editImage ? 'block' : 'none'; }
        $('item-modal').style.display = 'flex';
    }

    $('f-image').addEventListener('change', () => { const f = $('f-image').files[0]; const p = $('f-preview'); p.src = f ? URL.createObjectURL(f) : editImage; p.style.display = 'block'; });
    $('stock-filter').addEventListener('change', () => { stockFilter = $('stock-filter').value; render(); });
    $('cat-filter').addEventListener('change', () => { catFilter = $('cat-filter').value; render(); });
    $('btn-add-item').addEventListener('click', () => openModal(null));
    $('f-cancel').addEventListener('click', () => { $('item-modal').style.display = 'none'; });

    $('f-save').addEventListener('click', async () => {
        const body = {
            categoryId: +$('f-cat').value, itemType: $('f-type').value, name: $('f-name').value,
            price: parseFloat($('f-price').value), stock: parseInt($('f-stock').value), sizes: $('f-sizes').value,
            variants: currentVariants.map(v => ({ ColorName: v.ColorName, ImagePath: v.ImagePath || '' }))
        };
        if (!body.name.trim() || !body.itemType.trim()) return toast('Enter the item type and product name.', true);
        if (isNaN(body.price) || body.price < 0 || isNaN(body.stock) || body.stock < 0) return toast('Enter a valid price and stock.', true);
        if (items.some(x => x.id !== editId && x.categoryId === body.categoryId && x.name.trim().toLowerCase() === body.name.trim().toLowerCase())) return toast('This item already exists in this category. Edit the existing one instead.', true);
        const cn = body.variants.map(v => (v.ColorName || '').trim().toLowerCase()).filter(Boolean); if (new Set(cn).size !== cn.length) return toast('Each color can only be added once.', true);
        try {
            const res = await api(editId ? '/api/admin/products/' + editId : '/api/admin/products', editId ? 'PUT' : 'POST', body);
            const prodId = editId || res.id;

            const file = $('f-image').files[0];
            if (file) { const fd = new FormData(); fd.append('image', file); await api('/api/admin/products/' + prodId + '/image', 'POST', fd); }

            for (let i = 0; i < currentVariants.length; i++) {
                if (currentVariants[i].File) {
                    const fd = new FormData(); fd.append('image', currentVariants[i].File);
                    const r = await api('/api/admin/products/' + prodId + '/variant-image', 'POST', fd);
                    currentVariants[i].ImagePath = r.path;
                }
            }
            // Save again to attach variant image paths
            body.variants = currentVariants.map(v => ({ ColorName: v.ColorName, ImagePath: v.ImagePath }));
            await api('/api/admin/products/' + prodId, 'PUT', body);

            $('item-modal').style.display = 'none'; await load(); toast('Saved.');
        } catch (e) { toast(e.message, true); }
    });

    $('inventory-grid').addEventListener('click', async e => {
        const card = e.target.closest('[data-id]'); if (!card) return;
        const id = +card.dataset.id, p = items.find(x => x.id === id);
        try {
            const d = e.target.closest('[data-d]');
            if (d) { await api(`/api/admin/products/${id}/stock`, 'POST', { delta: +d.dataset.d }); await load(); }
            else if (e.target.dataset.feat) { await api(`/api/admin/products/${id}/featured`, 'PUT', { featured: !p.featured }); await load(); toast(p.featured ? 'Removed from Featured.' : 'Added to Featured on the shop homepage.'); }
            else if (e.target.dataset.edit) openModal(p);
            else if (e.target.dataset.del && confirm(`Delete "${p.name}"?`)) { await api('/api/admin/products/' + id, 'DELETE'); await load(); }
        } catch (err) { toast(err.message, true); }
    });

    initHeader(t => { q = t; render(); }); load();
})();