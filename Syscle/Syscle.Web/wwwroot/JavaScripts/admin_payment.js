// ADMIN: PAYMENT SETUP. Turn Cash / GCash on or off and save the GCash account details.
(async function () {
  const $ = id => document.getElementById(id);
  const btns = [...document.querySelectorAll('.toggle-btn')];
  const paint = b => { b.textContent = b.classList.contains('active') ? 'ON' : 'OFF'; };
  btns.forEach(b => b.addEventListener('click', () => { b.classList.toggle('active'); paint(b); }));
  try {
    const list = await api('/api/admin/payment-methods');
    btns.forEach(b => { const m = list.find(x => x.code === b.dataset.code); b.classList.toggle('active', !!(m && m.isOn)); paint(b); });
    const g = list.find(x => x.code === 'gcash');
    if (g) { $('gcash-number').value = g.accountNumber; $('gcash-name').value = g.accountName; }
  } catch (e) { toast(e.message, true); }
  $('btn-apply').addEventListener('click', async () => {
    const body = btns.map(b => ({ code: b.dataset.code, isOn: b.classList.contains('active'),
      accountNumber: b.dataset.code === 'gcash' ? $('gcash-number').value : '', accountName: b.dataset.code === 'gcash' ? $('gcash-name').value : '' }));
    try { await api('/api/admin/payment-methods', 'PUT', body); toast('Payment settings saved.'); } catch (e) { toast(e.message, true); }
  });
  initHeader(null);
})();
