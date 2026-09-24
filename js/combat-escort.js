(() => {
  const gate=document.querySelector('[data-escort-gate]');
  const gateStatus=document.querySelector('[data-escort-gate-status]');
  const app=document.querySelector('[data-escort-app]');
  const form=document.querySelector('[data-escort-form]');
  const formStatus=document.querySelector('[data-escort-form-status]');
  const submit=document.querySelector('[data-escort-submit]');
  const board=document.querySelector('[data-escort-board]');
  const empty=document.querySelector('[data-escort-empty]');
  const discordState=document.querySelector('[data-escort-discord-state]');
  const discordTitle=document.querySelector('[data-escort-discord-title]');
  const discordCopy=document.querySelector('[data-escort-discord-copy]');
  const filters=[...document.querySelectorAll('[data-escort-filter]')];

  let state={items:[],viewer:null,discord:{},filter:'open'};

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const urgencyLabel=value=>({routine:'Routine',priority:'Priority',immediate:'Immediate'})[value]||'Routine';
  const statusLabel=value=>({open:'Open',complete:'Complete',cancelled:'Cancelled'})[value]||value;

  async function api(method='GET',body=null){
    const response=await fetch('/api/combat-escort'+(method==='GET'?'?_='+Date.now():''),
      {
        method,
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          ...(body?{'Content-Type':'application/json','X-Mongrels-Request':'mongrels-combat-escort'}:{}),
        },
        ...(body?{body:JSON.stringify(body)}:{}),
      }
    );
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.error||'escort_request_failed'),{status:response.status,data});
    return data;
  }

  function setFormStatus(message='',tone=''){
    formStatus.textContent=message;
    formStatus.dataset.tone=tone;
  }

  function renderDiscord(){
    if(!discordState)return;
    if(state.discord?.configured){
      discordState.dataset.tone='ok';
      discordTitle.textContent='Escort Discord integration ready';
      discordCopy.textContent='New requests and responder changes will update the live Discord card.';
    }else{
      discordState.dataset.tone='warning';
      discordTitle.textContent='Website board active';
      discordCopy.textContent='Discord delivery is not configured yet; website requests will still save normally.';
    }
  }

  function actionButton(label,action,extra=''){
    return '<button class="btn '+extra+'" type="button" data-escort-action="'+action+'">'+label+'</button>';
  }

  function renderCard(item){
    const responders=item.responses||{available:[],onMyWay:[],total:0,current:''};
    const responderHtml=[
      ...responders.onMyWay.map(name=>'<span class="escort-response-chip on-my-way">🚀 '+esc(name)+'</span>'),
      ...responders.available.map(name=>'<span class="escort-response-chip">🛡️ '+esc(name)+'</span>'),
    ].join('')||'<span class="escort-response-chip">No escorts checked in yet</span>';

    let actions='';
    if(item.status==='open'){
      if(!item.isMine){
        actions+=actionButton('🛡️ I Can Help','available',responders.current==='available'?'btn-primary':'btn-ghost');
        actions+=actionButton('🚀 On My Way','on_my_way',responders.current==='on_my_way'?'btn-primary':'btn-ghost');
        if(responders.current)actions+=actionButton('↩️ Stand Down','withdraw','btn-ghost');
      }
      if(item.canManage){
        actions+=actionButton('✓ Complete','complete','btn-secondary');
        actions+=actionButton('Cancel','cancel','btn-ghost');
      }
    }

    return '<article class="escort-card" id="request-'+esc(item.id)+'" data-request-id="'+esc(item.id)+'" data-status="'+esc(item.status)+'" data-urgency="'+esc(item.urgency)+'">'+
      '<div class="escort-card-head"><div><span class="escort-requester">Requested by '+esc(item.ownerName)+'</span><h3>'+esc(item.title)+'</h3></div>'+
      '<div class="escort-card-meta"><span class="escort-badge status-'+esc(item.status)+'">'+esc(statusLabel(item.status))+'</span><span class="escort-badge urgency-'+esc(item.urgency)+'">'+esc(urgencyLabel(item.urgency))+'</span></div></div>'+
      '<div class="escort-detail-grid">'+
        '<div class="escort-detail"><span>System</span><strong>'+esc(item.system)+'</strong></div>'+
        '<div class="escort-detail"><span>Timing</span><strong>'+esc(item.timing)+'</strong></div>'+
        '<div class="escort-detail"><span>Destination / Area</span><strong>'+esc(item.destination||'—')+'</strong></div>'+
      '</div>'+
      '<p class="escort-objective"><strong>Objective:</strong> '+esc(item.objective)+'</p>'+
      (item.notes?'<p class="escort-notes">'+esc(item.notes)+'</p>':'')+
      '<div class="escort-responders"><strong>Escort Response</strong><div class="escort-response-row">'+responderHtml+'</div></div>'+
      (actions?'<div class="escort-card-actions">'+actions+'<span class="escort-card-status" data-escort-card-status></span></div>':'')+
    '</article>';
  }

  function render(){
    const items=state.filter==='open'?state.items.filter(item=>item.status==='open'):state.items;
    board.innerHTML=items.map(renderCard).join('');
    empty.hidden=items.length>0;
    board.querySelectorAll('[data-escort-action]').forEach(button=>button.addEventListener('click',onAction));
  }

  async function onAction(event){
    const button=event.currentTarget;
    const card=button.closest('[data-request-id]');
    const id=card?.dataset.requestId;
    const action=button.dataset.escortAction;
    const cardStatus=card?.querySelector('[data-escort-card-status]');
    if(!id||!action)return;

    if((action==='complete'||action==='cancel')&&!confirm(action==='complete'?'Mark this escort request complete?':'Cancel this escort request?'))return;
    card.querySelectorAll('button').forEach(btn=>btn.disabled=true);
    if(cardStatus)cardStatus.textContent='Updating…';
    try{
      const body={id};
      if(['available','on_my_way','withdraw'].includes(action)){body.action='respond';body.state=action;}
      else body.action=action;
      const data=await api('PUT',body);
      const index=state.items.findIndex(item=>item.id===id);
      if(index>=0)state.items[index]=data.item;
      render();
    }catch(error){
      if(cardStatus)cardStatus.textContent=messageFor(error);
      card.querySelectorAll('button').forEach(btn=>btn.disabled=false);
    }
  }

  function messageFor(error){
    const code=error?.data?.error||error?.message||'';
    const map={
      system_required:'System is required.',
      objective_required:'Objective is required.',
      requester_cannot_respond:'You created this request, so you do not need to volunteer as your own escort.',
      escort_request_closed:'That request is already closed.',
      escort_request_manage_required:'Only the requester or leadership can close this request.',
      request_validation_failed:'Secure request validation failed. Reload the page and try again.',
    };
    return map[code]||'Could not update the escort request.';
  }

  async function createRequest(event){
    event.preventDefault();
    const fd=new FormData(form);
    const payload={
      title:fd.get('title'),
      system:fd.get('system'),
      destination:fd.get('destination'),
      timing:fd.get('timing'),
      urgency:fd.get('urgency'),
      objective:fd.get('objective'),
      notes:fd.get('notes'),
    };
    submit.disabled=true;
    setFormStatus('Posting escort request…');
    try{
      const data=await api('POST',payload);
      state.items=[data.item,...state.items.filter(item=>item.id!==data.item.id)];
      form.reset();
      form.elements.timing.value='As soon as available';
      form.elements.urgency.value='routine';
      state.filter='open';
      filters.forEach(filter=>filter.classList.toggle('is-active',filter.dataset.escortFilter==='open'));
      render();
      const launcherWarning=data.discord?.launcher?.pinWarning||data.discord?.launcher?.error||'';
      if(data.discord?.ok===false){
        setFormStatus('Request posted. Discord delivery needs attention, but the website request is live.','error');
      }else if(launcherWarning){
        setFormStatus('Escort request posted. '+launcherWarning,'error');
      }else{
        setFormStatus('Escort request posted.','ok');
      }
    }catch(error){
      setFormStatus(messageFor(error),'error');
    }finally{
      submit.disabled=false;
    }
  }

  async function load(){
    try{
      const data=await api();
      state.items=Array.isArray(data.items)?data.items:[];
      state.viewer=data.viewer||null;
      state.discord=data.discord||{};
      gate.hidden=true;
      app.hidden=false;
      renderDiscord();
      render();
      if(location.hash==='#request-form'){
        requestAnimationFrame(()=>{
          document.getElementById('request-form')?.scrollIntoView({behavior:'smooth',block:'start'});
          setTimeout(()=>form?.elements?.system?.focus({preventScroll:true}),250);
        });
      }
    }catch(error){
      if(error.status===401||error.status===403){
        gate.hidden=false;
        app.hidden=true;
        gateStatus.textContent=error.status===401?'Sign in with Discord to continue.':'This Discord account does not currently have member website access.';
      }else{
        gateStatus.textContent='Combat Escort Network is temporarily unavailable.';
      }
    }
  }

  form?.addEventListener('submit',createRequest);
  filters.forEach(filter=>filter.addEventListener('click',()=>{
    state.filter=filter.dataset.escortFilter||'open';
    filters.forEach(item=>item.classList.toggle('is-active',item===filter));
    render();
  }));

  load();
})();