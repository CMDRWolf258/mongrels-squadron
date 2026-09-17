(() => {
  const API = '/api/operations/wolf-bgs-conflicts';
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
    const warnings=[];
    if(result.unresolved.length)warnings.push(`Unpaired active participants: ${result.unresolved.join(', ')}. Ordinary BGS work is still locked for them, but no conflict winner order will be generated.`);
    warnings.push(...result.invalid,...result.manualNotes);
    if(result.auto.ambiguous.length)warnings.push(...result.auto.ambiguous.map(group=>`${group.names.length} factions show ${typeLabel(group.type)}; ${group.reason}. Manual confirmation is required.`));
    host.innerHTML=`<div><span>Active participants</span><strong>${esc(activeText)}</strong></div><div><span>Pending conflict states</span><strong>${esc(pendingText)}</strong></div><div><span>Resolved pairs</span><strong>${result.resolved.length}</strong></div>${warnings.length?`<div class="wolf-conflict-alert"><span>Pairing attention</span><strong>${warnings.map(esc).join(' ')}</strong></div>`:''}`;
    card.querySelectorAll('[data-conflict-pair-row]').forEach(row=>{
      const a=row.querySelector('[data-conflict="factionA"]')?.value||'', b=row.querySelector('[data-conflict="factionB"]')?.value||'', typeHost=row.querySelector('[data-conflict-type]');
      const aa=result.active.find(item=>norm(item.name)===norm(a)), bb=result.active.find(item=>norm(item.name)===norm(b)), gap=influenceGap(aa,bb);
      if(typeHost)typeHost.textContent=aa&&bb&&aa.type===bb.type?`${typeLabel(aa.type)}${gap===null?'':` · Δ${gap.toFixed(1)}%`}`:(a&&b?'Mismatch / inactive':'—');
    });
    processPreview(card);
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
    if(pair.type==='election')return `<article class="wolf-order-task wolf-conflict-preview-task"><div class="wolf-order-task-number">C${index+1}</div><div><span class="wolf-order-task-type">CONFLICT / ELECTION</span><strong>Complete about ${missionGoal()} INF of non-combat/economic missions for ${esc(winner)}</strong><p>Election pair: ${esc(winner)} vs ${esc(loser)}. Favor legal non-combat/economic mission work for the intended winner; trade/exploration can supplement where practical.</p><small><b>Conflict lock:</b> ordinary influence balancing for both participants is suspended until the Election ends.</small></div></article>`;
    return `<article class="wolf-order-task wolf-conflict-preview-task"><div class="wolf-order-task-number">C${index+1}</div><div><span class="wolf-order-task-type">CONFLICT / ${esc(typeLabel(pair.type).toUpperCase())}</span><strong>Fight Conflict Zones and turn in Combat Bonds for ${esc(winner)}</strong><p>${esc(typeLabel(pair.type))} pair: ${esc(winner)} vs ${esc(loser)}. Work only the intended winner's side.</p><small><b>Calibration:</b> exact CZ-win workload per CMDR is not programmed yet; Mandalore can be used to tune that threshold before publishing real conflict orders.</small></div></article>`;
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
        const orders=result.resolved.filter(pair=>pair.objective==='win-a'||pair.objective==='win-b');
        if(list&&orders.length)list.insertAdjacentHTML('afterbegin',orders.map(conflictTaskMarkup).join(''));
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
    card.addEventListener('click',event=>{if(event.target.closest('[data-save-conflicts]')){save(card);return;}if(event.target.closest('[data-reset-conflicts]'))reset(card);});
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

  async function init(){
    try{await load();}catch(error){console.error('Could not load Wolf BGS conflict configuration',error);}
    const wait=()=>{const list=document.querySelector('[data-system-list]');if(!list){setTimeout(wait,80);return;}watch();enhanceAll();setTimeout(enhanceAll,180);setTimeout(enhanceAll,450);};wait();
    for(const name of ['wolf-bgs-faction-strategy-updated','wolf-bgs-slider-objectives-updated','wolf-bgs-rules-updated'])window.addEventListener(name,()=>setTimeout(enhanceAll,30));
  }
  init();
})();