(() => {
  const squadGrid = document.querySelector('#squadTradeGrid');
  const creditGrid = document.querySelector('#creditTradeGrid');
  if (!squadGrid || !creditGrid) return;

  const squadEmpty = document.querySelector('#squadTradeEmpty');
  const creditEmpty = document.querySelector('#creditTradeEmpty');
  const search = document.querySelector('#tradeSearch');
  const padFilter = document.querySelector('#tradePadFilter');
  const sort = document.querySelector('#tradeSort');
  let routes = [];

  const n = value => Number(value || 0);
  const fmt = value => n(value).toLocaleString();
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dateLabel = value => {
    if (!value) return 'Not dated';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  };

  function card(route) {
    const priority = route.category === 'squad' ? `<span class="trade-priority ${escapeHtml(route.priority || 'normal')}">${escapeHtml(route.priority || 'Squad')}</span>` : '';
    const profit = route.profitPerTon ? `${fmt(route.profitPerTon)} Cr/t` : 'Objective route';
    const total = route.estimatedLoopProfit ? `${fmt(route.estimatedLoopProfit)} Cr / loop` : '';
    const tags = (route.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
    return `<article class="trade-card">
      <div class="trade-card-head"><div><p class="trade-kicker">${escapeHtml(route.commodity || 'Commodity')}</p><h3>${escapeHtml(route.title || `${route.originSystem || ''} → ${route.destinationSystem || ''}`)}</h3></div>${priority}</div>
      <div class="trade-route-line"><div><span>Buy / Load</span><strong>${escapeHtml(route.originStation || '—')}</strong><small>${escapeHtml(route.originSystem || '')}</small></div><div class="trade-arrow">→</div><div><span>Sell / Deliver</span><strong>${escapeHtml(route.destinationStation || '—')}</strong><small>${escapeHtml(route.destinationSystem || '')}</small></div></div>
      <div class="trade-metrics">
        <div><span>Profit</span><strong>${profit}</strong>${total ? `<small>${total}</small>` : ''}</div>
        <div><span>Pad</span><strong>${escapeHtml(route.padSize || 'Unknown')}</strong></div>
        <div><span>Distance</span><strong>${route.distanceLy ? `${escapeHtml(route.distanceLy)} ly` : '—'}</strong></div>
      </div>
      ${route.objective ? `<p class="trade-objective"><strong>Objective:</strong> ${escapeHtml(route.objective)}</p>` : ''}
      ${route.notes ? `<p class="trade-notes">${escapeHtml(route.notes)}</p>` : ''}
      <div class="trade-card-foot"><div class="trade-tags">${tags}</div><small>Updated ${dateLabel(route.updated)}</small></div>
    </article>`;
  }

  function render() {
    const squad = routes.filter(r => r.category === 'squad' && r.active !== false);
    squadGrid.innerHTML = squad.map(card).join('');
    squadEmpty.hidden = squad.length > 0;

    const q = (search.value || '').trim().toLowerCase();
    const pad = padFilter.value;
    let credit = routes.filter(r => r.category === 'credits' && r.active !== false);
    credit = credit.filter(r => {
      const hay = [r.title,r.commodity,r.originStation,r.originSystem,r.destinationStation,r.destinationSystem,r.notes,...(r.tags||[])].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (pad === 'all' || String(r.padSize || '').toLowerCase() === pad);
    });
    if (sort.value === 'profit-desc') credit.sort((a,b)=>n(b.profitPerTon)-n(a.profitPerTon));
    if (sort.value === 'updated-desc') credit.sort((a,b)=>new Date(b.updated||0)-new Date(a.updated||0));
    if (sort.value === 'commodity-asc') credit.sort((a,b)=>String(a.commodity||'').localeCompare(String(b.commodity||'')));
    creditGrid.innerHTML = credit.map(card).join('');
    creditEmpty.hidden = credit.length > 0;

    document.querySelector('#squadRouteCount').textContent = squad.length;
    document.querySelector('#creditRouteCount').textContent = routes.filter(r=>r.category==='credits' && r.active !== false).length;
    const maxProfit = Math.max(0, ...routes.filter(r=>r.active !== false).map(r=>n(r.profitPerTon)));
    document.querySelector('#topProfit').textContent = maxProfit ? `${fmt(maxProfit)} Cr/t` : '—';
  }

  fetch('../data/trades.json', {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error('Trade data unavailable'); return r.json(); })
    .then(data => { routes = Array.isArray(data) ? data : (data.routes || []); render(); })
    .catch(() => { routes = []; render(); });

  [search,padFilter,sort].forEach(el => el.addEventListener(el === search ? 'input' : 'change', render));
})();
