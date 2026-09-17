(() => {
  const gate = document.querySelector('[data-wolf-gate]');
  const privateView = document.querySelector('[data-wolf-private]');
  const gateStatus = document.querySelector('[data-wolf-gate-status]');
  const viewer = document.querySelector('[data-wolf-viewer]');
  const list = document.querySelector('[data-system-list]');
  const search = document.querySelector('[data-system-search]');
  const filter = document.querySelector('[data-system-filter]');
  const count = document.querySelector('[data-system-count]');
  const sourceCoverage = document.querySelector('[data-source-coverage]');
  const sourceNote = document.querySelector('[data-source-note]');
  const globalForm = document.querySelector('[data-global-form]');
  const globalMeta = document.querySelector('[data-global-meta]');

  let payload = null;

  const html = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const influence = value => num(value) === null ? '—' : `${Number(value).toFixed(1)}%`;

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
    set('[data-summary-updated]', fmt(data.meta?.generatedAt));
    set('[data-summary-source]', data.meta?.source || 'EliteHub Vault / EDDN');
    if (sourceCoverage) sourceCoverage.textContent = data.meta?.sourceBoardCoverage === 'mongrel-presence-only' ? 'Partial source board' : 'Source coverage';
    if (sourceNote) sourceNote.textContent = data.meta?.sourceBoardNote || '';
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

  function collectGlobal() {
    const out = {};
    globalForm.querySelectorAll('[data-global]').forEach(el => {
      const key = el.dataset.global;
      out[key] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }

  function priorityLabel(system) {
    const value = system.settings?.strategicPriority || 'normal';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function systemStatus(system) {
    if (system.retreatRisk) return { key:'risk', label:'Retreat risk' };
    if (system.conflict) return { key:'risk', label:'Conflict' };
    if (system.dataCondition === 'stale') return { key:'stale', label:'Stale' };
    return { key:'ok', label:'Healthy' };
  }

  function rowTemplate(faction, index) {
    return `<tr data-faction-row>
      <td><input class="faction-name" data-faction="name" maxlength="120" value="${html(faction?.name || '')}" placeholder="Faction name"></td>
      <td><input data-faction="influence" type="number" min="0" max="100" step="0.01" value="${faction?.influence ?? ''}" placeholder="0.0"></td>
      <td><input data-faction="state" maxlength="80" value="${html(faction?.state || 'None')}" placeholder="None"></td>
      <td><input data-faction="pending" maxlength="120" value="${html(faction?.pending || '')}" placeholder="None"></td>
      <td><input data-faction="recovering" maxlength="120" value="${html(faction?.recovering || '')}" placeholder="None"></td>
      <td><span class="wolf-row-source">${html(faction?.source || (index === 0 ? 'source' : 'manual'))}</span></td>
      <td><button type="button" class="wolf-mini-button" data-remove-faction aria-label="Remove faction">×</button></td>
    </tr>`;
  }

  function systemCard(system) {
    const status = systemStatus(system);
    const settings = system.settings || {};
    const factions = Array.isArray(system.factions) && system.factions.length ? system.factions : [{ name:'Regiment of Imperial Mongrels', influence:system.influence, state:system.state, pending:(system.pendingStates || []).join(', '), recovering:(system.recoveringStates || []).join(', '), source:'third-party' }];
    const tick = settings.customTick || payload.defaults?.defaultTick || '19:00';
    const freshHours = settings.freshnessHours ?? payload.defaults?.freshnessHours ?? 8;
    const manualNewer = system.activeSnapshotSource === 'manual';
    const boardWarning = system.boardComplete ? '' : `<div class="wolf-danger-note">Automated ingestion currently supplies the Mongrel presence row, not the complete faction board. Add/edit all system factions here and submit a manual snapshot until full-board ingestion is added.</div>`;

    return `<details class="wolf-system-card" data-system="${html(system.name)}">
      <summary>
        <div class="wolf-system-name"><strong>${html(system.name)}</strong><small>${html(system.control || 'Controller unknown')}</small></div>
        <div class="wolf-system-stat"><span>Mongrel INF</span><b>${influence(system.influence)}</b></div>
        <div class="wolf-system-stat hide-mobile"><span>State</span><b>${html(system.state || 'None')}</b></div>
        <div class="wolf-system-stat hide-mobile"><span>Data</span><b>${html(age(system.activeSnapshotTime))}</b></div>
        <div class="wolf-system-stat hide-tablet hide-mobile"><span>Tick</span><b>${html(tick)}</b></div>
        <div class="wolf-system-stat hide-tablet hide-mobile"><span>Priority</span><b>${html(priorityLabel(system))}</b></div>
        <span class="wolf-status-pill ${status.key}">${html(status.label)}</span>
        <span class="wolf-expand">+</span>
      </summary>
      <div class="wolf-system-body">
        <div class="wolf-system-topline">
          <span class="wolf-chip">Source update <b>${html(fmt(system.sourceUpdated))}</b></span>
          <span class="wolf-chip">Manual update <b>${html(fmt(system.manualUpdatedAt))}</b></span>
          <span class="wolf-chip">Active snapshot <b>${manualNewer ? 'Manual' : 'Source'} · ${html(fmt(system.activeSnapshotTime))}</b></span>
          <span class="wolf-chip">Freshness limit <b>${html(freshHours)}h</b></span>
          <span class="wolf-chip">Population <b>${html(system.population ? Number(system.population).toLocaleString() : '—')}</b></span>
        </div>
        <div class="wolf-subgrid">
          <div>
            <section class="wolf-section">
              <h3>System Status & Faction Board</h3>
              <p class="wolf-section-intro">All faction rows are editable. Submit Status creates a fresh manual snapshot and immediately becomes the newest trusted board when its timestamp is newer.</p>
              ${boardWarning}
              <div style="overflow-x:auto"><table class="wolf-faction-table"><thead><tr><th>Faction</th><th>Influence %</th><th>State</th><th>Pending</th><th>Recovering</th><th>Origin</th><th></th></tr></thead><tbody data-faction-body>${factions.map(rowTemplate).join('')}</tbody></table></div>
              <div class="wolf-faction-actions"><button type="button" class="wolf-mini-button" data-add-faction>+ Add Faction</button><span class="wolf-status-message" data-status-message></span></div>
              <div class="wolf-form-grid" style="margin-top:.8rem"><label><span>Controller</span><input data-status="controller" maxlength="120" value="${html(system.manualController || system.control || '')}"></label><label style="grid-column:span 2"><span>Status notes</span><input data-status="notes" maxlength="1200" value="${html(system.manualNotes || '')}" placeholder="Optional notes about this snapshot"></label></div>
              <div class="wolf-save-row"><span>Manual status last submitted: ${html(system.manualUpdatedAt ? `${fmt(system.manualUpdatedAt)} by ${system.manualUpdatedBy || 'Wolf'}` : 'never')}</span><button type="button" class="btn btn-primary" data-submit-status>Submit Status</button></div>
            </section>

            <section class="wolf-section">
              <h3>Strategy</h3><p class="wolf-section-intro">Defines what the programmed BGS logic should try to accomplish here.</p>
              <div class="wolf-system-settings-grid">
                <label class="wolf-field"><span>Strategic importance</span><select data-setting="strategicPriority"><option value="critical" ${settings.strategicPriority==='critical'?'selected':''}>Critical</option><option value="high" ${settings.strategicPriority==='high'?'selected':''}>High</option><option value="normal" ${!settings.strategicPriority||settings.strategicPriority==='normal'?'selected':''}>Normal</option><option value="low" ${settings.strategicPriority==='low'?'selected':''}>Low</option></select></label>
                <label class="wolf-field"><span>Desired control</span><select data-setting="desiredControl"><option value="maintain" ${settings.desiredControl==='maintain'?'selected':''}>Maintain Mongrel control</option><option value="gain" ${settings.desiredControl==='gain'?'selected':''}>Gain control</option><option value="allow-transfer" ${settings.desiredControl==='allow-transfer'?'selected':''}>Allow intentional transfer</option><option value="none" ${settings.desiredControl==='none'?'selected':''}>No control objective</option></select></label>
                <label class="wolf-field"><span>Target minimum %</span><input data-setting="targetMin" type="number" min="0" max="100" step="0.1" value="${settings.targetMin ?? ''}" placeholder="Inherited / none"></label>
                <label class="wolf-field"><span>Target maximum %</span><input data-setting="targetMax" type="number" min="0" max="100" step="0.1" value="${settings.targetMax ?? ''}" placeholder="Inherited / none"></label>
                <label class="wolf-field"><span>Preferred states</span><input data-setting="desiredStates" value="${html((settings.desiredStates || []).join(', '))}" placeholder="Boom, Civil Liberty"></label>
                <label class="wolf-field"><span>Avoid states</span><input data-setting="avoidStates" value="${html((settings.avoidStates || []).join(', '))}" placeholder="Expansion, Civil Unrest"></label>
              </div>
              <div class="wolf-toggle-list"><label><input type="checkbox" data-setting="protectRetreat" ${settings.protectRetreat!==false?'checked':''}> Protect Mongrels from Retreat</label><label><input type="checkbox" data-setting="avoidExpansion" ${settings.avoidExpansion?'checked':''}> Avoid unwanted Expansion</label></div>
              <label class="wolf-field" style="margin-top:.7rem"><span>System notes</span><textarea data-setting="notes" rows="3" maxlength="1200">${html(settings.notes || '')}</textarea></label>
            </section>
          </div>

          <div>
            <section class="wolf-section">
              <h3>Automation Controls</h3><p class="wolf-section-intro">The programmed rules remain authoritative. Advanced intelligence suggestions will be advisory and visible separately.</p>
              <div class="wolf-toggle-list">
                <label><input type="checkbox" data-setting="allowDailyOrders" ${settings.allowDailyOrders!==false?'checked':''}> Allow into Daily Orders</label>
                <label><input type="checkbox" data-setting="autoGenerateOrders" ${settings.autoGenerateOrders!==false?'checked':''}> Generate orders automatically</label>
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
                <label class="wolf-field"><span>Custom tick</span><input type="time" data-setting="customTick" value="${html(settings.customTick || '')}"><small>Blank = global ${html(payload.defaults?.defaultTick || '19:00')}</small></label>
                <label class="wolf-field"><span>Custom freshness hours</span><input type="number" min="1" max="72" data-setting="freshnessHours" value="${settings.freshnessHours ?? ''}" placeholder="Global ${html(payload.defaults?.freshnessHours ?? 8)}"></label>
                <label class="wolf-field" style="grid-column:span 2"><span>Rollover policy</span><select data-setting="rolloverPolicy"><option value="" ${!settings.rolloverPolicy?'selected':''}>Use global (${html(payload.defaults?.rolloverPolicy || 'safety')})</option><option value="strict" ${settings.rolloverPolicy==='strict'?'selected':''}>Strict</option><option value="safety" ${settings.rolloverPolicy==='safety'?'selected':''}>Safety Only</option><option value="carry" ${settings.rolloverPolicy==='carry'?'selected':''}>Carry Forward</option></select></label>
              </div>
            </section>

            <section class="wolf-section">
              <h3>Programmed Automation</h3>
              <div class="wolf-automation-preview"><strong>Rule-engine output placeholder</strong><p>This card will show exactly which programmed rule fired, the base workload (for example bounty amount), modifiers, final task, priority, and stop condition.</p><button type="button" class="wolf-mini-button" disabled>Why did automation do this?</button></div>
              <div class="wolf-automation-preview wolf-ai-preview"><strong>Advanced Intelligence Suggestion</strong><p>Advisory layer reserved for historical calibration, anomaly checks, and AI suggestions. It will never silently replace the programmed rule.</p><button type="button" class="wolf-mini-button" disabled>Apply suggestion</button></div>
            </section>
          </div>
        </div>

        <div class="wolf-system-actions"><div><small>System settings last saved: ${html(settings.updatedAt ? `${fmt(settings.updatedAt)} by ${settings.updatedBy || 'Wolf'}` : 'never')}</small><div class="wolf-status-message" data-settings-message></div></div><button type="button" class="btn btn-primary" data-save-system>Save System Settings</button></div>
      </div>
    </details>`;
  }

  function renderSystems() {
    if (!list || !payload) return;
    const q = (search?.value || '').trim().toLowerCase();
    const mode = filter?.value || 'all';
    const rows = (payload.systems || []).filter(system => {
      if (q && !String(system.name || '').toLowerCase().includes(q)) return false;
      if (mode === 'attention') return system.retreatRisk || system.conflict || system.dataCondition === 'stale';
      if (mode === 'stale') return system.dataCondition === 'stale';
      if (mode === 'controlled') return system.controlled;
      if (mode === 'custom') return Boolean(system.settings?.updatedAt || system.manualUpdatedAt);
      return true;
    });
    if (count) count.textContent = rows.length.toLocaleString();
    list.innerHTML = rows.length ? rows.map(systemCard).join('') : '<div class="wolf-empty">No systems match this view.</div>';
  }

  function collectSettings(card) {
    const out = {};
    card.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (el.type === 'checkbox') out[key] = el.checked;
      else if (['desiredStates','avoidStates'].includes(key)) out[key] = el.value.split(',').map(v => v.trim()).filter(Boolean);
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

  async function save(action, system, body) {
    const response = await fetch('/api/operations/wolf-bgs', {
      method:'PUT', credentials:'same-origin', cache:'no-store',
      headers:{ Accept:'application/json', 'Content-Type':'application/json', 'X-Mongrels-Request':'wolf-bgs-control' },
      body:JSON.stringify({ action, system, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    payload = data;
    populateSummary(payload);
    populateGlobal(payload);
    renderSystems();
    return data;
  }

  globalForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = globalForm.querySelector('button[type="submit"]');
    button.disabled = true;
    if (globalMeta) globalMeta.textContent = 'Saving global defaults…';
    try { await save('save-global', '', { defaults:collectGlobal() }); if (globalMeta) globalMeta.textContent = `Saved ${fmt(payload.globalUpdatedAt)} by ${payload.globalUpdatedBy || 'Wolf'}`; }
    catch (error) { console.error(error); if (globalMeta) globalMeta.textContent = 'Could not save global defaults.'; }
    finally { button.disabled = false; }
  });

  list?.addEventListener('click', async event => {
    const card = event.target.closest('[data-system]');
    if (!card) return;
    const system = card.dataset.system;

    if (event.target.closest('[data-add-faction]')) {
      card.querySelector('[data-faction-body]')?.insertAdjacentHTML('beforeend', rowTemplate({ name:'', influence:'', state:'None', pending:'', recovering:'', source:'manual' }, 99));
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
      try { await save('submit-status', system, { snapshot:collectSnapshot(card) }); const reopened = [...document.querySelectorAll('[data-system]')].find(el => el.dataset.system === system); if (reopened) reopened.open = true; setMessage(reopened?.querySelector('[data-status-message]'), 'Status accepted. Automation can now use this snapshot.', 'success'); }
      catch (error) { console.error(error); setMessage(msg, 'Could not submit status.', 'error'); }
      finally { button.disabled = false; }
      return;
    }
    if (event.target.closest('[data-save-system]')) {
      const button = event.target.closest('[data-save-system]');
      const msg = card.querySelector('[data-settings-message]');
      button.disabled = true; setMessage(msg, 'Saving system settings…', 'working');
      try { await save('save-system', system, { settings:collectSettings(card) }); const reopened = [...document.querySelectorAll('[data-system]')].find(el => el.dataset.system === system); if (reopened) reopened.open = true; setMessage(reopened?.querySelector('[data-settings-message]'), 'System settings saved.', 'success'); }
      catch (error) { console.error(error); setMessage(msg, 'Could not save system settings.', 'error'); }
      finally { button.disabled = false; }
    }
  });

  search?.addEventListener('input', renderSystems);
  filter?.addEventListener('change', renderSystems);

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
      populateSummary(payload);
      populateGlobal(payload);
      renderSystems();
      setAccess(true);
    } catch (error) {
      console.error('Could not load Wolf BGS Control', error);
      if (gateStatus) gateStatus.textContent = 'Wolf BGS Control service unavailable. Please try again.';
    }
  }

  load();
})();