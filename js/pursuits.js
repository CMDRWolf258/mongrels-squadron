(() => {
  const gate=document.querySelector('[data-pursuits-gate]');
  const gateStatus=document.querySelector('[data-pursuits-gate-status]');
  const app=document.querySelector('[data-pursuits-app]');
  const form=document.querySelector('[data-pursuits-form]');
  const groupsRoot=document.querySelector('[data-pursuits-groups]');
  const count=document.querySelector('[data-pursuits-selected-count]');
  const saveStatus=document.querySelector('[data-pursuits-save-status]');
  const saveButton=document.querySelector('[data-pursuits-save]');
  const clearButton=document.querySelector('[data-pursuits-clear]');
  const discordBox=document.querySelector('[data-pursuits-status]');
  const discordTitle=document.querySelector('[data-pursuits-discord-title]');
  const discordCopy=document.querySelector('[data-pursuits-discord-copy]');
  const discordSync=document.querySelector('[data-pursuits-discord-sync]');

  let state={pursuits:[],selected:[],canManage:false,discord:{}};
  let initialSelection='';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  async function api(method='GET',body=null){
    const url='/api/pursuits'+(method==='GET'?'?_='+Date.now():'');
    const response=await fetch(url,{
      method,
      credentials:'same-origin',
      cache:'no-store',
      headers:{
        Accept:'application/json',
        ...(body?{'Content-Type':'application/json','X-Mongrels-Request':'mongrels-pursuits'}:{}),
      },
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.error||'pursuits_request_failed'),{status:response.status,data});
    return data;
  }

  function selection(){
    return [...document.querySelectorAll('[data-pursuit-id]:checked')].map(input=>input.value);
  }

  function selectionSignature(values){
    return [...values].sort().join('|');
  }

  function updateCount(){
    const selected=selection();
    if(count)count.textContent=selected.length+' selected';
    if(saveButton)saveButton.disabled=selectionSignature(selected)===initialSelection;
  }

  function render(){
    const groups=[...new Set(state.pursuits.map(item=>item.group))];
    groupsRoot.innerHTML=groups.map(group=>{
      const items=state.pursuits.filter(item=>item.group===group);
      const cards=items.map(item=>
        '<label class="pursuit-card">'+
          '<input type="checkbox" data-pursuit-id value="'+esc(item.id)+'" '+(state.selected.includes(item.id)?'checked':'')+'>'+
          '<span class="pursuit-icon" aria-hidden="true">'+esc(item.emoji)+'</span>'+
          '<span class="pursuit-copy"><strong>'+esc(item.label)+'</strong><span>'+esc(item.description)+'</span></span>'+
          '<span class="pursuit-check" aria-hidden="true"></span>'+
        '</label>'
      ).join('');
      return '<section class="pursuit-group"><div class="pursuit-group-head"><h3>'+esc(group)+'</h3><span>'+items.length+' activities</span></div><div class="pursuit-grid">'+cards+'</div></section>';
    }).join('');
    document.querySelectorAll('[data-pursuit-id]').forEach(input=>input.addEventListener('change',()=>{
      setSaveStatus('Unsaved changes');
      updateCount();
    }));
    initialSelection=selectionSignature(state.selected);
    updateCount();
    renderDiscord();
  }

  function renderDiscord(){
    const discord=state.discord||{};
    if(discordSync)discordSync.hidden=!state.canManage;
    if(!discordBox)return;
    if(discord.cardLinked&&discord.roleCount===state.pursuits.length){
      discordBox.dataset.tone='ok';
      discordTitle.textContent='🐺〡mongrel-pursuits connected';
      discordCopy.textContent='Discord card and '+discord.roleCount+' Pursuit roles are initialized.';
    }else if(discord.configured){
      discordBox.dataset.tone='warning';
      discordTitle.textContent='Discord Pursuits ready to initialize';
      discordCopy.textContent=state.canManage
        ?'Publish / Sync will create any missing Pursuit roles and maintain one persistent selector card in 🐺〡mongrel-pursuits.'
        :'Your website pursuits will save normally. Discord role synchronization will begin once leadership initializes the Pursuits card.';
    }else{
      discordBox.dataset.tone='warning';
      discordTitle.textContent='Discord sync not configured';
      discordCopy.textContent='Website Pursuits are available, but the Discord bot or guild configuration is not currently available.';
    }
    if(state.canManage&&discord.lastError){
      discordBox.dataset.tone='warning';
      discordCopy.textContent='Last Discord sync issue: '+discord.lastError;
    }
  }

  function setSaveStatus(message,tone=''){
    if(!saveStatus)return;
    saveStatus.textContent=message||'';
    saveStatus.dataset.tone=tone;
  }

  async function save(event){
    event.preventDefault();
    const pursuits=selection();
    saveButton.disabled=true;
    clearButton.disabled=true;
    setSaveStatus('Saving your pursuits…');
    try{
      const data=await api('POST',{action:'save',pursuits});
      state.selected=Array.isArray(data.selected)?data.selected:pursuits;
      initialSelection=selectionSignature(state.selected);
      updateCount();
      if(data.roleSync?.ok){
        setSaveStatus('Saved to the website and Discord.','ok');
      }else if(data.roleSync?.attempted){
        setSaveStatus('Saved. Discord role sync needs attention, but your website selection is correct.','error');
      }else{
        setSaveStatus('Saved. Discord roles will sync after leadership initializes the Pursuits card.','ok');
      }
    }catch(error){
      setSaveStatus(messageFor(error),'error');
      updateCount();
    }finally{
      clearButton.disabled=false;
    }
  }

  async function syncDiscord(){
    if(!state.canManage)return;
    discordSync.disabled=true;
    discordSync.textContent='Syncing Discord…';
    try{
      const data=await api('POST',{action:'sync_discord'});
      if(!data.ok)throw Object.assign(new Error(data.discord?.error||'discord_sync_failed'),{data});
      const fresh=await api();
      state.discord=fresh.discord||{};
      renderDiscord();
      setSaveStatus('Discord Pursuits card and roles synchronized.','ok');
    }catch(error){
      const message=error?.data?.discord?.error||error?.data?.error||error?.message||'Discord sync failed.';
      discordBox.dataset.tone='warning';
      discordTitle.textContent='Discord Pursuits needs attention';
      discordCopy.textContent=message;
    }finally{
      discordSync.disabled=false;
      discordSync.textContent='Publish / Sync Discord Card';
    }
  }

  function messageFor(error){
    const code=error?.data?.error||error?.message||'';
    const map={
      pursuits_storage_not_configured:'Pursuits storage is not configured.',
      request_validation_failed:'The secure request check failed. Reload the page and try again.',
      member_access_required:'Mongrel Pursuits are available to recognized squadron members.',
    };
    return map[code]||'Could not save your pursuits. Please try again.';
  }

  async function load(){
    try{
      const data=await api();
      state.pursuits=Array.isArray(data.pursuits)?data.pursuits:[];
      state.selected=Array.isArray(data.selected)?data.selected:[];
      state.canManage=Boolean(data.canManage);
      state.discord=data.discord||{};
      gate.hidden=true;
      app.hidden=false;
      render();
    }catch(error){
      if(error.status===401||error.status===403){
        gate.hidden=false;
        app.hidden=true;
        if(gateStatus)gateStatus.textContent=error.status===401?'Sign in with Discord to continue.':'This Discord account does not currently have member website access.';
      }else if(gateStatus){
        gateStatus.textContent='Mongrel Pursuits are temporarily unavailable.';
      }
    }
  }

  form?.addEventListener('submit',save);
  clearButton?.addEventListener('click',()=>{
    document.querySelectorAll('[data-pursuit-id]').forEach(input=>{input.checked=false;});
    setSaveStatus('Unsaved changes');
    updateCount();
  });
  discordSync?.addEventListener('click',syncDiscord);
  load();
})();