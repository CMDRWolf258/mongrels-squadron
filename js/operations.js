(() => {
  const gate = document.querySelector('[data-mc-gate]');
  const privateView = document.querySelector('[data-mission-control-private]');
  const gateStatus = document.querySelector('[data-mc-gate-status]');
  const loginLink = document.querySelector('[data-mc-login]');
  const viewerEl = document.querySelector('[data-mc-viewer]');

  const priorityEl = document.getElementById('prioritySystems');
  const watchEl = document.getElementById('watchList');
  const tableBody = document.getElementById('systemsTableBody');
  const updatedEl = document.getElementById('systemsUpdated');
  const summaryPresence = document.getElementById('summaryPresence');
  const summaryControlled = document.getElementById('summaryControlled');
  const summaryPriority = document.getElementById('summaryPriority');
  const summaryAttention = document.getElementById('summaryAttention');
  const summaryActiveOrders = document.getElementById('summaryActiveOrders');
  const summaryUpdated = document.getElementById('summaryUpdated');
  const searchEl = document.getElementById('systemSearch');
  const filterEl = document.getElementById('systemFilter');
  const sortEl = document.getElementById('systemSort');
  const shownEl = document.getElementById('systemsShown');
  const countDetailEl = document.getElementById('systemsCountDetail');
  const pageSizeEl = document.getElementById('systemsPageSize');
  const prevPageEl = document.getElementById('systemsPrev');
  const nextPageEl = document.getElementById('systemsNext');
  const pageStatusEl = document.getElementById('systemsPageStatus');
  const liveStatusEl = document.getElementById('bgsLiveStatus');
  const liveSourceEl = document.getElementById('bgsLiveSource');
  const playbookNote = document.getElementById('memberPlaybookNote');
  const benchmarksEl = document.getElementById('memberBenchmarks');
  const recipesEl = document.getElementById('memberRecipes');
  const strategyManager = document.querySelector('[data-strategy-manager]');
  const strategyToggle = document.querySelector('[data-strategy-toggle]');
  const strategyEditor = document.querySelector('[data-strategy-editor]');
  const strategyList = document.querySelector('[data-strategy-list]');
  const strategyAdd = document.querySelector('[data-strategy-add]');
  const strategySave = document.querySelector('[data-strategy-save]');
  const strategyStatus = document.querySelector('[data-strategy-status]');
  const systemNamesList = document.getElementById('missionControlSystemNames');

  let systems = [];
  let meta = null;
  let playbook = null;
  let strategy = null;
  let canManage = false;
  let strategyBaseline = '';
  let currentPage = 1;
  let pageSize = 15;

  const safe = (value, fallback = '—') => (value === null || value === undefined || value === '' ? fallback : value);
  const html = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const influence = value => typeof value === 'number' ? `${value.toFixed(1)}%` : safe(value);
  const controlled = system => system.controlled === true || /regiment of imperial mongrels|mongrels/i.test(String(system.control || ''));
  const activePresence = system => system.present === true && !system.formerPresence;

  if (loginLink) {
    const returnPath = `/operations/${window.location.hash || ''}`;
    loginLink.href = `/api/auth/login?return=${encodeURIComponent(returnPath)}`;
  }

  function setAccess(view) {
    if (gate) gate.hidden = view === 'member';
    if (privateView) privateView.hidden = view !== 'member';
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatSnapshot(value, compact = false) {
    const date = parseDate(value);
    if (!date) return null;
    return new Intl.DateTimeFormat(undefined, compact
      ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    ).format(date);
  }

  function newestTimestamp(...values) {
    let best=null,bestMs=-Infinity;
    for (const value of values) {
      const date=parseDate(value);
      if (!date) continue;
      if (date.getTime()>bestMs){best=date.toISOString();bestMs=date.getTime();}
    }
    return best;
  }

  function ageHours(value) {
    const date = parseDate(value);
    if (!date) return null;
    return Math.max(0, (Date.now() - date.getTime()) / 3600000);
  }

  function ageLabel(value) {
    const hours = ageHours(value);
    if (hours === null) return 'Unknown age';
    if (hours < (2 / 60)) return 'just now';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`;
    if (hours < 48) return `${Math.round(hours)} hr ago`;
    return `${Math.round(hours / 24)} days ago`;
  }

  function freshness(system) {
    if (system.formerPresence || system.present === false) return { key: 'former', label: 'Former presence', detail: system.retiredAt ? `Removed ${ageLabel(system.retiredAt)}` : 'No longer in active presence feed', rank: 4 };
    const stamp = system.freshestUpdatedAt || system.sourceUpdated;
    const scoutSource = system.freshestSource === 'Mongrel Scout / EDMC' || system.sourceKind === 'scout';
    if (stamp) {
      const hours = ageHours(stamp);
      if (hours === null) return { key: 'unknown', label: 'Unknown', detail: 'Source timestamp unreadable', rank: 3 };
      const sourceLabel = scoutSource
        ? 'Live Scout'+(system.scoutLabel ? ' · '+system.scoutLabel : '')
        : (system.freshestSource || system.source || 'EliteHub Vault / EDDN');
      const detail = sourceLabel+' · '+ageLabel(stamp);
      if (hours <= 6 && (!system.stale || scoutSource)) return { key: 'fresh', label: 'Fresh', detail, rank: 0 };
      if (hours <= 24 && (!system.stale || scoutSource)) return { key: 'aging', label: 'Aging', detail, rank: 1 };
      return { key: 'stale', label: 'Stale', detail, rank: 2 };
    }
    if (system.stale === true) return { key: 'stale', label: 'Last known', detail: 'Upstream source age unavailable', rank: 3 };
    const syncStamp = system.fetchedAt || system.lastSeen;
    if (syncStamp) return { key: 'sync', label: 'Synced', detail: `Fetched ${ageLabel(syncStamp)} · source age unknown`, rank: 1 };
    return { key: 'unknown', label: 'Unknown', detail: 'No source timestamp', rank: 3 };
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function targetStatus(system) {
    const value = finiteNumber(system.influence);
    const min = finiteNumber(system.targetMin);
    const max = finiteNumber(system.targetMax);
    if (value === null || min === null || max === null) return null;
    const source = system.targetSource === 'manual' ? 'manual target' : 'default target';
    if (value < min) return { key:'low', label:`Below ${source} · ${min.toFixed(0)}–${max.toFixed(0)}%` };
    if (value > max) return { key:'high', label:`Above ${source} · ${min.toFixed(0)}–${max.toFixed(0)}%` };
    return { key:'in', label:`In ${source} · ${min.toFixed(0)}–${max.toFixed(0)}%` };
  }

  function progressBar(value, system = null) {
    if (typeof value !== 'number') return '';
    const width = Math.max(0, Math.min(100, value));
    let target = '';
    const rawMin = system ? finiteNumber(system.targetMin) : null;
    const rawMax = system ? finiteNumber(system.targetMax) : null;
    if (rawMin !== null && rawMax !== null) {
      const min = Math.max(0, Math.min(100, rawMin));
      const max = Math.max(min, Math.min(100, rawMax));
      target = `<i class="inf-target-band" style="left:${min}%;width:${max-min}%" aria-hidden="true"></i>`;
    }
    return `<div class="inf-bar" aria-label="Influence ${value.toFixed(1)} percent">${target}<span style="width:${width}%"></span></div>`;
  }

  function systemNameMarkup(name, heading = false) {
    const value = safe(name, 'Unnamed system');
    const tag = heading ? 'h3' : 'strong';
    const wrapper = heading ? 'div' : 'span';
    return `<${wrapper} class="operation-system-name"><${tag}>${html(value)}</${tag}><button class="system-copy-button operation-system-copy" type="button" data-copy-system="${html(value)}" aria-label="Copy system name ${html(value)}" title="Copy system name">⧉</button></${wrapper}>`;
  }

  function operationalTags(system) {
    const tags = [];
    if (system.priority) tags.push('<span class="priority-badge">Priority</span>');
    if (system.watch) tags.push('<span class="watch-badge">Watch</span>');
    if (system.conflict) tags.push('<span class="mc-risk-badge conflict">Conflict</span>');
    if (system.expansionRisk) tags.push('<span class="mc-risk-badge expansion">Expansion</span>');
    if (system.retreatRisk) tags.push('<span class="mc-risk-badge retreat">Retreat warning</span>');
    const target = targetStatus(system);
    if (target?.key === 'low') tags.push('<span class="mc-risk-badge low">Below target</span>');
    if (target?.key === 'high') tags.push('<span class="mc-risk-badge high">Above target</span>');
    if (!tags.length) tags.push('<span class="muted">Standard</span>');
    return tags.join(' ');
  }

  function renderSummary() {
    const active = systems.filter(activePresence);
    const controlledCount = active.filter(controlled).length;
    const priorityCount = active.filter(system => system.priority).length;
    const attentionCount = active.filter(system => system.attention).length;
    if (summaryPresence) summaryPresence.textContent = (meta?.presenceCount ?? active.length).toLocaleString();
    if (summaryControlled) summaryControlled.textContent = (meta?.controlledCount ?? controlledCount).toLocaleString();
    if (summaryPriority) summaryPriority.textContent = (meta?.priorityCount ?? priorityCount).toLocaleString();
    if (summaryAttention) summaryAttention.textContent = (meta?.attentionCount ?? attentionCount).toLocaleString();
    if (summaryActiveOrders && !summaryActiveOrders.dataset.resolved) summaryActiveOrders.textContent = '—';
    if (summaryUpdated) summaryUpdated.textContent = formatSnapshot(newestTimestamp(meta?.generatedAt,meta?.newestScoutAt), true) || 'Pending';
  }

  function renderLiveStatus() {
    if (updatedEl) updatedEl.textContent = formatSnapshot(newestTimestamp(meta?.generatedAt,meta?.newestScoutAt), true) || 'Awaiting sync';
    if (liveSourceEl) liveSourceEl.textContent = Number(meta?.scoutSnapshotCount||0)>0
      ? (meta?.source || 'EliteHub Vault / EDDN')+' + Live Scout'
      : (meta?.source || 'EliteHub Vault / EDDN');
    if (!liveStatusEl) return;
    if (!meta?.generatedAt) {
      liveStatusEl.textContent = 'Awaiting first automatic sync';
      liveStatusEl.className = 'live-feed-pill waiting';
      return;
    }
    const errors = Array.isArray(meta?.syncErrors) ? meta.syncErrors.length : 0;
    liveStatusEl.textContent = errors ? `Snapshot with ${errors} warning${errors === 1 ? '' : 's'} · ${ageLabel(meta.generatedAt)}` : `Snapshot synced · ${ageLabel(meta.generatedAt)}`;
    liveStatusEl.className = errors ? 'live-feed-pill partial' : 'live-feed-pill live';
  }

  function renderPriority() {
    if (!priorityEl) return;
    const rows = systems.filter(system => activePresence(system) && system.priority);
    if (!rows.length) {
      priorityEl.innerHTML = '<div class="data-empty-state"><span class="data-empty-icon">◇</span><div><strong>No priority systems configured.</strong><p>Live All Systems data can still be used while leadership strategy is updated.</p></div></div>';
      return;
    }
    priorityEl.innerHTML = rows.map(system => {
      const fresh = freshness(system);
      const target = targetStatus(system);
      return `<article class="priority-system-card">
        <div class="priority-card-head"><div class="priority-card-tags"><span class="tag">Priority</span>${system.watch ? '<span class="tag quiet-tag">Watch</span>' : ''}<span class="data-origin ${fresh.key}">${html(fresh.label)}</span></div><span class="priority-updated">${html(fresh.detail)}</span></div>
        ${systemNameMarkup(system.name, true)}
        <div class="priority-influence-block"><div><span>Mongrel Influence</span><strong>${influence(system.influence)}</strong></div>${progressBar(system.influence, system)}${target ? `<div class="target-status target-${target.key}">${html(target.label)}</div>` : ''}</div>
        <div class="priority-metrics"><div><span>Control</span><strong>${html(safe(system.control, controlled(system) ? 'Mongrels' : 'Unknown'))}</strong></div><div><span>State</span><strong>${html(safe(system.state))}</strong></div><div><span>Security</span><strong>${html(safe(system.security))}</strong></div></div>
        ${Array.isArray(system.pendingStates) && system.pendingStates.length ? `<div class="bgs-state-line"><span>Pending</span><strong>${html(system.pendingStates.join(', '))}</strong></div>` : ''}
        ${Array.isArray(system.desiredStates) && system.desiredStates.length ? `<div class="bgs-state-line"><span>Desired</span><strong>${html(system.desiredStates.join(' + '))}</strong></div>` : ''}
        <div class="priority-objective"><span>Private Objective</span><p>${html(safe(system.objective, 'No leadership objective posted.'))}</p></div>
      </article>`;
    }).join('');
  }

  function renderWatch() {
    if (!watchEl) return;
    const rows = systems.filter(system => activePresence(system) && system.attention);
    if (!rows.length) {
      watchEl.innerHTML = '<div class="data-empty-state slim-empty"><span class="data-empty-icon">△</span><div><strong>No active watch-list alerts.</strong><p>Nothing is currently outside configured bands or flagged by the automatic risk checks.</p></div></div>';
      return;
    }
    watchEl.innerHTML = rows
      .sort((a,b) => Number(Boolean(b.priority)) - Number(Boolean(a.priority)) || Number(b.influence || 0) - Number(a.influence || 0))
      .slice(0, 30)
      .map(system => {
        const alerts = Array.isArray(system.alerts) && system.alerts.length ? system.alerts : ['Operational attention recommended'];
        return `<article class="bgs-watch-card"><div><span class="bgs-watch-label">${system.priority ? 'Priority Watch' : 'Watch'}</span>${systemNameMarkup(system.name, true)}</div><div class="bgs-watch-alerts">${alerts.map(alert => `<span>${html(alert)}</span>`).join('')}</div><p>${html(safe(system.watchNote || system.objective, 'Review this system before committing BGS work.'))}</p></article>`;
      }).join('');
  }

  function renderPlaybook() {
    if (!playbook) return;
    if (playbookNote) playbookNote.textContent = playbook.note || '';
    if (benchmarksEl) {
      const rows = Array.isArray(playbook.benchmarks) ? playbook.benchmarks : [];
      benchmarksEl.innerHTML = rows.length ? rows.map(row => `<tr><td><strong>${html(row.activity)}</strong></td><td>${html(row.small)}</td><td>${html(row.medium)}</td><td>${html(row.large)}</td><td>${html(row.measure)}</td></tr>`).join('') : '<tr><td colspan="5">No benchmarks posted.</td></tr>';
    }
    if (recipesEl) {
      const recipes = Array.isArray(playbook.recipes) ? playbook.recipes : [];
      recipesEl.innerHTML = recipes.map(recipe => `<details class="member-playbook-disclosure member-recipe-disclosure"><summary><span><strong>${html(recipe.title)}</strong><small>Open operational steps</small></span><b aria-hidden="true">+</b></summary><div class="member-playbook-disclosure-body"><ul>${(recipe.steps || []).map(step => `<li>${html(step)}</li>`).join('')}</ul></div></details>`).join('');
    }
  }

  function makeStrategyRow(row = {}) {
    const article = document.createElement('article');
    article.className = 'strategy-editor-row';
    article.innerHTML = `
      <div class="strategy-row-grid">
        <label class="strategy-field strategy-field-system"><span>System</span><input type="text" list="missionControlSystemNames" maxlength="120" data-strategy-field="name" placeholder="System name"></label>
        <label class="strategy-field"><span>Target min % <small>(blank = default)</small></span><input type="number" min="0" max="100" step="0.1" data-strategy-field="targetMin" placeholder="Default"></label>
        <label class="strategy-field"><span>Target max % <small>(blank = default)</small></span><input type="number" min="0" max="100" step="0.1" data-strategy-field="targetMax" placeholder="Default"></label>
        <label class="strategy-check"><input type="checkbox" data-strategy-field="priority"><span>Priority</span></label>
        <label class="strategy-check"><input type="checkbox" data-strategy-field="watch"><span>Watch</span></label>
        <label class="strategy-field strategy-field-wide"><span>Desired states <small>comma separated</small></span><input type="text" maxlength="220" data-strategy-field="desiredStates" placeholder="Boom, Civil Liberty"></label>
        <label class="strategy-field strategy-field-wide"><span>Objective</span><textarea rows="2" maxlength="700" data-strategy-field="objective" placeholder="Private leadership objective"></textarea></label>
        <label class="strategy-field strategy-field-wide"><span>Watch note</span><textarea rows="2" maxlength="700" data-strategy-field="watchNote" placeholder="Why this system needs attention"></textarea></label>
      </div>
      <button class="strategy-row-remove" type="button">Remove</button>`;
    const set = (field, value) => {
      const input = article.querySelector(`[data-strategy-field="${field}"]`);
      if (!input) return;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else if (Array.isArray(value)) input.value = value.join(', ');
      else if (value !== null && value !== undefined) input.value = value;
    };
    ['name','targetMin','targetMax','priority','watch','desiredStates','objective','watchNote'].forEach(field => set(field, row[field]));
    article.querySelector('.strategy-row-remove')?.addEventListener('click', () => article.remove());
    return article;
  }

  function populateStrategyEditor() {
    if (!strategyList) return;
    const defaults = strategy?.defaults || { controlledMin:40, controlledMax:65, nonControlledMin:15, nonControlledMax:65, retreatWarning:5 };
    document.querySelectorAll('[data-strategy-default]').forEach(input => {
      const key = input.dataset.strategyDefault;
      if (Object.prototype.hasOwnProperty.call(defaults, key)) input.value = defaults[key];
    });
    strategyList.replaceChildren();
    const rows = Array.isArray(strategy?.systems) ? strategy.systems : [];
    rows.forEach(row => strategyList.appendChild(makeStrategyRow(row)));
    strategyBaseline = JSON.stringify(collectStrategy());
  }

  function collectStrategy() {
    if (!strategyList) return { systems: [] };
    const defaultValue = (key, fallback) => {
      const input = document.querySelector(`[data-strategy-default="${key}"]`);
      const value = finiteNumber(input?.value);
      return value === null ? fallback : value;
    };
    const defaults = {
      controlledMin: defaultValue('controlledMin', 40),
      controlledMax: defaultValue('controlledMax', 65),
      nonControlledMin: defaultValue('nonControlledMin', 15),
      nonControlledMax: defaultValue('nonControlledMax', 65),
      retreatWarning: defaultValue('retreatWarning', 5),
    };
    const rows = [...strategyList.querySelectorAll('.strategy-editor-row')].map(article => {
      const get = field => article.querySelector(`[data-strategy-field="${field}"]`);
      const numberOrNull = value => {
        if (value === '' || value === null || value === undefined) return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      };
      const desiredStates = String(get('desiredStates')?.value || '').split(',').map(x => x.trim()).filter(Boolean);
      return {
        name: String(get('name')?.value || '').trim(),
        targetMin: numberOrNull(get('targetMin')?.value),
        targetMax: numberOrNull(get('targetMax')?.value),
        priority: Boolean(get('priority')?.checked),
        watch: Boolean(get('watch')?.checked),
        desiredStates,
        objective: String(get('objective')?.value || '').trim(),
        watchNote: String(get('watchNote')?.value || '').trim(),
      };
    }).filter(row => row.name);
    return { version: 2, defaults, systems: rows, prioritySystems: rows.filter(row => row.priority).map(row => row.name) };
  }

  function setupStrategyManager() {
    if (!strategyManager) return;
    strategyManager.hidden = !canManage;
    if (!canManage) return;
    if (systemNamesList) {
      systemNamesList.replaceChildren();
      systems.filter(activePresence).forEach(system => {
        const option = document.createElement('option');
        option.value = system.name;
        systemNamesList.appendChild(option);
      });
    }
    populateStrategyEditor();
  }

  strategyToggle?.addEventListener('click', () => {
    if (!canManage || !strategyEditor) return;
    const opening = strategyEditor.hidden;
    strategyEditor.hidden = !opening;
    strategyToggle.textContent = opening ? 'Close Editor' : 'Edit Strategy';
    if (opening) populateStrategyEditor();
  });

  strategyAdd?.addEventListener('click', () => {
    if (!canManage || !strategyList) return;
    strategyList.appendChild(makeStrategyRow({ priority: true }));
    strategyList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  strategyEditor?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!canManage) return;
    const payload = collectStrategy();
    if (strategySave) strategySave.disabled = true;
    if (strategyStatus) { strategyStatus.textContent = 'Saving private strategy…'; strategyStatus.dataset.state = 'working'; }
    try {
      const response = await fetch('/api/operations/systems', {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Mongrels-Request': 'mission-control-strategy',
        },
        body: JSON.stringify(payload),
      });
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(next.error || `Save failed (${response.status})`);
      systems = Array.isArray(next.systems) ? next.systems : systems;
      meta = next.meta || meta;
      playbook = next.playbook || playbook;
      strategy = next.strategy || payload;
      strategyBaseline = JSON.stringify(collectStrategy());
      if (strategyStatus) { strategyStatus.textContent = 'Private strategy saved.'; strategyStatus.dataset.state = 'success'; }
      renderSummary(); renderLiveStatus(); renderPriority(); renderWatch(); renderTable();
      populateStrategyEditor();
    } catch (error) {
      console.error('Could not save private strategy', error);
      if (strategyStatus) { strategyStatus.textContent = 'Could not save strategy. Please try again.'; strategyStatus.dataset.state = 'error'; }
    } finally {
      if (strategySave) strategySave.disabled = false;
    }
  });

  function matchesFilter(system, mode) {
    if (mode === 'former') return !activePresence(system);
    if (!activePresence(system)) return false;
    if (mode === 'all') return true;
    if (mode === 'priority') return Boolean(system.priority);
    if (mode === 'watch') return Boolean(system.attention);
    if (mode === 'control') return controlled(system);
    if (mode === 'not-control') return !controlled(system);
    if (mode === 'below-target') return Boolean(system.belowTarget);
    if (mode === 'above-target') return Boolean(system.aboveTarget);
    if (mode === 'conflict') return Boolean(system.conflict);
    if (mode === 'expansion-risk') return Boolean(system.expansionRisk);
    if (mode === 'retreat-risk') return Boolean(system.retreatRisk);
    if (mode === 'stale') return ['aging','stale','unknown'].includes(freshness(system).key);
    return true;
  }

  function sortedSystems(list) {
    const mode = sortEl?.value || 'name';
    return [...list].sort((a,b) => {
      if (mode === 'influence-desc') return (Number(b.influence) || -Infinity) - (Number(a.influence) || -Infinity) || String(a.name || '').localeCompare(String(b.name || ''));
      if (mode === 'influence-asc') return (Number(a.influence) || Infinity) - (Number(b.influence) || Infinity) || String(a.name || '').localeCompare(String(b.name || ''));
      if (mode === 'attention') return Number(Boolean(b.attention)) - Number(Boolean(a.attention)) || Number(Boolean(b.priority)) - Number(Boolean(a.priority)) || String(a.name || '').localeCompare(String(b.name || ''));
      if (mode === 'freshness') return freshness(a).rank - freshness(b).rank || String(a.name || '').localeCompare(String(b.name || ''));
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function renderTable() {
    if (!tableBody) return;
    const query = (searchEl?.value || '').trim().toLowerCase();
    const mode = filterEl?.value || 'all';
    const filtered = systems.filter(system => {
      const matchesSearch = !query || [system.name, system.state, system.control, system.objective, system.watchNote, ...(system.alerts || [])].some(value => String(value || '').toLowerCase().includes(query));
      return matchesSearch && matchesFilter(system, mode);
    });
    const rows = sortedSystems(filtered);
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageRows = rows.slice(startIndex, startIndex + pageSize);

    if (shownEl) shownEl.textContent = pageRows.length.toLocaleString();
    if (countDetailEl) {
      const base = mode === 'all' ? `${totalRows.toLocaleString()} active systems match` : `${totalRows.toLocaleString()} systems match this view`;
      countDetailEl.textContent = totalRows ? `shown · ${base}` : base;
    }
    if (pageStatusEl) pageStatusEl.textContent = `Page ${currentPage} of ${totalPages}${totalRows ? ` · ${startIndex + 1}–${Math.min(startIndex + pageSize, totalRows)} of ${totalRows}` : ''}`;
    if (prevPageEl) prevPageEl.disabled = currentPage <= 1;
    if (nextPageEl) nextPageEl.disabled = currentPage >= totalPages;

    if (!rows.length) {
      tableBody.innerHTML = `<tr class="systems-empty-row"><td colspan="6">${systems.length ? 'No systems match this view.' : 'The first full faction-presence sync has not completed yet.'}</td></tr>`;
      return;
    }

    tableBody.innerHTML = pageRows.map(system => {
      const fresh = freshness(system);
      const target = targetStatus(system);
      const rowClasses = [activePresence(system) ? '' : 'former-presence-row', system.retreatRisk ? 'retreat-warning-row' : ''].filter(Boolean).join(' ');
      return `<tr class="${rowClasses}">
        <td>${systemNameMarkup(system.name)}${system.retreatRisk ? `<span class="retreat-inline-warning">RETREAT WARNING &lt; ${html(system.retreatWarningThreshold ?? 5)}%</span>` : ''}${system.objective ? `<small>${html(system.objective)}</small>` : ''}</td>
        <td><strong>${influence(system.influence)}</strong>${progressBar(system.influence, system)}${target ? `<small class="table-target-status target-${target.key}">${html(target.label)}</small>` : ''}</td>
        <td>${html(safe(system.control, controlled(system) ? 'Mongrels' : 'Unknown'))}${controlled(system) ? '<small class="mc-control-note">Mongrel control</small>' : ''}</td>
        <td>${html(safe(system.state))}${Array.isArray(system.pendingStates) && system.pendingStates.length ? `<small>Pending: ${html(system.pendingStates.join(', '))}</small>` : ''}</td>
        <td><div class="mc-op-tags">${operationalTags(system)}</div></td>
        <td><span class="data-origin ${fresh.key}">${html(fresh.label)}</span><small>${html(fresh.detail)}</small></td>
      </tr>`;
    }).join('');
  }

  async function copySystemName(button) {
    const value = button?.dataset?.copySystem || '';
    if (!value) return;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); copied = true; }
    } catch {}
    if (!copied) {
      const fallback = document.createElement('textarea');
      fallback.value = value;
      fallback.setAttribute('readonly', '');
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.select();
      copied = document.execCommand('copy');
      fallback.remove();
    }
    const original = button.textContent;
    button.textContent = copied ? '✓' : '!';
    window.setTimeout(() => { button.textContent = original; }, 1200);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.operation-system-copy');
    if (button) copySystemName(button);
  });

  window.addEventListener('mongrels:orders-loaded', event => {
    if (!summaryActiveOrders) return;
    const detail = event.detail || {};
    summaryActiveOrders.dataset.resolved = 'true';
    summaryActiveOrders.textContent = detail.authenticated ? String(detail.activeCount ?? 0) : '—';
  });

  const resetTablePage = () => { currentPage = 1; renderTable(); };
  searchEl?.addEventListener('input', resetTablePage);
  filterEl?.addEventListener('change', resetTablePage);
  sortEl?.addEventListener('change', resetTablePage);
  pageSizeEl?.addEventListener('change', () => {
    pageSize = Math.max(1, Number(pageSizeEl.value) || 15);
    currentPage = 1;
    renderTable();
  });
  const scrollAllSystemsTop = () => {
    const anchor = document.querySelector('[data-all-systems-top]');
    if (!anchor) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    anchor.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  prevPageEl?.addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; renderTable(); scrollAllSystemsTop(); } });
  nextPageEl?.addEventListener('click', () => { currentPage += 1; renderTable(); scrollAllSystemsTop(); });

  async function load() {
    setAccess('gate');
    try {
      const response = await fetch(`/api/operations/systems?_=${Date.now()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 401 || response.status === 403) {
        if (gateStatus) gateStatus.textContent = response.status === 401 ? 'Member sign-in required' : 'This Discord account does not have Mission Control access';
        setAccess('gate');
        return;
      }
      if (!response.ok) throw new Error(`Mission Control request failed (${response.status})`);

      const payload = await response.json();
      systems = Array.isArray(payload.systems) ? payload.systems : [];
      meta = payload.meta || {};
      playbook = payload.playbook || null;
      strategy = payload.strategy || null;
      canManage = Boolean(payload.canManage);
      if (viewerEl) viewerEl.textContent = `${payload.viewer?.displayName || 'Mongrel Member'} · ${String(payload.viewer?.access || 'member').replace('_', ' ')}`;
      setAccess('member');
      renderSummary();
      renderLiveStatus();
      renderPlaybook();
      renderPriority();
      renderWatch();
      renderTable();
      setupStrategyManager();
      window.dispatchEvent(new CustomEvent('mongrels:mission-control-loaded', { detail: { systems: systems.length, meta } }));
    } catch (error) {
      console.error('Could not load Mission Control', error);
      if (gateStatus) gateStatus.textContent = 'Secure Mission Control service unavailable. Please try again.';
      setAccess('gate');
    }
  }

  load();
})();
