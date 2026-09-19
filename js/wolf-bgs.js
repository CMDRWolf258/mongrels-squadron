(() => {
  const gate = document.querySelector('[data-wolf-gate]');
  const privateView = document.querySelector('[data-wolf-private]');
  const gateStatus = document.querySelector('[data-wolf-gate-status]');
  const viewer = document.querySelector('[data-wolf-viewer]');
  const list = document.querySelector('[data-system-list]');
  const search = document.querySelector('[data-system-search]');
  const filter = document.querySelector('[data-system-filter]');
  const sort = document.querySelector('[data-system-sort]');
  const pageSizeEl = document.querySelector('[data-page-size]');
  const favoritesFirst = document.querySelector('[data-favorites-first]');
  const lowestFiveWatch = document.querySelector('[data-lowest-five-watch]');
  const prevPage = document.querySelector('[data-page-prev]');
  const nextPage = document.querySelector('[data-page-next]');
  const pageStatus = document.querySelector('[data-page-status]');
  const count = document.querySelector('[data-system-count]');
  const sourceNote = document.querySelector('[data-source-note]');
  const globalForm = document.querySelector('[data-global-form]');
  const globalMeta = document.querySelector('[data-global-meta]');
  const systemDefaultsForm = document.querySelector('[data-system-defaults-form]');
  const systemDefaultsMeta = document.querySelector('[data-system-defaults-meta]');
  const customPanel = document.querySelector('[data-custom-filter-panel]');
  const customPriority = document.querySelector('[data-custom-priority]');
  const customState = document.querySelector('[data-custom-state]');
  const customPending = document.querySelector('[data-custom-pending]');
  const customControl = document.querySelector('[data-custom-control]');
  const customFlag = document.querySelector('[data-custom-flag]');
  const alertList = document.querySelector('[data-faction-alert-list]');
  const alertCount = document.querySelector('[data-faction-alert-count]');
  const alertAckButton = document.querySelector('[data-alert-ack-button]');
  const alertAckState = document.querySelector('[data-alert-ack-state]');
  const alertAckSubstate = document.querySelector('[data-alert-ack-substate]');
  const queueSelectorSummary = document.querySelector('[data-queue-selector-summary]');
  const queueSelectorCount = document.querySelector('[data-queue-selector-count]');
  const activeViewBanner = document.querySelector('[data-active-board-view]');
  const activeViewLabel = document.querySelector('[data-active-board-view-label]');
  const clearActiveView = document.querySelector('[data-clear-active-board-view]');

  let payload = null;
  let currentPage = 1;
  let pageSize = 20;
  let activeBoardView = '';

  const html = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const influence = value => num(value) === null ? '—' : `${Number(value).toFixed(1)}%`;
  const listFromText = value => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
  const systemKey = system => String(system?.name || '').toLowerCase();

  function setAccess(ok) {
    if (gate) gate.hidden = ok;
    if (privateView) privateView.hidden = !ok;
  }

  function fmt(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(d);
  }

  function age(value) {
    if (!value) return 'Unknown';
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return 'Unknown';
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  function populateSummary(data) {
    const set = (sel, value) => { const el = document.querySelector(sel); if (el) el.textContent = value; };
    set('[data-summary-presence]', Number(data.meta?.presenceCount || 0).toLocaleString());
    set('[data-summary-controlled]', Number(data.meta?.controlledCount || 0).toLocaleString());
    set('[data-summary-attention]', Number(data.meta?.attentionCount || 0).toLocaleString());
    set('[data-summary-stale]', Number(data.meta?.staleCount || 0).toLocaleString());
    set('[data-summary-slots]', String(data.defaults?.maxDailySystems ?? 6));
    if (queueSelectorCount) queueSelectorCount.textContent = Number(data.meta?.queueSelectorCount || 0).toLocaleString();
    set('[data-summary-updated]', fmt(data.meta?.generatedAt));
    set('[data-summary-source]', data.meta?.source || 'EliteHub Vault / EDDN');
    if (sourceNote) sourceNote.textContent = data.meta?.sourceBoardNote || 'External BGS source status unavailable.';
  }


  function alertFamilyLabel(family) {
    return {
      retreat:'RETREAT PENDING',
      conflict:'CONFLICT CHANGE',
      bust:'BUST',
      'civil-unrest':'CIVIL UNREST',
    }[family] || String(family || 'ALERT').toUpperCase();
  }

  function alertStatusText(alert) {
    const detail = String(alert?.detail || alertFamilyLabel(alert?.family)).toUpperCase();
    if (alert?.family === 'retreat') return 'RETREAT PENDING';
    return `${detail} ${alert?.phase === 'pending' ? 'PENDING' : 'ACTIVE'}`;
  }

  function populateAlerts(data) {
    if (!alertList) return;
    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
    const listedCount = Number(data?.alertMeta?.listedCount ?? alerts.length);
    const unreviewedCount = Number(data?.alertMeta?.unreviewedCount ?? alerts.filter(alert => !alert.reviewedAt).length);
    if (alertCount) alertCount.textContent = String(listedCount);

    if (alertAckButton) {
      const active = unreviewedCount > 0;
      alertAckButton.disabled = !active;
      alertAckButton.classList.toggle('is-active', active);
      alertAckButton.classList.toggle('is-extinguished', !active);
      alertAckButton.setAttribute('aria-label', active ? `Acknowledge ${unreviewedCount} new faction alert${unreviewedCount === 1 ? '' : 's'}` : 'Faction Alert master warning extinguished');
      if (alertAckState) alertAckState.textContent = active ? 'ACKNOWLEDGE' : 'EXTINGUISHED';
      if (alertAckSubstate) alertAckSubstate.textContent = active ? `${unreviewedCount} NEW ALERT${unreviewedCount === 1 ? '' : 'S'}` : (listedCount ? 'ALERTS RETAINED FOR REVIEW' : 'NO NEW ALERTS');
    }

    if (!alerts.length) {
      alertList.innerHTML = '<div class="wolf-alert-empty"><strong>No faction alerts retained.</strong><span>Major Mongrel state changes will appear here when detected.</span></div>';
      return;
    }
    alertList.innerHTML = alerts.map(alert => `
      <article class="wolf-faction-alert is-${html(alert.family)} ${alert.reviewedAt ? 'is-reviewed' : 'is-new'}">
        <div class="wolf-faction-alert-main">
          <span>${html(alertFamilyLabel(alert.family))}</span>
          <strong>${html(alert.system)}</strong>
          <small>${html(alertStatusText(alert))} · detected ${html(fmt(alert.firstSeenAt))}${alert.reviewedAt ? ' · ACKNOWLEDGED' : ' · NEW'}</small>
        </div>
        <div class="wolf-faction-alert-actions">
          <button type="button" class="btn btn-secondary btn-compact" data-view-faction-alert data-alert-system="${html(alert.system)}" data-alert-family="${html(alert.family)}">VIEW</button>
          <button type="button" class="wolf-alert-remove-button" data-remove-faction-alert data-alert-system="${html(alert.system)}" data-alert-family="${html(alert.family)}">REMOVE</button>
        </div>
      </article>`).join('');
  }

  function stateNames(system, key) {
    return (Array.isArray(system?.[key]) ? system[key] : []).map(value => String(value || '').trim().toLowerCase());
  }

  function matchesBoardView(system, view) {
    if (!view) return true;
    if (view === 'queue-selected') return Boolean(system.settings?.queueSelected);
    const active = stateNames(system, 'activeStates');
    const pending = stateNames(system, 'pendingStates');
    if (view === 'conflict') {
      const conflicts = new Set(['war','civil war','election']);
      return active.some(state => conflicts.has(state)) || pending.some(state => conflicts.has(state));
    }
    if (view === 'retreat') return pending.includes('retreat');
    if (view === 'bust') return active.includes('bust') || pending.includes('bust');
    if (view === 'civil-unrest') return active.includes('civil unrest') || pending.includes('civil unrest');
    return true;
  }

  function boardViewLabel(view) {
    return {
      'queue-selected':'QUEUE SELECTORS',
      conflict:'CONFLICTS · PENDING + ACTIVE',
      retreat:'RETREAT PENDING',
      bust:'BUST · PENDING + ACTIVE',
      'civil-unrest':'CIVIL UNREST · PENDING + ACTIVE',
    }[view] || 'FILTERED VIEW';
  }

  function syncBoardViewBanner(total = null) {
    if (!activeViewBanner) return;
    activeViewBanner.hidden = !activeBoardView;
    if (activeViewLabel && activeBoardView) {
      const suffix = total === null ? '' : ` · ${total} SYSTEM${total === 1 ? '' : 'S'}`;
      activeViewLabel.textContent = boardViewLabel(activeBoardView) + suffix;
    }
    queueSelectorSummary?.classList.toggle('active', activeBoardView === 'queue-selected');
  }

  function setBoardView(view) {
    activeBoardView = view || '';
    if (search) search.value = '';
    if (filter) filter.value = 'all';
    currentPage = 1;
    renderSystems();
    document.querySelector('.wolf-systems-section')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function populateGlobal(data) {
    if (!globalForm) return;
    for (const [key, value] of Object.entries(data.defaults || {})) {
      const el = globalForm.querySelector(`[data-global="${key}"]`);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = value ?? '';
    }
    if (globalMeta) globalMeta.textContent = data.globalUpdatedAt ? `Saved ${fmt(data.globalUpdatedAt)} by ${data.globalUpdatedBy || 'Wolf'}` : 'Using prototype defaults. No global changes saved yet.';
  }

  function populateSystemDefaults(data) {
    if (!systemDefaultsForm) return;
    for (const [key, value] of Object.entries(data.systemDefaults || {})) {
      const el = systemDefaultsForm.querySelector(`[data-system-default="${key}"]`);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else if (Array.isArray(value)) el.value = value.join(', ');
      else el.value = value ?? '';
    }
    if (systemDefaultsMeta) systemDefaultsMeta.textContent = data.systemDefaultsUpdatedAt
      ? `Saved ${fmt(data.systemDefaultsUpdatedAt)} by ${data.systemDefaultsUpdatedBy || 'Wolf'}`
      : 'Using prototype system defaults.';
  }

  function collectGlobal() {
    const out = {};
    globalForm.querySelectorAll('[data-global]').forEach(el => {
      out[el.dataset.global] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }

  function collectSystemDefaults() {
    const out = {};
    systemDefaultsForm.querySelectorAll('[data-system-default]').forEach(el => {
      const key = el.dataset.systemDefault;
      if (el.type === 'checkbox') out[key] = el.checked;
      else if (['desiredStates','avoidStates'].includes(key)) out[key] = listFromText(el.value);
      else out[key] = el.value;
    });
    return out;
  }

  function priorityLabel(system) {
    const value = system.settings?.priority || 'normal';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function controlPolicyLabel(value) {
    return ({
      'maintain-existing':'Maintain existing control state',
      gain:'Gain Mongrel control',
      'allow-transfer':'Allow intentional transfer',
      none:'No control objective',
    })[value] || 'Maintain existing control state';
  }

  function systemStatus(system) {
    if (system.retreatPending) return { key:'risk', label:'Retreat pending' };
    if (system.retreatRisk) return { key:'risk', label:'Retreat risk' };
    if (system.conflict) return { key:'risk', label:'Conflict' };
    return { key:'ok', label:'Normal' };
  }

  function freshnessStatus(system) {
    if (!system.activeSnapshotTime) return { key:'unknown', label:'Unknown' };
    if (system.dataCondition === 'stale') return { key:'stale', label:'Stale' };
    return { key:'fresh', label:'Fresh' };
  }

  function conflictScoreText(system) {
    const score = system?.conflictScore;
    if (!score) return '—';
    return `${Number(score.factionWonDays)}–${Number(score.opponentWonDays)}`;
  }

  function conflictDayText(system) {
    const timeline = system?.conflictTimeline;
    if (!timeline || timeline.phase === 'none') return '';
    if (timeline.phase === 'pending' && !timeline.day) return 'PENDING';
    if (timeline.day) return timeline.overdue ? 'DAY 7+' : `DAY ${timeline.day}`;
    return 'DAY ?';
  }

  function conflictDaySourceText(system) {
    const timeline = system?.conflictTimeline;
    if (!timeline) return '';
    if (timeline.source === 'manual') return 'MANUAL VERIFIED';
    if (timeline.source === 'inferred') return 'INFERRED';
    return timeline.phase === 'active' ? 'UNKNOWN' : '';
  }

  function rowTemplate(faction, index) {
    return `<tr data-faction-row>
      <td><input class="faction-name" data-faction="name" maxlength="120" value="${html(faction?.name || '')}" placeholder="Faction name"></td>
      <td><input data-faction="influence" type="number" min="0" max="100" step="0.01" value="${faction?.influence ?? ''}" placeholder="0.0"></td>
      <td><input data-faction="state" maxlength="120" value="${html(faction?.state || 'None')}" placeholder="None"></td>
      <td><input data-faction="pending" maxlength="240" value="${html(faction?.pending || '')}" placeholder="None"></td>
      <td><input data-faction="recovering" maxlength="240" value="${html(faction?.recovering || '')}" placeholder="None"></td>
      <td><span class="wolf-row-source">${html(faction?.source || (index === 0 ? 'External source' : 'Manual'))}</span></td>
      <td><button type="button" class="wolf-mini-button" data-remove-faction aria-label="Remove faction">×</button></td>
    </tr>`;
  }

  function systemCard(system, lowWatch = false) {
    const status = systemStatus(system);
    const freshness = freshnessStatus(system);
    const settings = system.settings || {};
    const factions = Array.isArray(system.factions) && system.factions.length ? system.factions : [{
      name:'Regiment of Imperial Mongrels', influence:system.influence, state:system.state,
      pending:(system.pendingStates || []).join(', '), recovering:(system.recoveringStates || []).join(', '), source:'External source',
    }];
    const tick = settings.customTick || payload.defaults?.defaultTick || '19:00';
    const freshHours = settings.freshnessHours ?? payload.defaults?.freshnessHours ?? 8;
    const manualNewer = system.activeSnapshotSource === 'manual';
    const favorite = Boolean(settings.favorite);
    const queueSelected = Boolean(settings.queueSelected);
    const boardWarning = system.boardComplete ? '' : `<div class="wolf-danger-note">A complete external faction board is not available for this system yet. The Mongrel presence row remains available, and a manual full-board snapshot can be submitted as a fallback.</div>`;
    const boardChip = system.externalBoardComplete
      ? `<span class="wolf-chip">External board <b>${html(system.factionCount || factions.length)} factions</b></span>`
      : '<span class="wolf-chip">External board <b>awaiting data</b></span>';
    const controllerValue = manualNewer ? (system.manualController || system.control || '') : (system.control || '');
    const score = system.conflictScore || null;
    const timeline = system.conflictTimeline || null;
    const scoreAge = score?.updatedAt ? age(score.updatedAt) : '';
    const dayText = conflictDayText(system);
    const daySource = conflictDaySourceText(system);
    const scoreTitle = score
      ? `Mongrels ${score.factionWonDays} — ${score.opponentFaction || 'Opponent'} ${score.opponentWonDays} · verified ${scoreAge || 'time unknown'}${score.stale ? ' · last known score' : ''}`
      : 'No active Mongrel conflict score available';

    return `<details class="wolf-system-card ${lowWatch ? 'low-watch' : ''}" data-system="${html(system.name)}" data-favorite="${favorite}" data-queue-selected="${queueSelected}" data-retreat-pending="${system.retreatPending ? 'true' : 'false'}" data-snapshot-time="${html(system.activeSnapshotTime || '')}" data-settings-updated="${html(settings.updatedAt || '')}" data-conflict-score-a="${html(score?.factionWonDays ?? '')}" data-conflict-score-b="${html(score?.opponentWonDays ?? '')}" data-conflict-opponent="${html(score?.opponentFaction || '')}" data-conflict-score-stale="${score?.stale ? 'true' : 'false'}" data-conflict-score-updated="${html(score?.updatedAt || '')}" data-conflict-phase="${html(timeline?.phase || 'none')}" data-conflict-day="${html(timeline?.day ?? '')}" data-conflict-raw-day="${html(timeline?.rawDay ?? '')}" data-conflict-day-source="${html(timeline?.source || 'unknown')}" data-conflict-day-overdue="${timeline?.overdue ? 'true' : 'false'}" data-conflict-expected-active="${html(timeline?.expectedActiveAt || '')}" data-conflict-active-seen="${html(timeline?.activeSeenAt || '')}" data-conflict-manual-day="${html(timeline?.manualDay ?? '')}" data-conflict-manual-set-at="${html(timeline?.manualSetAt || '')}" data-conflict-manual-set-by="${html(timeline?.manualSetBy || '')}">
      <summary>
        <div class="wolf-system-name-row">
          <div class="wolf-system-selectors">
            <button type="button" class="wolf-favorite-button ${favorite ? 'active' : ''}" data-favorite-toggle aria-label="${favorite ? 'Remove' : 'Add'} ${html(system.name)} ${favorite ? 'from' : 'to'} favorites" title="${favorite ? 'Remove from favorites' : 'Add to favorites'}">${favorite ? '★' : '☆'}</button>
            <button type="button" class="wolf-queue-selector-button ${queueSelected ? 'active' : ''}" data-queue-selector-toggle aria-pressed="${queueSelected ? 'true' : 'false'}" aria-label="${queueSelected ? 'Disable' : 'Enable'} Queue Selector for ${html(system.name)}" title="${queueSelected ? 'Queue Selector enabled — normal automation may queue this system' : 'Enable Queue Selector for normal automated queueing'}">Q</button>
          </div>
          <div class="wolf-system-name"><strong>${html(system.name)}</strong><small>${html(system.control || 'Controller unknown')}</small></div>
        </div>
        <div class="wolf-system-stat"><span>Mongrel INF</span><b>${influence(system.influence)}</b></div>
        <div class="wolf-system-stat hide-mobile"><span>State</span><b>${html(system.state || 'None')}</b></div>
        <div class="wolf-system-stat wolf-freshness-stat"><span>Freshness</span><b class="wolf-freshness-value ${freshness.key}">${html(freshness.label)}</b><small>${html(age(system.activeSnapshotTime))}</small></div>
        <div class="wolf-system-stat wolf-conflict-score-stat hide-mobile" title="${html(scoreTitle)}"><span>Conflict Score</span><b class="${score ? 'has-score' : ''}">${html(conflictScoreText(system))}</b><small>${html([dayText, scoreAge].filter(Boolean).join(' · ') || '—')}</small></div>
        <div class="wolf-system-stat hide-tablet hide-mobile"><span>Tick</span><b>${html(tick)}</b></div>
        <div class="wolf-system-stat hide-tablet hide-mobile"><span>Priority</span><b>${html(priorityLabel(system))}</b></div>
        <span class="wolf-status-pill ${status.key}">${html(status.label)}</span>
        <span class="wolf-expand">+</span>
      </summary>
      <div class="wolf-system-body">
        <div class="wolf-system-topline">
          ${lowWatch ? '<span class="wolf-chip low-watch">LOW 5 WATCH</span>' : ''}
          <span class="wolf-chip">External source update <b>${html(fmt(system.sourceUpdated))}</b></span>
          <span class="wolf-chip">Manual update <b>${html(fmt(system.manualUpdatedAt))}</b></span>
          <span class="wolf-chip">Active snapshot <b>${manualNewer ? 'Manual' : 'External'} · ${html(fmt(system.activeSnapshotTime))}</b></span>
          <span class="wolf-chip">Freshness limit <b>${html(freshHours)}h</b></span>
          <span class="wolf-chip">Population <b>${html(system.population ? Number(system.population).toLocaleString() : '—')}</b></span>
          ${timeline && timeline.phase !== 'none' ? `<span class="wolf-chip wolf-conflict-day-chip">Conflict day <b>${html(dayText || 'DAY ?')}</b>${daySource ? ` · ${html(daySource)}` : ''}${timeline.overdue ? ' · VERIFY' : ''}</span>` : ''}
          ${score ? `<span class="wolf-chip wolf-conflict-score-chip">Conflict score <b>${html(conflictScoreText(system))}</b>${score.opponentFaction ? ` vs ${html(score.opponentFaction)}` : ''}${scoreAge ? ` · ${html(scoreAge)}` : ''}${score.stale ? ' · last known' : ''}</span>` : ''}
          ${boardChip}
          ${system.hasCustomSettings ? '<span class="wolf-chip custom">Custom settings</span>' : '<span class="wolf-chip">System defaults</span>'}
        </div>
        <div class="wolf-subgrid">
          <div>
            <section class="wolf-section">
              <h3>System Status & Faction Board</h3>
              <p class="wolf-section-intro">All faction rows are editable. Submit Status creates a fresh manual snapshot and becomes the newest trusted board when its timestamp is newer.</p>
              ${boardWarning}
              <div class="wolf-table-scroll"><table class="wolf-faction-table"><thead><tr><th>Faction</th><th>Influence %</th><th>State</th><th>Pending</th><th>Recovering</th><th>Origin</th><th></th></tr></thead><tbody data-faction-body>${factions.map(rowTemplate).join('')}</tbody></table></div>
              <div class="wolf-faction-actions"><button type="button" class="wolf-mini-button" data-add-faction>+ Add Faction</button><span class="wolf-status-message" data-status-message></span></div>
              <div class="wolf-form-grid wolf-status-meta-grid"><label><span>Controller</span><input data-status="controller" maxlength="120" value="${html(controllerValue)}"></label><label class="wolf-wide-field"><span>Status notes</span><input data-status="notes" maxlength="1200" value="${html(system.manualNotes || '')}" placeholder="Optional notes about this snapshot"></label></div>
              <div class="wolf-save-row"><span>Manual status last submitted: ${html(system.manualUpdatedAt ? `${fmt(system.manualUpdatedAt)} by ${system.manualUpdatedBy || 'Wolf'}` : 'never')}</span><button type="button" class="btn btn-primary" data-submit-status>Submit Status</button></div>
            </section>

            <section class="wolf-section">
              <h3>Strategy</h3><p class="wolf-section-intro">Defines what the programmed BGS logic should try to accomplish here. Priority is the same value shown in this system's collapsed header.</p>
              <div class="wolf-system-settings-grid">
                <label class="wolf-field"><span>Priority</span><select data-setting="priority"><option value="critical" ${settings.priority==='critical'?'selected':''}>Critical</option><option value="high" ${settings.priority==='high'?'selected':''}>High</option><option value="normal" ${!settings.priority||settings.priority==='normal'?'selected':''}>Normal</option><option value="low" ${settings.priority==='low'?'selected':''}>Low</option></select></label>
                <label class="wolf-field"><span>Control policy</span><select data-setting="controlPolicy"><option value="maintain-existing" ${!settings.controlPolicy||settings.controlPolicy==='maintain-existing'?'selected':''}>Maintain existing control state</option><option value="gain" ${settings.controlPolicy==='gain'?'selected':''}>Gain Mongrel control</option><option value="allow-transfer" ${settings.controlPolicy==='allow-transfer'?'selected':''}>Allow intentional transfer</option><option value="none" ${settings.controlPolicy==='none'?'selected':''}>No control objective</option></select><small>${html(controlPolicyLabel(settings.controlPolicy))}</small></label>
                <label class="wolf-field"><span>Target minimum %</span><input data-setting="targetMin" type="number" min="0" max="100" step="0.1" value="${settings.targetMin ?? ''}" placeholder="System default / none"></label>
                <label class="wolf-field"><span>Target maximum %</span><input data-setting="targetMax" type="number" min="0" max="100" step="0.1" value="${settings.targetMax ?? ''}" placeholder="System default / none"></label>
                <label class="wolf-field"><span>Preferred states</span><input data-setting="desiredStates" value="${html((settings.desiredStates || []).join(', '))}" placeholder="Boom, Civil Liberty"></label>
                <label class="wolf-field"><span>Avoid states</span><input data-setting="avoidStates" value="${html((settings.avoidStates || []).join(', '))}" placeholder="Expansion, Civil Unrest"></label>
              </div>
              <div class="wolf-toggle-list"><label><input type="checkbox" data-setting="protectRetreat" ${settings.protectRetreat!==false?'checked':''}> Protect Mongrels from Retreat</label><label><input type="checkbox" data-setting="avoidExpansion" ${settings.avoidExpansion?'checked':''}> Avoid unwanted Expansion</label></div>
              <label class="wolf-field wolf-notes-field"><span>System notes</span><textarea data-setting="notes" rows="3" maxlength="1200">${html(settings.notes || '')}</textarea></label>
            </section>
          </div>

          <div>
            <section class="wolf-section">
              <h3>Automation Controls</h3><p class="wolf-section-intro">The programmed rules will remain authoritative. Advanced intelligence suggestions will be advisory and visible separately.</p>
              <div class="wolf-toggle-list">
                <label><input type="checkbox" data-setting="allowDailyOrders" ${settings.allowDailyOrders!==false?'checked':''}> Allow into Daily Orders</label>
                <label><input type="checkbox" data-setting="autoGenerateOrders" ${settings.autoGenerateOrders!==false?'checked':''}> Auto-queue Queue Selector work</label>
                <label><input type="checkbox" data-setting="emergencyOverride" ${settings.emergencyOverride!==false?'checked':''}> Emergency priority override</label>
                <label><input type="checkbox" data-setting="reactRetreat" ${settings.reactRetreat!==false?'checked':''}> React to Retreat risk</label>
                <label><input type="checkbox" data-setting="reactConflict" ${settings.reactConflict!==false?'checked':''}> React to conflict</label>
                <label><input type="checkbox" data-setting="reactExpansion" ${settings.reactExpansion!==false?'checked':''}> React to Expansion risk</label>
                <label><input type="checkbox" data-setting="reactInfluence" ${settings.reactInfluence!==false?'checked':''}> React outside target band</label>
                <label><input type="checkbox" data-setting="reactStates" ${settings.reactStates!==false?'checked':''}> React to state changes</label>
              </div>
            </section>

            <section class="wolf-section">
              <h3>Tick & Freshness</h3>
              <div class="wolf-system-settings-grid">
                <label class="wolf-field"><span>Custom tick</span><input class="wolf-time-input" type="time" data-setting="customTick" value="${html(settings.customTick || '')}"><small>Blank = global ${html(payload.defaults?.defaultTick || '19:00')}</small></label>
                <label class="wolf-field"><span>Custom freshness hours</span><input type="number" min="1" max="72" data-setting="freshnessHours" value="${settings.freshnessHours ?? ''}" placeholder="Global ${html(payload.defaults?.freshnessHours ?? 8)}"></label>
                <label class="wolf-field wolf-grid-span"><span>Rollover policy</span><select data-setting="rolloverPolicy"><option value="" ${!settings.rolloverPolicy?'selected':''}>Use global (${html(payload.defaults?.rolloverPolicy || 'safety')})</option><option value="strict" ${settings.rolloverPolicy==='strict'?'selected':''}>Strict</option><option value="safety" ${settings.rolloverPolicy==='safety'?'selected':''}>Safety Only</option><option value="carry" ${settings.rolloverPolicy==='carry'?'selected':''}>Carry Forward</option></select></label>
              </div>
            </section>

            <section class="wolf-section">
              <h3>Programmed Automation</h3>
              <div class="wolf-automation-preview"><strong>Rule-engine output placeholder</strong><p>This card will show exactly which programmed rule fired, the base workload (for example bounty amount), modifiers, final task, priority, and stop condition.</p><button type="button" class="wolf-mini-button" disabled>Why did automation do this?</button></div>
              <div class="wolf-automation-preview wolf-ai-preview"><strong>Advanced Intelligence Suggestion</strong><p>Advisory layer reserved for historical calibration, anomaly checks, and AI suggestions. It will never silently replace the programmed rule.</p><button type="button" class="wolf-mini-button" disabled>Apply suggestion</button></div>
            </section>
          </div>
        </div>

        <div class="wolf-system-actions"><div><small>System settings last saved: ${html(settings.updatedAt ? `${fmt(settings.updatedAt)} by ${settings.updatedBy || 'Wolf'}` : 'using System Defaults')}</small><div class="wolf-status-message" data-settings-message></div></div><button type="button" class="btn btn-primary" data-save-system>Save System Settings</button></div>
      </div>
    </details>`;
  }

  function priorityRank(value) {
    return ({ critical:0, high:1, normal:2, low:3 })[value] ?? 2;
  }

  function customMatches(system) {
    const priority = customPriority?.value || '';
    const stateText = (customState?.value || '').trim().toLowerCase();
    const pendingText = (customPending?.value || '').trim().toLowerCase();
    const controlMode = customControl?.value || '';
    const flag = customFlag?.value || '';
    const factionStates = (system.factions || []).map(f => f.state || '').join(' ').toLowerCase();
    const factionPending = (system.factions || []).map(f => f.pending || '').join(' ').toLowerCase();
    const systemPending = (system.pendingStates || []).join(' ').toLowerCase();

    if (priority && system.settings?.priority !== priority) return false;
    if (stateText && !`${system.state || ''} ${factionStates}`.toLowerCase().includes(stateText)) return false;
    if (pendingText && !`${systemPending} ${factionPending}`.includes(pendingText)) return false;
    if (controlMode === 'controlled' && !system.controlled) return false;
    if (controlMode === 'not-controlled' && system.controlled) return false;
    if (flag === 'favorite' && !system.settings?.favorite) return false;
    if (flag === 'retreat' && !system.retreatRisk) return false;
    if (flag === 'conflict' && !system.conflict) return false;
    if (flag === 'stale' && system.dataCondition !== 'stale') return false;
    if (flag === 'custom-settings' && !system.hasCustomSettings) return false;
    if (flag === 'automation-off' && system.settings?.autoGenerateOrders !== false && system.settings?.allowDailyOrders !== false) return false;
    return true;
  }

  function filteredSystems() {
    const q = (search?.value || '').trim().toLowerCase();
    const mode = filter?.value || 'all';
    return (payload?.systems || []).filter(system => {
      if (activeBoardView && !matchesBoardView(system, activeBoardView)) return false;
      if (q && !String(system.name || '').toLowerCase().includes(q)) return false;
      if (mode === 'favorites') return Boolean(system.settings?.favorite);
      if (mode === 'attention') return system.retreatRisk || system.conflict || system.dataCondition === 'stale';
      if (mode === 'stale') return system.dataCondition === 'stale';
      if (mode === 'controlled') return system.controlled;
      if (mode === 'not-controlled') return !system.controlled;
      if (mode === 'custom-filter') return customMatches(system);
      return true;
    });
  }

  function sortedSystems(rows) {
    const mode = sort?.value || 'influence-desc';
    return [...rows].sort((a, b) => {
      if (mode === 'influence-desc') return (num(b.influence) ?? -Infinity) - (num(a.influence) ?? -Infinity) || a.name.localeCompare(b.name);
      if (mode === 'influence-asc') return (num(a.influence) ?? Infinity) - (num(b.influence) ?? Infinity) || a.name.localeCompare(b.name);
      if (mode === 'priority') return priorityRank(a.settings?.priority) - priorityRank(b.settings?.priority) || a.name.localeCompare(b.name);
      if (mode === 'freshness') return (Date.parse(b.activeSnapshotTime || '') || 0) - (Date.parse(a.activeSnapshotTime || '') || 0) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }

  function withFavoritesFirst(rows) {
    if (!favoritesFirst?.checked || !payload?.systems) return rows;
    const favoriteRows = sortedSystems(rows.filter(system => system.settings?.favorite));
    const favoriteKeys = new Set(favoriteRows.map(systemKey));
    const remainder = rows.filter(system => !favoriteKeys.has(systemKey(system)));
    return [...favoriteRows, ...remainder];
  }


  function withOperationalFirst(rows) {
    const retreat = sortedSystems(rows.filter(system => system.retreatPending));
    const retreatKeys = new Set(retreat.map(systemKey));
    const selected = sortedSystems(rows.filter(system => !retreatKeys.has(systemKey(system)) && system.settings?.queueSelected));
    const keys = new Set([...retreat, ...selected].map(systemKey));
    return [...retreat, ...selected, ...rows.filter(system => !keys.has(systemKey(system)))];
  }

  function lowestFiveSystems() {
    return [...(payload?.systems || [])]
      .filter(system => num(system.influence) !== null)
      .sort((a, b) => (num(a.influence) ?? Infinity) - (num(b.influence) ?? Infinity) || a.name.localeCompare(b.name))
      .slice(0, 5);
  }

  function renderSystems(reopenSystem = '') {
    if (!list || !payload) return;
    if (customPanel) customPanel.hidden = (filter?.value || 'all') !== 'custom-filter';

    const matchingRows = filteredSystems();
    const sortedMatches = sortedSystems(matchingRows);
    const rows = withOperationalFirst(withFavoritesFirst(sortedMatches));
    const total = rows.length;
    const watchRows = lowestFiveWatch?.checked && !activeBoardView ? lowestFiveSystems() : [];
    const watchKeys = new Set(watchRows.map(systemKey));

    let pageRows = [];
    let totalPages = 1;
    let pageText = '';

    if (watchRows.length) {
      const normalRows = rows.filter(system => !watchKeys.has(systemKey(system)));
      const normalSlots = Math.max(1, pageSize - watchRows.length);
      totalPages = Math.max(1, Math.ceil(normalRows.length / normalSlots));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      const start = (currentPage - 1) * normalSlots;
      const normalPageRows = normalRows.slice(start, start + normalSlots);
      pageRows = [...normalPageRows.map(system => ({ system, lowWatch:false })), ...watchRows.map(system => ({ system, lowWatch:true }))];
      pageText = `Page ${currentPage} of ${totalPages} · ${normalPageRows.length} list + ${watchRows.length} low watch · ${total} systems in view`;
    } else {
      const operational = !activeBoardView ? rows.filter(system => system.retreatPending || system.settings?.queueSelected) : [];
      const operationalKeys = new Set(operational.map(systemKey));
      const normalRows = operational.length ? rows.filter(system => !operationalKeys.has(systemKey(system))) : rows;
      const firstNormalSlots = operational.length ? Math.max(0, pageSize - operational.length) : pageSize;
      const remainingAfterFirst = Math.max(0, normalRows.length - firstNormalSlots);
      totalPages = Math.max(1, 1 + Math.ceil(remainingAfterFirst / pageSize));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);

      if (currentPage === 1) {
        const normalPageRows = normalRows.slice(0, firstNormalSlots);
        pageRows = [...operational, ...normalPageRows].map(system => ({ system, lowWatch:false }));
        const operationalNote = operational.length ? `${operational.length} operational + ${normalPageRows.length} list` : `${normalPageRows.length} list`;
        pageText = total ? `Page 1 of ${totalPages} · ${operationalNote} · ${total} systems in view` : 'Page 1 of 1 · 0 systems';
      } else {
        const start = firstNormalSlots + (currentPage - 2) * pageSize;
        const normalPageRows = normalRows.slice(start, start + pageSize);
        pageRows = normalPageRows.map(system => ({ system, lowWatch:false }));
        pageText = `Page ${currentPage} of ${totalPages} · ${normalPageRows.length} list · ${total} systems in view`;
      }
    }

    if (count) count.textContent = total.toLocaleString();
    syncBoardViewBanner(total);
    if (pageStatus) pageStatus.textContent = pageText;
    if (prevPage) prevPage.disabled = currentPage <= 1;
    if (nextPage) nextPage.disabled = currentPage >= totalPages;
    list.innerHTML = pageRows.length ? pageRows.map(row => systemCard(row.system, row.lowWatch)).join('') : '<div class="wolf-empty">No systems match this view.</div>';

    if (reopenSystem) {
      const card = [...list.querySelectorAll('[data-system]')].find(el => el.dataset.system === reopenSystem);
      if (card) card.open = true;
    }
  }

  function collectSettings(card) {
    const out = { favorite: card.dataset.favorite === 'true', queueSelected: card.dataset.queueSelected === 'true' };
    card.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (el.type === 'checkbox') out[key] = el.checked;
      else if (['desiredStates','avoidStates'].includes(key)) out[key] = listFromText(el.value);
      else out[key] = el.value;
    });
    return out;
  }

  function collectSnapshot(card) {
    const factions = [...card.querySelectorAll('[data-faction-row]')].map(row => {
      const value = key => row.querySelector(`[data-faction="${key}"]`)?.value?.trim() || '';
      return { name:value('name'), influence:value('influence'), state:value('state'), pending:value('pending'), recovering:value('recovering') };
    }).filter(row => row.name);
    return {
      controller: card.querySelector('[data-status="controller"]')?.value?.trim() || '',
      notes: card.querySelector('[data-status="notes"]')?.value?.trim() || '',
      factions,
    };
  }

  function setMessage(el, text, state='') {
    if (!el) return;
    el.textContent = text;
    el.className = `wolf-status-message ${state}`.trim();
  }

  async function save(action, system, body, reopenSystem = '') {
    const response = await fetch('/api/operations/wolf-bgs', {
      method:'PUT', credentials:'same-origin', cache:'no-store',
      headers:{ Accept:'application/json', 'Content-Type':'application/json', 'X-Mongrels-Request':'wolf-bgs-control' },
      body:JSON.stringify({ action, system, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    payload = data;
    populateSummary(payload);
    populateAlerts(payload);
    populateGlobal(payload);
    populateSystemDefaults(payload);
    renderSystems(reopenSystem);
    window.dispatchEvent(new CustomEvent('wolf-bgs-payload-updated', { detail:{ systems:payload.systems || [] } }));
    return data;
  }

  globalForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = globalForm.querySelector('button[type="submit"]');
    button.disabled = true;
    if (globalMeta) globalMeta.textContent = 'Saving global defaults…';
    try {
      await save('save-global', '', { defaults:collectGlobal() });
      if (globalMeta) globalMeta.textContent = `Saved ${fmt(payload.globalUpdatedAt)} by ${payload.globalUpdatedBy || 'Wolf'}`;
    } catch (error) {
      console.error(error);
      if (globalMeta) globalMeta.textContent = 'Could not save global defaults.';
    } finally { button.disabled = false; }
  });

  systemDefaultsForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = systemDefaultsForm.querySelector('button[type="submit"]');
    button.disabled = true;
    if (systemDefaultsMeta) systemDefaultsMeta.textContent = 'Saving system defaults…';
    try {
      await save('save-system-defaults', '', { systemDefaults:collectSystemDefaults() });
      if (systemDefaultsMeta) systemDefaultsMeta.textContent = `Saved ${fmt(payload.systemDefaultsUpdatedAt)} by ${payload.systemDefaultsUpdatedBy || 'Wolf'}`;
    } catch (error) {
      console.error(error);
      if (systemDefaultsMeta) systemDefaultsMeta.textContent = 'Could not save system defaults.';
    } finally { button.disabled = false; }
  });

  list?.addEventListener('click', async event => {
    const favoriteButton = event.target.closest('[data-favorite-toggle]');
    if (favoriteButton) {
      event.preventDefault();
      event.stopPropagation();
      const card = favoriteButton.closest('[data-system]');
      if (!card) return;
      const system = card.dataset.system;
      const nextFavorite = card.dataset.favorite !== 'true';
      favoriteButton.disabled = true;
      try { await save('toggle-favorite', system, { favorite:nextFavorite }); }
      catch (error) { console.error(error); favoriteButton.disabled = false; }
      return;
    }

    const queueButton = event.target.closest('[data-queue-selector-toggle]');
    if (queueButton) {
      event.preventDefault();
      event.stopPropagation();
      const card = queueButton.closest('[data-system]');
      if (!card) return;
      const system = card.dataset.system;
      const nextSelected = card.dataset.queueSelected !== 'true';
      queueButton.disabled = true;
      try {
        await save('toggle-queue-selector', system, { queueSelected:nextSelected });
        window.dispatchEvent(new CustomEvent('wolf-bgs-queue-selector-updated', { detail:{ system, selected:nextSelected } }));
      } catch (error) {
        console.error(error);
        queueButton.disabled = false;
      }
      return;
    }

    const card = event.target.closest('[data-system]');
    if (!card) return;
    const system = card.dataset.system;

    if (event.target.closest('[data-add-faction]')) {
      card.querySelector('[data-faction-body]')?.insertAdjacentHTML('beforeend', rowTemplate({ name:'', influence:'', state:'None', pending:'', recovering:'', source:'Manual' }, 99));
      return;
    }
    if (event.target.closest('[data-remove-faction]')) {
      event.target.closest('[data-faction-row]')?.remove();
      return;
    }
    if (event.target.closest('[data-submit-status]')) {
      const button = event.target.closest('[data-submit-status]');
      const msg = card.querySelector('[data-status-message]');
      button.disabled = true; setMessage(msg, 'Submitting manual snapshot…', 'working');
      try {
        await save('submit-status', system, { snapshot:collectSnapshot(card) }, system);
        const reopened = [...document.querySelectorAll('[data-system]')].find(el => el.dataset.system === system);
        setMessage(reopened?.querySelector('[data-status-message]'), 'Status accepted. Automation can now use this snapshot.', 'success');
      } catch (error) {
        console.error(error); setMessage(msg, 'Could not submit status.', 'error');
      } finally { button.disabled = false; }
      return;
    }
    if (event.target.closest('[data-save-system]')) {
      const button = event.target.closest('[data-save-system]');
      const msg = card.querySelector('[data-settings-message]');
      button.disabled = true; setMessage(msg, 'Saving system settings…', 'working');
      try {
        await save('save-system', system, { settings:collectSettings(card) }, system);
        const reopened = [...document.querySelectorAll('[data-system]')].find(el => el.dataset.system === system);
        setMessage(reopened?.querySelector('[data-settings-message]'), 'System settings saved.', 'success');
      } catch (error) {
        console.error(error); setMessage(msg, 'Could not save system settings.', 'error');
      } finally { button.disabled = false; }
    }
  });

  const resetPage = () => { activeBoardView = ''; currentPage = 1; renderSystems(); };
  search?.addEventListener('input', resetPage);
  filter?.addEventListener('change', resetPage);
  sort?.addEventListener('change', resetPage);
  favoritesFirst?.addEventListener('change', resetPage);
  lowestFiveWatch?.addEventListener('change', resetPage);
  pageSizeEl?.addEventListener('change', () => {
    pageSize = Math.max(1, Number(pageSizeEl.value) || 20);
    currentPage = 1;
    renderSystems();
  });
  [customPriority, customState, customPending, customControl, customFlag].forEach(el => {
    el?.addEventListener(el?.tagName === 'INPUT' ? 'input' : 'change', resetPage);
  });
  queueSelectorSummary?.addEventListener('click', () => setBoardView(activeBoardView === 'queue-selected' ? '' : 'queue-selected'));
  clearActiveView?.addEventListener('click', () => setBoardView(''));
  alertAckButton?.addEventListener('click', async () => {
    if (alertAckButton.disabled) return;
    alertAckButton.disabled = true;
    try {
      await save('ack-alerts', '', {});
    } catch (error) {
      console.error(error);
      alertAckButton.disabled = false;
    }
  });

  alertList?.addEventListener('click', async event => {
    const viewButton = event.target.closest('[data-view-faction-alert]');
    if (viewButton) {
      setBoardView(viewButton.dataset.alertFamily || '');
      return;
    }

    const removeButton = event.target.closest('[data-remove-faction-alert]');
    if (!removeButton) return;
    const system = removeButton.dataset.alertSystem || '';
    const family = removeButton.dataset.alertFamily || '';
    removeButton.disabled = true;
    try {
      await save('remove-alert', system, { family });
    } catch (error) {
      console.error(error);
      removeButton.disabled = false;
    }
  });

  prevPage?.addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; renderSystems(); } });
  nextPage?.addEventListener('click', () => { currentPage += 1; renderSystems(); });

  async function load() {
    setAccess(false);
    try {
      const response = await fetch(`/api/operations/wolf-bgs?_=${Date.now()}`, { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } });
      if (response.status === 401 || response.status === 403) {
        if (gateStatus) gateStatus.textContent = response.status === 401 ? 'Site-admin sign-in required.' : 'This Discord account does not have Wolf BGS Control access.';
        return;
      }
      if (!response.ok) throw new Error(`Wolf BGS Control request failed (${response.status})`);
      payload = await response.json();
      if (viewer) viewer.textContent = `${payload.viewer?.displayName || 'CMDR Wolf258'} · site admin`;
      if (pageSizeEl) { pageSizeEl.value = '20'; pageSize = 20; }
      if (sort) sort.value = 'influence-desc';
      populateSummary(payload);
      populateAlerts(payload);
      populateGlobal(payload);
      populateSystemDefaults(payload);
      renderSystems();
      window.dispatchEvent(new CustomEvent('wolf-bgs-payload-updated', { detail:{ systems:payload.systems || [] } }));
      setAccess(true);
    } catch (error) {
      console.error('Could not load Wolf BGS Control', error);
      if (gateStatus) gateStatus.textContent = 'Wolf BGS Control service unavailable. Please try again.';
    }
  }

  load();
})();
