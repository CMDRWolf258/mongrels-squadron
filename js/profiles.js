(() => {
  const mode = document.body.dataset.profileMode;
  if (!mode) return;
  const app = document.querySelector('[data-profile-app]');
  const gate = document.querySelector('[data-profile-gate]');
  const state = { data:null, search:'', specialty:'', activity:'', status:'', group:'all' };

  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const list = v => Array.isArray(v) ? v : [];
  const fmtDate = v => { if (!v) return ''; const d=new Date(v); return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
  const qs = v => encodeURIComponent(v || '');
  const api = async (method='GET', body=null) => {
    const options={method,credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'};
    if(body){options.headers['Content-Type']='application/json';options.headers['X-Mongrels-Request']='profile-editor';options.body=JSON.stringify(body);}
    if(method==='DELETE') options.headers['X-Mongrels-Request']='profile-editor';
    const res=await fetch(`/api/profiles?_=${Date.now()}`,options); const data=await res.json().catch(()=>({}));
    if(res.status===401||res.status===403) throw Object.assign(new Error('auth'),{auth:true});
    if(!res.ok) throw new Error(data.error||'profile_request_failed'); return data;
  };
  async function load(){
    try { state.data=await api(); gate.hidden=true; app.hidden=false; if(mode==='roster') renderRoster(); else renderDetail(); }
    catch(e){ if(e.auth){gate.hidden=false;app.hidden=true;} else {gate.hidden=false;gate.querySelector('h2').textContent='Profile service unavailable';gate.querySelector('p').textContent='The member directory could not be loaded. Please try again shortly.';} }
  }

  function completion(p){
    const checks=[p.commanderName,p.bio,list(p.specialties).length,list(p.activities).length,p.tagline,(p.availabilityStatus&&p.availabilityStatus!=='none'),p.availability,p.homeSystem,(list(p.featuredShips).length||Number(p.contributions?.carriers)||p.carrierCallsign)];
    return Math.round(checks.filter(Boolean).length/checks.length*100);
  }
  function statusLabel(p){ return p.availabilityStatus && p.availabilityStatus!=='none' ? p.availabilityStatus : ''; }
  function tagLink(kind, value, extra=''){ return `<a class="profile-chip ${kind==='activity'?'activity-chip':''}" href="../members/?${kind}=${qs(value)}${extra}">${esc(value)}</a>`; }

  function renderRoster(){
    const search=document.querySelector('[data-roster-search]'); const spec=document.querySelector('[data-roster-specialty]'); const activity=document.querySelector('[data-roster-activity]');
    const status=document.querySelector('[data-roster-status]'); const group=document.querySelector('[data-roster-group]');
    const profiles=list(state.data.profiles);
    const specs=list(state.data.specialties).length ? state.data.specialties : [...new Set(profiles.flatMap(p=>list(p.specialties)))].sort();
    const acts=list(state.data.activities).length ? state.data.activities : [...new Set(profiles.flatMap(p=>list(p.activities)))].sort();
    spec.innerHTML='<option value="">All specialties</option>'+specs.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    activity.innerHTML='<option value="">All activities</option>'+acts.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    status.innerHTML='<option value="">Any availability</option>'+list(state.data.availabilityStatuses).filter(x=>x!=='none').map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    const params=new URLSearchParams(location.search);
    state.specialty=params.get('specialty')||''; state.activity=params.get('activity')||''; state.status=params.get('status')||''; state.group=params.get('group')||'all'; state.search=params.get('q')||'';
    search.value=state.search; spec.value=state.specialty; activity.value=state.activity; status.value=state.status; group.value=state.group;
    const update=()=>{state.search=search.value.trim().toLowerCase();state.specialty=spec.value;state.activity=activity.value;state.status=status.value;state.group=group.value;renderRosterGrid();};
    search.oninput=update; spec.onchange=update; activity.onchange=update; status.onchange=update; group.onchange=update;
    const clear=document.querySelector('[data-roster-clear]'); if(clear) clear.onclick=()=>{search.value='';spec.value='';activity.value='';status.value='';group.value='all';update();history.replaceState({},'',location.pathname);};
    const create=document.querySelector('[data-create-profile]');
    if(state.data.mine){create.textContent='Edit My Profile';create.onclick=()=>location.href=`../profile/?id=${qs(state.data.mine.id)}&edit=1`;}
    else {create.textContent='Create My Profile';create.onclick=()=>location.href='../profile/?edit=1';}
    renderRosterGrid();
  }
  function renderRosterGrid(){
    const grid=document.querySelector('[data-roster-grid]'); const empty=document.querySelector('[data-roster-empty]'); const count=document.querySelector('[data-roster-count]');
    let profiles=list(state.data.profiles).filter(p=>p.directoryVisible || p.isMine || state.data.canModerate);
    profiles=profiles.filter(p=>{
      const hay=[p.commanderName,p.discordName,p.squadRank,p.leadershipRole,p.tagline,p.homeSystem,p.availabilityStatus,p.availability,...list(p.specialties),...list(p.activities)].join(' ').toLowerCase();
      const groupOK=state.group==='all'||(state.group==='leadership'&&p.leadershipRole)||(state.group==='carriers'&&(Number(p.contributions?.carriers)>0||Boolean(p.carrierCallsign)))||(state.group==='help'&&['Available to Help','Looking for Group'].includes(p.availabilityStatus));
      return (!state.search||hay.includes(state.search))&&(!state.specialty||list(p.specialties).includes(state.specialty))&&(!state.activity||list(p.activities).includes(state.activity))&&(!state.status||p.availabilityStatus===state.status)&&groupOK;
    });
    count.textContent=`${profiles.length} profile${profiles.length===1?'':'s'}`; empty.hidden=profiles.length>0;
    grid.innerHTML=profiles.map(profileCard).join('');
  }
  function profileCard(p){
    const badges=[p.squadRank,p.leadershipRole].filter(Boolean).map((x,i)=>`<span class="profile-rank${i===1?' leadership-badge':''}">${esc(x)}</span>`).join('');
    const specialties=list(p.specialties).slice(0,5).map(x=>tagLink('specialty',x)).join(''); const c=p.contributions||{}; const st=statusLabel(p);
    return `<article class="roster-card${p.directoryVisible?'':' is-hidden-profile'}"><div class="roster-card-top"><div><p class="eyebrow">${esc(p.squadRank||'Mongrel')}</p><h3>${esc(p.commanderName||'Unnamed CMDR')}</h3>${p.discordName?`<span class="profile-discord">Discord · ${esc(p.discordName)}</span>`:''}</div>${p.isMine?'<span class="profile-you">YOU</span>':''}</div>${badges?`<div class="profile-ranks">${badges}</div>`:''}${st?`<div class="profile-presence status-${esc(st.toLowerCase().replace(/\s+/g,'-'))}"><span></span>${esc(st)}</div>`:''}${p.tagline?`<p class="profile-tagline">${esc(p.tagline)}</p>`:''}<div class="profile-chip-row">${specialties||'<span class="profile-chip muted-chip">No specialties listed</span>'}</div><div class="roster-meta">${p.homeSystem?`<span>Home · <strong>${esc(p.homeSystem)}</strong></span>`:''}<span>Projects · <strong>${Number(c.projects)||0}</strong></span><span>Carrier · <strong>${Number(c.carriers)>0||p.carrierCallsign?'Yes':'No'}</strong></span></div>${p.isMine&&completion(p)<75?`<a class="profile-completion-mini" href="../profile/?id=${qs(p.id)}&edit=1">Profile ${completion(p)}% complete · add more details →</a>`:''}<a class="btn btn-ghost" href="../profile/?id=${qs(p.id)}">View Profile</a></article>`;
  }

  function renderDetail(){
    const root=document.querySelector('[data-profile-detail]'); const params=new URLSearchParams(location.search); const id=params.get('id'); const wantsEdit=params.get('edit')==='1';
    const profile=id?list(state.data.profiles).find(p=>p.id===id):state.data.mine;
    if(!profile){ if(wantsEdit) return renderEditor(null); root.innerHTML='<div class="profile-empty"><h2>No profile yet</h2><p>Create your member profile to appear in the private roster.</p><button class="btn btn-primary" data-start-profile>Create My Profile</button></div>'; root.querySelector('[data-start-profile]').onclick=()=>renderEditor(null); return; }
    if(wantsEdit&&profile.canEdit) return renderEditor(profile);
    root.innerHTML=profileDetail(profile);
    const edit=root.querySelector('[data-edit-profile]'); if(edit) edit.onclick=()=>renderEditor(profile);
  }
  function profileDetail(p){
    const chips=list(p.specialties).map(x=>tagLink('specialty',x)).join(''); const activities=list(p.activities).map(x=>tagLink('activity',x)).join(''); const c=p.contributions||{}; const member=qs(p.id);
    const carriers=list(p.registeredCarriers).map(x=>`<article class="profile-mini-card"><strong>${esc(x.name)}</strong><span>${esc(x.callsign)}${x.role?` · ${esc(x.role)}`:''}</span>${x.currentSystem?`<small>Current system · ${esc(x.currentSystem)}</small>`:''}<a href="../carriers/?member=${member}#carrier-directory">Open Carrier Registry →</a></article>`).join('');
    const ships=list(p.featuredShips).map(x=>`<article class="profile-mini-card"><strong>${esc(x.name||x.type)}</strong><span>${esc([x.type,x.role].filter(Boolean).join(' · '))}</span>${x.edsy?`<a href="${esc(x.edsy)}" target="_blank" rel="noopener noreferrer">Open EDSY ↗</a>`:''}</article>`).join('');
    const status=statusLabel(p);
    const actions=[Number(c.projects)?`<a class="profile-action" href="../projects/?member=${member}#project-list"><strong>${Number(c.projects)}</strong><span>Projects</span></a>`:'',Number(c.trades)?`<a class="profile-action" href="../trading/?member=${member}#member-trade-board"><strong>${Number(c.trades)}</strong><span>Trade Posts</span></a>`:'',Number(c.bounties)?`<a class="profile-action" href="../pvp/?member=${member}#bounty-board"><strong>${Number(c.bounties)}</strong><span>Bounties</span></a>`:'',Number(c.carriers)?`<a class="profile-action" href="../carriers/?member=${member}#carrier-directory"><strong>${Number(c.carriers)}</strong><span>Carriers</span></a>`:''].filter(Boolean).join('');
    return `<article class="profile-sheet"><header class="profile-sheet-head"><div><p class="eyebrow">${esc(p.squadRank||'Mongrel')}</p><h2>${esc(p.commanderName)}</h2>${p.leadershipRole?`<div class="profile-leadership-row"><span class="profile-rank leadership-badge">${esc(p.leadershipRole)}</span></div>`:''}${p.discordName?`<span class="profile-discord">Discord · ${esc(p.discordName)}</span>`:''}${status?`<div class="profile-presence"><span></span>${esc(status)}</div>`:''}</div>${p.canEdit?'<button class="btn btn-primary" type="button" data-edit-profile>Edit Profile</button>':''}</header>${p.tagline?`<p class="profile-quote">${esc(p.tagline)}</p>`:''}${actions?`<nav class="profile-action-bar" aria-label="Member contributions">${actions}</nav>`:'<div class="profile-action-bar is-empty"><span>No linked squad activity yet.</span></div>'}<div class="profile-columns"><section><p class="eyebrow">About</p>${p.bio?`<p class="profile-bio">${esc(p.bio).replace(/\n/g,'<br>')}</p>`:'<p class="muted">No bio shared.</p>'}${p.homeSystem?`<p><strong>Home system:</strong> ${esc(p.homeSystem)}</p>`:''}${p.availability?`<p><strong>Availability / contact:</strong> ${esc(p.availability)}</p>`:''}<p class="eyebrow profile-section-label">Specialties</p><div class="profile-chip-row">${chips||'<span class="muted">None listed.</span>'}</div><p class="eyebrow profile-section-label">Preferred Activities</p><div class="profile-chip-row">${activities||'<span class="muted">None listed.</span>'}</div></section><section><p class="eyebrow">Fleet Carrier</p><div class="profile-mini-grid">${carriers|| (p.carrierCallsign?`<article class="profile-mini-card"><strong>${esc(p.carrierCallsign)}</strong><span>Profile-listed carrier</span><a href="../carriers/?member=${member}#carrier-directory">Open Carrier Registry →</a></article>`:'<p class="muted">No carrier shared.</p>')}</div><p class="eyebrow profile-section-label">Showcase Ships</p><div class="profile-mini-grid">${ships||'<p class="muted">No ships showcased.</p>'}</div></section></div><footer class="profile-sheet-foot">Updated ${esc(fmtDate(p.updatedAt)||'recently')}${!p.directoryVisible?' · Hidden from normal roster results':''}</footer></article>`;
  }

  function optionsField(title,name,options,selected){
    const set=new Set(list(selected)); return `<fieldset class="profile-tag-picker"><legend>${esc(title)}</legend><div class="profile-tag-options">${options.map(x=>`<label><input type="checkbox" name="${name}" value="${esc(x)}" ${set.has(x)?'checked':''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>`;
  }
  function renderEditor(p){
    const root=document.querySelector('[data-profile-detail]'); const isNew=!p; const current=p||{specialties:[],activities:[],featuredShips:[],privacy:{showDiscord:true,showBio:true,showCarrier:true,showShips:true},directoryVisible:true,availabilityStatus:'none'};
    const ships=list(current.featuredShips).map(x=>[x.name,x.type,x.role,x.edsy].filter(Boolean).join(' | ')).join('\n'); const pct=completion(current);
    const statuses=list(state.data.availabilityStatuses).length?state.data.availabilityStatuses:['none','Available to Help','Looking for Group','Busy','Away'];
    root.innerHTML=`<form class="profile-editor" data-profile-form><div class="profile-editor-head"><div><p class="eyebrow">${isNew?'Create Profile':'Edit Profile'}</p><h2>${esc(current.commanderName||'Your Mongrel Profile')}</h2><p>Use this to tell squadmates what you do, how you like to help, and what you want to showcase.</p></div><button class="btn btn-ghost" type="button" data-cancel-profile>Cancel</button></div>${!isNew&&pct<85?`<div class="profile-completion"><div><strong>Profile completion · ${pct}%</strong><span>Add a bio, specialties, activities, availability, or fleet details to help other Mongrels find you.</span></div><div class="profile-completion-bar"><i style="width:${pct}%"></i></div></div>`:''}<div class="profile-form-grid"><label class="field"><span>CMDR Name</span><input name="commanderName" maxlength="80" required value="${esc(current.commanderName||'')}"></label><label class="field"><span>Tagline</span><input name="tagline" maxlength="140" value="${esc(current.tagline||'')}" placeholder="Short squadron-facing line"></label><label class="field"><span>Home System</span><input name="homeSystem" maxlength="120" value="${esc(current.homeSystem||'')}"></label><label class="field"><span>Availability Status</span><select name="availabilityStatus">${statuses.map(x=>`<option value="${esc(x)}" ${current.availabilityStatus===x?'selected':''}>${x==='none'?'No status':esc(x)}</option>`).join('')}</select></label><label class="field profile-span-2"><span>Availability / Contact Note</span><input name="availability" maxlength="300" value="${esc(current.availability||'')}" placeholder="e.g. Usually evenings UTC; ping me for AX"></label></div><label class="field"><span>Bio</span><textarea name="bio" rows="6" maxlength="1800" placeholder="A little about you as a CMDR…">${esc(current.bio||'')}</textarea></label>${optionsField('Specialties','specialties',list(state.data.specialties),current.specialties)}${optionsField('Preferred Activities','activities',list(state.data.activities),current.activities)}<div class="profile-form-grid"><label class="field"><span>Carrier Callsign (optional)</span><input name="carrierCallsign" maxlength="20" value="${esc(current.carrierCallsign||'')}" placeholder="ABC-123"></label>${state.data.canModerate?`<label class="field"><span>Squad Rank <small>Officer-managed</small></span><input name="squadRank" maxlength="60" value="${esc(current.squadRank||'Pilot')}"></label><label class="field"><span>Leadership Role <small>Officer-managed</small></span><input name="leadershipRole" maxlength="100" value="${esc(current.leadershipRole||'')}"></label>`:''}</div><label class="field"><span>Showcase Ships <small>one per line: Name | Ship Type | Role | EDSY URL</small></span><textarea name="featuredShips" rows="6" placeholder="Honey Badger | Imperial Cutter | Multi-role | https://edsy.org/…">${esc(ships)}</textarea></label><fieldset class="profile-privacy"><legend>Profile Visibility</legend>${[['directoryVisible','Show me in the member roster',current.directoryVisible!==false],['showDiscord','Show my Discord display name',current.privacy?.showDiscord!==false],['showBio','Show my bio',current.privacy?.showBio!==false],['showCarrier','Show carrier information',current.privacy?.showCarrier!==false],['showShips','Show showcased ships',current.privacy?.showShips!==false]].map(([name,label,checked])=>`<label class="profile-privacy-option"><input type="checkbox" name="${name}" ${checked?'checked':''}><span>${label}</span></label>`).join('')}</fieldset><div class="profile-editor-actions"><span data-profile-message></span><button class="btn btn-primary" type="submit">${isNew?'Create Profile':'Save Changes'}</button></div></form>`;
    root.querySelector('[data-cancel-profile]').onclick=()=>{ if(p) location.href=`../profile/?id=${qs(p.id)}`; else location.href='../members/'; };
    root.querySelector('[data-profile-form]').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const msg=form.querySelector('[data-profile-message]');const fd=new FormData(form);const payload={id:p?.id,commanderName:fd.get('commanderName'),tagline:fd.get('tagline'),homeSystem:fd.get('homeSystem'),availabilityStatus:fd.get('availabilityStatus'),availability:fd.get('availability'),bio:fd.get('bio'),specialties:fd.getAll('specialties'),activities:fd.getAll('activities'),carrierCallsign:fd.get('carrierCallsign'),featuredShips:parseShips(fd.get('featuredShips')),directoryVisible:fd.has('directoryVisible'),showDiscord:fd.has('showDiscord'),showBio:fd.has('showBio'),showCarrier:fd.has('showCarrier'),showShips:fd.has('showShips')}; if(state.data.canModerate){payload.squadRank=fd.get('squadRank')||p?.squadRank||'Pilot';payload.leadershipRole=fd.get('leadershipRole')||'';} msg.textContent='Saving…'; try{const result=await api(isNew?'POST':'PUT',payload);await load();location.href=`../profile/?id=${qs(result.profile.id)}`;}catch(err){msg.textContent=`Could not save profile (${err.message}).`;}};
  }
  const parseShips=v=>String(v||'').split(/\n+/).map(line=>{const [name='',type='',role='',edsy='']=line.split('|').map(x=>x.trim());return{name,type,role,edsy};}).filter(x=>x.name||x.type).slice(0,6);
  load();
})();
