// ACCOUNT PAGE (customers and admins): personal info, edit email/contact/password, order history with cancel (customers).
(async function () {
  const $ = id => document.getElementById(id);
  let me;
  try { me = await api('/api/auth/me'); } catch (e) { return; }
  const back = $('back-link');
  if (me.role === 'Admin') {
    back.href = 'adminhomepage.html'; back.textContent = '\u2190 Back to Dashboard';
    document.querySelectorAll('.cart-icon').forEach(i => { const a = i.closest('a'); if (a) a.style.display = 'none'; });
    const h = $('history-section'); if (h) h.style.display = 'none';
  } else { back.href = 'homepage.html'; back.textContent = '\u2190 Back to Storefront'; }
  const prefix = { 'disp-username': 'Username: ', 'disp-email': 'Email: ', 'disp-contact': 'Contact Number: ' };
  const raw = { 'disp-username': me.username, 'disp-email': me.email, 'disp-contact': me.phone };
  const paint = () => Object.keys(prefix).forEach(id => { $(id).value = prefix[id] + (raw[id] || '(not set)'); });
  paint();
  async function saveProfile() {
    try { await api('/api/me/profile', 'PUT', { email: raw['disp-email'], phone: raw['disp-contact'] }); toast('Saved.'); }
    catch (e) { toast(e.message, true); const f = await api('/api/auth/me'); raw['disp-email'] = f.email; raw['disp-contact'] = f.phone; }
    paint();
  }
  document.querySelectorAll('.input-group').forEach(group => {
    const input = group.querySelector('.info-input'), pencil = group.querySelector('.edit-icon');
    if (!input || !pencil) return;
    pencil.style.cursor = 'pointer';
    pencil.addEventListener('click', async () => {
      if (input.id === 'disp-username') return toast('Usernames can\u2019t be changed.', true);
      if (input.id === 'disp-password') {
        const cur = prompt('Enter your current password:'); if (cur === null) return;
        const nxt = prompt('Enter a new password (8+ characters):'); if (nxt === null) return;
        try { await api('/api/me/password', 'POST', { current: cur, next: nxt }); toast('Password changed.'); } catch (e) { toast(e.message, true); }
        return;
      }
      input.readOnly = false; input.value = raw[input.id] || ''; input.focus();
      input.addEventListener('blur', () => { input.readOnly = true; raw[input.id] = input.value.trim(); saveProfile(); }, { once: true });
    });
  });
  async function loadOrders() {
    try {
      const rows = await api('/api/orders');
      $('history-body').innerHTML = rows.length ? rows.map(o => `<tr><td>${esc(o.code)}</td><td>${fmtDateTime(o.date)}</td><td>${esc(o.items)}</td><td>${peso(o.total)}</td><td>${fmtDate(o.pickup)}</td>
        <td><span class="sy-chip ${o.status === 'Completed' ? 'ok' : o.status === 'Cancelled' ? 'bad' : 'warn'}">${esc(o.status)}</span></td>
        <td>${o.status === 'Pending' ? `<button class="sy-x" data-cancel="${o.id}">Cancel</button>` : '-'}</td></tr>`).join('')
        : '<tr><td colspan="7" class="sy-empty">No orders yet.</td></tr>';
    } catch (e) { /* ignore */ }
  }
  if (me.role !== 'Admin') {
    loadOrders();
    $('history-body').addEventListener('click', async e => {
      const id = e.target.dataset.cancel; if (!id || !confirm('Cancel this order? The items go back to stock.')) return;
      try { await api('/api/orders/' + id + '/cancel', 'POST'); toast('Order cancelled.'); await loadOrders(); } catch (err) { toast(err.message, true); }
    });
  }
})();
function logoutUserClick() { logoutUser(); }
