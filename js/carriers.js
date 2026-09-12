(() => {
  const grid = document.querySelector('[data-carrier-grid]');
  if (!grid) return;

  const search = document.querySelector('[data-carrier-search]');
  const roleSelect = document.querySelector('[data-carrier-role]');
  const statusSelect = document.querySelector('[data-carrier-status]');
  const empty = document.querySelector('[data-carrier-empty]');
  const movementGrid = document.querySelector('[data-movement-grid]');
  const movementEmpty = document.querySelector('[data-movement-empty]');
  const countEl = document.querySelector('[data-carrier-count]');
  const activeEl = document.querySelector('[data-carrier-active]');
  const movementsEl = document.querySelector('[data-carrier-movements]');

  let carriers = [];

  const safe = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const label = value => String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, m => m.toUpperCase());

  function renderCarriers() {
    const q = (search?.value || '').trim().toLowerCase();
    const role = roleSelect?.value || 'all';
    const status = statusSelect?.value || 'all';

    const filtered = carriers.filter(c => {
      const hay = [c.name,c.callsign,c.owner,c.currentSystem,c.role,c.status,(c.services||[]).join(' '),(c.tags||[]).join(' ')].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (role === 'all' || c.role === role) && (status === 'all' || c.status === status);
    });

    grid.innerHTML = filtered.map(c => {
      const services = (c.services || []).map(x => `<span>${safe(x)}</span>`).join('');
      const tags = (c.tags || []).map(x => `<span>${safe(x)}</span>`).join('');
      const ext = c.inaraUrl ? `<a class="btn btn-ghost carrier-link" href="${safe(c.inaraUrl)}" target="_blank" rel="noopener">View Carrier</a>` : '';
      return `<article class="carrier-card">
        <div class="carrier-card-head">
          <div><p class="carrier-kicker">${safe(c.callsign || 'Fleet Carrier')}</p><h3>${safe(c.name)}</h3></div>
          <span class="carrier-state carrier-state-${safe(c.status || 'active')}">${safe(label(c.status || 'active'))}</span>
        </div>
        <dl class="carrier-meta">
          <div><dt>Owner</dt><dd>${safe(c.owner || '—')}</dd></div>
          <div><dt>Current System</dt><dd>${safe(c.currentSystem || '—')}</dd></div>
          <div><dt>Role</dt><dd>${safe(label(c.role || 'general'))}</dd></div>
        </dl>
        ${c.notes ? `<p class="carrier-notes">${safe(c.notes)}</p>` : ''}
        <div class="carrier-services"><span class="carrier-label">Services</span><div>${services || '<span>Not listed</span>'}</div></div>
        <div class="carrier-card-foot"><div class="carrier-tags">${tags}</div>${ext}</div>
        ${c.lastUpdated ? `<small class="carrier-updated">Updated ${safe(c.lastUpdated)}</small>` : ''}
      </article>`;
    }).join('');

    empty.hidden = filtered.length > 0;
  }

  function renderMovements() {
    const moves = carriers.filter(c => c.movement && (c.movement.destination || c.movement.departureUTC));
    movementGrid.innerHTML = moves.map(c => {
      const m = c.movement || {};
      return `<article class="movement-card">
        <div class="movement-card-head"><div><p class="carrier-kicker">${safe(c.name)}</p><h3>${safe(c.currentSystem || 'Current Location')} <span>→</span> ${safe(m.destination || 'TBA')}</h3></div><span class="tag">${safe(m.status || 'Planned')}</span></div>
        <div class="movement-meta">
          <div><span>Departure</span><strong>${safe(m.departureUTC || 'TBA')}</strong></div>
          <div><span>Purpose</span><strong>${safe(m.purpose || 'Squad movement')}</strong></div>
          <div><span>Owner</span><strong>${safe(c.owner || '—')}</strong></div>
        </div>
        ${m.notes ? `<p>${safe(m.notes)}</p>` : ''}
      </article>`;
    }).join('');
    movementEmpty.hidden = moves.length > 0;
    if (movementsEl) movementsEl.textContent = String(moves.length);
  }

  function hydrateFilters() {
    const roles = [...new Set(carriers.map(c => c.role).filter(Boolean))].sort();
    roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role;
      option.textContent = label(role);
      roleSelect.appendChild(option);
    });
  }

  fetch('../data/carriers.json', {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error('Unable to load carriers'); return r.json(); })
    .then(data => {
      carriers = Array.isArray(data.carriers) ? data.carriers : [];
      hydrateFilters();
      if (countEl) countEl.textContent = String(carriers.length);
      if (activeEl) activeEl.textContent = String(carriers.filter(c => c.status === 'active').length);
      renderCarriers();
      renderMovements();
    })
    .catch(() => {
      empty.hidden = false;
      empty.querySelector('strong').textContent = 'Unable to load carrier data.';
      empty.querySelector('p').textContent = 'Check data/carriers.json for formatting errors.';
    });

  [search, roleSelect, statusSelect].forEach(el => el?.addEventListener(el === search ? 'input' : 'change', renderCarriers));
})();
