(() => {
  const panel=document.querySelector('[data-discord-integration]');
  if(!panel)return;
  const testButton=panel.querySelector('[data-discord-test]');
  const syncOrdersButton=panel.querySelector('[data-discord-sync-orders]');
  const status=panel.querySelector('[data-discord-status]');

  function setStatus(message,state=''){
    if(!status)return;
    status.textContent=message;
    status.classList.remove('success','error','working');
    if(state)status.classList.add(state);
  }

  function setButtons(disabled){
    if(testButton)testButton.disabled=disabled;
    if(syncOrdersButton)syncOrdersButton.disabled=disabled;
  }

  async function api(path,method='GET'){
    const response=await fetch(path+(method==='GET'?'?_='+Date.now():''),{
      method,
      credentials:'same-origin',
      cache:'no-store',
      headers:{
        Accept:'application/json',
        ...(method==='POST'?{'Content-Type':'application/json','X-Mongrels-Request':'wolf-bgs-control'}:{}),
      },
      ...(method==='POST'?{body:'{}'}:{}),
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data.error||'discord_request_failed');
      error.status=response.status;
      error.discordStatus=data.discordStatus||data.discord?.discordStatus;
      error.discord=data.discord||null;
      throw error;
    }
    return data;
  }

  async function load(){
    setButtons(true);
    setStatus('Checking Discord webhook…','working');
    try{
      const data=await api('/api/operations/discord-test','GET');
      if(data.configured){
        setButtons(false);
        setStatus('Webhook secret detected · Daily Orders automation is ready.','success');
      }else{
        setStatus('DISCORD_OPERATIONS_WEBHOOK_URL is not configured in this deployment.','error');
      }
    }catch(error){
      if(error.status===401||error.status===403){
        setStatus('Site-admin session required to manage Discord.','error');
      }else{
        setStatus('Could not verify Discord configuration.','error');
      }
    }
  }

  testButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Sending test alert to Discord…','working');
    try{
      const data=await api('/api/operations/discord-test','POST');
      const time=data.sentAt?new Date(data.sentAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'now';
      setStatus('Test alert sent successfully · '+time,'success');
    }catch(error){
      const messages={
        discord_webhook_not_configured:'Webhook secret is missing or invalid in Cloudflare.',
        discord_webhook_request_failed:'Discord rejected the webhook request'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Discord test failed · '+String(error.message||error),'error');
    }finally{
      setButtons(false);
    }
  });

  syncOrdersButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Syncing current Daily Orders to Discord…','working');
    try{
      const data=await api('/api/operations/discord-daily-orders','POST');
      const mode=data.discord?.mode||'updated';
      const label={
        created:'posted as a new announcement',
        edited:'updated in place',
        recreated:'recreated after the previous Discord message was unavailable',
      }[mode]||'synced';
      setStatus('Current Daily Orders '+label+'.','success');
    }catch(error){
      const messages={
        no_daily_orders_published:'There are no current Daily Orders to sync.',
        discord_webhook_not_configured:'Webhook secret is missing or invalid in Cloudflare.',
        discord_webhook_request_failed:'Discord rejected the Daily Orders sync'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        discord_daily_orders_sync_failed:'Daily Orders are still live in Mission Control, but Discord sync failed.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Daily Orders Discord sync failed · '+String(error.message||error),'error');
    }finally{
      setButtons(false);
    }
  });

  load();
})();
