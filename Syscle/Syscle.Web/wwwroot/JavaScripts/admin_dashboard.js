(async function () {
  const box = document.getElementById('admin-stats');
  const chip = s => `<span class="sy-chip ${s === 'Completed' ? 'ok' : s === 'Cancelled' ? 'bad' : 'warn'}">${esc(s)}</span>`;
  try {
    const d = await api('/api/admin/stats'), o = d.orders, p = d.prods;
    box.innerHTML = `<h1>Admin Dashboard</h1><p class="sy-sub">How the shop is doing right now.</p>
      <div class="sy-cards">
        <div class="sy-stat">Today's sales<b>${peso(o.todaySales)}</b></div>
        <div class="sy-stat">Orders today<b>${o.todayOrders}</b></div>
        <div class="sy-stat">Pending orders<b>${o.pendingOrders}</b></div>
        <div class="sy-stat">Low / out of stock<b>${p.lowStock} / ${p.outOfStock}</b></div>
        <div class="sy-stat">Total sales<b>${peso(o.totalSales)}</b></div>
        <div class="sy-stat">Products &middot; Customers<b>${p.products} &middot; ${d.customers}</b></div>
      </div>
      <div class="sy-pos">
        <div class="sy-card"><h3>Needs restocking</h3>${d.low.length ? d.low.map(i => `<div class="sy-row"><a href="admin_inventory.html?cat=${i.categoryId}">${esc(i.name)}</a><b class="${i.stock === 0 ? 'sy-red' : ''}">${i.stock === 0 ? 'Out of stock' : i.stock + ' left'}</b></div>`).join('') : '<p class="sy-empty">Everything is well stocked.</p>'}</div>
        <div class="sy-card"><h3>Recent orders</h3>${d.recent.length ? d.recent.map(r => `<div class="sy-row"><span>${esc(r.code)} &middot; ${esc(r.customer)}</span><span>${peso(r.total)} ${chip(r.status)}</span></div>`).join('') : '<p class="sy-empty">No orders yet.</p>'}<p style="margin-top:10px"><a href="admin_transaction_history.html">View all transactions</a></p></div>
      </div>`;
  } catch (e) { box.innerHTML = '<p class="sy-empty">Could not load the dashboard numbers.</p>'; }
  initHeader(null);
})();
