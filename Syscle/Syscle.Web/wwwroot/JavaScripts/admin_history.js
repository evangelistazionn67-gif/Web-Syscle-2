// ADMIN: TRANSACTIONS HISTORY. Filter, and mark orders Completed or Cancelled (cancelling returns the stock).
(async function () {
  const $ = id => document.getElementById(id);
  const chip = s => `<span class="sy-chip ${s === 'Completed' ? 'ok' : s === 'Cancelled' ? 'bad' : 'warn'}">${esc(s)}</span>`;
  async function load() {
    const qs = new URLSearchParams({ search: $('f-search').value, status: $('f-status').value, range: $('f-range').value });
    try {
      const d = await api('/api/admin/transactions?' + qs);
      $('val-total').textContent = d.summary.total; $('val-completed').textContent = d.summary.completed;
      $('val-pending').textContent = d.summary.pending; $('val-cancelled').textContent = d.summary.cancelled;
      $('transaction-table-body').innerHTML = d.rows.length ? d.rows.map(o => `<tr data-id="${o.id}">
        <td>${esc(o.code)}</td><td>${fmtDateTime(o.date)}</td><td>${esc(o.customer)}</td><td style="text-align:left">${esc(o.items)}</td>
        <td>${peso(o.total)}</td><td>${esc(o.payment)}</td><td>${chip(o.status)}</td>
        <td>${o.status === 'Pending' ? '<button class="sy-btn small" data-s="Completed">Complete</button> ' : ''}${o.status !== 'Cancelled' ? '<button class="sy-x" data-s="Cancelled">Cancel</button>' : '-'}</td></tr>`).join('')
        : '<tr><td colspan="8" class="sy-empty">No transactions found.</td></tr>';
    } catch (e) { toast(e.message, true); }
  }
  $('btn-filter').addEventListener('click', load);
  $('f-search').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
  $('btn-reset').addEventListener('click', () => { $('f-search').value = ''; $('f-status').value = ''; $('f-range').value = ''; load(); });
  $('transaction-table-body').addEventListener('click', async e => {
    const s = e.target.dataset.s, row = e.target.closest('tr[data-id]'); if (!s || !row) return;
    if (s === 'Cancelled' && !confirm('Cancel this transaction and return its items to stock?')) return;
    try { await api(`/api/admin/transactions/${row.dataset.id}/status`, 'PUT', { status: s }); await load(); toast('Updated.'); } catch (err) { toast(err.message, true); }
  });
  initHeader(t => { $('f-search').value = t; load(); }); load();
})();
