(() => {
  const panel=document.querySelector('[data-discord-integration]');
  if(!panel)return;
  const testButton=panel.querySelector('[data-discord-test]');
  const syncOrdersButton=panel.querySelector('[data-discord-sync-orders]');
  const syncColonizationButton=panel.querySelector('[data-discord-sync-colonization]');
  const syncColonizationArchiveButton=panel.querySelector('[data-discord-sync-colonization-archive]');
  const syncScoutButton=panel.querySelector('[data-discord-sync-scout]');
  const syncBgsButton=panel.querySelector('[data-discord-sync-bgs]');
  const syncRewardsButton=panel.querySelector('[data-discord-sync-rewards]');
  const status=panel.querySelector('[data-discord-status]');
  let colonizationArchiveConfigured=false;
  let colonizationJobsConfigured=false;
  let factionAlertsConfigured=false;
  let missionControlConfigured=false;
  let scoutNetworkConfigured=false;
  let squadPayoutsConfigured=false;

  function setStatus(message,state=''){
    if(!status)return;
    status.textContent=message;
    status.classList.remove('success','error','working');
    if(state)status.classList.add(state);
  }

  function setButtons(disabled){
    if(testButton)testButton.disabled=disabled;
    if(syncOrdersButton)syncOrdersButton.disabled=disabled||!missionControlConfigured;
    if(syncColonizationButton)syncColonizationButton.disabled=disabled||!colonizationJobsConfigured;
    if(syncColonizationArchiveButton)syncColonizationArchiveButton.disabled=disabled||!colonizationArchiveConfigured;
    if(syncScoutButton)syncScoutButton.disabled=disabled||!scoutNetworkConfigured;
    if(syncBgsButton)syncBgsButton.disabled=disabled||!factionAlertsConfigured;
    if(syncRewardsButton)syncRewardsButton.disabled=disabled||!squadPayoutsConfigured;
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
        colonizationArchiveConfigured=Boolean(data.colonizationArchiveConfigured);
        colonizationJobsConfigured=Boolean(data.colonizationJobsConfigured);
        factionAlertsConfigured=Boolean(data.factionAlertsConfigured);
        missionControlConfigured=Boolean(data.missionControlConfigured);
        scoutNetworkConfigured=Boolean(data.scoutNetworkConfigured);
        squadPayoutsConfigured=Boolean(data.squadPayoutsConfigured);
        const cycle=data.scoutCycleRefreshServerConfigured
          ? ' · Scout cycle refresh token detected on server'
          : ' · scheduled Scout cycle refresh token not configured yet';
        const colonization=colonizationJobsConfigured
          ? ' · Colonization Jobs webhook ready'
          : ' · Colonization Jobs webhook not configured';
        const archive=colonizationArchiveConfigured
          ? ' · Colonization Archive webhook ready'
          : ' · Colonization Archive webhook not configured';
        const mission=missionControlConfigured
          ? ' · Mission Control webhook ready'
          : ' · Mission Control webhook not configured';
        const faction=factionAlertsConfigured
          ? ' · Faction Alerts webhook ready'
          : ' · Faction Alerts webhook not configured';
        const scout=scoutNetworkConfigured
          ? ' · Scout Network webhook ready'
          : ' · Scout Network webhook not configured';
        const payouts=squadPayoutsConfigured
          ? ' · Squad Payouts webhook ready'
          : ' · Squad Payouts webhook not configured';
        setButtons(false);
        setStatus('System Testing webhook detected'+mission+colonization+archive+faction+scout+payouts+cycle+'.',
          data.scoutCycleRefreshServerConfigured&&missionControlConfigured&&colonizationJobsConfigured&&colonizationArchiveConfigured&&factionAlertsConfigured&&scoutNetworkConfigured&&squadPayoutsConfigured?'success':'');
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
    setStatus('Sending System Testing alert to Discord…','working');
    try{
      const data=await api('/api/operations/discord-test','POST');
      const time=data.sentAt?new Date(data.sentAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'now';
      setStatus('System Testing alert sent successfully · '+time,'success');
    }catch(error){
      const messages={
        discord_webhook_not_configured:'System Testing webhook secret is missing or invalid in Cloudflare.',
        discord_webhook_request_failed:'Discord rejected the webhook request'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Discord test failed · '+String(error.message||error),'error');
    }finally{
      setButtons(false);
    }
  });

  syncColonizationArchiveButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Syncing completed Colonization Jobs to the archive channel…','working');
    try{
      const data=await api('/api/operations/discord-colonization-archive','POST');
      const summary=data.discord||{};
      const parts=[
        Number(summary.completedJobs||0)+' completed job'+(Number(summary.completedJobs||0)===1?'':'s')+' checked',
      ];
      if(Number(summary.archived)>0)parts.push(Number(summary.archived)+' newly archived');
      if(Number(summary.updated)>0)parts.push(Number(summary.updated)+' archive link'+(Number(summary.updated)===1?'':'s')+' updated');
      if(Number(summary.alreadyArchived)>0)parts.push(Number(summary.alreadyArchived)+' already archived');
      if(Number(summary.failed)>0)parts.push(Number(summary.failed)+' failed');
      setStatus('Colonization Archive synced · '+parts.join(' · ')+'.',Number(summary.failed)>0?'error':'success');
    }catch(error){
      const messages={
        discord_colonization_archive_webhook_not_configured:'Colonization Archive webhook secret is not configured in Cloudflare.',
        discord_colonization_archive_sync_failed:'Completed jobs remain in Mission Control history, but the Discord archive sync failed.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Colonization Archive Discord sync failed · '+String(error.message||error),'error');
    }finally{
      setButtons(false);
      try{
        const state=await api('/api/operations/discord-test','GET');
        colonizationArchiveConfigured=Boolean(state.colonizationArchiveConfigured);
        colonizationJobsConfigured=Boolean(state.colonizationJobsConfigured);
        factionAlertsConfigured=Boolean(state.factionAlertsConfigured);
        missionControlConfigured=Boolean(state.missionControlConfigured);
        scoutNetworkConfigured=Boolean(state.scoutNetworkConfigured);
        squadPayoutsConfigured=Boolean(state.squadPayoutsConfigured);
        setButtons(false);
      }catch{}
    }
  });

  syncColonizationButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Syncing Colonization Jobs channel…','working');
    try{
      const data=await api('/api/operations/discord-colonization-jobs','POST');
      const summary=data.discord||{};
      const parts=[];
      if(Number(summary.created)>0)parts.push(Number(summary.created)+' posted');
      if(Number(summary.edited)>0)parts.push(Number(summary.edited)+' updated');
      if(Number(summary.deleted)>0)parts.push(Number(summary.deleted)+' completed/removed card'+(Number(summary.deleted)===1?'':'s')+' cleaned up');
      if(Number(summary.unchanged)>0)parts.push(Number(summary.unchanged)+' unchanged');
      if(summary.summary?.mode==='created'||summary.summary?.mode==='recreated')parts.push('Colonization summary posted');
      else if(summary.summary?.mode==='edited')parts.push('Colonization summary updated');
      if(Number(summary.failed)>0)parts.push(Number(summary.failed)+' failed');
      setStatus('Colonization Jobs channel synced'+(parts.length?' · '+parts.join(' · '):' · no current jobs')+'.',Number(summary.failed)>0?'error':'success');
    }catch(error){
      const messages={
        discord_colonization_jobs_webhook_not_configured:'Colonization Jobs webhook secret is not configured in Cloudflare.',
        discord_colonization_jobs_webhook_request_failed:'Discord rejected the Colonization Jobs webhook request'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        discord_colonization_sync_failed:'Colonization Jobs remain unchanged on the site, but Discord sync failed.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Colonization Jobs Discord sync failed · '+String(error.message||error),'error');
    }finally{
      setButtons(false);
    }
  });

  syncRewardsButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Syncing Squad Payouts to Discord…','working');
    try{
      const data=await api('/api/operations/discord-rewards','POST');
      const summary=data.discord||{};
      const parts=[
        Number(summary.outstandingMembers||0)+' CMDR'+(Number(summary.outstandingMembers||0)===1?'':'s')+' owed',
        Number(summary.activeRequests||0)+' payout request'+(Number(summary.activeRequests||0)===1?'':'s'),
      ];
      if(Number(summary.created)>0)parts.push(Number(summary.created)+' request card'+(Number(summary.created)===1?'':'s')+' posted');
      if(Number(summary.edited)>0)parts.push(Number(summary.edited)+' updated');
      if(Number(summary.paidShown)>0)parts.push(Number(summary.paidShown)+' paid');
      if(Number(summary.cancelledShown)>0)parts.push(Number(summary.cancelledShown)+' cancelled');
      if(Number(summary.deleted)>0)parts.push(Number(summary.deleted)+' old card'+(Number(summary.deleted)===1?'':'s')+' cleaned up');
      if(summary.summary?.mode==='created'||summary.summary?.mode==='recreated')parts.push('summary posted');
      else if(summary.summary?.mode==='edited')parts.push('summary updated');
      if(Number(summary.failed)>0)parts.push(Number(summary.failed)+' failed');
      setStatus('Squad Payouts synced · '+parts.join(' · ')+'.',Number(summary.failed)>0?'error':'success');
    }catch(error){
      const messages={
        discord_squad_payouts_webhook_not_configured:'Squad Payouts webhook secret is not configured in Cloudflare.',
        discord_squad_payouts_webhook_request_failed:'Discord rejected the Squad Payouts webhook request'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        discord_squad_payouts_sync_failed:'Reward ledger remains unchanged on the site, but Squad Payouts Discord sync failed.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Squad Payouts Discord sync failed · '+String(error.message||error),'error');
    }finally{setButtons(false);}
  });

  syncBgsButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Syncing Faction Alerts & Opportunities to Discord…','working');
    try{
      const data=await api('/api/operations/discord-bgs-alerts','POST');
      const summary=data.discord||{};
      const parts=[
        Number(summary.actionCount||0)+' action alert'+(Number(summary.actionCount||0)===1?'':'s'),
        Number(summary.opportunityCount||0)+' opportunity system'+(Number(summary.opportunityCount||0)===1?'':'s'),
      ];
      if(Number(summary.created)>0)parts.push(Number(summary.created)+' card'+(Number(summary.created)===1?'':'s')+' posted');
      if(Number(summary.edited)>0)parts.push(Number(summary.edited)+' updated');
      if(Number(summary.resolvedShown)>0)parts.push(Number(summary.resolvedShown)+' resolved');
      if(Number(summary.deleted)>0)parts.push(Number(summary.deleted)+' cleaned up');
      if(summary.summary?.mode==='created'||summary.summary?.mode==='recreated')parts.push('summary posted');
      else if(summary.summary?.mode==='edited')parts.push('summary updated');
      if(Number(summary.failed)>0)parts.push(Number(summary.failed)+' failed');
      setStatus('Faction Alerts synced · '+parts.join(' · ')+'.',Number(summary.failed)>0?'error':'success');
    }catch(error){
      const messages={
        discord_faction_alerts_webhook_not_configured:'Faction Alerts webhook secret is not configured in Cloudflare.',
        discord_faction_alerts_sync_failed:'Faction state remains unchanged on the site, but Discord sync failed.',
        discord_faction_alerts_webhook_request_failed:'Discord rejected the Faction Alerts webhook request'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Faction Alerts Discord sync failed · '+String(error.message||error),'error');
    }finally{setButtons(false);}
  });

  syncScoutButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Syncing Scout Network to Discord…','working');
    try{
      const data=await api('/api/operations/discord-scout-jobs','POST');
      const summary=data.discord||{};
      const parts=[];
      if(Number(summary.displayedPriority)>0)parts.push(Number(summary.displayedPriority)+' priority');
      parts.push(Number(summary.displayedOrdinary||0)+' nearest needs scouting');
      if(Number(summary.created)>0)parts.push(Number(summary.created)+' priority card'+(Number(summary.created)===1?'':'s')+' posted');
      if(Number(summary.edited)>0)parts.push(Number(summary.edited)+' updated');
      if(Number(summary.completionShown)>0)parts.push(Number(summary.completionShown)+' completion'+(Number(summary.completionShown)===1?'':'s')+' shown');
      if(Number(summary.deleted)>0)parts.push(Number(summary.deleted)+' old card'+(Number(summary.deleted)===1?'':'s')+' cleaned up');
      if(summary.summary?.mode==='created'||summary.summary?.mode==='recreated')parts.push('Colonization summary posted');
      else if(summary.summary?.mode==='edited')parts.push('Colonization summary updated');
      if(Number(summary.failed)>0)parts.push(Number(summary.failed)+' failed');
      setStatus('Scout Network synced · '+parts.join(' · ')+'.',Number(summary.failed)>0?'error':'success');
    }catch(error){
      const messages={
        discord_scout_network_webhook_not_configured:'Scout Network webhook secret is not configured in Cloudflare.',
        discord_scout_network_webhook_request_failed:'Discord rejected the Scout Network webhook request'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        discord_scout_sync_failed:'Scout Board remains available on the site, but Scout Network Discord sync failed.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Scout Network Discord sync failed · '+String(error.message||error),'error');
    }finally{
      setButtons(false);
    }
  });

  syncOrdersButton?.addEventListener('click',async()=>{
    setButtons(true);
    setStatus('Syncing current Daily Orders to Mission Control…','working');
    try{
      const data=await api('/api/operations/discord-daily-orders','POST');
      const mode=data.discord?.mode||'updated';
      const label={
        created:'posted as a new announcement',
        edited:'updated in place',
        recreated:'recreated after the previous Discord message was unavailable',
      }[mode]||'synced';
      setStatus('Mission Control Daily Orders '+label+'.','success');
    }catch(error){
      const messages={
        no_daily_orders_published:'There are no current Daily Orders to sync.',
        discord_mission_control_webhook_not_configured:'Mission Control webhook secret is not configured in Cloudflare.',
        discord_mission_control_webhook_request_failed:'Discord rejected the Mission Control webhook request'+(error.discordStatus?' · HTTP '+error.discordStatus:'')+'.',
        discord_daily_orders_sync_failed:'Daily Orders remain published on the site, but Mission Control Discord sync failed.',
        request_validation_failed:'Request validation failed. Refresh Wolf BGS Control and try again.',
      };
      setStatus(messages[error.message]||'Mission Control Daily Orders sync failed · '+String(error.message||error),'error');
    }finally{
      setButtons(false);
    }
  });

  load();
})();
