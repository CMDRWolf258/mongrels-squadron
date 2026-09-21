(() => {
  const API = '/api/operations/wolf-bgs-rules';
  const MONGREL = 'Regiment of Imperial Mongrels';
  let state = {
    rules: {
      workload: { missionInfPerCmdr:25, missionInfStretchPerCmdr:40, bountyMillionsPerCmdr:20, tradeProfitMillionsPerCmdr:20, explorationMillionsPerCmdr:10, preferredOperators:3, diversifyBuckets:true, soloDoNotMultiply:true },
      balancing: { bountyBaselineMillions:20, bountyCounterInf:15, tradeBaselineMillions:20, tradeCounterInf:null, triggerHeadroomPct:2, maxCounterweightFactions:2 },
      safety: { retreatWarning:5, retreatEmergency:3, expansionWarning:67 },
      doctrine: { exactPerCmdrCapConfirmed:false, operatorStrategy:'spread-first' },
    },
    systemFactionStrategies: {}, factionStrategyUpdatedAt: {}, factionStrategyUpdatedBy: {},
    systemCalibrations: {}, calibrationUpdatedAt: {}, calibrationUpdatedBy: {}, updatedAt:null, updatedBy:null,
  };

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const num = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const norm = value => String(value || '').trim().toLowerCase();

  function fmt(value) {
    if (!value) return 'never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(date);
  }

  async function call(action, body = {}) {
    const response = await fetch(API, {
      method:'PUT', credentials:'same-origin', cache:'no-store',
      headers:{ Accept:'application/json', 'Content-Type':'application/json', 'X-Mongrels-Request':'wolf-bgs-control' },
      body:JSON.stringify({ action, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function loadRules() {
    const response = await fetch(`${API}?_=${Date.now()}`, { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } });
    if (!response.ok) throw new Error(`Rules request failed (${response.status})`);
    const data = await response.json();
    state = { ...state, ...data };
  }

  function rulesPanelMarkup() {
    const r = state.rules || {};
    const w = r.workload || {};
    const b = r.balancing || {};
    const s = r.safety || {};
    return `<section class="section-sm wolf-rules-section" data-rules-section>
      <div class="container">
        <details class="wolf-panel wolf-rules-panel">
          <summary><span><b>Automation Rules Library</b><small>Authoritative workload guidance, balancing calibration, safety thresholds, and whole-board operating doctrine</small></span><strong>+</strong></summary>
          <form class="wolf-panel-body" data-rules-form>
            <p class="wolf-section-intro">These are programmed-rule inputs, not hidden Frontier formulas. Daily Orders generation remains preview-only until the rule behavior is reviewed and accepted.</p>
            <div class="wolf-rules-callout"><strong>Diminishing-return doctrine</strong><span>Prefer more participating CMDRs and multiple useful BGS buckets over making one CMDR grind a single bucket far past the useful range. Exact independent per-CMDR caps are not treated as confirmed game mechanics.</span></div>
            <div class="wolf-rules-grid">
              <label><span>Mission INF / CMDR goal</span><input type="number" min="1" max="100" step="1" data-rule="missionInfPerCmdr" value="${esc(w.missionInfPerCmdr ?? 25)}"></label>
              <label><span>Mission INF / CMDR stretch</span><input type="number" min="1" max="150" step="1" data-rule="missionInfStretchPerCmdr" value="${esc(w.missionInfStretchPerCmdr ?? 40)}"></label>
              <label><span>Preferred CMDRs / objective</span><input type="number" min="1" max="12" step="1" data-rule="preferredOperators" value="${esc(w.preferredOperators ?? 3)}"></label>
              <label><span>Bounties / CMDR</span><div class="input-unit"><input type="number" min="1" max="250" step="1" data-rule="bountyMillionsPerCmdr" value="${esc(w.bountyMillionsPerCmdr ?? 20)}"><em>M Cr</em></div></label>
              <label><span>Trade profit / CMDR</span><div class="input-unit"><input type="number" min="1" max="250" step="1" data-rule="tradeProfitMillionsPerCmdr" value="${esc(w.tradeProfitMillionsPerCmdr ?? 20)}"><em>M Cr</em></div></label>
              <label><span>Exploration data / CMDR</span><div class="input-unit"><input type="number" min="1" max="250" step="1" data-rule="explorationMillionsPerCmdr" value="${esc(w.explorationMillionsPerCmdr ?? 10)}"><em>M Cr</em></div></label>
              <label><span>Retreat warning</span><div class="input-unit"><input type="number" min="0" max="20" step="0.1" data-rule="retreatWarning" value="${esc(s.retreatWarning ?? 5)}"><em>%</em></div></label>
              <label><span>Retreat emergency</span><div class="input-unit"><input type="number" min="0" max="20" step="0.1" data-rule="retreatEmergency" value="${esc(s.retreatEmergency ?? 3)}"><em>%</em></div></label>
              <label><span>Expansion early warning</span><div class="input-unit"><input type="number" min="0" max="100" step="0.1" data-rule="expansionWarning" value="${esc(s.expansionWarning ?? 67)}"><em>%</em></div></label>
            </div>

            <div class="wolf-rules-subhead"><strong>Influence balancing baseline</strong><span>Operational calibration only. The starting Security recipe is 20M bounty vouchers → 15 mission INF of counter-support. It is not presented as a Frontier conversion formula.</span></div>
            <div class="wolf-rules-grid wolf-balancing-grid">
              <label><span>Bounty baseline workload</span><div class="input-unit"><input type="number" min="1" max="250" step="1" data-rule="bountyBaselineMillions" value="${esc(b.bountyBaselineMillions ?? 20)}"><em>M Cr</em></div></label>
              <label><span>Bounty counterweight</span><div class="input-unit"><input type="number" min="0" max="150" step="1" data-rule="bountyCounterInf" value="${esc(b.bountyCounterInf ?? 15)}"><em>INF</em></div></label>
              <label><span>Balance trigger headroom</span><div class="input-unit"><input type="number" min="0" max="20" step="0.1" data-rule="triggerHeadroomPct" value="${esc(b.triggerHeadroomPct ?? 2)}"><em>% pts</em></div></label>
              <label><span>Trade baseline workload</span><div class="input-unit"><input type="number" min="1" max="250" step="1" data-rule="tradeBaselineMillions" value="${esc(b.tradeBaselineMillions ?? 20)}"><em>M Cr</em></div></label>
              <label><span>Trade counterweight</span><div class="input-unit"><input type="number" min="0" max="150" step="1" data-rule="tradeCounterInf" value="${b.tradeCounterInf === null || b.tradeCounterInf === undefined ? '' : esc(b.tradeCounterInf)}" placeholder="Not calibrated"><em>INF</em></div></label>
              <label><span>Max counterweight factions</span><select data-rule="maxCounterweightFactions"><option value="1" ${Number(b.maxCounterweightFactions)===1?'selected':''}>1 faction</option><option value="2" ${Number(b.maxCounterweightFactions)!==1?'selected':''}>Up to 2 factions</option></select></label>
            </div>
            <div class="wolf-rules-callout subtle"><strong>Economy baseline</strong><span>Trade counterweight starts uncalibrated. Economy orders can still be previewed, but the engine will flag manual calibration instead of inventing an INF conversion until you set one.</span></div>

            <div class="wolf-check-grid">
              <label><input type="checkbox" data-rule-check="diversifyBuckets" ${w.diversifyBuckets !== false ? 'checked' : ''}> Diversify useful BGS buckets when practical</label>
              <label><input type="checkbox" data-rule-check="soloDoNotMultiply" ${w.soloDoNotMultiply !== false ? 'checked' : ''}> Do not multiply a solo CMDR's workload to replace missing operators</label>
            </div>
            <div class="wolf-save-row"><span data-rules-meta>Rules last saved: ${esc(state.updatedAt ? `${fmt(state.updatedAt)} by ${state.updatedBy || 'Wolf'}` : 'using prototype defaults')}</span><button class="btn btn-primary" type="submit">Save Automation Rules</button></div>
          </form>
        </details>
      </div>
    </section>`;
  }

  function mountRulesPanel() {
    if (document.querySelector('[data-rules-section]')) return;
    const systems = document.querySelector('.wolf-systems-section');
    if (!systems) return;
    systems.insertAdjacentHTML('beforebegin', rulesPanelMarkup());
    document.querySelector('[data-rules-form]')?.addEventListener('submit', saveRules);
  }

  async function saveRules(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const meta = form.querySelector('[data-rules-meta]');
    const get = key => form.querySelector(`[data-rule="${key}"]`)?.value ?? '';
    const checked = key => Boolean(form.querySelector(`[data-rule-check="${key}"]`)?.checked);
    const rules = {
      version:2,
      workload:{
        missionInfPerCmdr:get('missionInfPerCmdr'), missionInfStretchPerCmdr:get('missionInfStretchPerCmdr'), preferredOperators:get('preferredOperators'),
        bountyMillionsPerCmdr:get('bountyMillionsPerCmdr'), tradeProfitMillionsPerCmdr:get('tradeProfitMillionsPerCmdr'), explorationMillionsPerCmdr:get('explorationMillionsPerCmdr'),
        diversifyBuckets:checked('diversifyBuckets'), soloDoNotMultiply:checked('soloDoNotMultiply'),
      },
      balancing:{
        bountyBaselineMillions:get('bountyBaselineMillions'), bountyCounterInf:get('bountyCounterInf'), tradeBaselineMillions:get('tradeBaselineMillions'),
        tradeCounterInf:get('tradeCounterInf'), triggerHeadroomPct:get('triggerHeadroomPct'), maxCounterweightFactions:get('maxCounterweightFactions'),
      },
      safety:{ retreatWarning:get('retreatWarning'), retreatEmergency:get('retreatEmergency'), expansionWarning:get('expansionWarning') },
      doctrine:{ exactPerCmdrCapConfirmed:false, operatorStrategy:'spread-first' },
    };
    button.disabled = true;
    if (meta) meta.textContent = 'Saving automation rules…';
    try {
      const data = await call('save-rules', { rules });
      state = { ...state, ...data };
      if (meta) meta.textContent = `Rules last saved: ${fmt(state.updatedAt)} by ${state.updatedBy || 'Wolf'}`;
      enhanceAllCards(true);
      window.dispatchEvent(new CustomEvent('wolf-bgs-rules-updated'));
    } catch (error) {
      console.error(error);
      if (meta) meta.textContent = 'Could not save automation rules.';
    } finally { button.disabled = false; }
  }

  function ensureResetFilters() {
    if (document.querySelector('[data-reset-filters]')) return;
    const meta = document.querySelector('.wolf-system-list-meta');
    if (!meta) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary btn-compact wolf-reset-filters';
    button.dataset.resetFilters = '';
    button.textContent = 'Reset Filters';
    button.addEventListener('click', resetFilters);
    meta.insertBefore(button, meta.querySelector('.wolf-pagination'));
  }

  function resetFilters() {
    const set = (selector, value, eventName = 'change') => {
      const el = document.querySelector(selector);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = Boolean(value); else el.value = value;
      el.dispatchEvent(new Event(eventName, { bubbles:true }));
    };
    set('[data-system-search]', '', 'input'); set('[data-system-filter]', 'all'); set('[data-system-sort]', 'influence-desc'); set('[data-page-size]', '20');
    set('[data-favorites-first]', true); set('[data-lowest-five-watch]', false); set('[data-custom-priority]', ''); set('[data-custom-state]', '', 'input');
    set('[data-custom-pending]', '', 'input'); set('[data-custom-control]', ''); set('[data-custom-flag]', '');
  }

  function factionRows(card) { return [...card.querySelectorAll('[data-faction-row]')]; }
  function rowData(row) { return { name: row.querySelector('[data-faction="name"]')?.value?.trim() || '', influence: num(row.querySelector('[data-faction="influence"]')?.value) }; }
  function sortFactionRows(card) {
    const body = card.querySelector('[data-faction-body]');
    if (!body) return;
    const rows = factionRows(card).sort((a, b) => { const aa=rowData(a), bb=rowData(b); return (bb.influence ?? -Infinity)-(aa.influence ?? -Infinity) || aa.name.localeCompare(bb.name); });
    rows.forEach(row => body.appendChild(row));
  }
  function systemName(card) { return card.dataset.system || ''; }
  function targetValues(card) {
    const minInput=card.querySelector('[data-setting="targetMin"]');
    const maxInput=card.querySelector('[data-setting="targetMax"]');
    return {
      min:num(minInput ? minInput.value : card.dataset.targetMin),
      max:num(maxInput ? maxInput.value : card.dataset.targetMax),
    };
  }
  function currentInfluence(card) {
    const stat = [...card.querySelectorAll('summary .wolf-system-stat')].find(item => norm(item.querySelector('span')?.textContent) === 'mongrel inf');
    return num(String(stat?.querySelector('b')?.textContent || '').replace('%',''));
  }

  function meterInner(current, min, max, compact = false) {
    if (current === null || (min === null && max === null)) return '';
    const lo=min===null?0:clamp(min), hi=max===null?100:clamp(max), start=Math.min(lo,hi), end=Math.max(lo,hi), inside=current>=start&&current<=end;
    return `<div class="${compact?'wolf-influence-micro':'wolf-influence-meter'} ${inside?'in-band':'out-band'}" aria-label="Current influence ${current.toFixed(1)} percent; target ${min ?? 0} to ${max ?? 100} percent"><span class="wolf-influence-target" style="left:${start}%;width:${Math.max(1,end-start)}%"></span><span class="wolf-influence-marker" style="left:${clamp(current)}%"></span>${compact?'':`<div class="wolf-influence-labels"><span>0%</span><b>${current.toFixed(1)}% · target ${min ?? '—'}–${max ?? '—'}%</b><span>100%</span></div>`}</div>`;
  }

  function refreshMeters(card) {
    card.querySelectorAll('[data-target-meter]').forEach(el => el.remove());
    const {min,max}=targetValues(card), current=currentInfluence(card);
    if (current===null || (min===null&&max===null)) return;
    const stat=[...card.querySelectorAll('summary .wolf-system-stat')].find(item=>norm(item.querySelector('span')?.textContent)==='mongrel inf');
    if (stat) stat.insertAdjacentHTML('beforeend', `<div data-target-meter>${meterInner(current,min,max,true)}</div>`);
    const strategy=[...card.querySelectorAll('.wolf-section')].find(section=>norm(section.querySelector('h3')?.textContent)==='strategy');
    const intro=strategy?.querySelector('.wolf-section-intro');
    if (intro) intro.insertAdjacentHTML('afterend', `<div class="wolf-expanded-target" data-target-meter><span class="wolf-target-caption">Mongrel influence target</span>${meterInner(current,min,max,false)}</div>`);
  }

  function strategyFor(system, faction) { return (state.systemFactionStrategies?.[system] || []).find(row => norm(row.faction) === norm(faction)) || {}; }
  function intentValue(saved) { return saved?.intent === 'no-action' || !saved?.intent ? 'flexible' : saved.intent; }

  function factionStrategyMarkup(card) {
    const system=systemName(card), rows=factionRows(card).map(rowData).filter(row=>row.name);
    const body=rows.map(row=>{
      const saved=strategyFor(system,row.name), intent=intentValue(saved), mongrel=norm(row.name)===norm(MONGREL), systemTarget=targetValues(card);
      const targetMin=mongrel?systemTarget.min:num(saved.targetMin), targetMax=mongrel?systemTarget.max:num(saved.targetMax);
      return `<tr data-faction-strategy-row data-faction-name="${esc(row.name)}"><td><strong>${esc(row.name)}</strong><small>${row.influence===null?'—':`${row.influence.toFixed(2)}%`}</small>${mongrel?'<em>Mongrel target band is controlled by System Strategy.</em>':''}</td><td><select data-faction-strategy="intent">
        <option value="flexible" ${intent==='flexible'?'selected':''}>Flexible / available</option><option value="avoid-interaction" ${intent==='avoid-interaction'?'selected':''}>Avoid interaction</option>
        <option value="support" ${intent==='support'?'selected':''}>Support / raise</option><option value="suppress" ${intent==='suppress'?'selected':''}>Suppress / lower</option>
        <option value="maintain" ${intent==='maintain'?'selected':''}>Maintain / hold</option><option value="protect-retreat" ${intent==='protect-retreat'?'selected':''}>Protect from Retreat</option>
        <option value="allow-retreat" ${intent==='allow-retreat'?'selected':''}>Allow Retreat</option></select></td>
        <td><input type="number" min="0" max="100" step="0.1" data-faction-strategy="targetMin" value="${targetMin ?? ''}" ${mongrel?'disabled':''} placeholder="—"></td>
        <td><input type="number" min="0" max="100" step="0.1" data-faction-strategy="targetMax" value="${targetMax ?? ''}" ${mongrel?'disabled':''} placeholder="—"></td>
        <td><select data-faction-strategy="controlObjective"><option value="none" ${!saved.controlObjective||saved.controlObjective==='none'?'selected':''}>No control objective</option><option value="prefer-control" ${saved.controlObjective==='prefer-control'?'selected':''}>Prefer control</option><option value="avoid-control" ${saved.controlObjective==='avoid-control'?'selected':''}>Avoid control</option><option value="allow-control" ${saved.controlObjective==='allow-control'?'selected':''}>Allow either</option></select></td></tr>`;
    }).join('');
    const savedAt=state.factionStrategyUpdatedAt?.[system], savedBy=state.factionStrategyUpdatedBy?.[system];
    return `<section class="wolf-section wolf-faction-strategy" data-faction-strategy-section><h3>Faction Strategy</h3><p class="wolf-section-intro">Programmed intent for the whole faction board. <b>Flexible / available</b> means automation may use the faction when strategically safe. <b>Avoid interaction</b> means do not intentionally support or suppress it. <b>Maintain / hold</b> is an actual stability objective.</p><div class="wolf-table-scroll"><table class="wolf-faction-strategy-table"><thead><tr><th>Faction</th><th>Intent</th><th>Target min %</th><th>Target max %</th><th>Control</th></tr></thead><tbody>${body}</tbody></table></div><div class="wolf-faction-strategy-actions"><span data-faction-strategy-message>${savedAt?`Saved ${esc(fmt(savedAt))} by ${esc(savedBy||'Wolf')}`:'No faction-specific strategy saved yet.'}</span><div><button type="button" class="btn btn-secondary btn-compact" data-reset-faction-strategy>Reset Faction Strategy</button><button type="button" class="btn btn-primary btn-compact" data-save-faction-strategy>Save Faction Strategy</button></div></div></section>`;
  }

  function collectFactionStrategies(card) {
    return [...card.querySelectorAll('[data-faction-strategy-row]')].map(row=>{ const get=key=>row.querySelector(`[data-faction-strategy="${key}"]`)?.value??''; return { faction:row.dataset.factionName, intent:get('intent'), targetMin:get('targetMin'), targetMax:get('targetMax'), controlObjective:get('controlObjective'), notes:'' }; });
  }

  async function saveFactionStrategies(card) {
    const system=systemName(card), message=card.querySelector('[data-faction-strategy-message]'), button=card.querySelector('[data-save-faction-strategy]');
    button.disabled=true; if(message) message.textContent='Saving faction strategy…';
    try { const data=await call('save-system-faction-strategies',{system,strategies:collectFactionStrategies(card)}); state={...state,...data}; if(message) message.textContent=`Saved ${fmt(state.factionStrategyUpdatedAt?.[system])} by ${state.factionStrategyUpdatedBy?.[system]||'Wolf'}`; refreshProgrammedPreview(card); window.dispatchEvent(new CustomEvent('wolf-bgs-faction-strategy-updated',{detail:{system}})); }
    catch(error){ console.error(error); if(message) message.textContent='Could not save faction strategy.'; } finally { button.disabled=false; }
  }

  async function resetFactionStrategies(card) {
    const system=systemName(card); if(!window.confirm(`Reset all faction-strategy overrides for ${system}? System Strategy and manual faction data will not be changed.`)) return;
    const message=card.querySelector('[data-faction-strategy-message]');
    try { const data=await call('reset-system-faction-strategies',{system}); state={...state,...data}; const section=card.querySelector('[data-faction-strategy-section]'); if(section) section.outerHTML=factionStrategyMarkup(card); refreshProgrammedPreview(card); const newMessage=card.querySelector('[data-faction-strategy-message]'); if(newMessage) newMessage.textContent='Faction strategy reset.'; window.dispatchEvent(new CustomEvent('wolf-bgs-faction-strategy-updated',{detail:{system}})); }
    catch(error){ console.error(error); if(message) message.textContent='Could not reset faction strategy.'; }
  }

  function ensureFactionStrategy(card) { if(card.querySelector('[data-faction-strategy-section]')) return; const board=[...card.querySelectorAll('.wolf-section')].find(section=>norm(section.querySelector('h3')?.textContent)==='system status & faction board'); if(board) board.insertAdjacentHTML('afterend',factionStrategyMarkup(card)); }

  function ensureResetDefaults(card) {
    if(card.querySelector('[data-reset-system-defaults]')) return; const actions=card.querySelector('.wolf-system-actions'), save=actions?.querySelector('[data-save-system]'); if(!actions||!save) return;
    const button=document.createElement('button'); button.type='button'; button.className='btn btn-secondary'; button.dataset.resetSystemDefaults=''; button.textContent='Reset to Defaults'; save.insertAdjacentElement('beforebegin',button);
  }

  async function resetSystemDefaults(card) {
    const system=systemName(card); if(!window.confirm(`Reset ${system} system configuration to inherited System Defaults? Favorite status, notes, manual faction/status data, faction strategy, and calibration will be preserved.`)) return;
    const message=card.querySelector('[data-settings-message]'); if(message) message.textContent='Resetting to System Defaults…';
    try { await call('reset-system-settings',{system}); window.location.reload(); } catch(error){ console.error(error); if(message) message.textContent='Could not reset system settings.'; }
  }

  function refreshProgrammedPreview(card) {
    const section=[...card.querySelectorAll('.wolf-section')].find(item=>norm(item.querySelector('h3')?.textContent)==='programmed automation'), preview=section?.querySelector('.wolf-automation-preview:not(.wolf-ai-preview)'); if(!preview) return;
    const current=currentInfluence(card), {min,max}=targetValues(card), system=systemName(card), strategies=state.systemFactionStrategies?.[system]||[];
    const recipient=strategies.find(row=>['support','flexible'].includes(row.intent)&&norm(row.faction)!==norm(MONGREL));
    const goal=state.rules?.workload?.missionInfPerCmdr??25, stretch=state.rules?.workload?.missionInfStretchPerCmdr??40, operators=state.rules?.workload?.preferredOperators??3;
    let headline='Monitor board', explanation='No Mongrel target band is configured. Whole-board faction intent can still be saved above.';
    if(current!==null&&min!==null&&current<min){ headline=`Support Mongrels · about ${goal} INF per participating CMDR`; explanation=`Mongrel influence is below the ${min}% floor. Prefer roughly ${operators} operators when available; a solo CMDR should not be told to multiply the workload to replace missing people. Stretch guidance is about ${stretch} INF before switching bucket/system becomes preferable.`; }
    else if(current!==null&&max!==null&&current>max){ headline=recipient?`Use ${recipient.faction} as a possible counter-support recipient`:'Hold unnecessary Mongrel positive work'; explanation=recipient?`Mongrels are above the ${max}% ceiling. The detailed Order Preview will still run whole-board safety checks before assigning counter-support.`:`Mongrels are above the ${max}% ceiling. No eligible secondary faction is currently marked Support or Flexible, so the engine should not invent a recipient.`; }
    else if(current!==null&&(min!==null||max!==null)){ headline='Mongrels inside target window'; explanation='The detailed Order Preview separately evaluates Influence, Economy, Security, and any required counter-support.'; }
    preview.innerHTML=`<strong>${esc(headline)}</strong><p>${esc(explanation)}</p><p><b>Preview only:</b> this does not publish Daily Orders.</p><button type="button" class="wolf-mini-button" disabled>Detailed reasoning is shown in Order Preview below.</button>`;
  }

  function wireCardActions(card) {
    if(card.dataset.rulesWired==='true') return; card.dataset.rulesWired='true';
    card.addEventListener('change',event=>{ if(event.target.matches('[data-faction="influence"]')) sortFactionRows(card); if(event.target.matches('[data-setting="targetMin"],[data-setting="targetMax"]')){const values=targetValues(card);card.dataset.targetMin=values.min??'';card.dataset.targetMax=values.max??'';refreshMeters(card);refreshProgrammedPreview(card);} });
    card.addEventListener('click',event=>{ if(event.target.closest('[data-save-faction-strategy]')){saveFactionStrategies(card);return;} if(event.target.closest('[data-reset-faction-strategy]')){resetFactionStrategies(card);return;} if(event.target.closest('[data-reset-system-defaults]')) resetSystemDefaults(card); });
  }

  function enhanceCard(card,force=false){ if(force) card.dataset.rulesEnhanced=''; if(card.dataset.rulesEnhanced==='true') return; sortFactionRows(card); ensureFactionStrategy(card); ensureResetDefaults(card); refreshMeters(card); refreshProgrammedPreview(card); wireCardActions(card); card.dataset.rulesEnhanced='true'; }
  function enhanceAllCards(force=false){ document.querySelectorAll('.wolf-system-card').forEach(card=>enhanceCard(card,force)); }
  function watchCards(){ const list=document.querySelector('[data-system-list]'); if(!list||list.dataset.rulesObserved==='true') return; list.dataset.rulesObserved='true'; new MutationObserver(()=>enhanceAllCards()).observe(list,{childList:true,subtree:false}); }

  async function init(){ try{await loadRules();}catch(error){console.error('Could not load Wolf BGS automation rules',error);} const waitForDeck=()=>{const systems=document.querySelector('.wolf-systems-section'),list=document.querySelector('[data-system-list]'); if(!systems||!list){window.setTimeout(waitForDeck,80);return;} mountRulesPanel(); ensureResetFilters(); watchCards(); enhanceAllCards();}; waitForDeck(); }
  init();
})();