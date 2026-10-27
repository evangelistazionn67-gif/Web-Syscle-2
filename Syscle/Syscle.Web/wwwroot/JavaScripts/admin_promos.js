(async function () {
    const $ = id => document.getElementById(id);
    if (!$('promo-table-body')) return;
    let promos = [];
    async function load() {
        try {
            promos = await api('/api/admin/promos');
            $('promo-table-body').innerHTML = promos.length ? promos.map(p => `<tr data-code="${esc(p.code)}">
        <td><b>${esc(p.code)}</b></td><td>${p.percent} %</td><td>${p.season ? esc(p.season) : '<span class="sy-muted">-</span>'}</td>
        <td>${p.startsAt || p.endsAt ? esc((p.startsAt || 'now') + ' to ' + (p.endsAt || 'no end')) : 'Always'}</td><td>${p.uses}${p.maxUses ? ' / ' + p.maxUses : ''}</td>
        <td>${(() => { const t = new Date().toISOString().slice(0, 10); const st = !p.isActive ? ['warn', 'Off'] : p.startsAt && t < p.startsAt ? ['warn', 'Scheduled'] : p.endsAt && t > p.endsAt ? ['bad', 'Expired'] : p.maxUses && p.uses >= p.maxUses ? ['bad', 'Used up'] : ['ok', 'Active']; return `<span class="sy-chip ${st[0]}">${st[1]}</span>`; })()}</td>
        <td><button class="sy-btn small" data-toggle="1">${p.isActive ? 'Turn off' : 'Turn on'}</button> <button class="sy-btn small ghost" data-pct="1">Change %</button> <button class="sy-x" data-del="1">Delete</button></td></tr>`).join('')
                : '<tr><td colspan="7" class="sy-empty">No promo codes yet.</td></tr>';
        } catch (e) { toast(e.message, true); }
    }
    $('pc-add').addEventListener('click', async () => {
        const code = $('pc-code').value.trim(), percent = +$('pc-pct').value;
        if (!code) return toast('Type a code.', true);
        const body = { code, percent, season: $('pc-season').value || null, startsAt: $('pc-start').value || null, endsAt: $('pc-end').value || null, maxUses: $('pc-max').value ? +$('pc-max').value : null };
        if (body.startsAt && body.endsAt && body.endsAt < body.startsAt) return toast('The end date must be after the start date.', true);
        try { await api('/api/admin/promos', 'POST', body); $('pc-code').value = $('pc-start').value = $('pc-end').value = $('pc-max').value = ''; $('pc-season').value = ''; await load(); toast('Promo code added.'); } catch (e) { toast(e.message, true); }
    });
    $('promo-table-body').addEventListener('click', async e => {
        const row = e.target.closest('tr[data-code]'); if (!row) return;
        const code = row.dataset.code, p = promos.find(x => x.code === code), url = '/api/admin/promos/' + encodeURIComponent(code);
        try {
            if (e.target.dataset.toggle) { await api(url, 'PUT', { isActive: !p.isActive }); await load(); }
            else if (e.target.dataset.pct) {
                const v = prompt('New discount percent for ' + code + ' (1-90):', p.percent); if (v === null) return;
                await api(url, 'PUT', { percent: +v }); await load(); toast('Updated.');
            } else if (e.target.dataset.del && confirm('Delete code ' + code + '?')) { await api(url, 'DELETE'); await load(); }
        } catch (err) { toast(err.message, true); }
    });
    initHeader(null); load();
})();

// frequent buyers card (shown above the code list)
(async function () {
  const box = document.getElementById('top-buyers'); if (!box) return;
  try {
    const b = await api('/api/admin/top-buyers?limit=5');
    box.innerHTML = b.length ? b.map((x, i) => `<div class="sy-rank"><span class="n">${i + 1}</span><div class="sy-grow"><b>${esc(x.username)}</b><small>${x.orders} order${x.orders > 1 ? 's' : ''} &middot; last ${fmtDate(x.lastOrder)}</small></div><b>${peso(x.spent)}</b></div>`).join('') : '<div class="sy-empty">No completed purchases yet.</div>';
  } catch (e) { box.innerHTML = '<div class="sy-empty">Could not load buyers.</div>'; }
})();
