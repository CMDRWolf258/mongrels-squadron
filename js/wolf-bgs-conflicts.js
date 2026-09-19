(() => {
  const API = '/api/operations/wolf-bgs-conflicts';
  const CONTROL_API = '/api/operations/wolf-bgs';
  const LAB_KEY = 'wolf-bgs-lab-mandalore-conflicts-v1';
  const MONGREL = 'Regiment of Imperial Mongrels';
  const MAX_PAIRS = 3;
  const INFLUENCE_PAIR_TOLERANCE = 3;
  const previewObservers = new WeakMap();
  let remote = { systemConflicts:{}, updatedAt:{}, updatedBy:{} };

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
  const num = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const systemName = card => card.dataset.system || '';
  const isLab = card => card.dataset.bgsLab === 'true';

  function conflictType(value) {
    const text = String(value || '');
    if (/\bcivil\s+war\b/i.test(text)) return 'civil-war';
    if (/\belection\b/i.test(text)) return 'election';
    if (/\bwar\b/i.test(text)) return 'war';
    return '';
  }
  function typeLabel(value) {
    return value === 'civil-war' ? 'Civil War' : value === 'election' ? 'Election' : value === 'war' ? 'War' : '—';
  }
  function influenceGap(a,b) {
    if (a?.influence === null || a?.influence === undefined || b?.influence === null || b?.influence === undefined) return null;
    return Math.abs(Number(a.influence) - Number(b.influence));
  }

  async function load() {
    const response = await fetch(`${API}?_=${Date.now()}`, { credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'} });
    if (!response.ok) throw new Error(`Conflict configuration request failed (${response.status})`);
    remote = { ...remote, ...(await response.json()) };
  }

  async function request(action, body={}) {
    const response = await fetch(API, {
      method:'PUT', credentials:'same-origin', cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-bgs-control'},
      body:JSON.stringify({action,...body}),
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    remote = { ...remote, ...data };
    return data;
  }

  async function requestControl(action, body={}) {
    const response = await fetch(CONTROL_API, {
      method:'PUT', credentials:'same-origin', cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-bgs-control'},
      body:JSON.stringify({action,...body}),
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  function age(value) {
    if(!value)return '';
    const time=new Date(value).getTime();
    if(!Number.isFinite(time))return '';
    const mins=Math.max(0,Math.round((Date.now()-time)/60000));
    if(mins<60)return `${mins}m ago`;
    const hours=Math.round(mins/60);
    if(hours<48)return `${hours}h ago`;
    return `${Math.round(hours/24)}d ago`;
  }

  function formatWhen(value) {
    if(!value)return 'unknown';
    const date=new Date(value);
    return Number.isFinite(date.getTime())?date.toLocaleString():'unknown';
  }

  function timelineState(card) {
    return {
      phase:card.dataset.conflictPhase||'none',
      day:num(card.dataset.conflictDay),
      rawDay:num(card.dataset.conflictRawDay),
      source:card.dataset.conflictDaySource||'unknown',
      overdue:card.dataset.conflictDayOverdue==='true',
      expectedActiveAt:card.dataset.conflictExpectedActive||'',
      activeSeenAt:card.dataset.conflictActiveSeen||'',
      manualDay:num(card.dataset.conflictManualDay),
      manualSetAt:card.dataset.conflictManualSetAt||'',
      manualSetBy:card.dataset.conflictManualSetBy||'',
    };
  }

  function timelineLabel(card) {
    const timeline=timelineState(card);
    if(timeline.phase==='pending'&&!timeline.day)return 'PENDING';
    if(timeline.day!==null)return timeline.overdue?'DAY 7+':`DAY ${timeline.day}`;
    if(timeline.phase==='active')return 'DAY UNKNOWN';
    return 'NO ACTIVE CONFLICT';
  }

  function timelineDetail(card) {
    const timeline=timelineState(card);
    if(timeline.phase==='pending'&&!timeline.day){
      return timeline.expectedActiveAt
        ? `Day 1 expected after the next configured tick · ${formatWhen(timeline.expectedActiveAt)}`
        : 'Pending conflict detected; Day 1 is expected on the next configured tick.';
    }
    if(timeline.day!==null){
      const source=timeline.source==='manual'?'MANUAL VERIFIED':'INFERRED';
      if(timeline.overdue)return `${source} · beyond the 7-day maximum assumption — verify current state in game.`;
      if(timeline.day<4)return `${source} · 4-day minimum · earliest normal resolution is Day 4.`;
      return `${source} · inside the Day 4–7 resolution window.`;
    }
    if(timeline.phase==='active')return 'Start point was not observed. Enter the current day from the in-game faction page to anchor the timeline.';
    return 'No active Mongrel conflict timeline.';
  }

  function applyTimeline(card, system) {
    const timeline=system?.conflictTimeline||{};
    const score=system?.conflictScore||{};
    card.dataset.conflictPhase=timeline.phase||'none';
    card.dataset.conflictDay=timeline.day??'';
    card.dataset.conflictRawDay=timeline.rawDay??'';
    card.dataset.conflictDaySource=timeline.source||'unknown';
    card.dataset.conflictDayOverdue=timeline.overdue?'true':'false';
    card.dataset.conflictExpectedActive=timeline.expectedActiveAt||'';
    card.dataset.conflictActiveSeen=timeline.activeSeenAt||'';
    card.dataset.conflictManualDay=timeline.manualDay??'';
    card.dataset.conflictManualSetAt=timeline.manualSetAt||'';
    card.dataset.conflictManualSetBy=timeline.manualSetBy||'';
    if(score.updatedAt)card.dataset.conflictScoreUpdated=score.updatedAt;

    const scoreAge=age(card.dataset.conflictScoreUpdated||'');
    const summaryMeta=card.querySelector('.wolf-conflict-score-stat small');
    if(summaryMeta)summaryMeta.textContent=[timelineLabel(card),scoreAge].filter(Boolean).join(' · ')||'—';

    const dayChip=card.querySelector('.wolf-conflict-day-chip');
    if(dayChip){
      const state=timelineState(card);
      const source=state.source==='manual'?'MANUAL VERIFIED':state.source==='inferred'?'INFERRED':'';
      dayChip.innerHTML=`Conflict day <b>${esc(timelineLabel(card))}</b>${source?` · ${esc(source)}`:''}${state.overdue?' · VERIFY':''}`;
    }
  }

  function refreshTimelinePanel(card) {
    const host=card.querySelector('[data-conflict-timeline-readout]');
    const detail=card.querySelector('[data-conflict-timeline-detail]');
    const input=card.querySelector('[data-conflict-day-input]');
    const meta=card.querySelector('[data-conflict-day-meta]');
    const timeline=timelineState(card);
    if(host)host.textContent=timelineLabel(card);
    if(detail)detail.textContent=timelineDetail(card);
    if(input){
      input.value=timeline.manualDay!==null?String(timeline.manualDay):'';
      input.disabled=timeline.phase==='none';
    }
    const setButton=card.querySelector('[data-save-conflict-day]');
    const clearButton=card.querySelector('[data-clear-conflict-day]');
    if(setButton)setButton.disabled=timeline.phase==='none';
    if(clearButton)clearButton.disabled=timeline.phase==='none'||timeline.manualDay===null;
    if(meta){
      meta.textContent=timeline.manualDay!==null
        ? `Manual anchor: Day ${timeline.manualDay} set ${formatWhen(timeline.manualSetAt)} by ${timeline.manualSetBy||'Wolf'}.`
        : 'Automation uses an observed Pending → expected next-tick activation when available. Otherwise the day remains unknown.';
    }
  }

  function board(card) {
    return [...card.querySelectorAll('[data-faction-row]')].map(row => ({
      name:row.querySelector('[data-faction="name"]')?.value?.trim() || '',
      influence:num(row.querySelector('[data-faction="influence"]')?.value),
      state:row.querySelector('[data-faction="state"]')?.value?.trim() || '',
      pending:row.querySelector('[data-faction="pending"]')?.value?.trim() || '',
    })).filter(row=>row.name);
  }

  function detected(card) {
    const rows=board(card);
    const active=rows.map(row=>({...row,type:conflictType(row.state)})).filter(row=>row.type);
    const pending=rows.map(row=>({...row,type:conflictType(row.pending)})).filter(row=>row.type);
    return { rows, active, pending };
  }

  function findInfluenceMatchings(rows, limit=2) {
    if (limit <= 0) return [];
    if (!rows.length) return [[]];
    if (rows.length % 2) return [];
    const first=rows[0], solutions=[];
    for(let i=1;i<rows.length;i++){
      const other=rows[i], gap=influenceGap(first,other);
      if(gap === null || gap > INFLUENCE_PAIR_TOLERANCE) continue;
      const rest=rows.slice(1,i).concat(rows.slice(i+1));
      const tails=findInfluenceMatchings(rest,limit-solutions.length);
      for(const tail of tails){
        solutions.push([[first,other],...tail]);
        if(solutions.length>=limit)return solutions;
      }
    }
    return solutions;
  }

  function autoPairsFromActive(active) {
    const groups=new Map(), pairs=[], ambiguous=[];
    for(const row of active){if(!groups.has(row.type))groups.set(row.type,[]);groups.get(row.type).push(row);}
    for(const [type,rows] of groups){
      if(rows.length===2){
        pairs.push({factionA:rows[0].name,factionB:rows[1].name,objective:'monitor',type,auto:true,gap:influenceGap(rows[0],rows[1])});
        continue;
      }
      if(rows.length>2 && rows.length%2===0){
        const matchings=findInfluenceMatchings(rows,2);
        if(matchings.length===1){
          for(const [a,b] of matchings[0])pairs.push({factionA:a.name,factionB:b.name,objective:'monitor',type,auto:true,gap:influenceGap(a,b)});
          continue;
        }
        ambiguous.push({
          type,
          names:rows.map(row=>row.name),
          reason:matchings.length>1
            ? `multiple influence-compatible pairings fit the ±${INFLUENCE_PAIR_TOLERANCE} point tolerance`
            : `no complete pairing falls within the ±${INFLUENCE_PAIR_TOLERANCE} point tolerance`,
        });
        continue;
      }
      if(rows.length)ambiguous.push({type,names:rows.map(row=>row.name),reason:'an odd number of active participants cannot form complete pairs'});
    }
    return {pairs:pairs.slice(0,MAX_PAIRS),ambiguous};
  }

  function autoPairs(card) { return autoPairsFromActive(detected(card).active); }

  function labSavedPairs() {
    try { const value=JSON.parse(localStorage.getItem(LAB_KEY)||'null'); return Array.isArray(value)?value:[]; }
    catch { return []; }
  }
  function storedPairs(card) { return isLab(card) ? labSavedPairs() : (remote.systemConflicts?.[systemName(card)] || []); }

  function optionList(names, selected='') {
    return `<option value="">— select faction —</option>${names.map(name=>`<option value="${esc(name)}" ${norm(name)===norm(selected)?'selected':''}>${esc(name)}</option>`).join('')}`;
  }

  function pairRowsMarkup(card) {
    const names=board(card).map(row=>row.name), saved=storedPairs(card), initial=saved;
    let html='';
    for(let i=0;i<MAX_PAIRS;i++){
      const pair=initial[i]||{};
      html+=`<div class="wolf-conflict-pair" data-conflict-pair-row>
        <span class="wolf-conflict-pair-number">${i+1}</span>
        <label><span>Faction A</span><select data-conflict="factionA">${optionList(names,pair.factionA)}</select></label>
        <span class="wolf-conflict-versus">VS</span>
        <label><span>Faction B</span><select data-conflict="factionB">${optionList(names,pair.factionB)}</select></label>
        <label><span>Objective</span><select data-conflict="objective"><option value="monitor" ${!pair.objective||pair.objective==='monitor'?'selected':''}>Monitor / no winner</option><option value="win-a" ${pair.objective==='win-a'?'selected':''}>Win for faction A</option><option value="win-b" ${pair.objective==='win-b'?'selected':''}>Win for faction B</option></select></label>
        <div class="wolf-conflict-type" data-conflict-type>—</div>
      </div>`;
    }
    return html;
  }

  function sectionMarkup(card) {
    const system=systemName(card), savedAt=isLab(card)?null:remote.updatedAt?.[system], savedBy=isLab(card)?null:remote.updatedBy?.[system];
    return `<section class="wolf-section wolf-conflict-section" data-conflict-section>
      <h3>Conflict Configuration</h3>
      <p class="wolf-section-intro">Active War, Civil War, and Election participants are locked out of ordinary influence/counterweight work. Two-faction groups pair automatically. For multiple same-type conflicts, influence within ±${INFLUENCE_PAIR_TOLERANCE} percentage points is used only when it produces one unique pairing; otherwise Wolf must confirm the pairs here.</p>
      <div class="wolf-conflict-detection" data-conflict-detection></div>
      <div class="wolf-conflict-timeline-panel">
        <div class="wolf-conflict-timeline-readout"><span>CONFLICT TIMELINE</span><strong data-conflict-timeline-readout>${esc(timelineLabel(card))}</strong><small data-conflict-timeline-detail>${esc(timelineDetail(card))}</small></div>
        ${isLab(card)?'<div class="wolf-conflict-day-meta">Live-system conflict-day tracking is disabled in Mandalore.</div>':`<div class="wolf-conflict-day-controls"><label><span>Manual current day</span><select data-conflict-day-input><option value="">— unknown / automation —</option>${[1,2,3,4,5,6,7].map(day=>`<option value="${day}" ${num(card.dataset.conflictManualDay)===day?'selected':''}>Day ${day}</option>`).join('')}</select></label><button type="button" class="btn btn-primary btn-compact" data-save-conflict-day>SET DAY</button><button type="button" class="btn btn-secondary btn-compact" data-clear-conflict-day>USE AUTOMATION</button></div><small class="wolf-conflict-day-meta" data-conflict-day-meta></small>`}
      </div>
      <div class="wolf-conflict-pairs">${pairRowsMarkup(card)}</div>
      <div class="wolf-rules-callout subtle"><strong>Conflict action boundary</strong><span>War/Civil War winners use Conflict Zones + Combat Bonds. Election winners use non-combat/economic mission work. Exact CZ-win workload calibration is intentionally not invented yet; Mandalore is where we can tune that next.</span></div>
      <div class="wolf-faction-strategy-actions"><span data-conflict-message>${isLab(card)?'Mandalore conflict setup is local sandbox data only.':savedAt?`Saved ${esc(new Date(savedAt).toLocaleString())} by ${esc(savedBy||'Wolf')}`:'No manual conflict pairing saved. Unambiguous pairs can still resolve automatically.'}</span><div><button type="button" class="btn btn-secondary btn-compact" data-reset-conflicts>${isLab(card)?'Reset Lab Pairing':'Reset Conflict Pairing'}</button><button type="button" class="btn btn-primary btn-compact" data-save-conflicts>${isLab(card)?'Save Lab Pairing':'Save Conflict Pairing'}</button></div></div>
    </section>`;
  }

  function collectPairs(card) {
    return [...card.querySelectorAll('[data-conflict-pair-row]')].map(row=>({
      factionA:row.querySelector('[data-conflict="factionA"]')?.value||'',
      factionB:row.querySelector('[data-conflict="factionB"]')?.value||'',
      objective:row.querySelector('[data-conflict="objective"]')?.value||'monitor',
      auto:row.dataset.autoPair==='true',
    })).filter(row=>row.factionA&&row.factionB&&norm(row.factionA)!==norm(row.factionB));
  }

  function clearAutoPairControls(card) {
    card.querySelectorAll('[data-conflict-pair-row][data-auto-pair="true"]').forEach(row=>{
      const a=row.querySelector('[data-conflict="factionA"]'), b=row.querySelector('[data-conflict="factionB"]'), objective=row.querySelector('[data-conflict="objective"]');
      if(a)a.value=''; if(b)b.value=''; if(objective)objective.value='monitor';
      delete row.dataset.autoPair;
    });
  }

  function syncAutoPairControls(card) {
    clearAutoPairControls(card);
    const active=detected(card).active, configured=collectPairs(card), used=new Set(configured.flatMap(pair=>[norm(pair.factionA),norm(pair.factionB)]));
    const automatic=autoPairsFromActive(active.filter(row=>!used.has(norm(row.name))));
    const blanks=[...card.querySelectorAll('[data-conflict-pair-row]')].filter(row=>!row.querySelector('[data-conflict="factionA"]')?.value&&!row.querySelector('[data-conflict="factionB"]')?.value);
    for(const pair of automatic.pairs){
      const row=blanks.shift(); if(!row)break;
      row.querySelector('[data-conflict="factionA"]').value=pair.factionA;
      row.querySelector('[data-conflict="factionB"]').value=pair.factionB;
      row.querySelector('[data-conflict="objective"]').value='monitor';
      row.dataset.autoPair='true';
    }
  }

  function resolve(card) {
    const {active,pending}=detected(card), activeMap=new Map(active.map(row=>[norm(row.name),row])), configured=collectPairs(card), used=new Set(), resolved=[], invalid=[], manualNotes=[];
    for(const pair of configured){
      const a=activeMap.get(norm(pair.factionA)), b=activeMap.get(norm(pair.factionB));
      const keyA=norm(pair.factionA), keyB=norm(pair.factionB);
      if(used.has(keyA)||used.has(keyB)){invalid.push(`${pair.factionA} / ${pair.factionB}: a faction is already assigned to another pair.`);continue;}
      if(!a||!b){invalid.push(`${pair.factionA} / ${pair.factionB}: both factions are not currently in an active conflict state.`);continue;}
      if(a.type!==b.type){invalid.push(`${pair.factionA} / ${pair.factionB}: conflict types do not match (${typeLabel(a.type)} vs ${typeLabel(b.type)}).`);continue;}
      const gap=influenceGap(a,b);
      if(!pair.auto && gap!==null && gap>INFLUENCE_PAIR_TOLERANCE)manualNotes.push(`${pair.factionA} / ${pair.factionB} are ${gap.toFixed(1)} points apart; manual confirmation overrides the ±${INFLUENCE_PAIR_TOLERANCE} auto-pair tolerance.`);
      used.add(keyA);used.add(keyB);resolved.push({...pair,type:a.type,gap});
    }
    const remaining=active.filter(row=>!used.has(norm(row.name))), automatic=autoPairsFromActive(remaining);
    for(const pair of automatic.pairs){
      if(resolved.length>=MAX_PAIRS)break;
      const keyA=norm(pair.factionA), keyB=norm(pair.factionB);
      if(used.has(keyA)||used.has(keyB))continue;
      used.add(keyA);used.add(keyB);resolved.push(pair);
    }
    const participants=active.map(row=>row.name), covered=new Set(resolved.flatMap(pair=>[norm(pair.factionA),norm(pair.factionB)])), unresolved=participants.filter(name=>!covered.has(norm(name)));
    return {active,pending,participants,resolved,unresolved,invalid,manualNotes,auto:automatic};
  }

  function refreshDetection(card) {
    syncAutoPairControls(card);
    const host=card.querySelector('[data-conflict-detection]'); if(!host)return;
    const result=resolve(card);
    const activeText=result.active.length?result.active.map(row=>`${row.name} (${typeLabel(row.type)}${row.influence===null?'':`, ${row.influence.toFixed(1)}%`})`).join(' · '):'None';
    const pendingText=result.pending.length?result.pending.map(row=>`${row.name} (${typeLabel(row.type)})`).join(' · '):'None';
    const scoreA=num(card.dataset.conflictScoreA), scoreB=num(card.dataset.conflictScoreB), scoreOpponent=card.dataset.conflictOpponent||'', scoreStale=card.dataset.conflictScoreStale==='true', scoreUpdated=card.dataset.conflictScoreUpdated||'';
    const scoreAge=age(scoreUpdated);
    const scoreText=scoreA!==null&&scoreB!==null?`${scoreA}–${scoreB}${scoreOpponent?` vs ${scoreOpponent}`:''}${scoreAge?` · ${scoreAge}`:''}${scoreStale?' · last known':''}`:'Awaiting conflict score from source';
    const warnings=[];
    if(result.unresolved.length)warnings.push(`Unpaired active participants: ${result.unresolved.join(', ')}. Ordinary BGS work is still locked for them, but no conflict winner order will be generated.`);
    warnings.push(...result.invalid,...result.manualNotes);
    if(result.auto.ambiguous.length)warnings.push(...result.auto.ambiguous.map(group=>`${group.names.length} factions show ${typeLabel(group.type)}; ${group.reason}. Manual confirmation is required.`));
    host.innerHTML=`<div><span>Active participants</span><strong>${esc(activeText)}</strong></div><div><span>Pending conflict states</span><strong>${esc(pendingText)}</strong></div><div><span>Conflict day</span><strong class="wolf-conflict-day-detail">${esc(timelineLabel(card))}</strong></div><div><span>Mongrel conflict score</span><strong class="wolf-conflict-score-detail">${esc(scoreText)}</strong></div><div><span>Resolved pairs</span><strong>${result.resolved.length}</strong></div>${warnings.length?`<div class="wolf-conflict-alert"><span>Pairing attention</span><strong>${warnings.map(esc).join(' ')}</strong></div>`:''}`;
    refreshTimelinePanel(card);
    card.querySelectorAll('[data-conflict-pair-row]').forEach(row=>{
      const a=row.querySelector('[data-conflict="factionA"]')?.value||'', b=row.querySelector('[data-conflict="factionB"]')?.value||'', typeHost=row.querySelector('[data-conflict-type]');
      const aa=result.active.find(item=>norm(item.name)===norm(a)), bb=result.active.find(item=>norm(item.name)===norm(b)), gap=influenceGap(aa,bb);
      if(typeHost)typeHost.textContent=aa&&bb&&aa.type===bb.type?`${typeLabel(aa.type)}${gap===null?'':` · Δ${gap.toFixed(1)}%`}`:(a&&b?'Mismatch / inactive':'—');
    });
    processPreview(card);
  }

  async function saveConflictDay(card) {
    if(isLab(card))return;
    const input=card.querySelector('[data-conflict-day-input]');
    const message=card.querySelector('[data-conflict-day-meta]');
    const day=num(input?.value);
    if(day===null||day<1||day>7){
      if(message)message.textContent='Choose Day 1–7 before setting a manual conflict day.';
      return;
    }
    const button=card.querySelector('[data-save-conflict-day]');
    if(button)button.disabled=true;
    try{
      const data=await requestControl('set-conflict-day',{system:systemName(card),day});
      const system=(data.systems||[]).find(row=>norm(row.name)===norm(systemName(card)));
      if(system)applyTimeline(card,system);
      refreshDetection(card);
    }catch(error){
      console.error(error);
      if(message)message.textContent='Could not save the manual conflict day.';
    }finally{if(button)button.disabled=false;}
  }

  async function clearConflictDay(card) {
    if(isLab(card))return;
    const button=card.querySelector('[data-clear-conflict-day]');
    const message=card.querySelector('[data-conflict-day-meta]');
    if(button)button.disabled=true;
    try{
      const data=await requestControl('clear-conflict-day',{system:systemName(card)});
      const system=(data.systems||[]).find(row=>norm(row.name)===norm(systemName(card)));
      if(system)applyTimeline(card,system);
      refreshDetection(card);
    }catch(error){
      console.error(error);
      if(message)message.textContent='Could not return conflict-day tracking to automation.';
    }finally{if(button)button.disabled=false;}
  }

  async function save(card) {
    const pairs=collectPairs(card).map(({factionA,factionB,objective})=>({factionA,factionB,objective})), message=card.querySelector('[data-conflict-message]'), button=card.querySelector('[data-save-conflicts]');
    if(button)button.disabled=true;
    try{
      if(isLab(card)){
        localStorage.setItem(LAB_KEY,JSON.stringify(pairs));
        if(message)message.textContent='Mandalore conflict pairing saved locally in this browser.';
      }else{
        const data=await request('save-system-conflicts',{system:systemName(card),pairs});
        if(message)message.textContent=`Saved ${new Date(data.updatedAt?.[systemName(card)]||Date.now()).toLocaleString()} by ${data.updatedBy?.[systemName(card)]||'Wolf'}.`;
      }
      card.querySelectorAll('[data-conflict-pair-row]').forEach(row=>delete row.dataset.autoPair);
      refreshDetection(card);
    }catch(error){console.error(error);if(message)message.textContent='Could not save conflict pairing.';}finally{if(button)button.disabled=false;}
  }

  async function reset(card) {
    const message=card.querySelector('[data-conflict-message]');
    try{
      if(isLab(card)){localStorage.removeItem(LAB_KEY);}
      else await request('reset-system-conflicts',{system:systemName(card)});
      const section=card.querySelector('[data-conflict-section]');
      if(section){section.outerHTML=sectionMarkup(card);card.dataset.conflictWired='';wire(card);placeSection(card);}
      if(message)message.textContent='Conflict pairing reset.';
      refreshDetection(card);
    }catch(error){console.error(error);if(message)message.textContent='Could not reset conflict pairing.';}
  }

  function missionGoal(){return Number(document.querySelector('[data-rule="missionInfPerCmdr"]')?.value||25);}
  function conflictTaskMarkup(pair,index){
    const winA=pair.objective==='win-a', winner=winA?pair.factionA:pair.factionB, loser=winA?pair.factionB:pair.factionA;
    if(pair.type==='election')return `<article class="wolf-order-task wolf-conflict-preview-task" data-order-kind="mission-inf" data-order-faction="${esc(winner)}" data-order-amount="${esc(missionGoal())}" data-order-conflict-type="election"><div class="wolf-order-task-number">C${index+1}</div><div><span class="wolf-order-task-type">CONFLICT / ELECTION</span><strong>Complete about ${missionGoal()} INF of non-combat/economic missions for ${esc(winner)}</strong><p>Election pair: ${esc(winner)} vs ${esc(loser)}. Favor legal non-combat/economic mission work for the intended winner; trade/exploration can supplement where practical.</p><small><b>Conflict lock:</b> ordinary influence balancing for both participants is suspended until the Election ends.</small></div></article>`;
    return `<article class="wolf-order-task wolf-conflict-preview-task" data-order-kind="conflict-cz" data-order-faction="${esc(winner)}" data-order-amount="" data-order-conflict-type="${esc(pair.type)}"><div class="wolf-order-task-number">C${index+1}</div><div><span class="wolf-order-task-type">CONFLICT / ${esc(typeLabel(pair.type).toUpperCase())}</span><strong>Fight Conflict Zones and turn in Combat Bonds for ${esc(winner)}</strong><p>${esc(typeLabel(pair.type))} pair: ${esc(winner)} vs ${esc(loser)}. Work only the intended winner's side.</p><small><b>Calibration:</b> exact CZ-win workload per CMDR is not programmed yet; Mandalore can be used to tune that threshold before publishing real conflict orders.</small></div></article>`;
  }

  function labOrder(card){
    if(!isLab(card)||typeof window.WolfBgsConflictLabOrder!=='function')return null;
    try{return window.WolfBgsConflictLabOrder(card)||null;}catch(error){console.error('Mandalore conflict order hook failed',error);return null;}
  }

  function labConflictTaskMarkup(order,index=0){
    const amount=num(order?.amount);
    if(!order?.generate||!order?.faction||amount===null)return '';
    const kind=order.kind==='mission-inf'?'mission-inf':'conflict-cz';
    const conflictType=order.conflictType||'war';
    const pressure=String(order.pressure||'contested').toUpperCase();
    const stale=Boolean(order.stale);
    const prefix=stale?'REVIEW / STALE':`CONFLICT / ${typeLabel(conflictType).toUpperCase()} · ${pressure}`;
    if(kind==='mission-inf'){
      return `<article class="wolf-order-task wolf-conflict-preview-task" data-order-kind="mission-inf" data-order-faction="${esc(order.faction)}" data-order-amount="${esc(amount)}" data-order-conflict-type="election"><div class="wolf-order-task-number">C${index+1}</div><div><span class="wolf-order-task-type">${esc(prefix)}</span><strong>Complete ${esc(amount)} INF of Election-compatible missions for ${esc(order.faction)}</strong><p><b>Squad-wide target.</b> ${esc(order.detail||'Support the configured Election outcome.')}</p><small>Mission Control will aggregate member +2 / +3 / +4 / +5 Influence reports toward this target.${stale?' Score is stale; review before acting or queueing.':''}</small></div></article>`;
    }
    return `<article class="wolf-order-task wolf-conflict-preview-task" data-order-kind="conflict-cz" data-order-faction="${esc(order.faction)}" data-order-amount="${esc(amount)}" data-order-conflict-type="${esc(conflictType)}"><div class="wolf-order-task-number">C${index+1}</div><div><span class="wolf-order-task-type">${esc(prefix)}</span><strong>Earn ${esc(amount)} CZ points for ${esc(order.faction)}</strong><p><b>Squad-wide target.</b> Low = 1 · Medium = 1.3 · High = 1.6 points. Redeem Combat Bonds for the intended side.</p><small>${esc(order.detail||'Work the configured conflict outcome.')}${stale?' Score is stale; review before acting or queueing.':''}</small></div></article>`;
  }

  function updateTaskCount(host){
    const small=host.querySelector('.wolf-order-preview-head small'); if(!small)return;
    const count=host.querySelectorAll('.wolf-order-task').length;
    small.textContent=small.textContent.replace(/^\d+ generated tasks?/,`${count} generated task${count===1?'':'s'}`);
  }

  function processPreview(card) {
    const host=card.querySelector('[data-order-preview-output]'); if(!host||!host.querySelector('.wolf-order-preview-head'))return;
    const entry=previewObservers.get(card); if(entry?.observer)entry.observer.disconnect();
    try{
      host.querySelectorAll('.wolf-conflict-preview-task,.wolf-conflict-preview-banner').forEach(el=>el.remove());
      const result=resolve(card), participantNames=result.participants;
      if(participantNames.length){
        host.querySelectorAll('.wolf-order-task:not(.wolf-conflict-preview-task)').forEach(task=>{const text=task.textContent||'';if(participantNames.some(name=>text.includes(name)))task.remove();});
        host.querySelectorAll('.wolf-order-math').forEach(item=>{const text=item.textContent||'';if(participantNames.some(name=>text.includes(name)))item.remove();});
        const list=host.querySelector('.wolf-order-task-list');
        const prototypeOrder=labOrder(card);
        if(list&&prototypeOrder){
          const markup=labConflictTaskMarkup(prototypeOrder);
          if(markup)list.insertAdjacentHTML('afterbegin',markup);
        }else{
          const orders=result.resolved.filter(pair=>pair.objective==='win-a'||pair.objective==='win-b');
          if(list&&orders.length)list.insertAdjacentHTML('afterbegin',orders.map(conflictTaskMarkup).join(''));
        }
        const head=host.querySelector('.wolf-order-preview-head');
        if(head)head.insertAdjacentHTML('afterend',`<div class="wolf-conflict-preview-banner"><strong>Conflict lock active</strong><span>${participantNames.length} active participant${participantNames.length===1?'':'s'} removed from ordinary influence/slider work. ${result.unresolved.length?`${result.unresolved.length} participant${result.unresolved.length===1?' is':'s are'} still unpaired.`:`${result.resolved.length} pair${result.resolved.length===1?'':'s'} resolved.`}</span></div>`);
      }
      updateTaskCount(host);
    }finally{
      if(entry?.observer)entry.observer.observe(host,{childList:true,subtree:true});
    }
  }

  function watchPreview(card){
    const host=card.querySelector('[data-order-preview-output]'); if(!host)return;
    const existing=previewObservers.get(card); if(existing?.host===host)return;
    if(existing?.observer)existing.observer.disconnect();
    let queued=false;
    const observer=new MutationObserver(()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;processPreview(card);},0);});
    observer.observe(host,{childList:true,subtree:true});
    previewObservers.set(card,{host,observer});
    processPreview(card);
  }

  function placeSection(card){
    const section=card.querySelector('[data-conflict-section]'); if(!section)return;
    const preview=card.querySelector('[data-order-preview-section]');
    if(preview&&section.nextElementSibling!==preview)preview.parentNode.insertBefore(section,preview);
  }

  function wire(card){
    if(card.dataset.conflictWired==='true')return;card.dataset.conflictWired='true';
    card.addEventListener('click',event=>{
      if(event.target.closest('[data-save-conflict-day]')){saveConflictDay(card);return;}
      if(event.target.closest('[data-clear-conflict-day]')){clearConflictDay(card);return;}
      if(event.target.closest('[data-save-conflicts]')){save(card);return;}
      if(event.target.closest('[data-reset-conflicts]'))reset(card);
    });
    card.addEventListener('change',event=>{
      if(event.target.matches('[data-conflict]')){
        const row=event.target.closest('[data-conflict-pair-row]'); if(row)delete row.dataset.autoPair;
        setTimeout(()=>refreshDetection(card),0); return;
      }
      if(event.target.matches('[data-faction="state"],[data-faction="pending"],[data-faction="name"],[data-faction="influence"]'))setTimeout(()=>refreshDetection(card),0);
    });
  }

  function ensure(card){
    if(!card.querySelector('[data-conflict-section]')){
      const preview=card.querySelector('[data-order-preview-section]'), sliders=card.querySelector('[data-slider-objectives-section]');
      if(preview)preview.insertAdjacentHTML('beforebegin',sectionMarkup(card));
      else if(sliders)sliders.insertAdjacentHTML('afterend',sectionMarkup(card));
      else return false;
    }
    placeSection(card);wire(card);refreshDetection(card);watchPreview(card);return true;
  }

  function enhanceAll(){document.querySelectorAll('.wolf-system-card').forEach(ensure);}
  function watch(){const list=document.querySelector('[data-system-list]');if(!list||list.dataset.conflictObserved==='true')return;list.dataset.conflictObserved='true';let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;enhanceAll();},40);}).observe(list,{childList:true,subtree:true});}
  document.addEventListener('wolf-bgs-conflict-lab-updated',()=>{const card=document.querySelector('[data-bgs-lab="true"]');if(card)processPreview(card);});

  async function init(){
    try{await load();}catch(error){console.error('Could not load Wolf BGS conflict configuration',error);}
    const wait=()=>{const list=document.querySelector('[data-system-list]');if(!list){setTimeout(wait,80);return;}watch();enhanceAll();setTimeout(enhanceAll,180);setTimeout(enhanceAll,450);};wait();
    for(const name of ['wolf-bgs-faction-strategy-updated','wolf-bgs-slider-objectives-updated','wolf-bgs-rules-updated'])window.addEventListener(name,()=>setTimeout(enhanceAll,30));
  }
  init();
})();