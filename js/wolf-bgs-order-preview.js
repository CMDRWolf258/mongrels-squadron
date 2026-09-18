(() => {
  const RULES_API = '/api/operations/wolf-bgs-rules';
  const SLIDERS_API = '/api/operations/wolf-bgs-sliders';
  const ECONOMY_API = '/api/operations/wolf-bgs-economy-rules';
  const MONGREL = 'Regiment of Imperial Mongrels';
  const CONFLICT_RE = /\b(civil\s+war|war|election)\b/i;

  let remote = {
    rules:{
      workload:{ missionInfPerCmdr:25, missionInfStretchPerCmdr:40, bountyMillionsPerCmdr:20, tradeProfitMillionsPerCmdr:20, preferredOperators:3, diversifyBuckets:true, soloDoNotMultiply:true },
      balancing:{ bountyBaselineMillions:20, bountyCounterInf:15, tradeBaselineMillions:20, tradeCounterInf:null, triggerHeadroomPct:2, maxCounterweightFactions:2 },
      safety:{ retreatWarning:5, retreatEmergency:3, expansionWarning:67 },
    },
    economySettings:{ explorationRoutineMillionsPerCmdr:2, explorationStrongMillionsPerCmdr:5, explorationEmergencyMillionsPerCmdr:10, negativeWorkEnabled:false },
    economyUpdatedAt:null, economyUpdatedBy:null,
    systemCalibrations:{}, calibrationUpdatedAt:{}, calibrationUpdatedBy:{}, systemSliderObjectives:{},
  };

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
  const num = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const round = value => Math.max(0, Math.round(Number(value) || 0));
  const signed = value => `${Number(value) >= 0 ? '+' : ''}${Number(value) || 0}`;

  function fmt(value) {
    if (!value) return 'not saved';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'unknown';
    return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d);
  }

  async function fetchJson(url) {
    const response = await fetch(`${url}?_=${Date.now()}`, { credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'} });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  async function refreshRemote() {
    const [rules, sliders, economy] = await Promise.all([fetchJson(RULES_API), fetchJson(SLIDERS_API), fetchJson(ECONOMY_API)]);
    remote = {
      ...remote,
      ...rules,
      ...sliders,
      rules:rules.rules || remote.rules,
      economySettings:economy.settings || remote.economySettings,
      economyUpdatedAt:economy.updatedAt || null,
      economyUpdatedBy:economy.updatedBy || null,
    };
  }

  async function writeRules(action, body) {
    const response = await fetch(RULES_API, {
      method:'PUT', credentials:'same-origin', cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-bgs-control'},
      body:JSON.stringify({action,...body}),
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    remote = { ...remote, ...data, rules:data.rules || remote.rules };
    return data;
  }

  async function saveEconomyRules() {
    const form=document.querySelector('[data-rules-form]');
    if(!form)return;
    const get=key=>form.querySelector(`[data-economy-rule="${key}"]`)?.value;
    const settings={
      explorationRoutineMillionsPerCmdr:get('explorationRoutineMillionsPerCmdr'),
      explorationStrongMillionsPerCmdr:get('explorationStrongMillionsPerCmdr'),
      explorationEmergencyMillionsPerCmdr:get('explorationEmergencyMillionsPerCmdr'),
      negativeWorkEnabled:false,
    };
    const meta=form.querySelector('[data-economy-rules-meta]');
    if(meta)meta.textContent='Saving exploration tiers…';
    try{
      const response=await fetch(ECONOMY_API,{method:'PUT',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-bgs-control'},body:JSON.stringify({action:'save-economy-rules',settings})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
      remote.economySettings=data.settings||remote.economySettings; remote.economyUpdatedAt=data.updatedAt||null; remote.economyUpdatedBy=data.updatedBy||null;
      syncEconomyRuleValues();
      if(meta)meta.textContent=`Exploration tiers saved ${fmt(remote.economyUpdatedAt)} by ${remote.economyUpdatedBy||'Wolf'}.`;
      document.querySelectorAll('.wolf-system-card').forEach(card=>generate(card));
    }catch(error){console.error(error);if(meta)meta.textContent='Could not save exploration tiers.';}
  }

  function injectEconomyRuleControls() {
    const form=document.querySelector('[data-rules-form]');
    if(!form||form.dataset.economyRulesWired==='true')return false;
    const legacy=form.querySelector('[data-rule="explorationMillionsPerCmdr"]')?.closest('label');
    if(!legacy)return false;
    const e=remote.economySettings||{};
    legacy.outerHTML=`<label><span>Exploration routine / CMDR</span><div class="input-unit"><input type="number" min="0" max="10" step="0.5" data-economy-rule="explorationRoutineMillionsPerCmdr" value="${esc(e.explorationRoutineMillionsPerCmdr??2)}"><em>M Cr</em></div></label><label><span>Exploration strong / CMDR</span><div class="input-unit"><input type="number" min="0" max="10" step="0.5" data-economy-rule="explorationStrongMillionsPerCmdr" value="${esc(e.explorationStrongMillionsPerCmdr??5)}"><em>M Cr</em></div></label><label><span>Exploration emergency / CMDR</span><div class="input-unit"><input type="number" min="0" max="10" step="0.5" data-economy-rule="explorationEmergencyMillionsPerCmdr" value="${esc(e.explorationEmergencyMillionsPerCmdr??10)}"><em>M Cr</em></div></label>`;
    const grids=form.querySelectorAll('.wolf-rules-grid');
    if(grids[0]&&!form.querySelector('[data-economy-rules-meta]'))grids[0].insertAdjacentHTML('afterend',`<div class="wolf-rules-callout subtle" data-exploration-doctrine><strong>Exploration workload doctrine</strong><span>Routine 2M · strong 5M · emergency ceiling 10M per CMDR by default. Exploration is a supplementary Economy/Influence bucket because nearby valuable scans become less convenient to repeat. Normal automation will not exceed the strong tier; the emergency tier is reserved for Critical systems. Exobiology is not used here.</span><small data-economy-rules-meta>${remote.economyUpdatedAt?`Exploration tiers saved ${esc(fmt(remote.economyUpdatedAt))} by ${esc(remote.economyUpdatedBy||'Wolf')}.`:'Using exploration tier defaults.'}</small></div>`);
    form.addEventListener('submit',()=>{window.setTimeout(saveEconomyRules,0);});
    form.dataset.economyRulesWired='true';
    return true;
  }

  function syncEconomyRuleValues(){
    const e=remote.economySettings||{};
    for(const key of ['explorationRoutineMillionsPerCmdr','explorationStrongMillionsPerCmdr','explorationEmergencyMillionsPerCmdr']){
      const el=document.querySelector(`[data-economy-rule="${key}"]`);if(el)el.value=e[key]??el.value;
    }
  }

  function systemName(card) { return card.dataset.system || ''; }
  function intentValue(value) { return !value || value === 'no-action' ? 'flexible' : value; }

  function currentRules() {
    const stored = remote.rules || {};
    const w = { ...(stored.workload || {}) }, b = { ...(stored.balancing || {}) }, s = { ...(stored.safety || {}) };
    const form = document.querySelector('[data-rules-form]');
    const read = key => form?.querySelector(`[data-rule="${key}"]`)?.value;
    const n = (key, fallback) => { const value=read(key); return value === undefined || value === '' ? fallback : Number(value); };
    if (form) {
      w.missionInfPerCmdr=n('missionInfPerCmdr',w.missionInfPerCmdr??25); w.missionInfStretchPerCmdr=n('missionInfStretchPerCmdr',w.missionInfStretchPerCmdr??40);
      w.preferredOperators=n('preferredOperators',w.preferredOperators??3); w.bountyMillionsPerCmdr=n('bountyMillionsPerCmdr',w.bountyMillionsPerCmdr??20); w.tradeProfitMillionsPerCmdr=n('tradeProfitMillionsPerCmdr',w.tradeProfitMillionsPerCmdr??20);
      b.bountyBaselineMillions=n('bountyBaselineMillions',b.bountyBaselineMillions??20); b.bountyCounterInf=n('bountyCounterInf',b.bountyCounterInf??15); b.tradeBaselineMillions=n('tradeBaselineMillions',b.tradeBaselineMillions??20);
      const trade=read('tradeCounterInf'); b.tradeCounterInf=trade === undefined ? b.tradeCounterInf : (trade === '' ? null : Number(trade));
      b.triggerHeadroomPct=n('triggerHeadroomPct',b.triggerHeadroomPct??2); b.maxCounterweightFactions=n('maxCounterweightFactions',b.maxCounterweightFactions??2);
      s.retreatWarning=n('retreatWarning',s.retreatWarning??5); s.retreatEmergency=n('retreatEmergency',s.retreatEmergency??3); s.expansionWarning=n('expansionWarning',s.expansionWarning??67);
    }
    return { workload:w, balancing:b, safety:s, economy:{...(remote.economySettings||{})} };
  }

  function boardRows(card) {
    const strategyRows = [...card.querySelectorAll('[data-faction-strategy-row]')];
    const sliderRows = [...card.querySelectorAll('[data-slider-objective-row]')];
    return [...card.querySelectorAll('[data-faction-row]')].map(row => {
      const name=row.querySelector('[data-faction="name"]')?.value?.trim()||'';
      const strategy=strategyRows.find(item=>norm(item.dataset.factionName)===norm(name));
      const slider=sliderRows.find(item=>norm(item.dataset.factionName)===norm(name));
      const mongrel=norm(name)===norm(MONGREL);
      return {
        name,
        influence:num(row.querySelector('[data-faction="influence"]')?.value),
        state:row.querySelector('[data-faction="state"]')?.value?.trim()||'',
        pending:row.querySelector('[data-faction="pending"]')?.value?.trim()||'',
        recovering:row.querySelector('[data-faction="recovering"]')?.value?.trim()||'',
        intent:intentValue(strategy?.querySelector('[data-faction-strategy="intent"]')?.value),
        targetMin:mongrel?num(card.querySelector('[data-setting="targetMin"]')?.value):num(strategy?.querySelector('[data-faction-strategy="targetMin"]')?.value),
        targetMax:mongrel?num(card.querySelector('[data-setting="targetMax"]')?.value):num(strategy?.querySelector('[data-faction-strategy="targetMax"]')?.value),
        controlObjective:strategy?.querySelector('[data-faction-strategy="controlObjective"]')?.value||'none',
        economy:slider?.querySelector('[data-slider-objective="economyObjective"]')?.value||'ignore',
        security:slider?.querySelector('[data-slider-objective="securityObjective"]')?.value||'ignore',
      };
    }).filter(row=>row.name);
  }

  function currentCalibration(card) {
    const saved=remote.systemCalibrations?.[systemName(card)]||{};
    const get=key=>card.querySelector(`[data-calibration="${key}"]`)?.value;
    const value=(key,fallback=0)=>{const raw=get(key);return raw===undefined||raw===''?Number(fallback)||0:Number(raw)||0;};
    return {
      bountyPercentAdjustment:value('bountyPercentAdjustment',saved.bountyPercentAdjustment),
      bountyFlatInfAdjustment:value('bountyFlatInfAdjustment',saved.bountyFlatInfAdjustment),
      tradePercentAdjustment:value('tradePercentAdjustment',saved.tradePercentAdjustment),
      tradeFlatInfAdjustment:value('tradeFlatInfAdjustment',saved.tradeFlatInfAdjustment),
    };
  }

  function calibrationMarkup(card) {
    const system=systemName(card), saved=remote.systemCalibrations?.[system]||{}, savedAt=remote.calibrationUpdatedAt?.[system], savedBy=remote.calibrationUpdatedBy?.[system];
    const v=key=>Number(saved[key]||0);
    return `<div class="wolf-calibration-block"><div class="wolf-order-subhead"><div><strong>System balancing calibration</strong><span>Add/subtract from the global baseline for this system. Percentage scales with workload; flat INF is applied after the percentage adjustment.</span></div><span class="wolf-chip">${savedAt?`Saved ${esc(fmt(savedAt))}`:'Global baseline'}</span></div><div class="wolf-calibration-grid"><label><span>Bounty adjustment</span><div class="input-unit"><input type="number" min="-100" max="300" step="1" data-calibration="bountyPercentAdjustment" value="${esc(v('bountyPercentAdjustment'))}"><em>%</em></div></label><label><span>Bounty flat adjustment</span><div class="input-unit"><input type="number" min="-100" max="100" step="1" data-calibration="bountyFlatInfAdjustment" value="${esc(v('bountyFlatInfAdjustment'))}"><em>INF</em></div></label><label><span>Trade adjustment</span><div class="input-unit"><input type="number" min="-100" max="300" step="1" data-calibration="tradePercentAdjustment" value="${esc(v('tradePercentAdjustment'))}"><em>%</em></div></label><label><span>Trade flat adjustment</span><div class="input-unit"><input type="number" min="-100" max="100" step="1" data-calibration="tradeFlatInfAdjustment" value="${esc(v('tradeFlatInfAdjustment'))}"><em>INF</em></div></label></div><div class="wolf-calibration-actions"><span data-calibration-message>${savedAt?`Calibration saved by ${esc(savedBy||'Wolf')}.`:'No system-specific calibration saved.'}</span><div><button type="button" class="btn btn-secondary btn-compact" data-reset-calibration>Reset Calibration</button><button type="button" class="btn btn-secondary btn-compact" data-save-calibration>Save Calibration</button></div></div></div>`;
  }

  function sectionMarkup(card) {
    return `<section class="wolf-section wolf-order-preview-section" data-order-preview-section><h3>Order Preview / Generator</h3><p class="wolf-section-intro">Preview-only deterministic orders from the current on-screen board, faction intent, slider objectives, target bands, workload doctrine, and balancing calibration. Nothing here publishes Daily Orders.</p>${calibrationMarkup(card)}<div class="wolf-order-toolbar"><span data-order-preview-meta>Uses current on-screen values, including unsaved edits.</span><button type="button" class="btn btn-primary btn-compact" data-generate-order-preview>Generate / Refresh Preview</button></div><div class="wolf-order-preview-output" data-order-preview-output><div class="wolf-order-empty">Generating preview…</div></div></section>`;
  }

  function balanceMath(activity, workload, rules, calibration) {
    const balancing=rules.balancing||{};
    const security=activity==='security';
    const baselineM=Number(security?balancing.bountyBaselineMillions:balancing.tradeBaselineMillions);
    const baselineInf=security?num(balancing.bountyCounterInf):num(balancing.tradeCounterInf);
    const pct=Number(security?calibration.bountyPercentAdjustment:calibration.tradePercentAdjustment)||0;
    const flat=Number(security?calibration.bountyFlatInfAdjustment:calibration.tradeFlatInfAdjustment)||0;
    if (!Number.isFinite(baselineM) || baselineM <= 0 || baselineInf === null) return { calibrated:false, activity, workload, pct, flat };
    const scaled=baselineInf*(Number(workload)||0)/baselineM;
    const afterPercent=scaled*(1+pct/100);
    const final=round(afterPercent+flat);
    return { calibrated:true, activity, workload, baselineM, baselineInf, scaled, pct, flat, final };
  }

  function sourceNeedsBalance(faction, rules) {
    const trigger=Number(rules.balancing?.triggerHeadroomPct??2);
    if (faction.intent==='avoid-interaction') return { blocked:true, reason:'Faction is set to Avoid interaction.' };
    if (faction.intent==='allow-retreat') return { blocked:true, reason:'Faction is set to Allow Retreat; positive slider work would oppose that objective.' };
    if (faction.intent==='suppress') return { needed:true, reason:'Positive slider work conflicts with the Suppress / lower objective.' };
    if (faction.influence!==null && faction.targetMin!==null && faction.influence < faction.targetMin) return { needed:false, reason:`${faction.name} is below its ${faction.targetMin}% target floor, so positive slider work also helps the influence objective.` };
    if (faction.intent==='maintain') return { needed:true, reason:'Maintain / hold requires counter-support against expected positive influence pressure.' };
    if (faction.influence!==null && faction.targetMax!==null && faction.influence >= faction.targetMax-trigger) return { needed:true, reason:`Only ${Math.max(0,faction.targetMax-faction.influence).toFixed(2)} percentage points of target headroom remain.` };
    return { needed:false, reason:'Influence headroom does not currently require automatic counter-support.' };
  }

  function candidateList(board, source, rules) {
    const warning=Number(rules.safety?.retreatWarning??5), expansion=Number(rules.safety?.expansionWarning??67);
    const controllerName=document.querySelector(`[data-system="${CSS.escape(source.cardSystem||'')}"] [data-status="controller"]`)?.value?.trim()||'';
    const controller=board.find(row=>norm(row.name)===norm(controllerName));
    const rejected=[], eligible=[];
    for (const row of board) {
      if (norm(row.name)===norm(source.name) || row.influence===null) continue;
      const reasons=[];
      if (row.intent==='avoid-interaction') reasons.push('Avoid interaction');
      if (row.intent==='suppress') reasons.push('Suppress / lower');
      if (row.intent==='allow-retreat') reasons.push('Allow Retreat');
      if (CONFLICT_RE.test(row.state)) reasons.push(`active ${row.state}`);
      if (row.targetMax!==null && row.influence>=row.targetMax) reasons.push('at/above target ceiling');
      if (row.targetMax===null && row.influence>=expansion) reasons.push(`at/above ${expansion}% expansion warning`);
      if (row.intent==='maintain' && !(row.targetMin!==null && row.influence<row.targetMin)) reasons.push('Maintain / hold is already satisfied');
      if (row.controlObjective==='avoid-control' && controller && norm(controller.name)!==norm(row.name) && controller.influence!==null && controller.influence-row.influence<=3) reasons.push('Avoid control and close to controller crossover');
      if (reasons.length) { rejected.push({name:row.name,reasons}); continue; }
      let score=0, why=[];
      if (row.intent==='protect-retreat' && row.influence<=warning) { score+=140; why.push('Retreat protection needed'); }
      if (row.intent==='support') { score+=120; why.push('Support / raise intent'); }
      if (row.targetMin!==null && row.influence<row.targetMin) { score+=80; why.push(`below ${row.targetMin}% target floor`); }
      if (row.intent==='maintain') { score+=75; why.push('below Maintain / hold band'); }
      if (row.intent==='flexible') { score+=55; why.push('Flexible / available'); }
      if (row.controlObjective==='prefer-control') { score+=8; why.push('control objective compatible'); }
      const headroom=row.targetMax===null?Math.max(0,expansion-row.influence):Math.max(0,row.targetMax-row.influence);
      score+=Math.min(20,headroom);
      eligible.push({...row,score,headroom,why:why.join(' + ')||'safe available faction'});
    }
    eligible.sort((a,b)=>b.score-a.score || b.headroom-a.headroom || a.name.localeCompare(b.name));
    return {eligible,rejected};
  }

  function allocateCounterweight(amount, candidates, rules) {
    if (!amount || !candidates.length) return [];
    const maxFactions=Math.max(1,Math.min(2,Number(rules.balancing?.maxCounterweightFactions??2)));
    const first=candidates[0];
    if (maxFactions===1 || candidates.length===1) return [{faction:first.name,amount,reason:first.why}];
    const trigger=Math.max(1,Number(rules.balancing?.triggerHeadroomPct??2));
    if (first.targetMax!==null && first.headroom<=trigger) {
      const firstAmount=Math.max(1,Math.floor(amount/2));
      return [{faction:first.name,amount:firstAmount,reason:`${first.why}; close to its ceiling so counterweight is split`},{faction:candidates[1].name,amount:amount-firstAmount,reason:candidates[1].why}];
    }
    return [{faction:first.name,amount,reason:first.why}];
  }

  function addPreference(task, preference){
    if(!preference)return; task.preferences=task.preferences||[]; if(!task.preferences.includes(preference))task.preferences.push(preference);
  }

  function addMissionTask(tasks, faction, amount, reason, stop, preference='') {
    if (!amount) return;
    let task=tasks.find(item=>item.kind==='mission-inf'&&norm(item.faction)===norm(faction));
    if (!task) { task={kind:'mission-inf',faction,amount,reason:[reason],stop:[stop].filter(Boolean),preferences:[]}; addPreference(task,preference); tasks.push(task); return; }
    task.amount=Math.max(task.amount,amount); if(reason&&!task.reason.includes(reason))task.reason.push(reason); if(stop&&!task.stop.includes(stop))task.stop.push(stop); addPreference(task,preference);
  }

  function addWorkTask(tasks, task){
    const existing=tasks.find(item=>item.kind===task.kind&&norm(item.faction)===norm(task.faction));
    if(!existing){tasks.push({...task,reason:[...(task.reason||[])],stop:[...(task.stop||[])]});return;}
    existing.amount=Math.max(Number(existing.amount)||0,Number(task.amount)||0);
    for(const reason of task.reason||[])if(!existing.reason.includes(reason))existing.reason.push(reason);
    for(const stop of task.stop||[])if(!existing.stop.includes(stop))existing.stop.push(stop);
  }

  function missionTaskFor(tasks,faction){return tasks.find(item=>item.kind==='mission-inf'&&norm(item.faction)===norm(faction));}
  function counterPreference(row){
    if(row?.economy==='raise'&&row?.security==='raise')return 'Prefer mission choices that support the configured Economy and Security objectives where practical.';
    if(row?.economy==='raise')return 'Prefer economic missions where practical so the counterweight also supports Economy.';
    if(row?.security==='raise')return 'Prefer security/combat-aligned missions where practical so the counterweight also supports Security.';
    return '';
  }

  function explorationTier(card,rules){
    const priority=card.querySelector('[data-setting="priority"]')?.value||'normal', e=rules.economy||{};
    if(priority==='critical')return {amount:Number(e.explorationEmergencyMillionsPerCmdr??10),tier:'emergency',optional:false};
    if(priority==='high')return {amount:Number(e.explorationStrongMillionsPerCmdr??5),tier:'strong',optional:true};
    return {amount:Number(e.explorationRoutineMillionsPerCmdr??2),tier:'routine',optional:true};
  }

  function generatePlan(card) {
    const rules=currentRules(), calibration=currentCalibration(card), board=boardRows(card), tasks=[],warnings=[],checks=[],math=[];
    const system=systemName(card), missionGoal=round(rules.workload?.missionInfPerCmdr??25), missionStretch=round(rules.workload?.missionInfStretchPerCmdr??40), retreatWarning=Number(rules.safety?.retreatWarning??5), retreatEmergency=Number(rules.safety?.retreatEmergency??3);
    const priority=card.querySelector('[data-setting="priority"]')?.value||'normal';
    const diversify=rules.workload?.diversifyBuckets!==false && Number(rules.workload?.preferredOperators??3)>1;
    board.forEach(row=>row.cardSystem=system);

    const findCounterweight=(source,amount,reason)=>{
      const candidates=candidateList(board,source,rules), allocated=allocateCounterweight(amount,candidates.eligible,rules);
      if (!allocated.length) { warnings.push(`No safe counterweight faction found for ${source.name}: ${reason}`); return; }
      allocated.forEach(item=>{
        const target=board.find(row=>norm(row.name)===norm(item.faction));
        addMissionTask(tasks,item.faction,item.amount,`Counterweight for ${source.name}: ${reason}. ${item.reason}`,`Stop/review before ${item.faction} reaches its configured ceiling or enters a conflict.`,counterPreference(target));
      });
      checks.push(`Counterweight candidates for ${source.name}: selected ${allocated.map(item=>item.faction).join(' + ')}${candidates.rejected.length?`; excluded ${candidates.rejected.slice(0,3).map(item=>`${item.name} (${item.reasons.join(', ')})`).join('; ')}`:''}.`);
    };

    for (const row of board) {
      const below=row.targetMin!==null&&row.influence!==null&&row.influence<row.targetMin;
      const above=row.targetMax!==null&&row.influence!==null&&row.influence>row.targetMax;
      if (norm(row.name)===norm(MONGREL) && below) addMissionTask(tasks,row.name,missionGoal,`Mongrels are below the ${row.targetMin}% target floor.`,`Stop normal support once Mongrels return to the configured target band.`);
      if (row.intent==='protect-retreat' && row.influence!==null && row.influence<=retreatWarning) addMissionTask(tasks,row.name,row.influence<=retreatEmergency?missionStretch:missionGoal,`Protect from Retreat at ${row.influence.toFixed(2)}%.`,`Continue only until Retreat danger is cleared; then reassess.`);
      if (row.intent==='support') {
        const shouldRaise=row.targetMax===null?true:(row.influence!==null&&row.influence<row.targetMax), alreadyInBand=row.targetMin!==null&&row.targetMax!==null&&row.influence!==null&&row.influence>=row.targetMin&&row.influence<=row.targetMax;
        if (shouldRaise&&!alreadyInBand) addMissionTask(tasks,row.name,missionGoal,`Support / raise intent${below?` and below ${row.targetMin}% floor`:''}.`,`Stop at the configured target ceiling${row.targetMax!==null?` (${row.targetMax}%)`:''}.`);
      }
      if(row.intent==='suppress'){
        const floorReached=row.targetMin!==null&&row.influence!==null&&row.influence<=row.targetMin;
        if(floorReached)checks.push(`${row.name} Suppress / lower is already at/below its configured ${row.targetMin}% floor.`);
        else{
          const candidates=candidateList(board,row,rules), recipient=candidates.eligible[0];
          if(recipient)addMissionTask(tasks,recipient.name,missionGoal,`Suppress / lower ${row.name} using positive redistribution to ${recipient.name}; automated direct negative work is disabled.`,row.targetMin!==null?`Stop/review when ${row.name} reaches about ${row.targetMin}% or ${recipient.name} reaches its own ceiling.`:`Reassess after the next trusted tick; no lower floor is configured for ${row.name}.`,counterPreference(recipient));
          else warnings.push(`${row.name} is set to Suppress / lower, but no safe positive-work recipient is available. Automated direct negative work is disabled.`);
        }
      }
      if (row.intent==='maintain') {
        if (below) addMissionTask(tasks,row.name,missionGoal,`Maintain / hold faction is below its target band.`,`Stop once ${row.name} returns to its target band.`);
        if (above) { const candidates=candidateList(board,row,rules), recipient=candidates.eligible[0]; if(recipient)addMissionTask(tasks,recipient.name,missionGoal,`Maintain / hold ${row.name} is above its target band; redirect positive work to ${recipient.name}.`,`Stop/review once ${row.name} returns to its target band.`,counterPreference(recipient)); else warnings.push(`${row.name} is above its Maintain / hold band but no safe positive-work recipient is available.`); }
      }
      if (norm(row.name)===norm(MONGREL) && above && row.economy!=='raise' && row.security!=='raise') {
        const candidates=candidateList(board,row,rules), recipient=candidates.eligible[0];
        if(recipient)addMissionTask(tasks,recipient.name,missionGoal,`Mongrels are above the ${row.targetMax}% ceiling; use positive work elsewhere rather than pushing Mongrels.`,`Stop/review when Mongrels return to the target band or ${recipient.name} reaches its own ceiling.`,counterPreference(recipient));
        else warnings.push(`Mongrels are above the ${row.targetMax}% ceiling and no safe counter-support faction is available.`);
      }

      for (const activity of ['security','economy']) {
        const objective=row[activity], label=activity==='security'?'Security':'Economy';
        if (activity==='security'&&objective==='locked') { checks.push(`Security for ${row.name} is Locked / not actionable.`); continue; }
        if(objective==='hold'){checks.push(`${label} ↔ for ${row.name}: avoid deliberate large ${activity} workloads unless a higher-priority objective requires them.`);continue;}
        if(objective==='lower'){warnings.push(`${label} ↓ for ${row.name} is configured, but automated negative-work actions are disabled. Manual planning is required for deliberate slider reduction.`);continue;}
        if (objective!=='raise') continue;
        const guard=sourceNeedsBalance(row,rules);
        if (guard.blocked) { warnings.push(`${label} ↑ for ${row.name} is not generated: ${guard.reason}`); continue; }

        if(activity==='security'){
          const workload=Number(rules.workload?.bountyMillionsPerCmdr??20);
          addWorkTask(tasks,{kind:'bounties',faction:row.name,amount:workload,reason:['Raise Security objective.'],stop:[row.targetMax!==null?`Reassess if ${row.name} influence moves beyond ${row.targetMax}%.`:'Reassess after the next trusted board update.']});
          const mission=missionTaskFor(tasks,row.name); if(mission)addPreference(mission,'Prefer security/combat-aligned missions where practical so existing INF work also supports Security.');
          if(guard.needed){const calc=balanceMath(activity,workload,rules,calibration);math.push({...calc,source:row.name,reason:guard.reason});if(!calc.calibrated)warnings.push(`Security ↑ for ${row.name} needs influence balancing, but no bounty counterweight baseline is configured.`);else if(calc.final>0)findCounterweight(row,calc.final,guard.reason);}else checks.push(`Security ↑ for ${row.name}: ${guard.reason}`);
          continue;
        }

        const existingMission=missionTaskFor(tasks,row.name), tradeWorkload=Number(rules.workload?.tradeProfitMillionsPerCmdr??20), urgent=['high','critical'].includes(priority);
        if(existingMission){
          addPreference(existingMission,'Prefer economic missions where practical so existing INF work also supports Economy.');
          checks.push(`Economy ↑ for ${row.name}: existing positive mission-INF work is aligned toward economic missions before adding another full Economy bucket.`);
        }
        const useTrade=!existingMission||urgent;
        if(useTrade){
          addWorkTask(tasks,{kind:'trade',faction:row.name,amount:tradeWorkload,reason:[existingMission?'Additional Economy pressure for a high-priority objective.':'Primary Economy workload because no existing positive mission-INF task is serving both objectives.'],stop:[row.targetMax!==null?`Reassess if ${row.name} influence moves beyond ${row.targetMax}%.`:'Reassess after the next trusted board update.'],assetNote:`Manual asset check: use a profitable market owned by ${row.name}; asset ownership is not yet verified by automation.`});
          if(guard.needed){const calc=balanceMath(activity,tradeWorkload,rules,calibration);math.push({...calc,source:row.name,reason:guard.reason});if(!calc.calibrated)warnings.push(`Economy ↑ for ${row.name} needs influence balancing, but no trade counterweight baseline is configured.`);else if(calc.final>0)findCounterweight(row,calc.final,guard.reason);}else checks.push(`Economy ↑ for ${row.name}: ${guard.reason}`);
        }
        if(diversify){
          const exploration=explorationTier(card,rules);
          if(exploration.amount>0)addWorkTask(tasks,{kind:'exploration',faction:row.name,amount:exploration.amount,optional:exploration.optional,tier:exploration.tier,reason:[`${exploration.tier[0].toUpperCase()+exploration.tier.slice(1)} exploration-data diversification for Economy/Influence; do not grind this bucket repeatedly when nearby valuable scans are exhausted.`],stop:['Do not exceed the configured exploration tier for this CMDR/cycle.'],assetNote:`Manual asset check: sell at a station/asset owned by ${row.name} with Universal Cartographics. Ownership and services are not yet verified by automation.`});
        }
      }
    }

    return {system,rules,calibration,board,tasks,warnings:[...new Set(warnings)],checks:[...new Set(checks)],math};
  }

  function taskMarkup(task,index) {
    let label='MISSION INF', instruction=`Complete about ${task.amount} INF for ${task.faction}`;
    if(task.kind==='bounties'){label='SECURITY / BOUNTIES';instruction=`Turn in about ${task.amount}M Cr of bounty vouchers for ${task.faction}`;}
    if(task.kind==='trade'){label='ECONOMY / TRADE';instruction=`Generate about ${task.amount}M Cr profitable trade for ${task.faction}`;}
    if(task.kind==='exploration'){label=`ECONOMY / EXPLORATION${task.optional?' · OPTIONAL':''}`;instruction=`Sell about ${task.amount}M Cr of exploration data for ${task.faction}`;}
    const preference=task.preferences?.length?`<small><b>Mission preference:</b> ${task.preferences.map(esc).join(' ')}</small>`:'';
    const asset=task.assetNote?`<small><b>Asset check:</b> ${esc(task.assetNote)}</small>`:'';
    return `<article class="wolf-order-task" data-order-kind="${esc(task.kind)}" data-order-faction="${esc(task.faction)}" data-order-amount="${esc(task.amount)}" data-order-optional="${task.optional?'true':'false'}"><div class="wolf-order-task-number">${String(index+1).padStart(2,'0')}</div><div><span class="wolf-order-task-type">${esc(label)}</span><strong>${esc(instruction)}</strong><p>${task.reason.map(esc).join(' ')}</p>${preference}${asset}${task.stop.length?`<small><b>Stop / review:</b> ${task.stop.map(esc).join(' ')}</small>`:''}</div></article>`;
  }

  function mathMarkup(item) {
    if (!item.calibrated) return `<div class="wolf-order-math warn"><strong>${item.activity==='security'?'Bounty':'Trade'} balance for ${esc(item.source)}</strong><span>No global counterweight baseline configured.</span></div>`;
    const pctPart=item.pct?` × ${(1+item.pct/100).toFixed(2)} (${signed(item.pct)}%)`:'';
    const flatPart=item.flat?` ${item.flat>=0?'+':'−'} ${Math.abs(item.flat)} INF`:'';
    return `<div class="wolf-order-math"><strong>${item.activity==='security'?'Bounty':'Trade'} balance for ${esc(item.source)}</strong><span>${item.workload}M ÷ ${item.baselineM}M × ${item.baselineInf} INF${esc(pctPart)}${esc(flatPart)} = <b>${item.final} INF</b></span><small>${esc(item.reason)}</small></div>`;
  }

  function renderPlan(card,plan) {
    const host=card.querySelector('[data-order-preview-output]'); if(!host)return;
    const taskHtml=plan.tasks.length?plan.tasks.map(taskMarkup).join(''):'<div class="wolf-order-empty">No actionable programmed orders are produced by the current configuration.</div>';
    const math=plan.math.length?`<div class="wolf-order-math-list"><h4>Balancing calculations</h4>${plan.math.map(mathMarkup).join('')}</div>`:'';
    const checks=plan.checks.length?`<details class="wolf-order-checks"><summary>Safety / candidate checks (${plan.checks.length})</summary><ul>${plan.checks.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details>`:'';
    const warnings=plan.warnings.length?`<div class="wolf-order-warnings"><strong>Needs attention before publishing</strong><ul>${plan.warnings.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`:'<div class="wolf-order-ready"><strong>Preview checks complete.</strong><span>No blocking configuration warning was found. This is still preview-only.</span></div>';
    host.innerHTML=`<div class="wolf-order-preview-head"><div><span class="wolf-chip preview">PREVIEW ONLY</span><strong>${esc(plan.system)} — Proposed Orders</strong><small>${plan.tasks.length} generated task${plan.tasks.length===1?'':'s'} · ${esc(String(plan.rules.workload?.preferredOperators??3))} preferred CMDRs/objective</small></div><button type="button" class="btn btn-secondary btn-compact" disabled>Publish disabled</button></div><div class="wolf-order-task-list">${taskHtml}</div>${math}${warnings}${checks}<p class="wolf-order-footnote">Mission INF means mission reward influence pips/ticks, not faction percentage points. Overlapping same-faction counterweight needs keep the higher INF workload rather than being blindly added. Exploration is a separate diversification bucket and is not assigned a fake INF conversion.</p>`;
    const meta=card.querySelector('[data-order-preview-meta]'); if(meta)meta.textContent=`Preview refreshed ${new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date())} · current on-screen values`;
  }

  async function generate(card,{reload=false}={}) {
    const host=card.querySelector('[data-order-preview-output]'); if(host)host.innerHTML='<div class="wolf-order-empty">Calculating whole-board preview…</div>';
    try { if(reload)await refreshRemote(); renderPlan(card,generatePlan(card)); }
    catch(error){console.error(error);if(host)host.innerHTML='<div class="wolf-order-warnings"><strong>Could not generate preview.</strong><span>Reload the Control Room and try again.</span></div>';}
  }

  async function saveCalibration(card) {
    const system=systemName(card),button=card.querySelector('[data-save-calibration]'),message=card.querySelector('[data-calibration-message]');
    if(button)button.disabled=true;if(message)message.textContent='Saving calibration…';
    try { await writeRules('save-system-calibration',{system,calibration:currentCalibration(card)}); if(message)message.textContent=`Calibration saved ${fmt(remote.calibrationUpdatedAt?.[system])} by ${remote.calibrationUpdatedBy?.[system]||'Wolf'}.`; await generate(card); }
    catch(error){console.error(error);if(message)message.textContent='Could not save calibration.';} finally{if(button)button.disabled=false;}
  }

  async function resetCalibration(card) {
    const system=systemName(card); if(!window.confirm(`Reset ${system} balancing calibration to the global baseline? Faction strategy and system settings will not be changed.`))return;
    const message=card.querySelector('[data-calibration-message]');
    try { await writeRules('reset-system-calibration',{system}); ['bountyPercentAdjustment','bountyFlatInfAdjustment','tradePercentAdjustment','tradeFlatInfAdjustment'].forEach(key=>{const el=card.querySelector(`[data-calibration="${key}"]`);if(el)el.value='0';}); if(message)message.textContent='Calibration reset to global baseline.'; await generate(card); }
    catch(error){console.error(error);if(message)message.textContent='Could not reset calibration.';}
  }

  function wire(card) {
    if(card.dataset.orderPreviewWired==='true')return;card.dataset.orderPreviewWired='true';
    card.addEventListener('click',event=>{if(event.target.closest('[data-generate-order-preview]')){generate(card,{reload:true});return;}if(event.target.closest('[data-save-calibration]')){saveCalibration(card);return;}if(event.target.closest('[data-reset-calibration]'))resetCalibration(card);});
    card.addEventListener('change',event=>{if(event.target.matches('[data-calibration],[data-faction-strategy],[data-slider-objective],[data-setting="priority"],[data-setting="targetMin"],[data-setting="targetMax"],[data-faction="influence"],[data-faction="state"],[data-faction="pending"],[data-faction="recovering"]'))generate(card);});
  }

  function mount(card) {
    if(card.querySelector('[data-order-preview-section]')){wire(card);return true;}
    const sliders=card.querySelector('[data-slider-objectives-section]'); if(!sliders)return false;
    sliders.insertAdjacentHTML('afterend',sectionMarkup(card)); wire(card); generate(card); return true;
  }

  function enhanceAll(){document.querySelectorAll('.wolf-system-card').forEach(mount);injectEconomyRuleControls();}
  function watch(){const list=document.querySelector('[data-system-list]');if(!list||list.dataset.orderPreviewObserved==='true')return;list.dataset.orderPreviewObserved='true';let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;window.setTimeout(()=>{queued=false;enhanceAll();},50);}).observe(list,{childList:true,subtree:true});}

  async function init() {
    try { await refreshRemote(); } catch(error){ console.error('Could not load BGS Order Preview data',error); }
    const wait=()=>{const list=document.querySelector('[data-system-list]');if(!list){window.setTimeout(wait,80);return;}watch();enhanceAll();window.setTimeout(enhanceAll,160);window.setTimeout(enhanceAll,420);};wait();
    window.addEventListener('wolf-bgs-rules-updated',async()=>{try{await refreshRemote();}catch{}syncEconomyRuleValues();enhanceAll();document.querySelectorAll('.wolf-system-card').forEach(card=>generate(card));});
    window.addEventListener('wolf-bgs-faction-strategy-updated',event=>{const card=[...document.querySelectorAll('.wolf-system-card')].find(item=>item.dataset.system===event.detail?.system);if(card)generate(card,{reload:true});});
    window.addEventListener('wolf-bgs-slider-objectives-updated',event=>{const card=[...document.querySelectorAll('.wolf-system-card')].find(item=>item.dataset.system===event.detail?.system);if(card)generate(card,{reload:true});});
  }

  init();
})();
