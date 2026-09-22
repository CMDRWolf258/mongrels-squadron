(() => {
  const host=document.querySelector('[data-scout-jobs-board]');
  if(!host)return;
  const list=host.querySelector('[data-scout-jobs-list]');
  const search=host.querySelector('[data-scout-jobs-search]');
  const filter=host.querySelector('[data-scout-jobs-filter]');
  const status=host.querySelector('[data-scout-jobs-status]');
  const refresh=host.querySelector('[data-scout-jobs-refresh]');
  let payload=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtCredits=millions=>Math.round((Number(millions)||0)*1_000_000).toLocaleString()+' Cr';
  const fmtTime=value=>{
    if(!value)return'—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  };
  const age=value=>{
    const ms=Date.parse(value||'');
    if(!Number.isFinite(ms))return'Never';
    const mins=Math.max(0,Math.round((Date.now()-ms)/60000));
    if(mins<60)return mins+'m ago';
    const hours=Math.round(mins/60);
    if(hours<48)return hours+'h ago';
    return Math.round(hours/24)+'d ago';
  };
  const countdown=value=>{
    const ms=Date.parse(value||'')-Date.now();
    if(!Number.isFinite(ms)||ms<=0)return'ending now';
    const mins=Math.ceil(ms/60000);
    if(mins<60)return mins+'m remaining';
    const hours=Math.floor(mins/60),rest=mins%60;
    return hours+'h '+rest+'m remaining';
  };

  async function api(method='GET',body=null){
    const response=await fetch('/api/operations/scout-jobs'+(method==='GET'?'?_='+Date.now():'') ,{
      method,
      credentials:'same-origin',
      cache:'no-store',
      headers:{
        Accept:'application/json',
        ...(body?{'Content-Type':'application/json','X-Mongrels-Request':'scout-jobs'}:{}),
      },
      body:body?JSON.stringify(body):undefined,
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Scout Job request failed ('+response.status+')');
    return data;
  }

  function statusInfo(job){
    if(job.status==='fresh')return{label:'FRESH · REWARD AWARDED',cls:'fresh'};
    if(job.status==='fresh_unattributed')return{label:'FRESH DATA',cls:'fresh'};
    if(job.status==='claimed')return{label:job.claim?.mine?'CLAIMED BY YOU':'CLAIMED',cls:'claimed'};
    if(Number(job.reward?.bonusMillions)>0)return{label:'PRIORITY · AVAILABLE',cls:'priority'};
    return{label:'AVAILABLE',cls:''};
  }

  function filteredJobs(){
    const q=String(search?.value||'').trim().toLowerCase();
    const wanted=String(filter?.value||'open');
    return (payload?.jobs||[]).filter(job=>{
      if(q&&!String(job.system||'').toLowerCase().includes(q)&&!String(job.reward?.bonusReason||'').toLowerCase().includes(q))return false;
      if(wanted==='open')return ['available','claimed'].includes(job.status);
      if(wanted==='available')return job.status==='available';
      if(wanted==='priority')return Number(job.reward?.bonusMillions)>0&&!job.status.startsWith('fresh');
      if(wanted==='claimed')return job.status==='claimed';
      if(wanted==='fresh')return job.status.startsWith('fresh');
      return true;
    });
  }

  function render(){
    if(!payload||!list)return;
    const s=payload.summary||{};
    for(const [key,value] of Object.entries({available:s.available,claimed:s.claimed,fresh:s.fresh,priority:s.priority})){
      const el=host.querySelector('[data-scout-summary="'+key+'"]');
      if(el)el.textContent=Number(value||0).toLocaleString();
    }
    const defaultReward=host.querySelector('[data-scout-default-reward]');
    if(defaultReward)defaultReward.textContent=fmtCredits(payload.defaultRewardMillions||0);

    const binding=host.querySelector('[data-scout-binding-note]');
    if(binding){
      binding.hidden=payload.viewer?.scoutBound===true;
      binding.textContent='Your website account does not currently have a Live Scout token bound to it. You can still view the board, but Scout Job rewards cannot be attributed until leadership binds your token.';
    }

    const jobs=filteredJobs();
    if(!jobs.length){
      list.innerHTML='<div class="scout-job-empty"><strong>No Scout Jobs match this view.</strong><br>Fresh systems return to the available queue when their next tick-aware cycle begins.</div>';
      return;
    }

    list.innerHTML=jobs.map(job=>{
      const info=statusInfo(job);
      const total=Number(job.reward?.totalMillions)||0;
      const bonus=Number(job.reward?.bonusMillions)||0;
      const base=Number(job.reward?.baseMillions)||0;
      const claimed=job.claim;
      const runner=job.viewerObservation?.status==='runner_up';
      const note=[];
      if(bonus>0)note.push('<b>Priority bonus:</b> +'+esc(fmtCredits(bonus))+(job.reward?.bonusReason?' · '+esc(job.reward.bonusReason):'')+(job.reward?.bonusOnce?' · clears after this reward':''));
      if(claimed)note.push('<b>Reservation:</b> '+esc(claimed.commander)+' · '+esc(countdown(claimed.expiresAt)));
      if(runner)note.push('<b>RUNNER-UP:</b> Your valid board is queued behind the active claim. If that claim expires without completion, your earliest protected submission is promoted automatically.');
      if(job.winner)note.push('<b>Cycle winner:</b> '+esc(job.winner.commander)+' · '+esc(fmtCredits((Number(job.winner.amountCredits)||0)/1_000_000)));
      if(job.status==='fresh_unattributed')note.push('<b>Fresh board received, but reward attribution was unavailable.</b> Another reward is not opened just to duplicate data already collected this cycle.');

      const action=job.canRelease
        ? '<button type="button" class="btn btn-secondary btn-compact" data-scout-release="'+esc(job.system)+'">RELEASE CLAIM</button>'
        : job.status==='available'
          ? '<button type="button" class="btn btn-primary btn-compact" data-scout-claim="'+esc(job.system)+'" '+(job.canClaim?'':'disabled')+'>CLAIM 60 MIN</button>'
          : '';

      return '<article class="scout-job-card '+(bonus>0?'is-priority ':'')+(job.status==='claimed'?'is-claimed ':'')+(job.status.startsWith('fresh')?'is-fresh ':'')+'">'
        +'<div class="scout-job-main"><strong>'+esc(job.system)+'</strong><span class="scout-job-status '+esc(info.cls)+'">'+esc(info.label)+'</span><small>Last Live Scout board: '+esc(job.latestScoutAt?fmtTime(job.latestScoutAt)+' · '+age(job.latestScoutAt):'Never')+'</small></div>'
        +'<div class="scout-job-meta"><span>REWARD</span><strong class="scout-job-reward">'+esc(fmtCredits(total))+'</strong><small>'+esc(fmtCredits(base))+' base'+(bonus>0?' + '+esc(fmtCredits(bonus))+' bonus':'')+'</small></div>'
        +'<div class="scout-job-meta"><span>SYSTEM TICK</span><strong>'+esc(job.cycle?.tickConfiguredTime||'19:00')+' CT</strong><small>Cycle boundary '+esc(fmtTime(job.cycle?.cycleEndsAt))+'</small></div>'
        +'<div class="scout-job-meta"><span>CYCLE</span><strong>'+esc(job.dataFresh?'CURRENT DATA':'NEEDS SCOUT')+'</strong><small>'+esc(countdown(job.cycle?.cycleEndsAt))+'</small></div>'
        +'<div class="scout-job-actions">'+action+'</div>'
        +(note.length?'<div class="scout-job-note '+(runner?'is-runner':'')+'">'+note.join('<br>')+'</div>':'')
        +'</article>';
    }).join('');
  }

  async function load(){
    if(refresh)refresh.disabled=true;
    if(status)status.textContent='Refreshing Scout Board…';
    try{
      payload=await api();
      render();
      if(status){
        const bound=payload.viewer?.scoutBound?'Live Scout reward identity linked':'Reward identity not linked';
        status.textContent='Updated '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+' · '+bound;
      }
    }catch(error){
      console.error('Could not load Scout Jobs',error);
      if(status)status.textContent='Scout Board unavailable · '+String(error.message||error);
      if(list)list.innerHTML='<div class="scout-job-empty"><strong>Scout Board unavailable.</strong><br>No claim or reward state was changed.</div>';
    }finally{
      if(refresh)refresh.disabled=false;
    }
  }

  async function mutate(action,system,button){
    if(button)button.disabled=true;
    if(status)status.textContent=action==='claim'?'Reserving '+system+'…':'Releasing '+system+'…';
    try{
      await api('POST',{action,system});
      await load();
    }catch(error){
      console.error('Scout Job action failed',error);
      const message={
        scout_job_claimed_by_another:'Another CMDR already holds this reservation.',
        scout_job_already_awarded:'This cycle already has a rewarded Scout.',
        scout_job_disabled:'Scouting rewards are disabled for this system.',
      }[error.message]||error.message;
      if(status)status.textContent='Scout Job not changed · '+message;
      if(button)button.disabled=false;
    }
  }

  list?.addEventListener('click',event=>{
    const claim=event.target.closest('[data-scout-claim]');
    if(claim){mutate('claim',claim.dataset.scoutClaim,claim);return;}
    const release=event.target.closest('[data-scout-release]');
    if(release){mutate('release',release.dataset.scoutRelease,release);}
  });
  search?.addEventListener('input',render);
  filter?.addEventListener('change',render);
  refresh?.addEventListener('click',load);
  load();
  window.setInterval(()=>{if(document.visibilityState==='visible')load();},60000);
})();
