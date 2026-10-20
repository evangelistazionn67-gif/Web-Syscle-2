// CART: list, promo code, pick-up date, payment choice, checkout. The server recalculates every total.
(async function () {
  const $ = id => document.getElementById(id);
  let cart = [], pct = 0, methods = [], bundleInfo = { discount: 0, applied: [] };
  const me = await api('/api/auth/me');
  $('cart-dynamic-title').textContent = me.username + '\u2019s Cart';
  $('summary-dynamic-name').textContent = me.username;
  $('purchase-date').textContent = new Date().toLocaleDateString();
  const localISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = new Date(), pick = $('pickup-date');
  pick.min = localISO(today); pick.value = localISO(today); pick.max = localISO(new Date(today.getTime() + 30 * 864e5));
  function render() {
    const box = $('cart-items-container'), bd = $('cost-breakdown-container');
    box.innerHTML = cart.length ? '' : '<div class="sy-empty" style="color:#fff">Your cart is empty. <a href="homepage.html" style="color:#ffd23f">Browse parts</a></div>';
    bd.querySelectorAll('.sy-row').forEach(n => n.remove());
    let sub = 0;
    cart.forEach(l => {
      sub += l.price * l.qty;
      box.insertAdjacentHTML('beforeend', `<div class="cart-product-card sy-line" data-id="${l.productId}">
        ${l.image ? `<img class="sy-thumb" src="${esc(l.image)}" alt="">` : ''}<div class="sy-grow"><b>${esc(l.name)}</b><small>${esc(l.itemType)} · ${peso(l.price)} each · ${l.stock} in stock</small></div>
        <div class="sy-qty"><button data-d="-1">-</button><span>${l.qty}</span><button data-d="1">+</button></div>
        <b>${peso(l.price * l.qty)}</b><button class="sy-x" data-rm="1">Remove</button></div>`);
      bd.insertAdjacentHTML('beforeend', `<div class="sy-row"><span>${esc(l.name)} (${peso(l.price)})</span><span>x ${l.qty}</span></div>`);
    });
    bundleInfo.applied.forEach(b => bd.insertAdjacentHTML('beforeend', `<div class="sy-row"><span>Bundle: ${esc(b.name)} (${b.percent}% off)</span><span>-${peso(b.discount)}</span></div>`));
    const after = sub - bundleInfo.discount;
    $('total-cost').textContent = 'Total Cost: ' + peso(after - Math.round(after * pct) / 100) + (pct ? ` (${pct}% promo)` : '');
  }
  async function load() { cart = await api('/api/cart'); bundleInfo = await api('/api/cart/bundles'); render(); refreshCartBadge(); }
  async function setQty(id, q) { try { await api('/api/cart/' + id, 'PUT', { qty: q }); await load(); } catch (e) { toast(e.message, true); } }
  $('cart-items-container').addEventListener('click', e => {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const id = +card.dataset.id, line = cart.find(l => l.productId === id);
    if (e.target.dataset.rm) setQty(id, 0);
    else if (e.target.dataset.d) setQty(id, line.qty + (+e.target.dataset.d));
  });
  $('promo-apply').addEventListener('click', async () => {
    const code = $('promo-code').value.trim();
    if (!code) { pct = 0; render(); return; }
    try { pct = (await api('/api/promo', 'POST', { code })).percent; toast(`Promo applied: ${pct}% off.`); }
    catch (e) { pct = 0; toast(e.message, true); }
    render();
  });
  $('btn-checkout').addEventListener('click', async () => {
    if (!cart.length) return toast('Your cart is empty.', true);
    const pickText = new Date(pick.value + 'T00:00:00').toLocaleDateString();
    try {
      const res = await api('/api/checkout', 'POST', { pickupDate: pick.value, promoCode: $('promo-code').value.trim() || null, paymentMethod: $('payment-method').value });
      $('order-number').textContent = 'ORDER NUMBER: ' + res.orderCode;
      const m = methods.find(x => x.code === $('payment-method').value);
      cart = []; pct = 0; render(); refreshCartBadge();
      const pay = m && m.accountNumber ? `<p>Pay with <b>${esc(m.label)}</b>: <b>${esc(m.accountNumber)}</b>${m.accountName ? ' (' + esc(m.accountName) + ')' : ''}, or pay at the store.</p>` : '<p>Pay at the store when you pick up.</p>';
      showModal(`<div class="sy-done"><div class="sy-check">&#10003;</div><h2>Order placed!</h2><p>Your order number</p><div class="sy-code">${esc(res.orderCode)}</div>
        <p>Total: <b>${peso(res.total)}</b></p><p>Pick-up date: <b>${pickText}</b></p>${pay}
        <div class="sy-pm-actions"><a class="sy-btn ghost" href="account.html">View my orders</a><a class="sy-btn accent" href="homepage.html">Continue shopping</a></div></div>`);
    } catch (e) { toast(e.message, true); await load(); }
  });
  try {
    methods = await api('/api/payment-methods');
    $('payment-method').innerHTML = methods.map(m => `<option value="${esc(m.code)}">${esc(m.label)}</option>`).join('') || '<option value="">No payment method available</option>';
    await load();
  } catch (e) { location.href = 'error.html'; }
  initHeader(null);
})();
