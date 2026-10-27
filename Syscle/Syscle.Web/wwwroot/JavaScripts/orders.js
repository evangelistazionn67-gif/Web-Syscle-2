// MY ORDERS: every order with a step tracker (Pending > Preparing > Ready > Completed) that refreshes by itself.
(async function () {
  const list = document.getElementById('ord-list'), tabs = document.getElementById('ord-tabs'), alerts = document.getElementById('ord-alerts');
  const me = await (window.SY_READY); if (!me) { location.href = loginUrl(); return; }
  let rows = [], filter = 'active';
  const PICK = [['Pending', 'Order placed'], ['Preparing', 'Preparing'], ['Ready', 'Ready for pick-up'], ['Completed', 'Completed']];
  const SHIP = [['Pending', 'Order placed'], ['Preparing', 'Preparing'], ['Ready', 'Packed'], ['Out for Delivery', 'Out for delivery'], ['Completed', 'Delivered']];
  const MSG = { Pending: 'Waiting for the store to confirm and start your order.', Preparing: 'The store is gathering and checking your items.', Ready: 'Your order is ready!', 'Out for Delivery': 'Your rider is on the way. Keep your phone nearby.', Completed: 'Thank you for shopping with us!', Cancelled: 'This order was cancelled and the items went back to stock.' };
  const fmtD = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
  function tracker(o) {
    if (o.status === 'Cancelled') return '<div class="sy-banner bad">This order was cancelled.</div>';
    const steps = o.fulfillment === 'Delivery' ? SHIP : PICK, idx = steps.findIndex(s => s[0] === o.status);
    return `<div class="sy-track" style="grid-template-columns:repeat(${steps.length},1fr)">` + steps.map((s, i) => `<div class="st ${i < idx || o.status === 'Completed' ? 'done' : i === idx ? 'now' : ''}" data-n="${i + 1}">${s[1]}</div>`).join('') + '</div>';
  }
  function card(o) {
    const del = o.fulfillment === 'Delivery', online = /online/i.test(o.payment || '');
    return `<article class="sy-order" id="o${o.id}"><div class="sy-order-h"><div><b>${esc(o.code)}</b><small>Placed ${fmtD(o.date)} &middot; ${del ? 'Delivery' : 'Pick-up'} ${fmtD(o.pickup)} &middot; ${esc(o.payment)}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap">${payChip(o)}${statusChip(o.status)}</div></div>
      ${o.status === 'Ready' && !del ? '<div class="sy-banner ready">&#128717; Ready for pick-up! Show order number <b>' + esc(o.code) + '</b> at the store.</div>' : ''}
      ${o.status === 'Out for Delivery' ? '<div class="sy-banner info">&#128666; Out for delivery' + (o.courier ? ' with <b>' + esc(o.courier) + '</b>' : '') + (o.trackingNo ? ' &middot; Tracking no. <b>' + esc(o.trackingNo) + '</b>' : '') + '</div>' : ''}
      ${online && o.paymentStatus !== 'Paid' && o.status === 'Pending' ? '<div class="sy-banner warn">&#128179; Payment not received yet. <button class="sy-btn small accent" data-pay="' + o.id + '" type="button">Pay now</button></div>' : ''}
      ${tracker(o)}<p class="sy-sub" style="margin:8px 0 0;text-align:center">${MSG[o.status] || ''}</p>
      ${del ? `<div class="sy-deliv"><b>Deliver to</b><span>${esc(o.address || '')}</span><span>&#9742; ${esc(o.deliveryPhone || '')}</span>${o.courier ? '<span>Courier: ' + esc(o.courier) + (o.trackingNo ? ' &middot; ' + esc(o.trackingNo) : '') + '</span>' : ''}</div>` : ''}
      <div class="sy-order-items">${esc(o.items || '')}</div>
      <div class="sy-order-f"><span>Total <b>${peso(o.total)}</b>${+o.deliveryFee > 0 ? ' <small class="sy-muted">(incl. ' + peso(o.deliveryFee) + ' delivery)</small>' : ''}</span>${o.status === 'Pending' && o.paymentStatus !== 'Paid' ? `<button class="sy-x" data-cancel="${o.id}" type="button">Cancel order</button>` : ''}</div></article>`;
  }
  function paint() {
    const f = rows.filter(o => filter === 'all' || (filter === 'active' && ['Pending', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)) || (filter === 'done' && o.status === 'Completed') || (filter === 'cancel' && o.status === 'Cancelled'));
    list.innerHTML = f.length ? f.map(card).join('') : `<div class="sy-empty">${rows.length ? 'Nothing here.' : 'No orders yet. <a href="homepage.html">Start shopping</a>'}</div>`;
    const ready = rows.filter(o => o.status === 'Ready' && o.fulfillment !== 'Delivery').length;
    alerts.innerHTML = ready ? `<div class="sy-banner ready">&#128717; ${ready} order${ready > 1 ? 's are' : ' is'} ready for pick-up.</div>` : '';
  }
  async function load() { try { rows = await api('/api/orders'); paint(); } catch (e) { list.innerHTML = '<div class="sy-empty">Could not load your orders.</div>'; } }
  tabs.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); paint(); });
  list.addEventListener('click', async e => {
    if (e.target.dataset.pay) { try { const r = await api('/api/orders/' + e.target.dataset.pay + '/pay', 'POST'); location.href = r.checkoutUrl; } catch (err) { toast(err.message, true); } return; }
    const id = e.target.dataset.cancel; if (!id || !confirm('Cancel this order? The items go back to stock.')) return;
    try { await api('/api/orders/' + id + '/cancel', 'POST'); toast('Order cancelled.'); await load(); if (window.syRefreshBell) syRefreshBell(); } catch (err) { toast(err.message, true); }
  });
  // coming back from the PayMongo page: ask the server to confirm the payment
  const qp = new URLSearchParams(location.search);
  if (qp.get('paid')) { try { const v = await api('/api/orders/' + +qp.get('paid') + '/verify-payment', 'POST'); toast(v.paid ? 'Payment received. Thank you!' : 'We are still waiting for the payment to be confirmed.', !v.paid); } catch (e) { } history.replaceState(null, '', location.pathname); }
  else if (qp.get('cancelled')) { toast('Payment was not completed. You can pay from this page.', true); history.replaceState(null, '', location.pathname); }
  await load(); initHeader(null);
  setInterval(() => { if (!document.hidden) load(); }, 15000);
})();
