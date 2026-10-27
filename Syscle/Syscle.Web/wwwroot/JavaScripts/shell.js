/* shell.js - builds the same header (shop) or sidebar (admin) on every page, plus the notification bell.
   A page chooses its layout with <body data-area="shop|admin|shared|auth">. "shared" pages (account, settings) switch by role.
   Optional: data-search="placeholder text" shows the search box; data-nav="file.html" marks the active menu item. */
(function () {
  const B = document.body, A0 = B.dataset.area || 'shop';
  const I = {
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    cart: '<svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 8H6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };
  const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ADMIN_NAV = [
    ['Overview'],
    ['Dashboard', 'adminhomepage.html', ic('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>')],
    ['Product insights', 'admin_insights.html', ic('<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>')],
    ['Reports', 'admin_reports.html', ic('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>')],
    ['Sales'],
    ['Orders', 'admin_transaction_history.html', ic('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>'), 'orders'],
    ['Walk-in sale', 'admin_transaction.html', ic('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>')],
    ['Promo codes', 'admin_promos.html', ic('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>')],
    ['Bundles', 'admin_bundles.html', ic('<path d="M21 16V8l-9-5-9 5v8l9 5z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>')],
    ['Catalog'],
    ['Inventory', 'admin_inventory.html', ic('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/>'), 'stock'],
    ['Stock movement', 'admin_stock.html', ic('<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>')],
    ['Store-front', 'admin_storefront.html', ic('<path d="M3 9 5 3h14l2 6"/><path d="M4 9v12h16V9"/><path d="M9 21v-6h6v6"/>')],
    ['Reviews', 'admin_reviews.html', ic('<path d="m12 2 3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z"/>')],
    ['People'],
    ['Messages', 'admin_messages.html', ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'), 'msg'],
    ['Accounts', 'admin_account_management.html', ic('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>')],
    ['Setup'],
    ['Payment setup', 'admin_payment_setup.html', ic('<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>')],
    ['Settings', 'settings.html', ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')]
  ];
  const file = () => location.pathname.split('/').pop() || 'index.html';
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (x) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) { } };
  const get = async u => { try { const r = await fetch(u, { headers: { 'X-Requested-With': 'syscle' } }); return r.ok ? await r.json() : null; } catch (x) { return null; } };
  const fmtP = n => '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });

  window.SY_READY = (async () => {
    const me = await get('/api/auth/me'); window.SY_ME = me; // null = guest
    const admin = !!me && (me.role === 'Admin' || me.role === 'SuperAdmin');
    let area = A0; if (area === 'shared') area = admin ? 'admin' : 'shop';
    B.dataset.area = area;
    if (area === 'auth') return me;
    if (area === 'admin') buildAdmin(me); else buildShop(me, admin);
    if (me) startBell(me, admin);
    wireMenus();
    return me;
  })();

  const accountMenu = (me, admin) => me ? `<div class="sy-wrapr"><button class="sy-ibtn" id="sy-umenu" aria-label="Account menu" aria-haspopup="true">${I.user}</button>
      <div class="sy-menu" id="sy-umenu-box"><div class="who"><b>${e(me.username)}</b><span>${e(me.email || '')} &middot; ${admin ? e(me.role) : 'Customer'}</span></div>
      <a href="/Pages/account.html">My account</a>${admin ? '' : '<a href="/Pages/orders.html">My orders</a>'}<a href="/Pages/settings.html">Settings</a>
      <button type="button" onclick="logoutUser()">Log out</button></div></div>` : '';
  const bellHtml = `<div class="sy-wrapr"><button class="sy-ibtn" id="sy-bell" aria-label="Notifications" aria-haspopup="true">${I.bell}<span class="sy-badge" id="sy-bell-n">0</span></button>
      <div class="sy-note" id="sy-note"><header>Notifications <button type="button" id="sy-readall">Mark all as read</button></header><div class="sy-nlist" id="sy-nlist"><div class="sy-nempty">Loading...</div></div></div></div>`;
  const searchHtml = ph => `<div class="sy-search" role="search"><input type="text" id="main-search-input" placeholder="${e(ph)}" aria-label="Search" autocomplete="off">
      <button type="button" id="clear-search" aria-label="Clear search">${I.x}</button><button type="button" id="execute-search" aria-label="Search">${I.search}</button></div>`;

  function buildShop(me, admin) {
    document.querySelectorAll('.top-nav').forEach(n => n.remove());
    const f = file(), on = n => f === n ? ' class="on"' : '';
    const links = `<a href="/Pages/homepage.html"${on('homepage.html')}>Shop</a><a href="/Pages/homepage.html#bundles">Bundle deals</a>` + (me ? `<a href="/Pages/orders.html"${on('orders.html')}>My orders</a>` : `<a href="/index.html#how">How it works</a>`);
    const nav = document.createElement('header'); nav.className = 'sy-nav';
    nav.innerHTML = `<div class="sy-nav-in"><a class="sy-logo" href="/index.html" aria-label="Web-Syscle home"><b>Web<i>-</i>Syscle</b><span id="hdr-sub">Shop &amp; Customize</span></a>
      <nav class="sy-links-nav" id="sy-links" aria-label="Main">${links}</nav>
      ${B.dataset.search ? searchHtml(B.dataset.search) : ''}
      <div class="sy-tools">${me ? bellHtml : ''}
        <a class="sy-ibtn" href="${me ? '/Pages/cart.html' : '/login.html?next=' + encodeURIComponent('/Pages/cart.html')}" aria-label="Cart">${I.cart}</a>
        ${me ? accountMenu(me, admin) : '<div class="sy-guestbtns"><a class="sy-btn ghost small" href="/login.html">Log in</a><a class="sy-btn accent small" href="/login.html?signup=1">Sign up</a></div>'}
        <button class="sy-ibtn sy-burger" id="sy-burger" aria-label="Menu">${I.menu}</button></div></div>`;
    B.prepend(nav);
    if (!document.querySelector('.sy-footer')) {
      const ft = document.createElement('footer'); ft.className = 'sy-footer';
      ft.innerHTML = `<div class="sy-fcols"><div><b>Web-Syscle</b><p>Quality bicycle parts for every ride. Order online, pick up in store.</p></div>
        <div><b>Shop</b><p><a href="/Pages/homepage.html">All parts</a><br><a href="/Pages/homepage.html#bundles">Bundle deals</a><br><a href="/Pages/cart.html">My cart</a></p></div>
        <div><b>Your account</b><p><a href="/Pages/orders.html">Track my orders</a><br><a href="/Pages/account.html">Account &amp; security</a><br><a href="/Pages/settings.html">Settings</a></p></div></div>
        <div class="sy-fcopy">&copy; ${new Date().getFullYear()} Web-Syscle. All rights reserved.</div>`;
      B.appendChild(ft);
    }
    if (!document.querySelector('.support-btn') && me) { const s = document.createElement('div'); s.className = 'support-btn'; s.setAttribute('role', 'button'); s.setAttribute('aria-label', 'Help and customer service'); B.appendChild(s); }
  }

  function buildAdmin(me) {
    document.querySelectorAll('.top-nav').forEach(n => n.remove());
    const f = file(); let h = '';
    ADMIN_NAV.forEach(it => {
      if (it.length === 1) h += `<h4>${it[0]}</h4>`;
      else h += `<a href="/Pages/${it[1]}"${f === it[1] ? ' class="on"' : ''}>${it[2]}${it[0]}${it[3] ? `<span class="sy-badge" data-side="${it[3]}">0</span>` : ''}</a>`;
    });
    const side = document.createElement('aside'); side.className = 'sy-side'; side.id = 'sy-side';
    side.innerHTML = `<a class="sy-logo" href="/Pages/adminhomepage.html"><b>Web<i>-</i>Syscle</b><span id="hdr-sub">Admin Panel</span></a><nav aria-label="Admin">${h}</nav><div class="foot">Signed in as <b style="color:#fff">${e(me ? me.username : '')}</b></div>`;
    const scrim = document.createElement('div'); scrim.className = 'sy-scrim'; scrim.id = 'sy-scrim';
    const top = document.createElement('header'); top.className = 'sy-top' + (B.dataset.search ? ' has-search' : '');
    top.innerHTML = `<button class="sy-ibtn sy-burger" id="sy-aburger" aria-label="Open menu">${I.menu}</button>
      ${B.dataset.search ? searchHtml(B.dataset.search) : `<span class="crumb">${e((document.title || '').replace(/^Syscle\s*-\s*/i, ''))}</span>`}
      <div class="sy-tools">${bellHtml}${accountMenu(me, true)}</div>`;
    B.prepend(top); B.prepend(scrim); B.prepend(side);
    const open = v => { side.classList.toggle('open', v); scrim.classList.toggle('open', v); };
    document.getElementById('sy-aburger').addEventListener('click', () => open(!side.classList.contains('open')));
    scrim.addEventListener('click', () => open(false));
    if (!document.querySelector('.support-btn')) { const sb = document.createElement('div'); sb.className = 'support-btn'; sb.setAttribute('role', 'button'); sb.setAttribute('aria-label', 'Help'); B.appendChild(sb); }
  }

  function wireMenus() {
    const burger = document.getElementById('sy-burger'), links = document.getElementById('sy-links');
    if (burger && links) burger.addEventListener('click', () => links.classList.toggle('open'));
    const pairs = [['sy-umenu', 'sy-umenu-box'], ['sy-bell', 'sy-note']];
    pairs.forEach(([b, p]) => { const bt = document.getElementById(b), pn = document.getElementById(p); if (bt && pn) bt.addEventListener('click', ev => { ev.stopPropagation(); const o = !pn.classList.contains('open'); pairs.forEach(([, q]) => { const x = document.getElementById(q); if (x) x.classList.remove('open'); }); pn.classList.toggle('open', o); }); });
    document.addEventListener('click', ev => { if (!ev.target.closest('.sy-menu,.sy-note')) pairs.forEach(([, q]) => { const x = document.getElementById(q); if (x) x.classList.remove('open'); }); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') pairs.forEach(([, q]) => { const x = document.getElementById(q); if (x) x.classList.remove('open'); }); });
  }

  /* ---------- notification bell ---------- */
  const STEP = { Pending: ['warn', '⏳', 'Order received', 'We got your order and will start soon.'], Preparing: ['info', '🛠️', 'Being prepared', 'The store is preparing your items.'], Ready: ['ok', '🛍️', 'Ready for pick-up!', 'Please bring your order number.'], Completed: ['ok', '✅', 'Completed', 'Thank you for shopping with us.'], Cancelled: ['bad', '✖', 'Cancelled', 'The items went back to stock.'] };
  function paintBell(items, unread) {
    const n = document.getElementById('sy-bell-n'), l = document.getElementById('sy-nlist'); if (!n || !l) return;
    n.textContent = unread > 99 ? '99+' : unread; n.classList.toggle('show', unread > 0);
    l.innerHTML = items.length ? items.map(x => `<a class="sy-nitem${x.fresh ? ' new' : ''}" href="${x.href}"><div class="dot ${x.tone}">${x.icon}</div><div><b>${e(x.title)}</b><span>${e(x.text)}</span></div></a>`).join('') : '<div class="sy-nempty">You are all caught up.</div>';
  }
  function startBell(me, admin) {
    const key = 'syscle.seen.' + me.userId;
    let first = true, lastSeen = lsGet(key) || {};
    async function tickCustomer() {
      const rows = await get('/api/orders'); if (!rows) return;
      const seen = lsGet(key) || {}, items = []; let unread = 0, cur = {};
      rows.forEach(o => { cur[o.id] = o.status; });
      rows.slice(0, 8).forEach(o => {
        const s = STEP[o.status] || STEP.Pending, fresh = seen[o.id] !== o.status; if (fresh) unread++;
        if (!first && lastSeen[o.id] && lastSeen[o.id] !== o.status && window.toast) window.toast(`Order ${o.code}: ${s[2]}`, o.status === 'Cancelled');
        items.push({ tone: s[0], icon: s[1], title: `${o.code} · ${s[2]}`, text: `${s[3]} (${fmtP(o.total)})`, href: '/Pages/orders.html', fresh });
      });
      lastSeen = cur; first = false; window.__syOrders = rows; paintBell(items, unread);
      document.getElementById('sy-readall').onclick = () => { lsSet(key, cur); paintBell(items.map(x => ({ ...x, fresh: false })), 0); };
    }
    async function tickAdmin() {
      const [st, msg] = await Promise.all([get('/api/admin/stats'), get('/api/admin/messages/unread')]); if (!st) return;
      const o = st.orders, p = st.prods, m = msg ? msg.count : 0, items = [];
      if (o.pendingOrders) items.push({ tone: 'warn', icon: '🔔', title: `${o.pendingOrders} new order${o.pendingOrders > 1 ? 's' : ''} waiting`, text: 'Start preparing them.', href: '/Pages/admin_transaction_history.html', fresh: true });
      const mid = (o.openOrders || 0) - (o.pendingOrders || 0); if (mid > 0) items.push({ tone: 'info', icon: '🛠️', title: `${mid} order${mid > 1 ? 's' : ''} in progress`, text: 'Preparing or ready for pick-up.', href: '/Pages/admin_transaction_history.html' });
      if (p.outOfStock) items.push({ tone: 'bad', icon: '⚠️', title: `${p.outOfStock} item${p.outOfStock > 1 ? 's' : ''} out of stock`, text: 'Restock to keep selling.', href: '/Pages/admin_inventory.html', fresh: true });
      if (p.lowStock) items.push({ tone: 'warn', icon: '📦', title: `${p.lowStock} item${p.lowStock > 1 ? 's' : ''} running low`, text: 'Five or fewer left.', href: '/Pages/admin_inventory.html' });
      if (m) items.push({ tone: 'info', icon: '💬', title: `${m} unread message${m > 1 ? 's' : ''}`, text: 'Customers are waiting for a reply.', href: '/Pages/admin_messages.html', fresh: true });
      paintBell(items, (o.pendingOrders || 0) + (p.outOfStock || 0) + m);
      document.querySelectorAll('[data-side]').forEach(b => { const v = b.dataset.side === 'orders' ? o.pendingOrders : b.dataset.side === 'msg' ? m : (p.outOfStock || 0) + (p.lowStock || 0); b.textContent = v; b.classList.toggle('show', v > 0); });
      const ra = document.getElementById('sy-readall'); if (ra) ra.style.display = 'none';
    }
    const tick = admin ? tickAdmin : tickCustomer; tick(); setInterval(() => { if (!document.hidden) tick(); }, admin ? 30000 : 20000);
    window.syRefreshBell = tick;
  }
})();

/* BACK BUTTON: every inner page gets the same "Back" button, so nobody is stuck. Home pages and the login pages do not need one. */
(function () {
  const p = location.pathname.toLowerCase();
  if (p === '/' || /\/(index|login|reset|error|adminhomepage)\.html$/.test(p)) return;
  const isShopHome = /\/homepage\.html$/.test(p);
  const run = () => {
    const admin = document.body.dataset.area === 'admin', home = admin ? '/Pages/adminhomepage.html' : '/Pages/homepage.html';
    let ref = ''; try { const r = document.referrer && new URL(document.referrer); ref = r && r.origin === location.origin && r.pathname.toLowerCase() !== p && !/login|reset/i.test(r.pathname) ? r.pathname : ''; } catch (e) { }
    /* the shop homepage is a starting point, so it only gets a Back button when you arrived from another page (for example "View everything" on the landing page) */
    if (isShopHome && !ref) return;
    const old = [...document.querySelectorAll('.back-btn')]; let btn = old.shift(); old.forEach(x => x.remove());
    if (!btn) {
      const host = [...document.querySelectorAll('.sy-page, .sy-section, .sy-shelf')].find(x => x.offsetWidth > 0 && !x.hidden) || document.querySelector('main'); if (!host) return;
      btn = document.createElement('a'); host.prepend(btn);
    }
    btn.className = 'back-btn'; btn.removeAttribute('onclick'); btn.setAttribute('href', home); btn.innerHTML = '&larr; Back'; btn.setAttribute('role', 'button');
    btn.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopImmediatePropagation();
      let same = false; try { same = document.referrer && new URL(document.referrer).origin === location.origin && !/login|reset/i.test(document.referrer); } catch (e) { }
      if (same && history.length > 1) history.back(); else location.href = isShopHome ? '/index.html' : home;
    }, true);
  };
  const go = () => { (window.SY_READY || Promise.resolve()).then(() => setTimeout(run, 0), () => setTimeout(run, 0)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
