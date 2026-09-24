(() => {
  const root=document.querySelector('[data-squad-structure]');
  const adminRoot=document.querySelector('[data-squad-structure-admin]');
  if(!root)return;

  let payload=null;
  let saving=false;

  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const apiFetch=async(url,options={})=>{
    const requestUrl=options.method?url:url+(url.includes('?')?'&':'?')+'_='+Date.now();
    const response=await fetch(requestUrl,{credentials:'same-origin',cache:'no-store',...options});
    const data=await response.json().catch(()=>({}));
    return {response,payload:data};
  };

  function renderStructure(structure){
    if(!structure){
      root.innerHTML='<div class="placeholder"><strong>Squad structure unavailable.</strong><p class="muted">The current roster could not be loaded.</p></div>';
      return;
    }

    const command=(structure.command||[]).map(item=>
      '<article class="leadership-card'+(item.primary?' leadership-card-primary':'')+'">'+
      '<span class="leadership-rank">'+safe(item.rank)+'</span>'+
      '<h3>'+safe(item.holder||'Position Vacant')+'</h3>'+
      '<p class="leadership-role">'+safe(item.role)+'</p>'+
      '<p>'+safe(item.description)+'</p>'+
      '</article>'
    ).join('');

    const captains=(structure.captains||[]).map(item=>
      '<article class="command-card'+(item.holder?' command-filled':'')+'">'+
      '<span class="command-status'+(item.holder?'':' command-open')+'">'+(item.holder?'Assigned':'Position Available')+'</span>'+
      '<h4>'+safe(item.title)+'</h4>'+
      (item.holder?'<strong>'+safe(item.holder)+'</strong>':'')+
      '<p>'+safe(item.description)+'</p>'+
      '</article>'
    ).join('');

    const field=(structure.fieldLeadership||[]).map(item=>{
      const assignments=(item.assignments||[]).map(assignment=>
        '<div class="member-assignment"><strong>'+safe(assignment.name)+'</strong>'+
        (assignment.focus?'<span>'+safe(assignment.focus)+'</span>':'')+
        '</div>'
      ).join('');
      return '<article class="field-card">'+
        '<span class="field-rank">'+safe(item.rank)+'</span>'+
        '<h3>'+safe(item.title)+'</h3>'+
        '<p>'+safe(item.description)+'</p>'+
        (assignments||'<div class="member-assignment"><strong>Position Available</strong></div>')+
        '</article>';
    }).join('');

    const specialists=(structure.specialists||[]).map(item=>
      '<article class="specialist-card'+(item.holder?' specialist-assigned':'')+'">'+
      '<span>'+safe(item.rank)+'</span>'+
      '<h4>'+safe(item.title)+'</h4>'+
      '<p>'+safe(item.description)+'</p>'+
      (item.holder
        ?'<strong>'+safe(item.holder)+'</strong>'+(item.focus?'<em>'+safe(item.focus)+'</em>':'')
        :'<em>Position currently open</em>')+
      '</article>'
    ).join('');

    const ranks=(structure.pilotRanks||[]).map(item=>
      '<article class="rank-step'+(item.veteran?' rank-veteran':'')+'">'+
      '<div class="rank-number">'+safe(item.number)+'</div>'+
      '<div><span>'+safe(item.rank)+'</span><h4>'+safe(item.title)+'</h4><p>'+safe(item.description)+'</p></div>'+
      '<strong>'+(Number(item.count)||0)+' current</strong>'+
      '</article>'
    ).join('');

    root.innerHTML=
      '<div class="leadership-grid">'+command+'</div>'+
      '<div class="structure-subheading"><p class="eyebrow">Operational Commands</p><h3>Captain Corps</h3><p>Captains organize and conduct operations within their specialty and serve as mentors to other squad members.</p></div>'+
      '<div class="command-grid">'+captains+'</div>'+
      '<div class="field-leadership-grid">'+field+'</div>'+
      '<div class="structure-subheading specialist-heading"><p class="eyebrow">Specialist Corps</p><h3>Expertise without a single-track career.</h3><p>Mongrels may specialize in one or more areas of squadron operations. Specialist ranks recognize Commanders who volunteer their expertise and prove themselves capable of completing missions in those fields. Multiple specialties are encouraged.</p></div>'+
      '<div class="specialist-grid">'+specialists+'</div>'+
      '<div class="structure-subheading rank-heading" id="ranks"><p class="eyebrow">Pilot Ranks</p><h3>The regular squadron progression.</h3><p>The public site keeps the leadership roster concise. The detailed squadron roster and member profiles are available inside the private Discord-authenticated member network.</p></div>'+
      '<div class="rank-ladder">'+ranks+'</div>';
    realignDynamicAnchor();
  }

  function realignDynamicAnchor(){
    if(location.hash==='#ranks'||location.hash==='#squad-rules'){
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const target=document.querySelector(location.hash);
        target?.scrollIntoView({block:'start'});
      }));
    }
  }

  function assignmentLines(assignments){
    return (assignments||[]).map(item=>item.name+(item.focus?' | '+item.focus:'')).join('\n');
  }

  function renderAdmin(){
    if(!adminRoot)return;
    if(!payload?.canEdit){
      adminRoot.hidden=true;
      adminRoot.innerHTML='';
      return;
    }

    const structure=payload.structure;
    const discord=payload.discord||{};
    const commandInputs=(structure.command||[]).map(item=>
      '<label><span>'+safe(item.rank)+' · '+safe(item.role)+'</span>'+
      '<input type="text" maxlength="100" value="'+safe(item.holder||'')+'" data-command-id="'+safe(item.id)+'" placeholder="CMDR name"></label>'
    ).join('');
    const captainInputs=(structure.captains||[]).map(item=>
      '<label><span>'+safe(item.title)+'</span>'+
      '<input type="text" maxlength="100" value="'+safe(item.holder||'')+'" data-captain-id="'+safe(item.id)+'" placeholder="Leave blank for Position Available"></label>'
    ).join('');
    const fieldInputs=(structure.fieldLeadership||[]).map(item=>
      '<label><span>'+safe(item.rank)+' · '+safe(item.title)+'</span>'+
      '<textarea rows="4" data-field-id="'+safe(item.id)+'" placeholder="One per line: CMDR Name | specialty / focus">'+safe(assignmentLines(item.assignments))+'</textarea></label>'
    ).join('');
    const specialistInputs=(structure.specialists||[]).map(item=>
      '<div class="structure-specialist-row">'+
      '<strong>'+safe(item.rank)+' · '+safe(item.title)+'</strong>'+
      '<input type="text" maxlength="100" value="'+safe(item.holder||'')+'" data-specialist-holder="'+safe(item.id)+'" placeholder="Leave blank if open">'+
      '<input type="text" maxlength="180" value="'+safe(item.focus||'')+'" data-specialist-focus="'+safe(item.id)+'" placeholder="Specialties / focus">'+
      '</div>'
    ).join('');
    const rankInputs=(structure.pilotRanks||[]).map(item=>
      '<label><span>'+safe(item.rank)+'</span>'+
      '<input type="number" min="0" max="999" step="1" value="'+(Number(item.count)||0)+'" data-rank-id="'+safe(item.id)+'"></label>'
    ).join('');

    const discordState=discord.lastError?'Needs Attention':discord.linked?'Synced':'Not Published';
    const discordDetail=discord.lastError
      ?safe(discord.lastError)
      :discord.lastSyncedAt
        ?'Last sync '+safe(new Date(discord.lastSyncedAt).toLocaleString())
        :'Target channel: 🏛️〡squad-structure';

    adminRoot.hidden=false;
    adminRoot.innerHTML=
      '<div class="structure-admin-head">'+
        '<div><p class="eyebrow">Site Admin</p><h3>Manage Squad Structure</h3><p>Update assignments here once. Saving refreshes the About page data and attempts to update the persistent Discord structure post.</p></div>'+
        '<div class="structure-discord-health'+(discord.lastError?' warning':'')+'"><span>Discord</span><strong>'+discordState+'</strong><small>'+discordDetail+'</small></div>'+
      '</div>'+
      '<form class="structure-admin-form" data-structure-form>'+
        '<details open><summary>Regiment Command</summary><div class="structure-admin-grid">'+commandInputs+'</div></details>'+
        '<details><summary>Captain Corps</summary><div class="structure-admin-grid">'+captainInputs+'</div></details>'+
        '<details><summary>Field Leadership</summary><div class="structure-admin-grid structure-admin-grid-wide">'+fieldInputs+'</div></details>'+
        '<details><summary>Specialist Corps</summary><div class="structure-specialist-editor">'+specialistInputs+'</div></details>'+
        '<details><summary>Pilot Rank Counts</summary><div class="structure-admin-grid structure-rank-count-grid">'+rankInputs+'</div></details>'+
        '<div class="structure-admin-actions">'+
          '<button class="btn btn-primary" type="submit" data-structure-save>Save & Sync Discord</button>'+
          '<button class="btn btn-secondary" type="button" data-structure-sync>Sync Discord Only</button>'+
          '<span data-structure-status aria-live="polite"></span>'+
        '</div>'+
      '</form>';

    adminRoot.querySelector('[data-structure-form]')?.addEventListener('submit',save);
    adminRoot.querySelector('[data-structure-sync]')?.addEventListener('click',syncDiscord);
  }

  function parseAssignments(text){
    return String(text||'').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
      const parts=line.split('|');
      return {name:(parts.shift()||'').trim(),focus:parts.join('|').trim()};
    }).filter(item=>item.name).slice(0,12);
  }

  function collectStructure(){
    const form=adminRoot.querySelector('[data-structure-form]');
    const command={};
    const captains={};
    const fieldLeadership={};
    const specialists={};
    const rankCounts={};

    form.querySelectorAll('[data-command-id]').forEach(input=>{command[input.dataset.commandId]=input.value.trim();});
    form.querySelectorAll('[data-captain-id]').forEach(input=>{captains[input.dataset.captainId]=input.value.trim();});
    form.querySelectorAll('[data-field-id]').forEach(input=>{fieldLeadership[input.dataset.fieldId]=parseAssignments(input.value);});
    form.querySelectorAll('[data-specialist-holder]').forEach(input=>{
      const id=input.dataset.specialistHolder;
      const focus=form.querySelector('[data-specialist-focus="'+CSS.escape(id)+'"]')?.value.trim()||'';
      specialists[id]={holder:input.value.trim(),focus};
    });
    form.querySelectorAll('[data-rank-id]').forEach(input=>{rankCounts[input.dataset.rankId]=Number(input.value)||0;});

    return {command,captains,fieldLeadership,specialists,rankCounts};
  }

  function setStatus(message,error=false){
    const target=adminRoot?.querySelector('[data-structure-status]');
    if(!target)return;
    target.textContent=message;
    target.classList.toggle('error',Boolean(error));
  }

  function setBusy(busy){
    saving=busy;
    adminRoot?.querySelectorAll('button').forEach(button=>button.disabled=busy);
  }

  async function save(event){
    event.preventDefault();
    if(saving)return;
    setBusy(true);
    setStatus('Saving structure and syncing Discord…');
    try{
      const {response,payload:next}=await apiFetch('/api/squad-structure',{
        method:'PATCH',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'squad-structure-editor'},
        body:JSON.stringify({structure:collectStructure()}),
      });
      if(!response.ok)throw new Error(next.error||'Unable to save squad structure.');
      payload={...payload,...next,canEdit:true};
      renderStructure(payload.structure);
      renderAdmin();
      realignDynamicAnchor();
      if(next.sync?.ok){
        setStatus(next.sync.mode==='created'?'Saved · Discord structure post created.':'Saved · Discord structure post updated.');
      }else{
        setStatus('Saved · Discord sync needs attention: '+(next.sync?.error||next.discord?.lastError||'unknown error'),true);
      }
    }catch(error){
      setStatus(error?.message||'Unable to save squad structure.',true);
    }finally{
      setBusy(false);
    }
  }

  async function syncDiscord(){
    if(saving)return;
    setBusy(true);
    setStatus('Syncing Discord…');
    try{
      const {response,payload:next}=await apiFetch('/api/squad-structure',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'squad-structure-editor'},
        body:JSON.stringify({action:'sync'}),
      });
      payload={...payload,...next,canEdit:true};
      renderAdmin();
      if(!response.ok||!next.sync?.ok)throw new Error(next.sync?.error||next.discord?.lastError||next.error||'Unable to sync Discord.');
      setStatus(next.sync.mode==='created'?'Discord structure post created.':'Discord structure post updated.');
    }catch(error){
      setStatus(error?.message||'Unable to sync Discord.',true);
    }finally{
      setBusy(false);
    }
  }

  async function load(){
    try{
      const {response,payload:next}=await apiFetch('/api/squad-structure');
      if(!response.ok)throw new Error(next.error||'Unable to load squad structure.');
      payload=next;
      renderStructure(next.structure);
      renderAdmin();
      realignDynamicAnchor();
    }catch{
      renderStructure(null);
      if(adminRoot)adminRoot.hidden=true;
    }
  }

  load();
})();