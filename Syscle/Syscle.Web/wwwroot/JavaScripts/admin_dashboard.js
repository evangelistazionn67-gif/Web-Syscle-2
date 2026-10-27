// ADMIN DASHBOARD: what needs attention now, today's numbers, a 14-day chart, top buyers, recent orders and low stock.
(async function () {
  const box = document.getElementById('admin-stats');
  const delta = (cur, prev) => { if (!prev) return cur ? '<small class="sy-up">New activity</small>' : '<small class="sy-muted">No sales yesterday</small>'; const p = Math.round((cur - prev) / prev * 100); return `<small class="${p >= 0 ? 'sy-up' : 'sy-down'}">${p >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(p)}% vs yesterday</small>`; };
  let d, rep = null, buyers = [], unread = 0;
  try {
    const r = await Promise.all([api('/api/admin/stats'), api('/api/admin/reports?period=daily').catch(() => null), api('/api/admin/top-buyers?limit=5').catch(() => []), api('/api/admin/messages/unread').catch(() => ({ count: 0 }))]);
    d = r[0]; rep = r[1]; buyers = r[2]; unread = r[3].count;
  } catch (e) { box.innerHTML = '<div class="sy-empty">Could not load the dashboard numbers.</div>'; return; }
  const o = d.orders, p = d.prods, me = await SY_READY;
  const alerts = [];
  if (o.pendingOrders) alerts.push(`<a class="sy-alert warn" href="admin_transaction_history.html"><span>&#128276;</span><span><b>${o.pendingOrders} new order${o.pendingOrders > 1 ? 's' : ''}</b> waiting to be prepared.</span><span class="go">Open orders &rarr;</span></a>`);
  if (p.outOfStock) alerts.push(`<a class="sy-alert bad" href="admin_inventory.html"><span>&#9888;&#65039;</span><span><b>${p.outOfStock} item${p.outOfStock > 1 ? 's are' : ' is'} out of stock.</b> Customers cannot buy them.</span><span class="go">Restock &rarr;</span></a>`);
  if (p.lowStock) alerts.push(`<a class="sy-alert warn" href="admin_inventory.html"><span>&#128230;</span><span><b>${p.lowStock} item${p.lowStock > 1 ? 's are' : ' is'} running low</b> (5 or fewer left).</span><span class="go">View &rarr;</span></a>`);
  if (unread) alerts.push(`<a class="sy-alert info" href="admin_messages.html"><span>&#128172;</span><span><b>${unread} unread message${unread > 1 ? 's' : ''}</b> from customers.</span><span class="go">Reply &rarr;</span></a>`);
  const series = rep ? fillSeries(rep.series, 'daily', rep.from, rep.to) : [], max = Math.max(1, ...series.map(s => +s.sales));
  const chart = series.some(s => +s.sales > 0) ? `<div class="sy-bars">${series.map(s => `<div class="sy-bar" style="height:${Math.max(4, +s.sales / max * 100)}%" data-tip="${esc(s.label)}: ${peso(s.sales)}"></div>`).join('')}</div><div class="sy-barlbl">${series.map(s => `<span>${esc(s.label.slice(8))}</span>`).join('')}</div>` : '<div class="sy-empty">No sales in the last 14 days yet.</div>';
  box.innerHTML = `<div class="sy-toolbar"><div><h1>Dashboard</h1><p class="sy-sub" style="margin:0">Hello ${esc(me ? me.username : '')}. Here is how the shop is doing.</p></div>
      <div class="sy-pactions"><a class="sy-btn accent" href="admin_transaction.html">+ Walk-in sale</a><a class="sy-btn ghost" href="admin_inventory.html?add=1">+ Add item</a><a class="sy-btn ghost" href="admin_reports.html">Reports</a></div></div>
    ${alerts.length ? `<div class="sy-alerts">${alerts.join('')}</div>` : '<div class="sy-alerts"><div class="sy-alert info"><span>&#10003;</span><span><b>All clear.</b> No orders waiting and stock looks fine.</span></div></div>'}
    <div class="sy-cards">
      <div class="sy-stat hot">Today's sales<b>${peso(o.todaySales)}</b>${delta(+o.todaySales, +o.yesterdaySales)}</div>
      <div class="sy-stat">Orders today<b>${o.todayOrders}</b><small class="sy-muted">${o.openOrders || 0} still open</small></div>
      <div class="sy-stat">This month<b>${peso(o.monthSales || 0)}</b></div>
      <div class="sy-stat dark">All-time sales<b>${peso(o.totalSales)}</b></div>
      <div class="sy-stat">Products<b>${p.products}</b><small class="sy-muted">${d.customers} customers</small></div>
    </div>
    <div class="sy-dash">
      <div class="sy-card sy-c8"><h3>Sales, last 14 days</h3>${chart}</div>
      <div class="sy-card sy-c4"><h3>Top buyers</h3>${buyers.length ? buyers.map((b, i) => `<div class="sy-rank"><span class="n">${i + 1}</span><div class="sy-grow"><b>${esc(b.username)}</b><small>${b.orders} order${b.orders > 1 ? 's' : ''}</small></div><b>${peso(b.spent)}</b></div>`).join('') : '<div class="sy-empty">No buyers yet.</div>'}<p style="margin-top:10px"><a href="admin_promos.html">Reward them with a promo code &rarr;</a></p></div>
      <div class="sy-card sy-c8"><h3>Recent orders</h3><div class="sy-scroll"><table class="sy-table" style="box-shadow:none;border:0;min-width:480px"><tbody>${d.recent.length ? d.recent.map(r => `<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.customer)}</td><td class="r">${peso(r.total)}</td><td>${statusChip(r.status)}</td></tr>`).join('') : '<tr><td class="sy-empty">No orders yet.</td></tr>'}</tbody></table></div><p style="margin-top:10px"><a href="admin_transaction_history.html">Manage all orders &rarr;</a></p></div>
      <div class="sy-card sy-c4"><h3>Needs restocking</h3>${d.low.length ? d.low.map(i => `<div class="sy-row"><a href="admin_inventory.html?cat=${i.categoryId}">${esc(i.name)}</a><b class="${i.stock === 0 ? 'sy-red' : ''}">${i.stock === 0 ? 'Out' : i.stock + ' left'}</b></div>`).join('') : '<div class="sy-empty">Everything is well stocked.</div>'}</div>
    </div>`;
  initHeader(null);
})();
