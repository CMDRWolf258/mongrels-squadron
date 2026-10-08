(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const safe = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const label = value => String(value || '').replace(/_/g,' ').replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
  const fmtQty = value => Number(value || 0).toLocaleString();
  const grid = $('[data-carrier-grid]');
  if (!grid) return;

  let session = null;
  let carriers = [];
  let posts = [];
  let coordFilter = 'active';
  let editingCarrier = null;
  let editingPost = null;
  let carrierDirty = false;
  let coordDirty = false;
  const memberParam = new URLSearchParams(location.search).get('member') || '';
  let memberFilter = null;
  const SHARED_DIALOGUE_ID='shared:squad';
  let dialogueProfiles = {};
  let dialogueCarrierRows = [];
  let dialogueEditingId = '';
  let dialogueCanManageShared = false;

  const apiFetch = async (url, options={}) => {
    const response = await fetch(`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`, {credentials:'same-origin',cache:'no-store',...options});
    let payload={}; try{payload=await response.json();}catch{}
    return {response,payload};
  };

  function timeAgo(value){
    if(!value) return 'No timestamp';
    const ms=Date.now()-new Date(value).getTime(); if(!Number.isFinite(ms)) return 'Unknown';
    const mins=Math.max(0,Math.round(ms/60000)); if(mins<60) return `${mins}m ago`;
    const hrs=Math.round(mins/60); if(hrs<48) return `${hrs}h ago`;
    return `${Math.round(hrs/24)}d ago`;
  }
  function formatDateTime(value){if(!value)return 'TBA'; const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); if(!m)return String(value); const d=new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`); const date=Number.isNaN(d.getTime())?`${m[1]}-${m[2]}-${m[3]}`:d.toLocaleDateString([], {month:'short',day:'numeric'}); return `${date} · ${m[4]}:${m[5]} UTC`;}
  function copyText(text,button){navigator.clipboard?.writeText(text).then(()=>{const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1100);}).catch(()=>{});}

  function locationMarkup(c){
    if(!c.currentSystem) return `<span class="carrier-location-empty">Not reported${c.telemetryCheckedAt?` · checked ${safe(timeAgo(c.telemetryCheckedAt))}`:''}</span>`;
    const source=c.locationSource==='member'?'Member reported':c.locationSource==='eddata'?'EDDN / EDData':label(c.locationSource||'Reported');
    const freshness=c.locationFreshness==='fresh'?'Fresh':c.locationFreshness==='aging'?'Aging':'Stale';
    return `<div class="carrier-location-line"><span>${safe(c.currentSystem)}</span><button type="button" class="copy-system-btn" data-copy-system="${safe(c.currentSystem)}" aria-label="Copy system name">⧉</button></div><small><span class="carrier-freshness carrier-freshness-${safe(c.locationFreshness||'unknown')}">${safe(freshness)}</span> · ${safe(source)} · ${safe(timeAgo(c.locationUpdatedAt))}</small>`;
  }

  function renderSquadCarrier(){
    const section=$('[data-squad-carrier-section]');
    const target=$('[data-squad-carrier-grid]');
    if(!section||!target)return;
    const c=carriers.find(row=>row.ownershipType==='squad');
    section.hidden=!c;
    target.replaceChildren();
    if(!c)return;
    const card=document.createElement('article');
    card.className='carrier-card carrier-card-official carrier-squad-card';
    const services=(c.services||[]).map(x=>`<span>${safe(x)}</span>`).join('');
    card.innerHTML=`<div class="carrier-squad-banner"><span>REGIMENT OF IMPERIAL MONGRELS</span><strong>OFFICIAL SQUAD CARRIER</strong></div><div class="carrier-card-head"><div><p class="carrier-kicker">${safe(c.callsign)}</p><h3>${safe(c.name)}</h3><span class="carrier-owner">${safe(c.ownershipName||'Regiment of Imperial Mongrels')}</span></div><div class="carrier-card-actions"><span class="carrier-state carrier-state-${safe(c.status)}">${safe(label(c.status))}</span>${c.canEdit?'<button class="btn btn-secondary carrier-edit-btn" type="button">Manage</button>':''}</div></div><dl class="carrier-meta carrier-squad-meta"><div><dt>Ownership</dt><dd>${safe(c.ownershipName||'Regiment of Imperial Mongrels')}</dd></div><div><dt>Commander / Custodian</dt><dd>${safe(c.custodianName||c.commanderName||'Wolf258')}</dd></div><div><dt>Current Location</dt><dd>${locationMarkup(c)}</dd></div><div><dt>Primary Role</dt><dd>${safe(c.role||'Squadron Flagship')}</dd></div></dl>${c.notes?`<p class="carrier-notes">${safe(c.notes)}</p>`:''}<div class="carrier-services"><span class="carrier-label">Services</span><div>${services||'<span>Not listed</span>'}</div></div><small class="carrier-updated">Squad registry updated ${safe(timeAgo(c.updatedAt))}</small>`;
    card.querySelector('[data-copy-system]')?.addEventListener('click',e=>copyText(c.currentSystem,e.currentTarget));
    card.querySelector('.carrier-edit-btn')?.addEventListener('click',()=>openCarrierEditor(c));
    target.appendChild(card);
  }

  function renderRegistry(){
    const q=($('[data-carrier-search]')?.value||'').trim().toLowerCase();
    const role=$('[data-carrier-role]')?.value||'all';
    const status=$('[data-carrier-status]')?.value||'all';
    renderSquadCarrier();
    const filtered=carriers.filter(c=>c.ownershipType!=='squad').filter(c=>{
      const hay=[c.name,c.callsign,c.commanderName,c.currentSystem,c.role,c.status,(c.services||[]).join(' ')].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(role==='all'||c.role===role)&&(status==='all'||c.status===status);
    });
    grid.replaceChildren();
    filtered.forEach(c=>{
      const card=document.createElement('article'); card.className=`carrier-card${c.official?' carrier-card-official':''}`;
      const services=(c.services||[]).map(x=>`<span>${safe(x)}</span>`).join('');
      card.innerHTML=`<div class="carrier-card-head"><div><p class="carrier-kicker">${safe(c.callsign)}</p><h3>${safe(c.name)}</h3><span class="carrier-owner">${c.official?'Official Squadron Carrier':safe(c.commanderName||'Mongrel Carrier')}</span></div><div class="carrier-card-actions"><span class="carrier-state carrier-state-${safe(c.status)}">${safe(label(c.status))}</span>${c.canEdit?'<button class="btn btn-secondary carrier-edit-btn" type="button">Edit</button>':''}</div></div><dl class="carrier-meta"><div><dt>Owner</dt><dd>${safe(c.commanderName||'—')}</dd></div><div><dt>Current Location</dt><dd>${locationMarkup(c)}</dd></div><div><dt>Primary Role</dt><dd>${safe(c.role||'General Logistics')}</dd></div></dl>${c.notes?`<p class="carrier-notes">${safe(c.notes)}</p>`:''}<div class="carrier-services"><span class="carrier-label">Services</span><div>${services||'<span>Not listed</span>'}</div></div><small class="carrier-updated">Registry updated ${safe(timeAgo(c.updatedAt))}</small>`;
      card.querySelector('[data-copy-system]')?.addEventListener('click',e=>copyText(c.currentSystem,e.currentTarget));
      card.querySelector('.carrier-edit-btn')?.addEventListener('click',()=>openCarrierEditor(c));
      grid.appendChild(card);
    });
    $('[data-carrier-empty]').hidden=filtered.length>0;
    $('[data-carrier-count]').textContent=carriers.length;
    $('[data-carrier-located]').textContent=carriers.filter(c=>c.currentSystem).length;
    $('[data-carrier-mine]').textContent=session?carriers.filter(c=>c.ownershipType!=='squad'&&c.isMine).length:'—';
  }

  function hydrateRoleFilter(){
    const select=$('[data-carrier-role]'); if(!select)return;
    const prior=select.value; select.innerHTML='<option value="all">All roles</option>';
    [...new Set(carriers.map(c=>c.role).filter(Boolean))].sort().forEach(role=>{const o=document.createElement('option');o.value=role;o.textContent=role;select.appendChild(o);});
    select.value=[...select.options].some(o=>o.value===prior)?prior:'all';
  }

  function filteredPosts(){
    return posts.filter(p=>{
      if(coordFilter==='complete') return p.status==='complete';
      if(p.status==='complete') return false;
      if(coordFilter==='mine') return p.isMine;
      if(coordFilter==='urgent') return p.priority==='urgent';
      if(coordFilter==='moves') return ['relocation','project_support','expedition_support'].includes(p.activityType);
      if(coordFilter==='cargo') return ['loading','unloading','refuel_tritium'].includes(p.activityType)||Boolean(p.commodity);
      return true;
    }).sort((a,b)=>{
      if(a.priority!==b.priority)return a.priority==='urgent'?-1:1;
      const ad=a.departure?new Date(a.departure).getTime():Infinity, bd=b.departure?new Date(b.departure).getTime():Infinity;
      if(ad!==bd)return ad-bd;
      return new Date(b.updatedAt)-new Date(a.updatedAt);
    });
  }

  function renderCoordination(){
    const target=$('[data-coord-grid]'); if(!target)return;
    const list=filteredPosts(); target.replaceChildren(); $('[data-coord-empty]').hidden=list.length>0;
    $('[data-carrier-coordination]').textContent=session?posts.filter(p=>p.status!=='complete').length:'—';
    list.forEach(p=>{
      const card=document.createElement('article'); card.className=`carrier-coord-card${p.priority==='urgent'?' carrier-coord-urgent':''}${p.official?' carrier-coord-official':''}`;
      const cargo=p.commodity||p.targetQuantity||p.remainingQuantity?`<div class="carrier-cargo-block"><span>Cargo Request</span><strong>${safe(p.commodity||'Cargo')}</strong><small>${p.targetQuantity?`Target ${fmtQty(p.targetQuantity)}`:''}${p.targetQuantity&&p.remainingQuantity?' · ':''}${p.remainingQuantity?`${fmtQty(p.remainingQuantity)} remaining`:''}</small></div>`:'';
      const current=p.currentSystem?`<div><span>Current</span><strong class="coord-system">${safe(p.currentSystem)} <button type="button" class="copy-system-btn" data-copy-current="${safe(p.currentSystem)}">⧉</button></strong><small>${safe(timeAgo(p.locationUpdatedAt))}</small></div>`:'';
      const dest=p.destination?`<div><span>Destination</span><strong class="coord-system">${safe(p.destination)} <button type="button" class="copy-system-btn" data-copy-dest="${safe(p.destination)}">⧉</button></strong></div>`:'';
      card.innerHTML=`<div class="carrier-coord-head"><div><div class="project-badges"><span class="project-type ${p.official?'official':''}">${p.official?'Squad Movement':'Member Coordination'}</span>${p.priority==='urgent'?'<span class="coord-priority">Urgent</span>':''}<span class="project-status">${safe(label(p.status))}</span></div><p class="carrier-kicker">${safe(p.carrierCallsign)} · ${safe(p.carrierName)}</p><h3>${safe(label(p.activityType))}</h3></div>${p.canEdit?'<button class="btn btn-secondary coord-edit-btn" type="button">Edit</button>':''}</div><p class="carrier-coord-purpose">${safe(p.purpose)}</p><div class="carrier-coord-meta">${current}${dest}<div><span>Departure</span><strong>${safe(formatDateTime(p.departure))}</strong></div><div><span>ETA</span><strong>${safe(formatDateTime(p.eta))}</strong></div></div>${cargo}${p.notes?`<p class="carrier-notes">${safe(p.notes)}</p>`:''}<small class="carrier-updated">Posted by ${safe(p.ownerName)} · updated ${safe(timeAgo(p.updatedAt))}</small>`;
      card.querySelector('[data-copy-current]')?.addEventListener('click',e=>copyText(p.currentSystem,e.currentTarget));
      card.querySelector('[data-copy-dest]')?.addEventListener('click',e=>copyText(p.destination,e.currentTarget));
      card.querySelector('.coord-edit-btn')?.addEventListener('click',()=>openCoordEditor(p));
      target.appendChild(card);
    });
  }

  function manager(){return session&&['officer','site_admin'].includes(session.access);}
  function openCarrierEditor(c=null){
    editingCarrier=c;carrierDirty=false;$('[data-carrier-editor-shell]').hidden=false;document.body.classList.add('project-editor-open');
    $('[data-carrier-form-title]').textContent=c?(c.ownershipType==='squad'?'Manage Squad Carrier':'Edit Carrier'):'Register My Carrier'; $('[data-carrier-id]').value=c?.id||'';
    const callsign=$('[data-carrier-callsign]'); callsign.value=c?.callsign||''; callsign.disabled=Boolean(c);
    $('[data-carrier-name]').value=c?.name||''; $('[data-carrier-commander]').value=c?.commanderName||(session?.displayName||''); $('[data-carrier-role-edit]').value=c?.role||'General Logistics';
    $('[data-carrier-status-edit]').value=c?.status||'active'; $('[data-carrier-system]').value=c?.currentSystem||''; $('[data-carrier-services]').value=(c?.services||[]).join(', '); $('[data-carrier-notes]').value=c?.notes||'';
    const personality=$('[data-carrier-voice-personality]'); personality.value=c?.voicePersonality||(c?.official?'mongrels':'personal'); const mongrelsOption=[...personality.options].find(o=>o.value==='mongrels'); if(mongrelsOption)mongrelsOption.disabled=!manager();
    $('[data-carrier-official-wrap]').hidden=!manager()||c?.ownershipType==='squad'; $('[data-carrier-official]').value=c?.official?'true':'false'; $('[data-carrier-delete]').hidden=!c||c?.ownershipType==='squad'; $('[data-carrier-form-status]').textContent='';
  }
  function closeCarrierEditor(){if(carrierDirty&&!confirm('Discard unsaved carrier changes?'))return;$('[data-carrier-editor-shell]').hidden=true;document.body.classList.remove('project-editor-open');editingCarrier=null;carrierDirty=false;}
  async function saveCarrier(e){e.preventDefault();const status=$('[data-carrier-form-status]');status.textContent='Saving…';const body={resource:'carrier',id:$('[data-carrier-id]').value||undefined,callsign:$('[data-carrier-callsign]').value,name:$('[data-carrier-name]').value,commanderName:$('[data-carrier-commander]').value,role:$('[data-carrier-role-edit]').value,status:$('[data-carrier-status-edit]').value,currentSystem:$('[data-carrier-system]').value,services:$('[data-carrier-services]').value,notes:$('[data-carrier-notes]').value,voicePersonality:$('[data-carrier-voice-personality]').value,official:$('[data-carrier-official]').value==='true'};const {response,payload}=await apiFetch('/api/carriers',{method:editingCarrier?'PUT':'POST',headers:{'Content-Type':'application/json','X-Mongrels-Request':'carrier-coordination'},body:JSON.stringify(body)});if(!response.ok){status.textContent=errorMessage(payload.error);return;}carrierDirty=false;closeCarrierEditor();await loadRegistry();await loadCoordination();}
  async function deleteCarrier(){if(!editingCarrier||!confirm('Delete this carrier registration? Active coordination posts must be completed first.'))return;const {response,payload}=await apiFetch(`/api/carriers?resource=carrier&id=${encodeURIComponent(editingCarrier.id)}`,{method:'DELETE',headers:{'X-Mongrels-Request':'carrier-coordination'}});if(!response.ok){$('[data-carrier-form-status]').textContent=errorMessage(payload.error);return;}carrierDirty=false;closeCarrierEditor();await loadRegistry();await loadCoordination();}

  function eligibleCarriers(){return carriers.filter(c=>manager()||c.isMine);}
  function fillCoordCarrierSelect(selected=''){$('[data-coord-carrier]').innerHTML=eligibleCarriers().map(c=>`<option value="${safe(c.callsign)}">${safe(c.name)} · ${safe(c.callsign)}</option>`).join('');if(selected)$('[data-coord-carrier]').value=selected;}
  function openCoordEditor(p=null){
    const eligible=eligibleCarriers(); if(!p&&!eligible.length){alert('Register your carrier first before creating a coordination post.');return;}
    editingPost=p;coordDirty=false;$('[data-coord-editor-shell]').hidden=false;document.body.classList.add('project-editor-open');$('[data-coord-form-title]').textContent=p?'Edit Coordination Post':'New Coordination Post'; $('[data-coord-id]').value=p?.id||'';fillCoordCarrierSelect(p?.carrierCallsign||'');$('[data-coord-carrier]').disabled=Boolean(p);
    $('[data-coord-activity]').value=p?.activityType||'relocation';$('[data-coord-status]').value=p?.status||'planned';$('[data-coord-priority]').value=p?.priority||'normal';$('[data-coord-destination]').value=p?.destination||'';$('[data-coord-departure]').value=toLocalInput(p?.departure);$('[data-coord-eta]').value=toLocalInput(p?.eta);$('[data-coord-commodity]').value=p?.commodity||'';$('[data-coord-target]').value=p?.targetQuantity||'';$('[data-coord-remaining]').value=p?.remainingQuantity||'';$('[data-coord-purpose]').value=p?.purpose||'';$('[data-coord-notes]').value=p?.notes||'';$('[data-coord-official-wrap]').hidden=!manager();$('[data-coord-official]').value=p?.official?'true':'false';$('[data-coord-delete]').hidden=!p;$('[data-coord-form-status]').textContent='';
  }
  function closeCoordEditor(){if(coordDirty&&!confirm('Discard unsaved coordination changes?'))return;$('[data-coord-editor-shell]').hidden=true;document.body.classList.remove('project-editor-open');editingPost=null;coordDirty=false;}
  function toLocalInput(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return v.slice(0,16);const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
  async function saveCoord(e){e.preventDefault();const status=$('[data-coord-form-status]');status.textContent='Saving…';const body={resource:'coordination',id:$('[data-coord-id]').value||undefined,carrierCallsign:$('[data-coord-carrier]').value,activityType:$('[data-coord-activity]').value,status:$('[data-coord-status]').value,priority:$('[data-coord-priority]').value,destination:$('[data-coord-destination]').value,departure:$('[data-coord-departure]').value,eta:$('[data-coord-eta]').value,commodity:$('[data-coord-commodity]').value,targetQuantity:Number($('[data-coord-target]').value)||0,remainingQuantity:Number($('[data-coord-remaining]').value)||0,purpose:$('[data-coord-purpose]').value,notes:$('[data-coord-notes]').value,official:$('[data-coord-official]').value==='true'};const {response,payload}=await apiFetch('/api/carriers',{method:editingPost?'PUT':'POST',headers:{'Content-Type':'application/json','X-Mongrels-Request':'carrier-coordination'},body:JSON.stringify(body)});if(!response.ok){status.textContent=errorMessage(payload.error);return;}coordDirty=false;closeCoordEditor();await loadCoordination();}
  async function deleteCoord(){if(!editingPost||!confirm('Delete this coordination post?'))return;const {response,payload}=await apiFetch(`/api/carriers?resource=coordination&id=${encodeURIComponent(editingPost.id)}`,{method:'DELETE',headers:{'X-Mongrels-Request':'carrier-coordination'}});if(!response.ok){$('[data-coord-form-status]').textContent=errorMessage(payload.error);return;}coordDirty=false;closeCoordEditor();await loadCoordination();}

  function errorMessage(code){return ({invalid_callsign:'Use a callsign in the format ABC-123.',callsign_already_registered:'That carrier callsign is already registered.',carrier_has_active_coordination:'Complete or remove this carrier’s active coordination posts first.',not_carrier_owner:'You can only manage your own personal carrier dialogue.',not_post_owner:'You can only edit your own coordination posts.',carrier_not_registered:'Register the carrier before posting coordination.',carrier_storage_not_configured:'Carrier storage is not connected yet.',squad_carrier_protected:'The official squad carrier is a protected squad asset and cannot be deleted.',shared_dialogue_admin_required:'Only Site Admin can edit the Squadron Shared Pool.',carrier_not_found_or_not_owned:'That carrier is not available in your dialogue manager.',member_access_required:'Mongrel member access is required.'}[code]||code||'Unable to save changes.');}



  function dialogueAdmin(){return session?.access==='site_admin';}
  function dialogueAvailable(){return Boolean(session&&(dialogueAdmin()||carriers.some(c=>c.isMine&&(c.ownershipType||'personal')==='personal')));}
  function currentDialogueCarrierRow(){const id=currentDialogueCarrierId();return dialogueCarrierRows.find(row=>row.id===id)||null;}
  function dialogueEditable(){return currentDialogueCarrierId()===SHARED_DIALOGUE_ID?dialogueCanManageShared:Boolean(currentDialogueCarrierRow()?.canEditDialogue);}
  function dialogueCategoryLabel(value){
    const option=[...($('[data-dialogue-category]')?.options||[])].find(item=>item.value===value);
    return option?.textContent||label(value);
  }
  function dialogueAudienceLabel(value){
    const option=[...($('[data-dialogue-audience]')?.options||[])].find(item=>item.value===value);
    return option?.textContent||label(value);
  }
  function currentDialogueCarrierId(){return $('[data-dialogue-carrier]')?.value||'';}
  function currentDialogueProfile(){
    const id=currentDialogueCarrierId();
    return dialogueProfiles[id]||{carrierId:id,settings:{sharedEnabled:true,ambientEnabled:true,hangarMinSeconds:120,hangarMaxSeconds:240,concourseMinSeconds:90,concourseMaxSeconds:210},lines:[]};
  }
  function resetDialogueEditor(){
    dialogueEditingId='';
    $('[data-dialogue-line-id]').value='';
    $('[data-dialogue-text]').value='';
    $('[data-dialogue-rarity]').value='common';
    $('[data-dialogue-enabled]').value='true';
    $('[data-dialogue-status]').textContent='';
  }
  const PUBLISHED_CUE_LABELS={
    'docking.requested':'Docking request','docking.granted':'Docking granted',
    'docking.docked':'Welcome aboard','docking.undocked':'Departure',
    'carrier.jump_request':'Jump scheduled','carrier.countdown_10':'10-minute countdown',
    'carrier.countdown_5':'5-minute countdown','carrier.jump_cancelled':'Jump cancelled',
    'carrier.jump':'Jump complete','carrier.cooldown_ready':'Cooldown ready',
  };
  const PUBLISHED_CUE_DEFAULTS={
    'docking.requested':[7,10,20,false],'docking.granted':[5,7,20,true],
    'docking.docked':[3,5,20,true],'docking.undocked':[4,6,20,true],
    'carrier.jump_request':[3,5,30,true],'carrier.countdown_10':[0,0,30,true],
    'carrier.countdown_5':[0,0,30,true],'carrier.jump_cancelled':[2,3,30,true],
    'carrier.jump':[8,11,30,true],'carrier.cooldown_ready':[0,0,30,true],
  };
  function hydratePublishedVoice(){
    const settings=currentDialogueProfile().voicePreferences||{};
    const roles=settings.roles||{};
    for(const role of ['announcement','atc']){
      const identity=roles[role]||{};
      $('[data-publish-'+role+'-provider]').value=identity.voiceProvider||'system';
      $('[data-publish-'+role+'-id]').value=identity.voiceId||'';
    }
    const concourse=$('[data-published-concourse-grid]');
    concourse.replaceChildren();
    for(let i=0;i<4;i++){
      const slot=(settings.concourseVoices||[])[i]||{};
      const wrapper=document.createElement('div');
      wrapper.className='carrier-dialogue-published-slot';
      const index=i+1;
      wrapper.innerHTML='<label><span>Concourse voice '+index+'</span><select data-concourse-provider="'+i+'">'+
        '<option value="system">Windows Legacy</option><option value="winrt">Windows Modern</option><option value="kokoro">Kokoro</option></select></label>'+
        '<label><span>Installed voice ID</span><input maxlength="300" data-concourse-id="'+i+'" placeholder="Optional voice ID"></label>'+
        '<label><span>Enabled</span><select data-concourse-enabled="'+i+'"><option value="true">Yes</option><option value="false">No</option></select></label>';
      concourse.appendChild(wrapper);
      wrapper.querySelector('[data-concourse-provider]').value=slot.voiceProvider||'system';
      wrapper.querySelector('[data-concourse-id]').value=slot.voiceId||'';
      wrapper.querySelector('[data-concourse-enabled]').value=slot.enabled===false||(!settings.concourseVoices?.length&&i>0)?'false':'true';
    }
    const grid=$('[data-published-cue-grid]');
    grid.replaceChildren();
    for(const [cue,label] of Object.entries(PUBLISHED_CUE_LABELS)){
      const cfg=(settings.cues||{})[cue]||{};
      const defaults=PUBLISHED_CUE_DEFAULTS[cue];
      const card=document.createElement('div');card.className='carrier-dialogue-published-cue';
      card.dataset.publishCue=cue;
      card.innerHTML='<strong>'+safe(label)+'</strong><div class="carrier-dialogue-timing-grid">'+
        '<label><span>Enabled</span><select data-publish-enabled><option value="true">Yes</option><option value="false">No</option></select></label>'+
        '<label><span>Min delay (s)</span><input data-publish-min type="number" min="0" max="60" step="0.5"></label>'+
        '<label><span>Max delay (s)</span><input data-publish-max type="number" min="0" max="60" step="0.5"></label>'+
        '<label><span>Cooldown (s)</span><input data-publish-cooldown type="number" min="0" max="300" step="0.5"></label>'+
        (cue==='carrier.cooldown_ready'?'<label><span>Ready after jump (s)</span><input data-publish-offset type="number" min="0" max="900" step="1"></label>':'')+
        '</div>';
      grid.appendChild(card);
      card.querySelector('[data-publish-enabled]').value=String(cfg.enabled??defaults[3]);
      card.querySelector('[data-publish-min]').value=String(cfg.minDelay??defaults[0]);
      card.querySelector('[data-publish-max]').value=String(cfg.maxDelay??defaults[1]);
      card.querySelector('[data-publish-cooldown]').value=String(cfg.cooldown??defaults[2]);
      if(cue==='carrier.cooldown_ready')card.querySelector('[data-publish-offset]').value=String(cfg.offsetSeconds??180);
    }
    $('[data-dialogue-publish-voice]').disabled=!dialogueEditable()||currentDialogueCarrierId()===SHARED_DIALOGUE_ID;
  }
  async function publishCarrierVoice(){
    if(!dialogueEditable()||currentDialogueCarrierId()===SHARED_DIALOGUE_ID)return;
    const status=$('[data-dialogue-footer-status]');
    const roles={};
    for(const role of ['announcement','atc']){
      roles[role]={voiceProvider:$('[data-publish-'+role+'-provider]').value,voiceId:$('[data-publish-'+role+'-id]').value.trim()};
    }
    const concourseVoices=[];
    for(let i=0;i<4;i++)concourseVoices.push({
      voiceProvider:$('[data-concourse-provider="'+i+'"]').value,
      voiceId:$('[data-concourse-id="'+i+'"]').value.trim(),
      enabled:$('[data-concourse-enabled="'+i+'"]').value==='true',
    });
    const cues={};
    for(const item of document.querySelectorAll('[data-publish-cue]')){
      const cue=item.dataset.publishCue;
      cues[cue]={enabled:item.querySelector('[data-publish-enabled]').value==='true',
        minDelay:Number(item.querySelector('[data-publish-min]').value),
        maxDelay:Number(item.querySelector('[data-publish-max]').value),
        cooldown:Number(item.querySelector('[data-publish-cooldown]').value)};
      const offset=item.querySelector('[data-publish-offset]');
      if(offset)cues[cue].offsetSeconds=Number(offset.value);
    }
    status.textContent='Publishing carrier voice preferences…';
    try{
      await dialogueMutation({action:'publish_voice',carrierId:currentDialogueCarrierId(),
        voicePreferences:{roles,concourseVoices,cues}});
      hydratePublishedVoice();
      status.textContent='Carrier voice profile published for visiting HUDs.';
    }catch(error){status.textContent=error.message||'Voice profile publish failed.';}
  }
  const portableVoices={
    'af_alloy':'Alloy','af_aoede':'Aoede','af_bella':'Bella','af_heart':'Heart',
    'af_jessica':'Jessica','af_kore':'Kore','af_nicole':'Nicole','af_nova':'Nova',
    'af_river':'River','af_sarah':'Sarah','af_sky':'Sky','am_adam':'Adam',
    'am_echo':'Echo','am_eric':'Eric','am_fenrir':'Fenrir','am_liam':'Liam',
    'am_michael':'Michael','am_onyx':'Onyx','am_puck':'Puck','am_santa':'Santa',
    'bf_alice':'Alice','bf_emma':'Emma','bf_isabella':'Isabella','bf_lily':'Lily',
    'bm_daniel':'Daniel','bm_fable':'Fable','bm_george':'George','bm_lewis':'Lewis',
  };
  const cueDefaults={
    'docking.requested':['Docking request',false,7,10,20],
    'docking.granted':['Docking granted',true,5,7,20],
    'docking.docked':['Docked / welcome',true,3,5,20],
    'docking.undocked':['Undocked / departure',true,4,6,20],
    'carrier.jump_request':['Jump scheduled',true,3,5,30],
    'carrier.countdown_10':['10-minute departure',true,0,0,30],
    'carrier.countdown_5':['5-minute departure',true,0,0,30],
    'carrier.jump_cancelled':['Jump cancelled',true,2,3,30],
    'carrier.jump':['Jump complete',true,8,11,30],
    'carrier.cooldown_ready':['Ready for next jump',true,0,0,30],
  };
  function portableVoiceOptions(){
    return '<option value="system|">System default · no voice pack required</option>'+
      Object.entries(portableVoices).map(([id,name])=>'<option value="kokoro|'+id+'">Kokoro · '+safe(name)+'</option>').join('');
  }
  function publishedVoiceSelect(element,value){
    if(!element)return;
    const options=portableVoiceOptions();
    if(element.innerHTML!==options)element.innerHTML=options;
    const identity=value&&typeof value==='object'?value:{};
    element.value=identity.voiceProvider==='kokoro'&&portableVoices[identity.voiceId]?'kokoro|'+identity.voiceId:'system|';
  }
  function publishedVoiceObject(element){
    const [provider,id]=String(element?.value||'system|').split('|');
    return provider==='kokoro'&&portableVoices[id]?{voiceProvider:'kokoro',voiceId:id}:{voiceProvider:'system',voiceId:''};
  }
  function hydratePublishedVoice(){
    const current=currentDialogueProfile().settings?.voiceProfile||{};
    const roles=current.roles||{};
    publishedVoiceSelect($('[data-dialogue-published-atc]'),roles.atc);
    publishedVoiceSelect($('[data-dialogue-published-announcement]'),roles.announcement);
    const slots=Array.isArray(current.concourseVoices)?current.concourseVoices:[];
    const concourse=$('[data-dialogue-published-concourse]');
    if(concourse){
      concourse.replaceChildren();
      for(let i=0;i<4;i++){
        const label=document.createElement('label');
        label.textContent='Concourse voice '+(i+1);
        const toggle=document.createElement('input');
        toggle.type='checkbox';toggle.dataset.publishedVoiceEnabled=String(i);
        toggle.checked=slots[i]?.enabled===true||i===0&&slots[i]?.enabled!==false;
        const select=document.createElement('select');
        select.dataset.publishedVoiceSlot=String(i);
        publishedVoiceSelect(select,slots[i]);
        label.append(toggle,select);
        concourse.append(label);
      }
    }
    const grid=$('[data-dialogue-published-cues]');
    if(!grid)return;
    grid.replaceChildren();
    for(const [cue,defaults] of Object.entries(cueDefaults)){
      const cfg=current.cues?.[cue]||{};
      const label=document.createElement('label');
      label.dataset.publishedCue=cue;
      const caption=document.createElement('strong');caption.textContent=defaults[0];
      label.append(caption);
      const toggle=document.createElement('input');toggle.type='checkbox';toggle.dataset.publishedCueEnabled='';
      toggle.checked=cfg.enabled===undefined?defaults[1]:cfg.enabled===true;
      label.append(toggle);
      const values=[['Min delay (s)','minDelay',defaults[2],60],['Max delay (s)','maxDelay',defaults[3],60],['Cooldown (s)','cooldown',defaults[4],300]];
      if(cue==='carrier.cooldown_ready')values.push(['Ready after jump (s)','offsetSeconds',180,900]);
      for(const [name,key,fallback,max] of values){
        const heading=document.createElement('small');heading.textContent=name;
        const input=document.createElement('input');input.type='number';input.min='0';input.max=String(max);
        input.step='0.5';input.dataset.publishedCueValue=key;input.value=String(cfg[key]??fallback);
        label.append(heading,input);
      }
      grid.append(label);
    }
  }
  function readPublishedVoice(){
    const slots=[...document.querySelectorAll('[data-published-voice-slot]')].map((select,i)=>({
      ...publishedVoiceObject(select),
      enabled:Boolean(document.querySelector('[data-published-voice-enabled="'+i+'"]')?.checked),
    }));
    const cues={};
    for(const row of document.querySelectorAll('[data-published-cue]')){
      const cue=row.dataset.publishedCue;
      const data={enabled:row.querySelector('[data-published-cue-enabled]')?.checked===true};
      for(const input of row.querySelectorAll('[data-published-cue-value]'))data[input.dataset.publishedCueValue]=Number(input.value);
      cues[cue]=data;
    }
    return{roles:{
      atc:publishedVoiceObject($('[data-dialogue-published-atc]')),
      announcement:publishedVoiceObject($('[data-dialogue-published-announcement]')),
    },concourseVoices:slots,cues};
  }
  function hydrateDialogueSettings(){
    const shared=currentDialogueCarrierId()===SHARED_DIALOGUE_ID;
    const settings=currentDialogueProfile().settings||{};
    $('[data-dialogue-shared-enabled]').value=settings.sharedEnabled===false?'false':'true';
    $('[data-dialogue-hangar-min]').value=settings.hangarMinSeconds??120;
    $('[data-dialogue-hangar-max]').value=settings.hangarMaxSeconds??240;
    $('[data-dialogue-concourse-min]').value=settings.concourseMinSeconds??90;
    $('[data-dialogue-concourse-max]').value=settings.concourseMaxSeconds??210;
    $('[data-dialogue-ambient-enabled]').value=settings.ambientEnabled===false?'false':'true';
    hydratePublishedVoice();
    const settingsBox=$('[data-dialogue-carrier-settings]');
    if(settingsBox)settingsBox.hidden=shared;
    syncDialoguePermissions();
    hydratePublishedVoice();
  }
  function syncDialoguePermissions(){
    const editable=dialogueEditable();
    for(const selector of ['[data-dialogue-text]','[data-dialogue-rarity]','[data-dialogue-enabled]','[data-dialogue-new]','[data-dialogue-save]']){
      const el=$(selector); if(el)el.disabled=!editable;
    }
    const settingsEditable=editable&&currentDialogueCarrierId()!==SHARED_DIALOGUE_ID;
    for(const el of document.querySelectorAll('[data-dialogue-published-atc],[data-dialogue-published-announcement],[data-dialogue-published-concourse] select,[data-dialogue-published-concourse] input,[data-dialogue-published-cues] input'))el.disabled=!settingsEditable;
    for(const selector of ['[data-dialogue-shared-enabled]','[data-dialogue-hangar-min]','[data-dialogue-hangar-max]','[data-dialogue-concourse-min]','[data-dialogue-concourse-max]','[data-dialogue-ambient-enabled]','[data-dialogue-save-settings]']){
      const el=$(selector); if(el)el.disabled=!settingsEditable;
    }
  }
  function renderDialogueLines(){
    const target=$('[data-dialogue-list]'); if(!target)return;
    const profile=currentDialogueProfile();
    const category=$('[data-dialogue-category]').value;
    const audience=$('[data-dialogue-audience]').value;
    const view=$('[data-dialogue-view]')?.value||'pool';
    const allRows=Array.isArray(profile.lines)?profile.lines:[];
    const rows=(view==='all'?allRows:allRows.filter(row=>row.category===category&&row.audience===audience))
      .slice()
      .sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''))||String(a.audience||'').localeCompare(String(b.audience||''))||String(a.text||'').localeCompare(String(b.text||'')));
    $('[data-dialogue-count]').textContent=`${rows.length} line${rows.length===1?'':'s'}`;
    const poolName=currentDialogueCarrierId()===SHARED_DIALOGUE_ID?'Squadron Shared Pool':'Private Carrier Pool';
    $('[data-dialogue-pool-label]').textContent=view==='all'?`All lines · ${poolName}`:`${dialogueCategoryLabel(category)} · ${dialogueAudienceLabel(audience)} · ${poolName}`;
    target.replaceChildren();
    if(!rows.length){
      const empty=document.createElement('div'); empty.className='carrier-dialogue-empty'; empty.textContent='No lines in this pool yet.';
      target.appendChild(empty); return;
    }
    rows.forEach(row=>{
      const card=document.createElement('article'); card.className='carrier-dialogue-row'+(row.enabled===false?' is-disabled':'');
      const scopeBadges=view==='all'?'<span>'+safe(dialogueCategoryLabel(row.category))+'</span><span>'+safe(dialogueAudienceLabel(row.audience))+'</span>':'';
      const actions=dialogueEditable()?'<div class="carrier-dialogue-row-actions"><button class="btn btn-secondary" type="button" data-dialogue-edit-line>Edit</button><button class="btn btn-secondary" type="button" data-dialogue-delete-line>Delete</button></div>':'';
      card.innerHTML=`<div class="carrier-dialogue-row-main"><div class="carrier-dialogue-badges">${scopeBadges}<span>${safe(label(row.rarity))}</span><span>${row.enabled===false?'Disabled':'Enabled'}</span></div><p>${safe(row.text)}</p></div>${actions}`;
      card.querySelector('[data-dialogue-edit-line]')?.addEventListener('click',()=>{
        dialogueEditingId=row.id;
        $('[data-dialogue-line-id]').value=row.id;
        $('[data-dialogue-text]').value=row.text;
        $('[data-dialogue-rarity]').value=row.rarity||'common';
        $('[data-dialogue-enabled]').value=row.enabled===false?'false':'true';
        $('[data-dialogue-status]').textContent='Editing existing line';
        $('[data-dialogue-text]').focus();
      });
      card.querySelector('[data-dialogue-delete-line]')?.addEventListener('click',()=>deleteDialogueLine(row));
      target.appendChild(card);
    });
  }
  async function loadDialogueLibrary(){
    if(!dialogueAvailable())return false;
    const {response,payload}=await apiFetch('/api/carriers/dialogue');
    if(!response.ok){
      $('[data-dialogue-footer-status]').textContent=errorMessage(payload.error);
      return false;
    }
    dialogueCanManageShared=payload.canManageShared===true;
    dialogueProfiles=payload.profiles&&typeof payload.profiles==='object'?payload.profiles:{};
    if(payload.sharedProfile)dialogueProfiles[SHARED_DIALOGUE_ID]=payload.sharedProfile;
    dialogueCarrierRows=Array.isArray(payload.carriers)?payload.carriers:[];
    const select=$('[data-dialogue-carrier]');
    const prior=select.value;
    select.innerHTML=`<option value="${SHARED_DIALOGUE_ID}">Squadron Shared Pool${dialogueCanManageShared?' · Admin':' · Read only'}</option>`+
      dialogueCarrierRows.map(row=>`<option value="${safe(row.id)}">${safe(row.name)} · ${safe(row.callsign)}</option>`).join('');
    const validIds=new Set([SHARED_DIALOGUE_ID,...dialogueCarrierRows.map(row=>row.id)]);
    if(prior&&validIds.has(prior))select.value=prior;
    else if(dialogueCarrierRows.length)select.value=dialogueCarrierRows[0].id;
    hydrateDialogueSettings();
    renderDialogueLines();
    $('[data-dialogue-footer-status]').textContent=payload.updatedAt?`Dialogue library updated ${timeAgo(payload.updatedAt)}`:'Dialogue library ready';
    return true;
  }
  async function openDialogueManager(){
    if(!dialogueAvailable())return;
    $('[data-dialogue-editor-shell]').hidden=false; document.body.classList.add('project-editor-open');
    resetDialogueEditor();
    await loadDialogueLibrary();
  }
  function closeDialogueManager(){
    $('[data-dialogue-editor-shell]').hidden=true; document.body.classList.remove('project-editor-open'); resetDialogueEditor();
  }
  async function dialogueMutation(body){
    const {response,payload}=await apiFetch('/api/carriers/dialogue',{method:'POST',headers:{'Content-Type':'application/json','X-Mongrels-Request':'carrier-dialogue'},body:JSON.stringify(body)});
    if(!response.ok)throw new Error(errorMessage(payload.error));
    if(payload.profile)dialogueProfiles[payload.profile.carrierId]=payload.profile;
    if(payload.sharedProfile)dialogueProfiles[SHARED_DIALOGUE_ID]=payload.sharedProfile;
    dialogueCanManageShared=payload.canManageShared===true||dialogueCanManageShared;
    return payload;
  }
  async function saveDialogueLine(){
    const status=$('[data-dialogue-status]');
    if(!dialogueEditable()){status.textContent='This pool is read only for your account.';return;}
    status.textContent='Saving…';
    const text=$('[data-dialogue-text]').value.trim();
    if(!text){status.textContent='Enter a dialogue line first.';return;}
    try{
      const id=dialogueEditingId||crypto.randomUUID();
      await dialogueMutation({
        action:'upsert_line',carrierId:currentDialogueCarrierId(),
        line:{id,category:$('[data-dialogue-category]').value,audience:$('[data-dialogue-audience]').value,rarity:$('[data-dialogue-rarity]').value,enabled:$('[data-dialogue-enabled]').value==='true',text}
      });
      resetDialogueEditor(); renderDialogueLines(); hydrateDialogueSettings();
      status.textContent=currentDialogueCarrierId()===SHARED_DIALOGUE_ID?'Saved to Squadron Shared Pool.':'Saved to this carrier’s private pool.';
    }catch(error){status.textContent=error.message||'Save failed.';}
  }
  async function deleteDialogueLine(row){
    if(!dialogueEditable())return;
    if(!confirm(currentDialogueCarrierId()===SHARED_DIALOGUE_ID?'Delete this shared squad line?':'Delete this carrier-only dialogue line?'))return;
    try{
      await dialogueMutation({action:'delete_line',carrierId:currentDialogueCarrierId(),lineId:row.id});
      if(dialogueEditingId===row.id)resetDialogueEditor();
      renderDialogueLines();
    }catch(error){$('[data-dialogue-status]').textContent=error.message||'Delete failed.';}
  }
  async function saveDialogueSettings(){
    const status=$('[data-dialogue-footer-status]');
    if(!dialogueEditable()||currentDialogueCarrierId()===SHARED_DIALOGUE_ID){status.textContent='Select a carrier you can manage.';return;}
    status.textContent='Saving carrier voice settings…';
    try{
      await dialogueMutation({
        action:'settings',carrierId:currentDialogueCarrierId(),
        settings:{
          sharedEnabled:$('[data-dialogue-shared-enabled]').value==='true',
          ambientEnabled:$('[data-dialogue-ambient-enabled]').value==='true',
          hangarMinSeconds:Number($('[data-dialogue-hangar-min]').value),
          hangarMaxSeconds:Number($('[data-dialogue-hangar-max]').value),
          concourseMinSeconds:Number($('[data-dialogue-concourse-min]').value),
          concourseMaxSeconds:Number($('[data-dialogue-concourse-max]').value),
          voiceProfile:readPublishedVoice(),
        }
      });
      hydrateDialogueSettings(); status.textContent='Carrier voice settings saved.';
    }catch(error){status.textContent=error.message||'Timing save failed.';}
  }

  function renderMemberFilter() {
    document.querySelector('[data-carrier-member-filter]')?.remove();
    if (!memberFilter) return;
    const section = document.querySelector('#carrier-directory .container');
    const head = section?.querySelector('.carrier-section-head');
    if (!section || !head) return;
    const banner = document.createElement('div');
    banner.className = 'member-filter-banner';
    banner.dataset.carrierMemberFilter = '';
    banner.innerHTML = `<div><span>Member View</span><strong>${safe(memberFilter.name)}</strong><small>Showing registered carriers owned by this CMDR.</small></div><a class="btn btn-ghost" href="../carriers/#carrier-directory">Show Everyone</a>`;
    section.insertBefore(banner, head);
  }

  async function loadRegistry(){const memberQuery=memberParam?`&member=${encodeURIComponent(memberParam)}`:'';const {response,payload}=await apiFetch(`/api/carriers?resource=registry${memberQuery}`);if(!response.ok){$('[data-carrier-empty]').hidden=false;$('[data-carrier-empty] strong').textContent='Carrier registry unavailable.';return;}session=payload.viewer||session;carriers=Array.isArray(payload.carriers)?payload.carriers:[];memberFilter=payload.memberFilter||null;renderMemberFilter();hydrateRoleFilter();renderRegistry();$('[data-carrier-register]').hidden=!session;$('[data-dialogue-manage]').hidden=!dialogueAvailable();if(memberParam&&memberFilter&&!window.__memberCarrierAnchorHandled){window.__memberCarrierAnchorHandled=true;requestAnimationFrame(()=>document.getElementById('carrier-directory')?.scrollIntoView({block:'start'}));}}
  async function loadCoordination(){if(!session){$('[data-coord-signed-out]').hidden=false;$('[data-coord-board]').hidden=true;return;}const {response,payload}=await apiFetch('/api/carriers?resource=coordination');if(!response.ok){$('[data-coord-signed-out]').hidden=false;$('[data-coord-board]').hidden=true;return;}posts=Array.isArray(payload.posts)?payload.posts:[];$('[data-coord-signed-out]').hidden=true;$('[data-coord-board]').hidden=false;$('[data-coord-create]').hidden=false;renderCoordination();}

  $('[data-carrier-search]')?.addEventListener('input',renderRegistry);$('[data-carrier-role]')?.addEventListener('change',renderRegistry);$('[data-carrier-status]')?.addEventListener('change',renderRegistry);
  $('[data-carrier-register]')?.addEventListener('click',()=>openCarrierEditor());$$('[data-carrier-cancel]').forEach(x=>x.addEventListener('click',closeCarrierEditor));$('[data-carrier-form]')?.addEventListener('submit',saveCarrier);$('[data-carrier-form]')?.addEventListener('input',()=>carrierDirty=true);$('[data-carrier-delete]')?.addEventListener('click',deleteCarrier);
  $('[data-coord-create]')?.addEventListener('click',()=>openCoordEditor());$$('[data-coord-cancel]').forEach(x=>x.addEventListener('click',closeCoordEditor));$('[data-coord-form]')?.addEventListener('submit',saveCoord);$('[data-coord-form]')?.addEventListener('input',()=>coordDirty=true);$('[data-coord-delete]')?.addEventListener('click',deleteCoord);
  $('[data-dialogue-manage]')?.addEventListener('click',openDialogueManager);
  $('[data-dialogue-publish-voice]')?.addEventListener('click',publishCarrierVoice);$$('[data-dialogue-cancel]').forEach(x=>x.addEventListener('click',closeDialogueManager));$('[data-dialogue-new]')?.addEventListener('click',resetDialogueEditor);$('[data-dialogue-save]')?.addEventListener('click',saveDialogueLine);$('[data-dialogue-save-settings]')?.addEventListener('click',saveDialogueSettings);
  $('[data-dialogue-carrier]')?.addEventListener('change',()=>{resetDialogueEditor();hydrateDialogueSettings();renderDialogueLines();});$('[data-dialogue-category]')?.addEventListener('change',()=>{resetDialogueEditor();renderDialogueLines();});$('[data-dialogue-audience]')?.addEventListener('change',()=>{resetDialogueEditor();renderDialogueLines();});$('[data-dialogue-view]')?.addEventListener('change',renderDialogueLines);
  $$('[data-coord-filter]').forEach(btn=>btn.addEventListener('click',()=>{$$('[data-coord-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');coordFilter=btn.dataset.coordFilter;renderCoordination();}));
  window.addEventListener('beforeunload',e=>{if(carrierDirty||coordDirty){e.preventDefault();e.returnValue='';}});

  (async()=>{try{const auth=await apiFetch('/api/auth/session');if(auth.response.ok&&auth.payload.authenticated&&['member','officer','site_admin'].includes(auth.payload.access))session=auth.payload;await loadRegistry();await loadCoordination();}catch(e){console.error('Carrier board failed to load',e);}})();
})();
