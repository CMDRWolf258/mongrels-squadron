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
  if (!priorityEl || !tableBody) return;

  let systems = [];
  let priorityNames = new Set();

  const safe = (value, fallback = '—') => (value === null || value === undefined || value === '' ? fallback : value);
  const influence = value => typeof value === 'number' ? `${value.toFixed(1)}%` : safe(value);
  const controlled = system => system.controlled === true || /mongrel|controlled/i.test(String(system.control || ''));
  const isPriority = system => system.priority === true || priorityNames.has(system.name);
  const isWatch = system => Boolean(system.watch || system.alert || (Array.isArray(system.alerts) && system.alerts.length));
  const html = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

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

  function renderPriority() {
    const rows = systems.filter(isPriority);
    if (!rows.length) return;
    priorityEl.innerHTML = rows.map(system => `
      <article class="priority-system-card">
        <div class="priority-card-head">
          <div class="priority-card-tags"><span class="tag">Priority</span>${system.region ? `<span class="tag quiet-tag">${html(system.region)}</span>` : ''}</div>
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
        <td><strong>${html(safe(system.name))}</strong>${system.region || system.note ? `<small>${html([system.region, system.note].filter(Boolean).join(' · '))}</small>` : ''}</td>
        <td>${html(safe(system.control))}</td>
        <td><strong>${influence(system.influence)}</strong>${progressBar(system.influence, system)}${targetStatus(system) ? `<small class="table-target-status target-${targetStatus(system).key}">${html(targetStatus(system).label)}</small>` : ''}</td>
        <td>${html(safe(system.state))}</td>
        <td>${isPriority(system) ? '<span class="priority-badge">Priority</span>' : isWatch(system) ? '<span class="watch-badge">Watch</span>' : '<span class="muted">Standard</span>'}</td>
        <td>${html(safe(system.objective))}</td>
      </tr>`).join('');
  }

  fetch('../data/systems.json', {cache:'no-store'})
    .then(response => {
      if (!response.ok) throw new Error('Unable to load system data');
      return response.json();
    })
    .then(data => {
      systems = Array.isArray(data.systems) ? data.systems : [];
      priorityNames = new Set(Array.isArray(data.prioritySystems) ? data.prioritySystems : []);
      const lastUpdated = data.lastUpdated || null;
      if (updatedEl) updatedEl.textContent = lastUpdated || 'Not connected';
      renderSummary(lastUpdated);
      renderPriority();
      renderWatch();
      renderTable();
    })
    .catch(() => {
      if (updatedEl) updatedEl.textContent = 'Connection pending';
      if (summaryUpdated) summaryUpdated.textContent = 'Pending';
    });

  searchEl?.addEventListener('input', renderTable);
  filterEl?.addEventListener('change', renderTable);
  sortEl?.addEventListener('change', renderTable);
})();
