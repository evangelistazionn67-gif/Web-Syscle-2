// ADMIN: BUNDLE OFFERS. The system pairs slow-moving parts with popular ones at 5-10% off; admins can also create, edit or switch off bundles.
(async function () {
  const $ = id => document.getElementById(id);
  let bundles = [], filled = false;
  async function load() {
    try {
      const [d, p] = await Promise.all([api('/api/admin/bundles'), api('/api/admin/products')]);
      bundles = d.bundles;
      if (!filled && p.length) {
        const opts = p.map(x => `<option value="${x.id}">${esc(x.name)} (${peso(x.price)})</option>`).join('');
        $('nb-a').innerHTML = opts; $('nb-b').innerHTML = opts; if (p[1]) $('nb-b').value = p[1].id; filled = true;
      }
      $('bundle-note').textContent = `The system looks for parts that have not sold for ${d.slowDays}+ days and pairs each with a popular part at 5-10% off (the longer it sits, the bigger the discount). You can also create, edit or turn off bundles here.`;
      $('bundle-table-body').innerHTML = bundles.length ? bundles.map(b => `<tr data-id="${b.id}">
        <td style="text-align:left"><b>${esc(b.name)}</b><br><small>${b.auto ? 'Made by the system' : 'Made by an admin'}</small></td>
        <td style="text-align:left">${b.items.map(i => esc(i.name) + ' x' + i.qty).join('<br>')}</td>
        <td>${peso(b.listPrice)}</td><td>${peso(b.price)}</td>
        <td><select data-pct="1" aria-label="Discount">${[5, 6, 7, 8, 9, 10].map(n => `<option${n === b.discountPercent ? ' selected' : ''}>${n}</option>`).join('')}</select> %</td>
        <td><span class="sy-chip ${b.isActive && b.inStock ? 'ok' : 'warn'}">${!b.inStock ? 'Out of stock' : b.isActive ? 'Live' : 'Off'}</span></td>
        <td><button class="sy-btn small" data-toggle="1">${b.isActive ? 'Turn off' : 'Turn on'}</button> <button class="sy-x" data-del="1">Delete</button></td></tr>`).join('')
        : '<tr><td colspan="7" class="sy-empty">No bundles yet. Click "Find slow-moving items now" or create one.</td></tr>';
    } catch (e) { toast(e.message, true); }
  }
  $('bundle-table-body').addEventListener('click', async e => {
    const row = e.target.closest('tr[data-id]'); if (!row) return;
    const id = +row.dataset.id, b = bundles.find(x => x.id === id);
    try {
      if (e.target.dataset.toggle) { await api('/api/admin/bundles/' + id, 'PUT', { isActive: !b.isActive }); await load(); }
      else if (e.target.dataset.del && confirm('Delete this bundle?')) { await api('/api/admin/bundles/' + id, 'DELETE'); await load(); }
    } catch (err) { toast(err.message, true); }
  });
  $('bundle-table-body').addEventListener('change', async e => {
    if (!e.target.dataset.pct) return;
    const row = e.target.closest('tr[data-id]');
    try { await api('/api/admin/bundles/' + row.dataset.id, 'PUT', { discountPercent: +e.target.value }); await load(); toast('Discount updated.'); } catch (err) { toast(err.message, true); }
  });
  $('nb-create').addEventListener('click', async () => {
    try { await api('/api/admin/bundles', 'POST', { productA: +$('nb-a').value, productB: +$('nb-b').value, discountPercent: +$('nb-pct').value }); await load(); toast('Bundle created. Customers see it now.'); }
    catch (e) { toast(e.message, true); }
  });
  $('nb-generate').addEventListener('click', async () => {
    try { const r = await api('/api/admin/bundles/generate', 'POST', {}); await load(); toast(r.made ? r.made + ' bundle(s) created.' : 'No slow-moving items found right now.'); }
    catch (e) { toast(e.message, true); }
  });
  initHeader(null); load();
})();
