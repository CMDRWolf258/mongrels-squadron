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
    if(!c.currentSystem) return '<span class="carrier-location-empty">Not reported</span>';
    const source=c.locationSource==='member'?'Member reported':label(c.locationSource||'Reported');
    return `<div class="carrier-location-line"><span>${safe(c.currentSystem)}</span><button type="button" class="copy-system-btn" data-copy-system="${safe(c.currentSystem)}" aria-label="Copy system name">⧉</button></div><small>${safe(source)} · ${safe(timeAgo(c.locationUpdatedAt))}</small>`;
  }

  function renderRegistry(){
    const q=($('[data-carrier-search]')?.value||'').trim().toLowerCase();
    const role=$('[data-carrier-role]')?.value||'all';
    const status=$('[data-carrier-status]')?.value||'all';
    const filtered=carriers.filter(c=>{
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
    $('[data-carrier-mine]').textContent=session?carriers.filter(c=>c.isMine).length:'—';
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
    $('[data-carrier-form-title]').textContent=c?'Edit Carrier':'Register My Carrier'; $('[data-carrier-id]').value=c?.id||'';
    const callsign=$('[data-carrier-callsign]'); callsign.value=c?.callsign||''; callsign.disabled=Boolean(c);
    $('[data-carrier-name]').value=c?.name||''; $('[data-carrier-commander]').value=c?.commanderName||(session?.displayName||''); $('[data-carrier-role-edit]').value=c?.role||'General Logistics';
    $('[data-carrier-status-edit]').value=c?.status||'active'; $('[data-carrier-system]').value=c?.currentSystem||''; $('[data-carrier-services]').value=(c?.services||[]).join(', '); $('[data-carrier-notes]').value=c?.notes||'';
    $('[data-carrier-official-wrap]').hidden=!manager(); $('[data-carrier-official]').value=c?.official?'true':'false'; $('[data-carrier-delete]').hidden=!c; $('[data-carrier-form-status]').textContent='';
  }
  function closeCarrierEditor(){if(carrierDirty&&!confirm('Discard unsaved carrier changes?'))return;$('[data-carrier-editor-shell]').hidden=true;document.body.classList.remove('project-editor-open');editingCarrier=null;carrierDirty=false;}
  async function saveCarrier(e){e.preventDefault();const status=$('[data-carrier-form-status]');status.textContent='Saving…';const body={resource:'carrier',id:$('[data-carrier-id]').value||undefined,callsign:$('[data-carrier-callsign]').value,name:$('[data-carrier-name]').value,commanderName:$('[data-carrier-commander]').value,role:$('[data-carrier-role-edit]').value,status:$('[data-carrier-status-edit]').value,currentSystem:$('[data-carrier-system]').value,services:$('[data-carrier-services]').value,notes:$('[data-carrier-notes]').value,official:$('[data-carrier-official]').value==='true'};const {response,payload}=await apiFetch('/api/carriers',{method:editingCarrier?'PUT':'POST',headers:{'Content-Type':'application/json','X-Mongrels-Request':'carrier-coordination'},body:JSON.stringify(body)});if(!response.ok){status.textContent=errorMessage(payload.error);return;}carrierDirty=false;closeCarrierEditor();await loadRegistry();await loadCoordination();}
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

  function errorMessage(code){return ({invalid_callsign:'Use a callsign in the format ABC-123.',callsign_already_registered:'That carrier callsign is already registered.',carrier_has_active_coordination:'Complete or remove this carrier’s active coordination posts first.',not_carrier_owner:'You can only manage your own carrier.',not_post_owner:'You can only edit your own coordination posts.',carrier_not_registered:'Register the carrier before posting coordination.',carrier_storage_not_configured:'Carrier storage is not connected yet.'}[code]||code||'Unable to save changes.');}

  async function loadRegistry(){const {response,payload}=await apiFetch('/api/carriers?resource=registry');if(!response.ok){$('[data-carrier-empty]').hidden=false;$('[data-carrier-empty] strong').textContent='Carrier registry unavailable.';return;}session=payload.viewer||session;carriers=Array.isArray(payload.carriers)?payload.carriers:[];hydrateRoleFilter();renderRegistry();$('[data-carrier-register]').hidden=!session;}
  async function loadCoordination(){if(!session){$('[data-coord-signed-out]').hidden=false;$('[data-coord-board]').hidden=true;return;}const {response,payload}=await apiFetch('/api/carriers?resource=coordination');if(!response.ok){$('[data-coord-signed-out]').hidden=false;$('[data-coord-board]').hidden=true;return;}posts=Array.isArray(payload.posts)?payload.posts:[];$('[data-coord-signed-out]').hidden=true;$('[data-coord-board]').hidden=false;$('[data-coord-create]').hidden=false;renderCoordination();}

  $('[data-carrier-search]')?.addEventListener('input',renderRegistry);$('[data-carrier-role]')?.addEventListener('change',renderRegistry);$('[data-carrier-status]')?.addEventListener('change',renderRegistry);
  $('[data-carrier-register]')?.addEventListener('click',()=>openCarrierEditor());$$('[data-carrier-cancel]').forEach(x=>x.addEventListener('click',closeCarrierEditor));$('[data-carrier-form]')?.addEventListener('submit',saveCarrier);$('[data-carrier-form]')?.addEventListener('input',()=>carrierDirty=true);$('[data-carrier-delete]')?.addEventListener('click',deleteCarrier);
  $('[data-coord-create]')?.addEventListener('click',()=>openCoordEditor());$$('[data-coord-cancel]').forEach(x=>x.addEventListener('click',closeCoordEditor));$('[data-coord-form]')?.addEventListener('submit',saveCoord);$('[data-coord-form]')?.addEventListener('input',()=>coordDirty=true);$('[data-coord-delete]')?.addEventListener('click',deleteCoord);
  $$('[data-coord-filter]').forEach(btn=>btn.addEventListener('click',()=>{$$('[data-coord-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');coordFilter=btn.dataset.coordFilter;renderCoordination();}));
  window.addEventListener('beforeunload',e=>{if(carrierDirty||coordDirty){e.preventDefault();e.returnValue='';}});

  (async()=>{try{const auth=await apiFetch('/api/auth/session');if(auth.response.ok&&auth.payload.authenticated&&['member','officer','site_admin'].includes(auth.payload.access))session=auth.payload;await loadRegistry();await loadCoordination();}catch(e){console.error('Carrier board failed to load',e);}})();
})();
