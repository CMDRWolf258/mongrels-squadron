(() => {
  const panel=document.querySelector('[data-squad-rules-discord-admin]');
  const title=document.querySelector('[data-squad-rules-discord-title]');
  const copy=document.querySelector('[data-squad-rules-discord-copy]');
  const sync=document.querySelector('[data-squad-rules-discord-sync]');
  if(!panel||!title||!copy||!sync)return;

  async function api(method='GET',body=null){
    const response=await fetch('/api/squad-rules'+(method==='GET'?'?_='+Date.now():''),
      {
        method,
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          ...(body?{'Content-Type':'application/json','X-Mongrels-Request':'squad-rules-admin'}:{}),
        },
        ...(body?{body:JSON.stringify(body)}:{}),
      }
    );
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.error||'squad_rules_request_failed'),{status:response.status,data});
    return data;
  }

  function render(discord){
    panel.hidden=false;
    if(discord?.cardLinked){
      panel.dataset.tone='ok';
      title.textContent='Squad Rules Discord card connected';
      copy.textContent='The Mongrels rules card is linked to 📕〡squad-rules.'
        +(discord.lastSyncedAt?' Last synced '+new Date(discord.lastSyncedAt).toLocaleString()+'.':'');
    }else if(discord?.configured){
      panel.dataset.tone='warning';
      title.textContent='Squad Rules Discord card ready to publish';
      copy.textContent='Publish / Sync will maintain one persistent Mongrels rules card in 📕〡squad-rules.';
    }else{
      panel.dataset.tone='warning';
      title.textContent='Squad Rules Discord integration not configured';
      copy.textContent='The existing Discord bot or guild configuration is unavailable.';
    }
    if(discord?.lastError){
      panel.dataset.tone='warning';
      copy.textContent='Last Discord sync issue: '+discord.lastError;
    }
  }

  async function load(){
    try{
      const data=await api();
      if(!data.canManage)return;
      render(data.discord||{});
    }catch(error){
      if(error.status===401||error.status===403)return;
      panel.hidden=false;
      panel.dataset.tone='warning';
      title.textContent='Squad Rules Discord status unavailable';
      copy.textContent='Could not check the Discord integration right now.';
    }
  }

  async function syncDiscord(){
    sync.disabled=true;
    sync.textContent='Syncing Discord…';
    try{
      const data=await api('POST',{action:'sync_discord'});
      render(data.discord||{});
      if(data.sync?.ok)copy.textContent='Squad Rules Discord card synchronized successfully.';
    }catch(error){
      panel.dataset.tone='warning';
      title.textContent='Squad Rules Discord needs attention';
      copy.textContent=error?.data?.sync?.error||error?.data?.error||error?.message||'Discord sync failed.';
    }finally{
      sync.disabled=false;
      sync.textContent='Publish / Sync Discord Card';
    }
  }

  sync.addEventListener('click',syncDiscord);
  load();
})();