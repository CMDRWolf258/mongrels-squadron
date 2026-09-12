(() => {
  const grid = document.querySelector('[data-ship-grid]');
  if (!grid) return;

  const search = document.querySelector('[data-ship-search]');
  const roleSelect = document.querySelector('[data-ship-role]');
  const platformSelect = document.querySelector('[data-ship-platform]');
  const empty = document.querySelector('[data-ship-empty]');
  const buildCount = document.querySelector('[data-build-count]');
  const builderCount = document.querySelector('[data-builder-count]');
  const roleCount = document.querySelector('[data-role-count]');
  let builds = [];

  const safe = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const label = value => String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, m => m.toUpperCase());

  function getBuildSites(build) {
    const sites = [];
    if (build.buildSite) sites.push(String(build.buildSite).toLowerCase());
    (build.buildLinks || []).forEach(link => { if (link.site) sites.push(String(link.site).toLowerCase()); });
    return [...new Set(sites)];
  }

  function renderBuildLinks(build) {
    const links = Array.isArray(build.buildLinks) && build.buildLinks.length
      ? build.buildLinks
      : (build.buildUrl ? [{label:`Open ${String(build.buildSite || 'Build').toUpperCase()}`, site:build.buildSite, url:build.buildUrl}] : []);

    if (!links.length) return '';
    const actions = links.map(link => {
      if (!link.url || link.status === 'coming-soon') {
        return `<span class="ship-build-pending">${safe(link.label || 'Build')} · Coming Soon</span>`;
      }
      return `<a class="btn btn-ghost ship-build-link" href="${safe(link.url)}" target="_blank" rel="noopener">${safe(link.label || `Open ${String(link.site || 'Build').toUpperCase()}`)}</a>`;
    }).join('');
    return `<div class="ship-build-actions">${actions}</div>`;
  }

  function render() {
    const q = (search?.value || '').trim().toLowerCase();
    const role = roleSelect?.value || 'all';
    const platform = platformSelect?.value || 'all';

    const filtered = builds.filter(b => {
      const hay = [b.name,b.ship,b.commander,b.role,b.description,b.engineering,(b.tags||[]).join(' '),(b.buildLinks||[]).map(x=>x.label).join(' ')].join(' ').toLowerCase();
      const sites = getBuildSites(b);
      return (!q || hay.includes(q)) && (role === 'all' || b.role === role) && (platform === 'all' || sites.includes(platform));
    });

    grid.innerHTML = filtered.map(b => {
      const tags = (b.tags || []).map(x => `<span>${safe(x)}</span>`).join('');
      const image = b.image ? `<div class="ship-image"><img src="${safe(b.image)}" alt="${safe(b.name || b.ship)}"></div>` : `<div class="ship-image ship-image-placeholder"><span>${safe(b.ship || 'Ship')}</span></div>`;
      const sites = getBuildSites(b).map(x => x.toUpperCase()).join(' · ') || '—';
      return `<article class="ship-card">
        ${image}
        <div class="ship-card-body">
          <div class="ship-card-head"><div><p class="ship-kicker">${safe(b.ship || 'Member Build')}</p><h3>${safe(b.name || 'Unnamed Build')}</h3></div><span class="ship-role">${safe(label(b.role || 'general'))}</span></div>
          <p class="ship-builder">Submitted by <strong>${safe(b.commander || 'Mongrel CMDR')}</strong></p>
          ${b.description ? `<p class="ship-description">${safe(b.description)}</p>` : ''}
          <dl class="ship-meta">
            <div><dt>Engineering Level</dt><dd>${safe(b.engineering || 'Not listed')}</dd></div>
            <div><dt>Build Site</dt><dd>${safe(sites)}</dd></div>
          </dl>
          <div class="ship-card-foot"><div class="ship-tags">${tags}</div>${renderBuildLinks(b)}</div>
        </div>
      </article>`;
    }).join('');

    empty.hidden = filtered.length > 0;
  }

  function hydrateFilters() {
    [...new Set(builds.map(b => b.role).filter(Boolean))].sort().forEach(role => {
      const opt = document.createElement('option');
      opt.value = role;
      opt.textContent = label(role);
      roleSelect.appendChild(opt);
    });
  }

  fetch('../data/ships.json', {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error('Unable to load ships'); return r.json(); })
    .then(data => {
      builds = Array.isArray(data.builds) ? data.builds : [];
      hydrateFilters();
      if (buildCount) buildCount.textContent = String(builds.length);
      if (builderCount) builderCount.textContent = String(new Set(builds.map(b => b.commander).filter(Boolean)).size);
      if (roleCount) roleCount.textContent = String(new Set(builds.map(b => b.role).filter(Boolean)).size);
      render();
    })
    .catch(() => {
      empty.hidden = false;
      empty.querySelector('strong').textContent = 'Unable to load ship data.';
      empty.querySelector('p').textContent = 'Check data/ships.json for formatting errors.';
    });

  search?.addEventListener('input', render);
  roleSelect?.addEventListener('change', render);
  platformSelect?.addEventListener('change', render);
})();
