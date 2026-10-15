// ADMIN: WALK-IN TRANSACTION (point of sale). Stock and prices are re-checked on the server.
(async function () {
  const $ = id => document.getElementById(id);
  let products = [], lines = [];
  $('current-date').textContent = 'Date: ' + new Date().toLocaleDateString();
  async function loadProducts() { products = await api('/api/admin/products'); }
  function renderResults(q) {
    const list = products.filter(p => p.stock > 0 && (p.name + ' ' + p.itemType + ' ' + p.category).toLowerCase().includes(q)).slice(0, 8);
    $('pos-search-results').innerHTML = list.length ? list.map(p => `<div class="pos-dropdown-item"><div class="item-details"><strong>${esc(p.name)}</strong><span>${esc(p.category)} · ${peso(p.price)} · ${p.stock} in stock</span></div><button class="add-pos-btn" data-id="${p.id}">+</button></div>`).join('')
      : '<div class="sy-empty">No matching items in stock.</div>';
    $('pos-search-results').classList.add('open');
  }
  function render() {
    const box = $('transaction-items-container'), bd = $('cost-breakdown-container');
    box.innerHTML = lines.length ? '' : '<div class="sy-empty" style="color:#fff">Search for an item above to add it.</div>';
    bd.querySelectorAll('.sy-row').forEach(n => n.remove());
    let total = 0;
    lines.forEach(l => {
      const p = products.find(x => x.id === l.id); total += p.price * l.qty;
      box.insertAdjacentHTML('beforeend', `<div class="sy-line" data-id="${p.id}"><div class="sy-grow"><b>${esc(p.name)}</b><small>${peso(p.price)} each · ${p.stock} in stock</small></div>
        <div class="sy-qty"><button data-d="-1">-</button><span>${l.qty}</span><button data-d="1">+</button></div><b>${peso(p.price * l.qty)}</b><button class="sy-x" data-rm="1">Remove</button></div>`);
      bd.insertAdjacentHTML('beforeend', `<div class="sy-row"><span>${esc(p.name)} (${peso(p.price)})</span><span>x ${l.qty}</span></div>`);
    });
    $('pos-total').textContent = 'Total Due: ' + peso(total);
  }
  const search = $('pos-item-search');
  search.addEventListener('input', () => renderResults(search.value.trim().toLowerCase()));
  search.addEventListener('focus', () => renderResults(search.value.trim().toLowerCase()));
  document.addEventListener('click', e => { if (!e.target.closest('.pos-search-wrapper')) $('pos-search-results').classList.remove('open'); });
  $('pos-search-results').addEventListener('click', e => {
    const id = +e.target.dataset.id; if (!id) return;
    const p = products.find(x => x.id === id), l = lines.find(x => x.id === id);
    if (l) { if (l.qty < p.stock) l.qty++; else toast('No more stock for that item.', true); } else lines.push({ id, qty: 1 });
    render();
  });
  $('transaction-items-container').addEventListener('click', e => {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const id = +card.dataset.id, l = lines.find(x => x.id === id), p = products.find(x => x.id === id);
    if (e.target.dataset.rm) lines = lines.filter(x => x.id !== id);
    else if (e.target.dataset.d) { const n = l.qty + (+e.target.dataset.d); if (n < 1) lines = lines.filter(x => x.id !== id); else if (n > p.stock) toast('No more stock for that item.', true); else l.qty = n; }
    render();
  });
  $('btn-generate').addEventListener('click', async () => {
    if (!lines.length) return toast('Add at least one item.', true);
    try {
      const res = await api('/api/admin/transactions/walkin', 'POST', { customerName: $('walkin-name').value, paymentMethod: $('pos-payment').value, items: lines.map(l => ({ productId: l.id, qty: l.qty })) });
      $('order-number-text').textContent = 'TRANS-ID: ' + res.orderCode;
      toast(`Transaction ${res.orderCode} recorded: ${peso(res.total)}`);
      lines = []; $('walkin-name').value = ''; await loadProducts(); render();
    } catch (e) { toast(e.message, true); await loadProducts(); }
  });
  initHeader(null);
  try {
    const methods = (await api('/api/admin/payment-methods')).filter(m => m.isOn);
    $('pos-payment').innerHTML = methods.map(m => `<option value="${esc(m.code)}">${esc(m.label)}</option>`).join('') || '<option value="">No payment method enabled</option>';
    await loadProducts(); render();
  } catch (e) { toast(e.message, true); }
})();
