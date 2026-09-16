(() => {
  const root = document.querySelector('[data-engineering-campaign-planner]');
  if (!root) return;

  let data = null;
  let busy = false;
  let plannerOpen = false;
  let flash = null;

  const STARTABLE_GOALS = new Set(['shields','jump-range','mobility','distributor']);
  const startGoalDetails = {
    shields:{
      option:'Improve Shields · G2/G3 Shield Generator',
      summary:'Build toward a useful G2/G3 Shield Generator improvement through Lei Cheung, then fly the result before deciding whether more Engineering is worth it.',
    },
    'jump-range':{
      option:'Improve Jump Range · G2 FSD + optional experimental/G3',
      summary:'Improve an FSD through a useful G2 Increased Range result, test the travel payoff, then treat the experimental and G3 as separate optional jobs.',
    },
    mobility:{
      option:'Improve Speed & Mobility · G2 Thrusters + optional experimental/G3',
      summary:'Improve Thrusters through a useful G2 result, fly the ship before doing more, then treat the experimental and G3 as separate optional refinements.',
    },
    distributor:{
      option:'Improve Power Distributor · G2 + optional experimental/G3',
      summary:'Diagnose the actual SYS/ENG/WEP bottleneck, build a useful G2 distributor through The Dweller, stress-test the ship, then treat the experimental and G3 as separate optional refinements.',
    },
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kindLabels = {
    assess:'Assess', plan:'Plan', prepare:'Prepare', unlock:'Engineer Access', engineer:'Engineer', demonstrate:'Test the Result', task:'Task',
  };

  async function api(method = 'GET', body = null) {
    const options = { method, credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Mongrels-Request'] = 'pathway-engineering-campaign';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`/api/pathway/engineering-campaign?_=${Date.now()}`, options);
    if (response.status === 401 || response.status === 403) return { unavailable:true };
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function campaignsByRecent() {
    return Object.values(data?.state?.campaigns || {}).sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  }

  function campaignName(campaign) {
    if (!campaign) return 'Engineering Campaign';
    const goal = (data?.goalCatalog || []).find(item => item.id === campaign.goalId);
    return goal?.label || 'Engineering Campaign';
  }

  function nodeStage(node) {
    return node?.meta?.stage || kindLabels[node?.kind] || 'Campaign Step';
  }

  function resourceMarkup(node) {
    const links = [];
    const meta = node?.meta || {};
    if (meta.resourceUrl) links.push({ label:meta.resourceLabel || 'Open Resource', url:meta.resourceUrl });
    if (Array.isArray(meta.secondaryResources)) links.push(...meta.secondaryResources.filter(item => item?.url));
    if (!links.length && node?.resourceHint === 'inara-engineering') {
      links.push({ label:'Open Inara Engineers', url:'https://inara.cz/elite/engineers/' });
    }
    if (!links.length) return '';
    return `<div class="engineering-campaign-resources">${links.map(item => {
      const external = /^https?:\/\//i.test(item.url);
      return `<a class="btn btn-ghost" href="${esc(item.url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(item.label || 'Open Resource')}${external ? ' ↗' : ''}</a>`;
    }).join('')}</div>`;
  }

  function factProgress(node) {
    const rule = node?.factCompletion;
    if (!rule || rule.operator !== 'gte') return null;
    const currentRaw = data?.state?.facts?.[rule.factId]?.value;
    const current = Number.isFinite(Number(currentRaw)) ? Number(currentRaw) : 0;
    const target = Number(rule.target) || 0;
    const remaining = Math.max(0, target - current);
    const percent = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
    return { current, target, remaining, percent };
  }

  function noteMarkup(node) {
    const meta = node?.meta || {};
    const rows = [];
    if (meta.requirement) rows.push(`<div><strong>Requirement</strong><p>${esc(meta.requirement)}</p></div>`);
    if (meta.note) rows.push(`<div><strong>Why this is a separate step</strong><p>${esc(meta.note)}</p></div>`);
    if (meta.stoppingPoint) rows.push(`<div class="is-stop"><strong>Stopping point</strong><p>${esc(meta.stoppingPoint)}</p></div>`);
    if (meta.payoff) rows.push(`<div class="is-payoff"><strong>Take the win</strong><p>${esc(meta.payoff)}</p></div>`);
    return rows.length ? `<div class="engineering-campaign-notes">${rows.join('')}</div>` : '';
  }

  function alternateFactMarkup(node) {
    const alternatives = Array.isArray(node?.meta?.alternateFacts) ? node.meta.alternateFacts : [];
    return alternatives
      .filter(item => item?.factId && item?.label)
      .map(item => `<button class="btn btn-ghost" type="button" data-campaign-set-fact="${esc(item.factId)}" data-campaign-fact-value="true">${esc(item.label)}</button>`)
      .join('');
  }

  function currentActionMarkup(node, campaign) {
    if (!node || !campaign) return '';
    const rule = node.factCompletion;
    const alternatives = alternateFactMarkup(node);
    if (rule?.operator === 'gte') {
      const progress = factProgress(node);
      return `<div class="engineering-campaign-counter">
        <div><strong>${progress.current.toLocaleString()} / ${progress.target.toLocaleString()}</strong><span>${esc(node.meta?.progressLabel || 'tracked progress')}</span></div>
        <div class="engineering-campaign-track"><i style="width:${progress.percent}%"></i></div>
        <small>${progress.remaining ? `${progress.remaining.toLocaleString()} remaining` : 'Tracked prerequisite reached'}</small>
        <button class="btn btn-primary" type="button" data-campaign-open-prep>Update Progress</button>
      </div>${alternatives}`;
    }
    if (rule && (rule.operator === 'truthy' || rule.operator === 'eq')) {
      return `<button class="btn btn-primary" type="button" data-campaign-set-fact="${esc(rule.factId)}" data-campaign-fact-value="${esc(rule.operator === 'eq' ? String(rule.target) : 'true')}">${esc(node.meta?.factActionLabel || 'Mark Requirement Met')}</button>${alternatives}`;
    }
    return `<button class="btn btn-primary" type="button" data-campaign-complete-node="${esc(node.id)}">Done / Already Have This</button>${alternatives}`;
  }

  function canCorrectFact(node) {
    const factId = node?.factCompletion?.factId || '';
    if (!factId || factId.startsWith('first-win.')) return false;
    const alternateIds = new Set((Array.isArray(node?.meta?.alternateFacts) ? node.meta.alternateFacts : []).map(item => item?.factId).filter(Boolean));
    return !alternateIds.has(factId);
  }

  function stepListMarkup(planner) {
    const currentId = planner?.nextMain?.id || '';
    return `<details class="engineering-campaign-step-list">
      <summary>View campaign steps</summary>
      <div class="engineering-campaign-step-list-body">
        ${(planner?.nodes || []).map((node, index) => {
          const complete = node.status === 'complete';
          const current = node.id === currentId;
          const locked = !complete && !node.dependenciesMet;
          let correction = '';
          if (complete && node.completionSource === 'manual') {
            correction = `<button type="button" data-campaign-reopen-node="${esc(node.id)}">Reopen</button>`;
          } else if (complete && node.completionSource === 'fact' && node.factCompletion?.operator === 'gte') {
            correction = `<button type="button" data-campaign-open-prep>Update Tracker</button>`;
          } else if (complete && node.completionSource === 'fact' && canCorrectFact(node)) {
            correction = `<button type="button" data-campaign-clear-fact="${esc(node.factCompletion.factId)}">Undo Mark</button>`;
          }
          return `<article class="engineering-campaign-step${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}${locked ? ' is-locked' : ''}">
            <span class="engineering-campaign-step-index">${String(index + 1).padStart(2,'0')}</span>
            <div><small>${esc(nodeStage(node))}</small><strong>${esc(node.title)}</strong></div>
            <div class="engineering-campaign-step-state"><span>${complete ? 'Complete' : current ? 'Next' : locked ? 'Locked' : 'Ready'}</span>${correction}</div>
          </article>`;
        }).join('')}
      </div>
    </details>`;
  }

  function historyMarkup() {
    const history = campaignsByRecent().filter(campaign => campaign.status !== 'active' && campaign.status !== 'archived').slice(0, 4);
    if (!history.length) return '';
    return `<details class="engineering-campaign-history">
      <summary>Previous campaigns</summary>
      <div class="engineering-campaign-history-list">${history.map(campaign => `<article>
        <div><small>${esc(campaign.status)}</small><strong>${esc(campaignName(campaign))}${campaign.shipName ? ` · ${esc(campaign.shipName)}` : ''}</strong></div>
        ${campaign.status === 'paused' ? `<button class="btn btn-ghost" type="button" data-campaign-resume="${esc(campaign.id)}">Resume</button>` : ''}
        ${campaign.status === 'complete' ? `<button class="btn btn-ghost" type="button" data-campaign-reopen-campaign="${esc(campaign.id)}">Reopen Campaign</button>` : ''}
        <button class="engineering-campaign-text-button" type="button" data-campaign-archive="${esc(campaign.id)}">Remove from History</button>
      </article>`).join('')}</div>
    </details>`;
  }

  function inactiveMarkup() {
    const recentWin = campaignsByRecent().find(campaign => campaign.status === 'complete');
    const available = (data?.goalCatalog || []).filter(goal => STARTABLE_GOALS.has(goal.id));
    return `<details class="engineering-campaign-planner"${plannerOpen ? ' open' : ''}>
      <summary>
        <span class="engineering-campaign-summary-copy"><small>Engineering · Goal Planner</small><strong>Campaign Planner</strong></span>
        <span class="engineering-campaign-summary-state">${recentWin ? 'Ready for another goal' : `${available.length || 4} audited campaigns ready`}</span>
      </summary>
      <div class="engineering-campaign-body">
        ${recentWin ? `<div class="engineering-campaign-last-win"><small>Last campaign win</small><strong>${esc(campaignName(recentWin))}${recentWin.shipName ? ` · ${esc(recentWin.shipName)}` : ''}</strong></div>` : ''}
        <div class="engineering-campaign-intro">
          <span class="engineering-campaign-live-badge">Live Campaigns</span>
          <h4>Choose the next useful improvement</h4>
          <p>Each audited campaign works toward a useful partial upgrade, makes you fly the result, and lets saved Engineer progress satisfy old prerequisites instead of sending you backward through work you already completed.</p>
        </div>
        <form class="engineering-campaign-start" data-campaign-start-form>
          <label><span>Campaign</span><select required data-campaign-goal>${available.map(goal => `<option value="${esc(goal.id)}">${esc(startGoalDetails[goal.id]?.option || goal.label)}</option>`).join('')}</select></label>
          <div class="engineering-campaign-goal-hints">${available.map(goal => `<p><strong>${esc(goal.label)}</strong>${esc(startGoalDetails[goal.id]?.summary || goal.description || '')}</p>`).join('')}</div>
          <label><span>Ship</span><input type="text" maxlength="120" required data-campaign-ship placeholder="Ship name or hull — e.g. Triad / Corsair"></label>
          <label><span>What do you want this ship to do better?</span><textarea maxlength="500" required rows="3" data-campaign-notes placeholder="Example: keep WEP from running dry during normal combat without sacrificing the boost cadence I rely on."></textarea></label>
          <button class="btn btn-primary" type="submit">Start Engineering Campaign</button>
        </form>
        ${historyMarkup()}
        <div class="engineering-campaign-status" data-campaign-status${flash ? ` data-state="${esc(flash.state)}"` : ''}>${esc(flash?.message || '')}</div>
      </div>
    </details>`;
  }

  function takeWinCopy(campaign) {
    if (campaign?.goalId === 'jump-range') {
      return 'If the travel improvement now solves the problem you started with, complete the campaign here. The experimental and G3 are optional follow-on improvements.';
    }
    if (campaign?.goalId === 'mobility') {
      return 'If the ship now moves the way you wanted, complete the campaign here. The experimental and G3 are optional follow-on improvements.';
    }
    if (campaign?.goalId === 'distributor') {
      return 'If the distributor now keeps up with the ship’s real workload, complete the campaign here. The experimental and G3 are optional follow-on improvements.';
    }
    return 'If the shield now solves the problem you started with, complete the campaign here. Continuing to G3 is optional refinement.';
  }

  function finishedCopy(campaign) {
    if (campaign?.goalId === 'jump-range') {
      return 'Record the win and close this campaign phase. Future FSD work should start from what you learned here rather than automatically extending the grind into G4/G5.';
    }
    if (campaign?.goalId === 'mobility') {
      return 'Record the win and close this campaign phase. Future Thrusters work should start from what you learned here rather than automatically extending the grind into G4/G5 or another Engineer unlock.';
    }
    if (campaign?.goalId === 'distributor') {
      return 'Record the win and close this campaign phase. Future distributor work should start from the measured SYS/ENG/WEP behavior rather than automatically extending the grind into G4/G5.';
    }
    return 'Record the win and close this campaign phase. Future shield work should start from what you learned here rather than automatically extending the grind.';
  }

  function activeMarkup(planner) {
    const campaign = planner.campaign;
    const nodes = Array.isArray(planner.nodes) ? planner.nodes : [];
    const completed = nodes.filter(node => node.status === 'complete').length;
    const percent = nodes.length ? Math.round((completed / nodes.length) * 100) : 0;
    const current = planner.nextMain;
    const canTakeWin = nodes.some(node => node.status === 'complete' && node.meta?.readyToFinish);

    return `<details class="engineering-campaign-planner"${plannerOpen ? ' open' : ''}>
      <summary>
        <span class="engineering-campaign-summary-copy"><small>Engineering · Active Campaign</small><strong>${esc(campaign.goal?.label || campaignName(campaign))}</strong></span>
        <span class="engineering-campaign-summary-state">${completed} / ${nodes.length} steps</span>
      </summary>
      <div class="engineering-campaign-body">
        <article class="engineering-campaign-head-card">
          <div><small>Active goal</small><h4>${esc(campaign.goal?.label || 'Engineering Campaign')}</h4><p>${campaign.shipName ? `<strong>${esc(campaign.shipName)}</strong> · ` : ''}${esc(campaign.targetNotes || 'Improve this ship deliberately, one useful stopping point at a time.')}</p></div>
          <div class="engineering-campaign-head-actions"><button class="engineering-campaign-text-button" type="button" data-campaign-pause>Pause Campaign</button></div>
          <div class="engineering-campaign-progress"><div><span>${completed} / ${nodes.length}</span><small>steps cleared</small></div><div class="engineering-campaign-track"><i style="width:${percent}%"></i></div><strong>${percent}%</strong></div>
        </article>

        ${current ? `<article class="engineering-campaign-current">
          <span class="engineering-campaign-stage">${esc(nodeStage(current))}</span>
          <h4>${esc(current.title)}</h4>
          <p>${esc(current.objective || '')}</p>
          ${noteMarkup(current)}
          ${factProgress(current) ? '' : resourceMarkup(current)}
          <div class="engineering-campaign-actions">${currentActionMarkup(current, campaign)}${factProgress(current) ? resourceMarkup(current) : ''}</div>
        </article>` : `<article class="engineering-campaign-current is-finished"><span class="engineering-campaign-stage">Campaign Chain Cleared</span><h4>Every planned step is complete.</h4><p>${esc(finishedCopy(campaign))}</p></article>`}

        ${canTakeWin ? `<aside class="engineering-campaign-take-win"><div><small>Stopping point reached</small><strong>You are allowed to be done.</strong><p>${esc(takeWinCopy(campaign))}</p></div><button class="btn btn-primary" type="button" data-campaign-finish>Take the Win · Complete Campaign</button></aside>` : ''}
        ${!current && !canTakeWin ? `<div class="engineering-campaign-finish-row"><button class="btn btn-primary" type="button" data-campaign-finish>Complete Campaign</button></div>` : ''}
        ${stepListMarkup(planner)}
        ${historyMarkup()}
        <div class="engineering-campaign-status" data-campaign-status${flash ? ` data-state="${esc(flash.state)}"` : ''}>${esc(flash?.message || '')}</div>
      </div>
    </details>`;
  }

  function render(payload) {
    data = payload;
    if (payload?.unavailable) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    const existing = root.querySelector('details.engineering-campaign-planner');
    if (existing?.open) plannerOpen = true;
    root.hidden = false;
    root.innerHTML = payload?.planner?.active ? activeMarkup(payload.planner) : inactiveMarkup();
    const details = root.querySelector('details.engineering-campaign-planner');
    details?.addEventListener('toggle', () => { plannerOpen = Boolean(details.open); });
    bind();
  }

  function bind() {
    root.querySelector('[data-campaign-start-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const goalId = form.querySelector('[data-campaign-goal]')?.value || '';
      const shipName = form.querySelector('[data-campaign-ship]')?.value?.trim() || '';
      const targetNotes = form.querySelector('[data-campaign-notes]')?.value?.trim() || '';
      if (!STARTABLE_GOALS.has(goalId) || !shipName || !targetNotes) return;
      const label = (data?.goalCatalog || []).find(goal => goal.id === goalId)?.label || 'Engineering';
      run({ action:'start_campaign', goalId, shipName, targetNotes }, `Starting ${label} campaign…`);
    });

    root.querySelectorAll('[data-campaign-complete-node]').forEach(button => button.addEventListener('click', () => {
      run({ action:'set_node', campaignId:data?.planner?.campaign?.id, nodeId:button.dataset.campaignCompleteNode, complete:true }, 'Saving campaign step…');
    }));
    root.querySelectorAll('[data-campaign-reopen-node]').forEach(button => button.addEventListener('click', () => {
      run({ action:'set_node', campaignId:data?.planner?.campaign?.id, nodeId:button.dataset.campaignReopenNode, complete:false }, 'Reopening campaign step…');
    }));
    root.querySelectorAll('[data-campaign-set-fact]').forEach(button => button.addEventListener('click', () => {
      const raw = button.dataset.campaignFactValue;
      const value = raw === 'true' ? true : raw === 'false' ? false : raw;
      run({ action:'set_fact', factId:button.dataset.campaignSetFact, value }, 'Recording shared Engineering progress…');
    }));
    root.querySelectorAll('[data-campaign-clear-fact]').forEach(button => button.addEventListener('click', () => {
      if (!window.confirm('Undo this recorded Engineer-access milestone?\n\nUse this only if you marked it by mistake.')) return;
      run({ action:'clear_fact', factId:button.dataset.campaignClearFact }, 'Correcting shared Engineering progress…');
    }));
    root.querySelectorAll('[data-campaign-open-prep]').forEach(button => button.addEventListener('click', openPrepTracker));
    root.querySelector('[data-campaign-pause]')?.addEventListener('click', () => {
      run({ action:'set_campaign_status', campaignId:data?.planner?.campaign?.id, status:'paused' }, 'Pausing campaign…');
    });
    root.querySelector('[data-campaign-finish]')?.addEventListener('click', () => {
      if (!window.confirm('Complete this Engineering campaign at the current stopping point?\n\nYour completed steps and shared Engineer progress stay saved.')) return;
      run({ action:'set_campaign_status', campaignId:data?.planner?.campaign?.id, status:'complete' }, 'Recording campaign win…');
    });
    root.querySelectorAll('[data-campaign-resume]').forEach(button => button.addEventListener('click', () => {
      run({ action:'set_campaign_status', campaignId:button.dataset.campaignResume, status:'active' }, 'Resuming campaign…');
    }));
    root.querySelectorAll('[data-campaign-reopen-campaign]').forEach(button => button.addEventListener('click', () => {
      if (data?.planner?.active && !window.confirm('Reopen this completed campaign?\n\nYour currently active Engineering campaign will be paused.')) return;
      run({ action:'set_campaign_status', campaignId:button.dataset.campaignReopenCampaign, status:'active' }, 'Reopening completed campaign…');
    }));
    root.querySelectorAll('[data-campaign-archive]').forEach(button => button.addEventListener('click', () => {
      if (!window.confirm('Remove this campaign from visible history?\n\nThe campaign record will be archived rather than permanently deleted, and shared Engineer facts will stay intact.')) return;
      run({ action:'set_campaign_status', campaignId:button.dataset.campaignArchive, status:'archived' }, 'Removing campaign from history…');
    }));
  }

  function openPrepTracker() {
    const prepRoot = document.querySelector('[data-engineering-prep-tracker]');
    const prep = prepRoot?.querySelector('details.engineering-prep-tracker');
    if (prep) prep.open = true;
    prepRoot?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function setBusy(message) {
    root.querySelectorAll('button,input,textarea,select').forEach(control => { control.disabled = true; });
    const status = root.querySelector('[data-campaign-status]');
    if (status) { status.textContent = message; status.dataset.state = 'working'; }
  }

  async function run(body, message) {
    if (busy) return;
    busy = true;
    plannerOpen = true;
    setBusy(message);
    try {
      flash = { state:'success', message:'Campaign progress saved.' };
      render(await api('POST', body));
      window.dispatchEvent(new CustomEvent('mongrels:engineering-campaign-updated', { detail:{ source:'planner' } }));
    } catch (error) {
      console.error('Could not update Engineering campaign', error);
      flash = { state:'error', message:error?.message || 'Could not save campaign progress.' };
      try { render(await api()); } catch { /* leave current surface if reload also fails */ }
    } finally {
      busy = false;
      root.querySelectorAll('button,input,textarea,select').forEach(control => { control.disabled = false; });
    }
  }

  async function load() {
    try { render(await api()); }
    catch (error) {
      console.error('Could not load Engineering Campaign Planner', error);
      root.hidden = true;
    }
  }

  window.addEventListener('mongrels:engineering-campaign-updated', event => {
    if (event?.detail?.source === 'planner') return;
    load();
  });

  load();
})();