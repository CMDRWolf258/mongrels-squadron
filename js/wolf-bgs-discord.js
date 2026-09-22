(() => {
  const panel=document.querySelector('[data-discord-integration]');
  if(!panel)return;
  const button=panel.querySelector('[data-discord-test]');
  const status=panel.querySelector('[data-discord-status]');

  function setStatus(message,state=''){
    if(!status)return;
    status.textContent=message;
    status.classList.remove('success','error','working');
    if(state)status.classList.add(state);
  }

  async function api(method='GET'){
    const response=await fetch('/api/operations/discord-test'+(method==='GET'?'?_='+Date.now():''),{
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
      error.discordStatus=data.discordStatus;
      throw error;
    }
    return data;
  }

  async function load(){
    if(button)button.disabled=true;
    setStatus('Checking Discord webhook…','working');
    try{
      const data=await api('GET');
      if(data.configured){
        if(button)button.disabled=false;
        setStatus('Webhook secret detected · ready for a manual test.','success');
      }else{
        setStatus('DISCORD_OPERATIONS_WEBHOOK_URL is not configured in this deployment.','error');
      }
    }catch(error){
      if(error.status===401||error.status===403){
        setStatus('Site-admin session required to test Discord.','error');
      }else{
        setStatus('Could not verify Discord configuration.','error');
      }
    }
  }

  button?.addEventListener('click',async()=>{
    button.disabled=true;
    setStatus('Sending test alert to Discord…','working');
    try{
      const data=await api('POST');
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
      button.disabled=false;
    }
  });

  load();
})();
