(() => {
  const priorityEl = document.getElementById('prioritySystems');
  const tableBody = document.getElementById('systemsTableBody');
  const updatedEl = document.getElementById('systemsUpdated');
  const searchEl = document.getElementById('systemSearch');
  const filterEl = document.getElementById('systemFilter');
  if (!priorityEl || !tableBody) return;

  let systems = [];
  let priorityNames = new Set();

  const safe = (value, fallback = '—') => (value === null || value === undefined || value === '' ? fallback : value);
  const influence = value => typeof value === 'number' ? `${value.toFixed(1)}%` : safe(value);
  const priorityLabel = value => value ? '<span class="priority-badge">Priority</span>' : '<span class="muted">Standard</span>';

  function renderPriority() {
    const prioritySystems = systems.filter(s => s.priority || priorityNames.has(s.name));
    if (!prioritySystems.length) return;
    priorityEl.innerHTML = prioritySystems.map(system => `
      <article class="priority-system-card">
        <div class="priority-card-head"><span class="tag">Priority System</span><span class="priority-updated">${safe(system.updated, 'Awaiting update')}</span></div>
        <h3>${safe(system.name, 'Unnamed system')}</h3>
        <div class="priority-metrics">
          <div><span>Mongrel Influence</span><strong>${influence(system.influence)}</strong></div>
          <div><span>Control</span><strong>${safe(system.control)}</strong></div>
          <div><span>State</span><strong>${safe(system.state)}</strong></div>
        </div>
        <div class="priority-objective"><span>Public Objective</span><p>${safe(system.objective, 'No public objective posted.')}</p></div>
      </article>`).join('');
  }

  function renderTable() {
    const query = (searchEl?.value || '').trim().toLowerCase();
    const mode = filterEl?.value || 'all';
    const filtered = systems.filter(system => {
      const matchesSearch = !query || (system.name || '').toLowerCase().includes(query);
      const isPriority = system.priority || priorityNames.has(system.name);
      const controlText = String(system.control || '').toLowerCase();
      const matchesMode = mode === 'all' || (mode === 'priority' && isPriority) || (mode === 'control' && (system.controlled === true || controlText.includes('mongrel') || controlText === 'controlled'));
      return matchesSearch && matchesMode;
    });

    if (!filtered.length) {
      tableBody.innerHTML = `<tr class="systems-empty-row"><td colspan="6">${systems.length ? 'No systems match this view.' : 'System data has not been connected yet.'}</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(system => `
      <tr>
        <td><strong>${safe(system.name)}</strong>${system.note ? `<small>${system.note}</small>` : ''}</td>
        <td>${safe(system.control)}</td>
        <td>${influence(system.influence)}</td>
        <td>${safe(system.state)}</td>
        <td>${priorityLabel(system.priority || priorityNames.has(system.name))}</td>
        <td>${safe(system.objective)}</td>
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
      if (data.lastUpdated && updatedEl) updatedEl.textContent = data.lastUpdated;
      renderPriority();
      renderTable();
    })
    .catch(() => {
      if (updatedEl) updatedEl.textContent = 'Connection pending';
    });

  searchEl?.addEventListener('input', renderTable);
  filterEl?.addEventListener('change', renderTable);
})();
