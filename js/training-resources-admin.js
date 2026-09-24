(() => {
  const panel=document.querySelector('[data-training-discord-admin]');
  const title=document.querySelector('[data-training-discord-title]');
  const copy=document.querySelector('[data-training-discord-copy]');
  const sync=document.querySelector('[data-training-discord-sync]');
  if(!panel||!title||!copy||!sync)return;

  async function api(method='GET',body=null){
    const response=await fetch('/api/training-resources'+(method==='GET'?'?_='+Date.now():''),
      {
        method,
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          ...(body?{'Content-Type':'application/json','X-Mongrels-Request':'training-resources-admin'}:{}),
        },
        ...(body?{body:JSON.stringify(body)}:{}),
      }
    );
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.error||'training_resources_request_failed'),{status:response.status,data});
    return data;
  }

  function render(discord){
    panel.hidden=false;
    if(discord?.cardLinked){
      panel.dataset.tone='ok';
      title.textContent='Training Resources Discord card connected';
      copy.textContent=(discord.chatLinked
        ?'The persistent training-resources index is linked to the existing training-chat channel.'
        :'The persistent training-resources index is live. The training-chat shortcut will appear once that channel can be discovered.')
        +(discord.lastSyncedAt?' Last synced '+new Date(discord.lastSyncedAt).toLocaleString()+'.':'');
    }else if(discord?.configured){
      panel.dataset.tone='warning';
      title.textContent='Training Resources Discord card ready to publish';
      copy.textContent='Publish / Sync will maintain one persistent index message in training-resources and link the existing training-chat when found.';
    }else{
      panel.dataset.tone='warning';
      title.textContent='Training Resources Discord integration not configured';
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
      title.textContent='Training Resources Discord status unavailable';
      copy.textContent='Could not check the Discord integration right now.';
    }
  }

  async function syncDiscord(){
    sync.disabled=true;
    sync.textContent='Syncing Discord…';
    try{
      const data=await api('POST',{action:'sync_discord'});
      render(data.discord||{});
      if(data.sync?.ok){
        copy.textContent=(data.sync.chatChannelId
          ?'Discord index synchronized and linked to the existing training-chat channel.'
          :'Discord index synchronized. training-chat was not found, so that shortcut is omitted for now.');
      }
    }catch(error){
      panel.dataset.tone='warning';
      title.textContent='Training Resources Discord needs attention';
      copy.textContent=error?.data?.sync?.error||error?.data?.error||error?.message||'Discord sync failed.';
    }finally{
      sync.disabled=false;
      sync.textContent='Publish / Sync Discord Card';
    }
  }

  sync.addEventListener('click',syncDiscord);
  load();
})();