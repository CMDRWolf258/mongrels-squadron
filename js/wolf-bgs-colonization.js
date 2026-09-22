(() => {
  const panel=document.querySelector('[data-colonization-jobs]');
  if(!panel)return;

  const API='/api/operations/colonization-jobs';
  const form=panel.querySelector('[data-colonization-form]');
  const list=panel.querySelector('[data-colonization-job-list]');
  const observed=panel.querySelector('[data-colonization-observed]');
  const message=panel.querySelector('[data-colonization-message]');
  const refresh=panel.querySelector('[data-colonization-refresh]');
  const scope=panel.querySelector('[data-colonization-field="scope"]');
  const marketFields=panel.querySelector('[data-colonization-market-fields]');
  let loading=false;
  let loadedAt=0;
  let jobsCache=[];
  const FRESH_MS=5000;

  const number=value=>Number(value)||0;
  const fmt=value=>Math.round(number(value)).toLocaleString();
  const money=value=>`${Math.round(number(value)*10)/10}M Cr`;
  const jobName=job=>job?.title||job?.buildName||job?.system||'Colonization Job';
  const date=value=>{
    if(!value)return'—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleString();
  };

  function setMessage(text,state=''){
    if(!message)return;
    message.textContent=text;
    message.className=`wolf-status-message ${state}`.trim();
  }

  function discordMutationNote(discord){
    if(!discord)return'';
    const labels={
      created:' Discord announcement posted.',
      edited:' Discord announcement updated.',
      recreated:' Discord announcement recreated.',
      unchanged:' Discord announcement already current.',
      removed:' Discord announcement marked removed.',
    };
    if(labels[discord.mode])return labels[discord.mode];
    if(discord.configured===false)return' Discord webhook is not configured.';
    if(discord.attempted&&discord.ok===false)return' Job change saved, but Discord sync failed.';
    return'';
  }

  function setText(selector,value){
    const el=panel.querySelector(selector);
    if(el)el.textContent=String(value);
  }

  function updateScope(){
    if(marketFields)marketFields.hidden=scope?.value!=='market';
  }

  function payloadFromForm(){
    const get=name=>form.querySelector(`[data-colonization-field="${name}"]`)?.value?.trim()||'';
    return {
      title:get('title'),
      system:get('system'),
      scope:get('scope')||'system',
      buildName:get('buildName'),
      marketId:get('marketId'),
      commodity:get('commodity'),
      targetTons:get('targetTons'),
      rewardBlockTons:get('rewardBlockTons'),
      rewardBlockMillions:get('rewardBlockMillions'),
      personalCapMillions:get('personalCapMillions'),
      notes:get('notes'),
    };
  }

  async function mutate(body){
    const response=await fetch(API,{
      method:'PUT',
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-colonization-jobs'},
      body:JSON.stringify(body),
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
    window.dispatchEvent(new CustomEvent('wolf-bgs-colonization-history-updated'));
    return data;
  }

  function badge(text,kind=''){
    const el=document.createElement('span');
    el.className=`wolf-colonization-chip ${kind}`.trim();
    el.textContent=text;
    return el;
  }

  function renderJob(job){
    const card=document.createElement('article');
    card.className='wolf-colonization-job';
    card.dataset.jobId=job.id||'';

    const head=document.createElement('div');
    head.className='wolf-colonization-job-head';
    const title=document.createElement('div');
    const eyebrow=document.createElement('span');
    eyebrow.textContent=job.scope==='market'?'SPECIFIC BUILD':'SYSTEM HAUL';
    const strong=document.createElement('strong');
    strong.textContent=job.title||job.buildName||job.system||'Colonization Job';
    const small=document.createElement('small');
    const scopeText=job.scope==='market'
      ? (job.marketId
          ? `${job.system} · ${job.buildName||'Specific construction build'}`
          : `${job.system} · waiting for construction site discovery`)
      : `${job.system} · any construction depot`;
    small.textContent=scopeText+(job.commodity?` · ${job.commodity} only`:'');
    title.append(eyebrow,strong,small);

    const chips=document.createElement('div');
    chips.className='wolf-colonization-job-chips';
    chips.append(
      badge(String(job.status||'active').toUpperCase(),`is-${job.status||'active'}`),
      badge('REV '+Number(job.revision||1)),
      ...(job.scope==='market'&&!job.marketId?[badge('AWAITING SITE','is-awaiting')]:[]),
      ...(job.arbitrationBlocked?[badge('ARBITRATION BLOCKED','is-conflict')]:[]),
      ...(number(job.suppressedEvents)>0?[badge('OVERLAP ROUTED','is-routed')]:[]),
      badge(`${fmt(job.contributorCount)} CMDR${number(job.contributorCount)===1?'':'s'}`),
    );
    head.append(title,chips);

    const target=Math.max(0,number(job.targetTons));
    const tons=number(job.squadTons);
    const openEnded=target<=0;
    const pct=openEnded?0:Math.max(0,Math.min(100,(tons/target)*100));
    const progress=document.createElement('div');
    progress.className='wolf-colonization-progress';
    progress.innerHTML=openEnded
      ? `<div><strong>${fmt(tons)} t hauled</strong><span>OPEN-ENDED</span></div>`
      : `<div><strong>${fmt(tons)} / ${fmt(target)} t</strong><span>${pct.toFixed(1)}%</span></div><div class="wolf-colonization-track"><i style="width:${pct}%"></i></div>`;

    const reward=document.createElement('div');
    reward.className='wolf-colonization-reward-line';
    reward.innerHTML=`<span>Reward preview</span><strong>${money(job.rewardBlockMillions)} / ${fmt(job.rewardBlockTons)} t block</strong><small>${job.personalCapMillions===null||job.personalCapMillions===undefined?'No personal cap set':`Personal cap ${money(job.personalCapMillions)}`} · preview only</small>`;

    const members=document.createElement('div');
    members.className='wolf-colonization-members';
    const rows=Array.isArray(job.members)?job.members:[];
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='wolf-colonization-empty';
      empty.textContent='No verified colonization contributions matched this job yet.';
      members.append(empty);
    }else{
      rows.forEach(member=>{
        const row=document.createElement('div');
        row.className='wolf-colonization-member';
        const main=document.createElement('div');
        const name=document.createElement('strong');name.textContent=member.commander||'Elite CMDR';
        const detail=document.createElement('small');
        const detailParts=[
          `${fmt(member.tons)} t payable after arbitration`,
          `${fmt(member.completeBlocks)} complete reward block${number(member.completeBlocks)===1?'':'s'}`,
          `${fmt(member.tonsToNextBlock)} t to next block`,
        ];
        if(number(member.ambiguousEventCount)>0)detailParts.push(`${fmt(member.ambiguousPotentialTons)} t blocked by ambiguous overlap`);
        if(number(member.suppressedEventCount)>0)detailParts.push(`${fmt(member.suppressedTons)} t routed to a more specific job`);
        detail.textContent=detailParts.join(' · ');
        main.append(name,detail);
        const amount=document.createElement('b');
        amount.textContent=money(member.rewardPreviewMillions);
        amount.title='Preview only — no reward debt created';
        row.append(main,amount);
        members.append(row);
      });
    }

    const meta=document.createElement('div');
    meta.className='wolf-colonization-meta';
    const metaParts=[
      `Started ${date(job.startsAt)}`,
      job.endsAt?`ended ${date(job.endsAt)}`:'',
      job.squadEvents?`${fmt(job.squadEvents)} payable contribution event${number(job.squadEvents)===1?'':'s'}`:'',
      job.ambiguousEvents?`${fmt(job.ambiguousEvents)} ambiguous event${number(job.ambiguousEvents)===1?'':'s'} blocked`:'',
      job.suppressedEvents?`${fmt(job.suppressedEvents)} overlap match${number(job.suppressedEvents)===1?' was':'es were'} routed elsewhere`:'',
    ].filter(Boolean);
    meta.textContent=metaParts.join(' · ');

    const actions=document.createElement('div');
    actions.className='wolf-colonization-actions';
    if(job.status==='active'&&job.scope==='market'&&job.marketId){
      actions.append(actionButton('Change Site','change-site',''));
    }
    if(job.status==='active'){
      actions.append(actionButton('Complete','complete','completed'));
    }else if(job.status==='paused'){
      actions.append(actionButton('Complete','complete','completed'));
    }
    actions.append(actionButton('Delete','delete','delete','danger'));

    card.append(head,progress,reward,members,meta,actions);
    return card;

    function actionButton(label,action,status,kind=''){
      const button=document.createElement('button');
      button.type='button';
      button.className=`btn btn-compact ${kind==='danger'?'wolf-colonization-delete':'btn-secondary'}`.trim();
      button.dataset.colonizationAction=action;
      button.dataset.colonizationStatus=status;
      button.textContent=label;
      return button;
    }
  }

  function renderObserved(rows){
    observed.replaceChildren();
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='wolf-colonization-empty';
      empty.textContent='No construction sites have been discovered yet. Dock at a construction depot, Sync Activity, then refresh this panel.';
      observed.append(empty);
      return;
    }
    rows.forEach(site=>{
      const row=document.createElement('div');
      row.className='wolf-colonization-observed-row';
      const selectedSystem=String(site.system||'').trim().toLowerCase();
      const selectedMarketId=String(site.marketId||'');
      const sameSystemJobs=jobsCache.filter(job=>
        job.status==='active'
        && job.scope==='market'
        && String(job.system||'').trim().toLowerCase()===selectedSystem
      );
      const pendingJobs=sameSystemJobs.filter(job=>!job.marketId);
      const boundJobs=sameSystemJobs.filter(job=>job.marketId);
      const currentJobs=boundJobs.filter(job=>String(job.marketId||'')===selectedMarketId);

      const main=document.createElement('div');
      const strong=document.createElement('strong');
      strong.textContent=site.station||'Construction depot';
      const small=document.createElement('small');
      const progress=Number.isFinite(Number(site.constructionProgress))
        ? ` · build ${Math.max(0,Math.min(100,Number(site.constructionProgress)*100)).toFixed(1)}%`
        : '';
      const delivered=Number(site.totalTons)>0?` · ${fmt(site.totalTons)} t contributions observed`:'';
      small.textContent=`${site.system||'Unknown system'}${progress}${delivered} · last seen ${date(site.lastObservedAt||site.lastContributionAt)}`;
      main.append(strong,small);

      const commanders=document.createElement('span');
      commanders.textContent=(site.commanders||[]).join(', ')||'—';

      const action=document.createElement('div');
      action.className='wolf-colonization-site-action';

      const use=document.createElement('button');
      use.type='button';
      use.className='btn btn-secondary btn-compact';
      use.dataset.useMarketId=site.marketId||'';
      use.dataset.useSystem=site.system||'';
      use.dataset.useBuildName=site.station||'';

      if(currentJobs.length){
        use.textContent=currentJobs.length===1
          ? `Current · ${jobName(currentJobs[0])}`
          : `Current Site · ${currentJobs.length} jobs`;
        use.disabled=true;
        use.classList.add('wolf-colonization-site-current');
        use.title=currentJobs.length===1
          ? `Currently linked to ${jobName(currentJobs[0])}`
          : `Currently linked to ${currentJobs.length} active jobs`;
        action.append(use);
      }else if(pendingJobs.length===1){
        use.textContent=`Link to: ${jobName(pendingJobs[0])}`;
        use.dataset.pendingJobId=pendingJobs[0].id||'';
        use.title=`Link this construction site to ${jobName(pendingJobs[0])}`;
        action.append(use);
      }else if(pendingJobs.length>1){
        const chooser=document.createElement('label');
        chooser.className='wolf-colonization-site-chooser';
        const chooserLabel=document.createElement('span');
        chooserLabel.textContent='LINK SITE TO';
        const select=document.createElement('select');
        select.dataset.colonizationJobSelect='true';
        select.setAttribute('aria-label',`Choose Colonization Job for ${site.station||'construction site'}`);
        pendingJobs.forEach(job=>{
          const option=document.createElement('option');
          option.value=job.id||'';
          option.textContent=jobName(job);
          select.append(option);
        });
        chooser.append(chooserLabel,select);
        use.textContent='Link Site';
        use.dataset.pendingSelection='1';
        use.title='Link this construction site to the selected awaiting job';
        action.append(chooser,use);
      }else if(boundJobs.length===1){
        use.textContent=`Switch ${jobName(boundJobs[0])} Here`;
        use.dataset.switchJobId=boundJobs[0].id||'';
        use.title=`Switch ${jobName(boundJobs[0])} to this site`;
        action.append(use);
      }else{
        use.textContent='Use This Site';
        use.title='Use this construction site in the new-job form';
        action.append(use);
      }

      row.append(main,commanders,action);
      observed.append(row);
    });
  }

  function render(data){
    const jobs=Array.isArray(data.jobs)?data.jobs:[];
    jobsCache=jobs;
    const observedRows=Array.isArray(data.observedMarkets)?data.observedMarkets:[];
    const active=jobs.filter(job=>job.status==='active').length;
    const verifiedTons=jobs.reduce((sum,job)=>sum+number(job.squadTons),0);
    setText('[data-colonization-active-count]',active.toLocaleString());
    setText('[data-colonization-observed-count]',observedRows.length.toLocaleString());
    setText('[data-colonization-verified-tons]',fmt(verifiedTons)+' t');
    setText('[data-colonization-connected]',number(data.connectedMembers).toLocaleString());
    const arbitration=data.arbitrationSummary||{};
    const arbitrationNote=panel.querySelector('[data-colonization-arbitration-summary]');
    if(arbitrationNote){
      const ambiguous=number(arbitration.ambiguousEvents);
      const suppressed=number(arbitration.suppressedMatches);
      const assigned=number(arbitration.assignedEvents);
      arbitrationNote.textContent=ambiguous
        ? `Arbitration assigned ${fmt(assigned)} contribution event${assigned===1?'':'s'} and blocked ${fmt(ambiguous)} ambiguous overlap${ambiguous===1?'':'s'}. ${fmt(suppressed)} lower-priority overlap match${suppressed===1?' was':'es were'} routed away from duplicate credit.`
        : `Arbitration assigned ${fmt(assigned)} contribution event${assigned===1?'':'s'} with no ambiguous overlaps. ${fmt(suppressed)} lower-priority overlap match${suppressed===1?' was':'es were'} routed away from duplicate credit.`;
    }

    list.replaceChildren();
    if(!jobs.length){
      const empty=document.createElement('div');
      empty.className='wolf-colonization-empty';
      empty.innerHTML='<strong>No Colonization Jobs yet.</strong><span>Create a system-wide or MarketID-specific test job above.</span>';
      list.append(empty);
    }else jobs.forEach(job=>list.append(renderJob(job)));
    renderObserved(observedRows);
  }

  async function load(force=false){
    if(loading)return;
    if(!force&&loadedAt&&Date.now()-loadedAt<FRESH_MS)return;
    loading=true;
    if(refresh)refresh.disabled=true;
    setMessage('Refreshing colonization job verification…','working');
    try{
      const response=await fetch(API+'?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
      render(data);
      loadedAt=Date.now();
      setMessage(`Checked ${new Date(loadedAt).toLocaleString()} · automatic reward issuance OFF`,'success');
    }catch(error){
      console.error('Could not load Colonization Jobs',error);
      setMessage('Could not load Colonization Jobs. Nothing was changed.','error');
    }finally{
      loading=false;
      if(refresh)refresh.disabled=false;
    }
  }

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    setMessage('Creating colonization job…','working');
    try{
      const mutation=await mutate({action:'create',job:payloadFromForm()});
      form.querySelector('[data-colonization-field="title"]').value='';
      form.querySelector('[data-colonization-field="buildName"]').value='';
      form.querySelector('[data-colonization-field="marketId"]').value='';
      form.querySelector('[data-colonization-field="commodity"]').value='';
      form.querySelector('[data-colonization-field="notes"]').value='';
      loadedAt=0;
      await load(true);
      setMessage('Colonization job created. Reward issuance remains OFF.'+discordMutationNote(mutation.discord),'success');
    }catch(error){
      console.error(error);
      setMessage(error.message||'Could not create colonization job.','error');
    }finally{if(button)button.disabled=false;}
  });

  list?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-colonization-action]');
    if(!button)return;
    const card=button.closest('[data-job-id]');
    const id=card?.dataset.jobId||'';
    if(!id)return;
    const action=button.dataset.colonizationAction;
    if(action==='delete'&&!window.confirm('Delete this Colonization Job definition? Its final revision will remain in durable history and verified Frontier events will remain stored. Automatic payouts are still off.'))return;
    if(action==='change-site'&&!window.confirm('Change the construction site for this job? The current site binding will remain archived as the prior revision. The job will return to AWAITING SITE and its preview will be recalculated after you select the correct site.'))return;
    button.disabled=true;
    try{
      let mutation;
      if(action==='delete')mutation=await mutate({action:'delete',id});
      else if(action==='change-site')mutation=await mutate({action:'update',job:{id,marketId:''}});
      else mutation=await mutate({action:'status',id,status:button.dataset.colonizationStatus});
      loadedAt=0;
      await load(true);
      if(action==='change-site')setMessage('Site binding cleared. Choose the correct discovered construction site below.'+discordMutationNote(mutation?.discord),'success');
      else if(action==='delete')setMessage('Colonization job removed.'+discordMutationNote(mutation?.discord),'success');
      else setMessage('Colonization job status updated.'+discordMutationNote(mutation?.discord),'success');
    }catch(error){
      console.error(error);
      setMessage('Could not update Colonization Job.','error');
      button.disabled=false;
    }
  });

  observed?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-use-market-id]');
    if(!button)return;
    const selectedSystem=button.dataset.useSystem||'';
    const selectedMarketId=button.dataset.useMarketId||'';
    const selectedBuildName=button.dataset.useBuildName||'';
    const switchJobId=button.dataset.switchJobId||'';
    const directPendingJobId=button.dataset.pendingJobId||'';
    const choosePendingJob=button.dataset.pendingSelection==='1';
    const pending=jobsCache.filter(job=>job.status==='active'&&job.scope==='market'&&!job.marketId&&String(job.system||'').trim().toLowerCase()===selectedSystem.trim().toLowerCase());

    if(switchJobId){
      const job=jobsCache.find(item=>String(item.id||'')===String(switchJobId));
      if(!job)return;
      if(!window.confirm(`Switch ${job.title||job.buildName||'this Colonization Job'} to ${selectedBuildName||'this construction site'}? Its verification preview will be recalculated against the new site.`))return;
      button.disabled=true;
      setMessage(`Switching ${job.title||job.buildName||'Colonization Job'} to the selected construction site…`,'working');
      try{
        await mutate({action:'update',job:{id:job.id,marketId:selectedMarketId}});
        loadedAt=0;
        await load(true);
        setMessage('Construction site changed. Verified tonnage and reward preview were recalculated.','success');
      }catch(error){
        console.error(error);
        setMessage('Could not switch the construction site.','error');
        button.disabled=false;
      }
      return;
    }

    if(directPendingJobId||choosePendingJob){
      const row=button.closest('.wolf-colonization-observed-row');
      const selectedJobId=directPendingJobId||row?.querySelector('[data-colonization-job-select]')?.value||'';
      const job=pending.find(item=>String(item.id||'')===String(selectedJobId));
      if(!job){
        setMessage('That awaiting Colonization Job is no longer available. Refresh Jobs and try again.','error');
        return;
      }
      const chooser=row?.querySelector('[data-colonization-job-select]');
      button.disabled=true;
      if(chooser)chooser.disabled=true;
      setMessage(`Binding ${selectedBuildName||'construction site'} to ${jobName(job)}…`,'working');
      try{
        await mutate({action:'update',job:{id:job.id,marketId:selectedMarketId,buildName:job.buildName||selectedBuildName}});
        loadedAt=0;
        await load(true);
        setMessage(`${selectedBuildName||'Construction site'} linked to ${jobName(job)}.`,'success');
      }catch(error){
        console.error(error);
        setMessage('Could not bind the discovered site to the selected Colonization Job.','error');
        button.disabled=false;
        if(chooser)chooser.disabled=false;
      }
      return;
    }

    const system=form.querySelector('[data-colonization-field="system"]');
    const market=form.querySelector('[data-colonization-field="marketId"]');
    const build=form.querySelector('[data-colonization-field="buildName"]');
    if(system)system.value=selectedSystem;
    if(scope)scope.value='market';
    if(market)market.value=selectedMarketId;
    if(build&&!build.value.trim())build.value=selectedBuildName;
    updateScope();
    setMessage('Construction site selected for a new job. The internal site ID was filled automatically.','success');
    form.scrollIntoView({behavior:'smooth',block:'nearest'});
  });

  scope?.addEventListener('change',updateScope);
  refresh?.addEventListener('click',()=>load(true));
  updateScope();

  panel.addEventListener('toggle',()=>{
    if(!panel.open)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(panel.open)load();}));
  },{passive:true});
})();
