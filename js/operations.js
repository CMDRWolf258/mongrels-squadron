(() => {
  const priorityEl = document.getElementById('prioritySystems');
  const watchEl = document.getElementById('watchList');
  const tableBody = document.getElementById('systemsTableBody');
  const updatedEl = document.getElementById('systemsUpdated');
  const summaryTracked = document.getElementById('summaryTracked');
  const summaryControlled = document.getElementById('summaryControlled');
  const summaryPriority = document.getElementById('summaryPriority');
  const summaryUpdated = document.getElementById('summaryUpdated');
  const searchEl = document.getElementById('systemSearch');
  const filterEl = document.getElementById('systemFilter');
  const sortEl = document.getElementById('systemSort');
  const liveStatusEl = document.getElementById('bgsLiveStatus');
  const liveSourceEl = document.getElementById('bgsLiveSource');
  if (!priorityEl || !tableBody) return;

  let systems = [];
  let priorityNames = new Set();
  let liveMeta = null;

  const safe = (value, fallback = '—') => (value === null || value === undefined || value === '' ? fallback : value);
  const influence = value => typeof value === 'number' ? `${value.toFixed(1)}%` : safe(value);
  const controlled = system => system.controlled === true || /mongrel|controlled/i.test(String(system.control || ''));
  const isPriority = system => system.priority === true || priorityNames.has(system.name);
  const isWatch = system => Boolean(system.watch || system.alert || (Array.isArray(system.alerts) && system.alerts.length));
  const html = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatSnapshot(value) {
    const date = parseDate(value);
    if (!date) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(date);
  }

  function ageLabel(value) {
    const date = parseDate(value);
    if (!date) return null;
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 2) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} hr ago`;
    return `${Math.round(hours / 24)} days ago`;
  }

  function targetStatus(system) {
    const value = Number(system.influence);
    const min = Number(system.targetMin);
    const max = Number(system.targetMax);
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (value < min) return {key:'low', label:`Below target · ${min.toFixed(0)}–${max.toFixed(0)}%`};
    if (value > max) return {key:'high', label:`Above target · ${min.toFixed(0)}–${max.toFixed(0)}%`};
    return {key:'in', label:`In target · ${min.toFixed(0)}–${max.toFixed(0)}%`};
  }

  function progressBar(value, system = null) {
    if (typeof value !== 'number') return '';
    const width = Math.max(0, Math.min(100, value));
    let target = '';
    if (system && Number.isFinite(Number(system.targetMin)) && Number.isFinite(Number(system.targetMax))) {
      const min = Math.max(0, Math.min(100, Number(system.targetMin)));
      const max = Math.max(min, Math.min(100, Number(system.targetMax)));
      target = `<i class="inf-target-band" style="left:${min}%;width:${max-min}%" aria-hidden="true"></i>`;
    }
    return `<div class="inf-bar" aria-label="Influence ${value.toFixed(1)} percent">${target}<span style="width:${width}%"></span></div>`;
  }

  function renderSummary(lastUpdated) {
    const priorityCount = systems.filter(isPriority).length;
    const controlledCount = systems.filter(controlled).length;
    if (summaryTracked) summaryTracked.textContent = systems.length ? systems.length.toLocaleString() : '0';
    if (summaryControlled) summaryControlled.textContent = controlledCount.toLocaleString();
    if (summaryPriority) summaryPriority.textContent = priorityCount.toLocaleString();
    if (summaryUpdated) summaryUpdated.textContent = lastUpdated || 'Pending';
  }

  function renderLiveStatus() {
    const generated = liveMeta?.generatedAt;
    const success = Number(liveMeta?.successfulSystems || 0);
    const requested = Number(liveMeta?.requestedSystems || systems.length || 0);
    const age = ageLabel(generated);

    if (liveStatusEl) {
      if (!generated) {
        liveStatusEl.textContent = 'Awaiting first automatic sync';
        liveStatusEl.className = 'live-feed-pill waiting';
      } else if (success === requested && requested > 0) {
        liveStatusEl.textContent = `Live snapshot · ${age || 'updated'}`;
        liveStatusEl.className = 'live-feed-pill live';
      } else if (success > 0) {
        liveStatusEl.textContent = `Partial snapshot · ${success}/${requested} systems`;
        liveStatusEl.className = 'live-feed-pill partial';
      } else {
        liveStatusEl.textContent = 'Using last known/manual values';
        liveStatusEl.className = 'live-feed-pill waiting';
      }
    }
    if (liveSourceEl) liveSourceEl.textContent = liveMeta?.source || 'EliteHub Vault / EDDN';
  }

  function liveTag(system) {
    if (!system.live) return '<span class="data-origin manual">Manual fallback</span>';
    if (system.liveStale) return '<span class="data-origin stale">Last known live</span>';
    return '<span class="data-origin live">Live BGS</span>';
  }

  function renderPriority() {
    const rows = systems.filter(isPriority);
    if (!rows.length) return;
    priorityEl.innerHTML = rows.map(system => `
      <article class="priority-system-card">
        <div class="priority-card-head">
          <div class="priority-card-tags"><span class="tag">Priority</span>${system.region ? `<span class="tag quiet-tag">${html(system.region)}</span>` : ''}${liveTag(system)}</div>
          <span class="priority-updated">${html(safe(system.updated, 'Awaiting update'))}</span>
        </div>
        <h3>${html(safe(system.name, 'Unnamed system'))}</h3>
        <div class="priority-influence-block">
          <div><span>Mongrel Influence</span><strong>${influence(system.influence)}</strong></div>
          ${progressBar(system.influence, system)}
          ${targetStatus(system) ? `<div class="target-status target-${targetStatus(system).key}">${html(targetStatus(system).label)}</div>` : ''}
        </div>
        <div class="priority-metrics">
          <div><span>Control</span><strong>${html(safe(system.control))}</strong></div>
          <div><span>State</span><strong>${html(safe(system.state))}</strong></div>
          <div><span>Security</span><strong>${html(safe(system.security))}</strong></div>
        </div>
        ${Array.isArray(system.pendingStates) && system.pendingStates.length ? `<div class="bgs-state-line"><span>Pending</span><strong>${html(system.pendingStates.join(', '))}</strong></div>` : ''}
        ${Array.isArray(system.recoveringStates) && system.recoveringStates.length ? `<div class="bgs-state-line"><span>Recovering</span><strong>${html(system.recoveringStates.join(', '))}</strong></div>` : ''}
        <div class="priority-objective"><span>Public Objective</span><p>${html(safe(system.objective, 'No public objective posted.'))}</p></div>
      </article>`).join('');
  }

  function renderWatch() {
    if (!watchEl) return;
    const rows = systems.filter(isWatch);
    if (!rows.length) return;
    watchEl.innerHTML = rows.map(system => {
      const alerts = Array.isArray(system.alerts) ? system.alerts : [system.alert || system.watch].filter(Boolean);
      return `<article class="bgs-watch-card">
        <div><span class="bgs-watch-label">Watch</span><h3>${html(safe(system.name))}</h3></div>
        <div class="bgs-watch-alerts">${alerts.map(a => `<span>${html(a)}</span>`).join('')}</div>
        <p>${html(safe(system.watchNote || system.objective, 'Operational attention recommended.'))}</p>
      </article>`;
    }).join('');
  }

  function sortedSystems(list) {
    const mode = sortEl?.value || 'name';
    return [...list].sort((a,b) => {
      if (mode === 'influence-desc') return (Number(b.influence) || -Infinity) - (Number(a.influence) || -Infinity);
      if (mode === 'influence-asc') return (Number(a.influence) || Infinity) - (Number(b.influence) || Infinity);
      if (mode === 'priority') return Number(isPriority(b)) - Number(isPriority(a)) || String(a.name || '').localeCompare(String(b.name || ''));
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function renderTable() {
    const query = (searchEl?.value || '').trim().toLowerCase();
    const mode = filterEl?.value || 'all';
    const filtered = systems.filter(system => {
      const matchesSearch = !query || [system.name, system.state, system.control, system.objective, system.region].some(v => String(v || '').toLowerCase().includes(query));
      const matchesMode = mode === 'all' ||
        (mode === 'priority' && isPriority(system)) ||
        (mode === 'watch' && isWatch(system)) ||
        (mode === 'control' && controlled(system)) ||
        (mode === 'not-control' && !controlled(system));
      return matchesSearch && matchesMode;
    });
    const rows = sortedSystems(filtered);

    if (!rows.length) {
      tableBody.innerHTML = `<tr class="systems-empty-row"><td colspan="6">${systems.length ? 'No systems match this view.' : 'System data has not been connected yet.'}</td></tr>`;
      return;
    }

    tableBody.innerHTML = rows.map(system => `
      <tr>
        <td><strong>${html(safe(system.name))}</strong>${system.region || system.note ? `<small>${html([system.region, system.note].filter(Boolean).join(' · '))}</small>` : ''}<small>${liveTag(system)}</small></td>
        <td>${html(safe(system.control))}</td>
        <td><strong>${influence(system.influence)}</strong>${progressBar(system.influence, system)}${targetStatus(system) ? `<small class="table-target-status target-${targetStatus(system).key}">${html(targetStatus(system).label)}</small>` : ''}</td>
        <td>${html(safe(system.state))}${Array.isArray(system.pendingStates) && system.pendingStates.length ? `<small>Pending: ${html(system.pendingStates.join(', '))}</small>` : ''}</td>
        <td>${isPriority(system) ? '<span class="priority-badge">Priority</span>' : isWatch(system) ? '<span class="watch-badge">Watch</span>' : '<span class="muted">Standard</span>'}</td>
        <td>${html(safe(system.objective))}</td>
      </tr>`).join('');
  }

  function mergeLive(config, live) {
    const liveByName = new Map((Array.isArray(live?.systems) ? live.systems : []).map(row => [row.name, row]));
    return (Array.isArray(config.systems) ? config.systems : []).map(base => {
      const observed = liveByName.get(base.name);
      if (!observed || typeof observed.influence !== 'number') return {...base, live:false};
      const merged = {...base};
      for (const key of ['influence','controlled','control','state','security','population','activeStates','pendingStates','recoveringStates']) {
        if (observed[key] !== null && observed[key] !== undefined && observed[key] !== '') merged[key] = observed[key];
      }
      merged.live = true;
      merged.liveStale = observed.stale === true || observed.ok === false;
      merged.sourceUpdated = observed.sourceUpdated || observed.fetchedAt || null;
      const formatted = formatSnapshot(merged.sourceUpdated || observed.fetchedAt);
      if (formatted) merged.updated = formatted;
      return merged;
    });
  }

  Promise.all([
    fetch('../data/systems.json', {cache:'no-store'}).then(response => {
      if (!response.ok) throw new Error('Unable to load system configuration');
      return response.json();
    }),
    fetch('../data/live-bgs.json', {cache:'no-store'}).then(response => response.ok ? response.json() : null).catch(() => null)
  ])
    .then(([config, live]) => {
      liveMeta = live;
      systems = mergeLive(config, live);
      priorityNames = new Set(Array.isArray(config.prioritySystems) ? config.prioritySystems : []);
      const liveUpdated = formatSnapshot(live?.generatedAt);
      const lastUpdated = liveUpdated || config.lastUpdated || null;
      if (updatedEl) updatedEl.textContent = lastUpdated || 'Not connected';
      renderSummary(lastUpdated);
      renderLiveStatus();
      renderPriority();
      renderWatch();
      renderTable();
    })
    .catch(() => {
      if (updatedEl) updatedEl.textContent = 'Connection pending';
      if (summaryUpdated) summaryUpdated.textContent = 'Pending';
      if (liveStatusEl) liveStatusEl.textContent = 'BGS data unavailable';
    });

  searchEl?.addEventListener('input', renderTable);
  filterEl?.addEventListener('change', renderTable);
  sortEl?.addEventListener('change', renderTable);
})();
