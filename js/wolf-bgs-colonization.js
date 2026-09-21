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
  const FRESH_MS=5000;

  const number=value=>Number(value)||0;
  const fmt=value=>Math.round(number(value)).toLocaleString();
  const money=value=>`${Math.round(number(value)*10)/10}M Cr`;
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
      ? `${job.system} · ${job.buildName||'Build'} · MarketID ${job.marketId||'—'}`
      : `${job.system} · any construction depot`;
    small.textContent=scopeText+(job.commodity?` · ${job.commodity} only`:'');
    title.append(eyebrow,strong,small);

    const chips=document.createElement('div');
    chips.className='wolf-colonization-job-chips';
    chips.append(
      badge(String(job.status||'active').toUpperCase(),`is-${job.status||'active'}`),
      badge(`${fmt(job.contributorCount)} CMDR${number(job.contributorCount)===1?'':'s'}`),
    );
    head.append(title,chips);

    const target=Math.max(1,number(job.targetTons));
    const tons=number(job.squadTons);
    const pct=Math.max(0,Math.min(100,(tons/target)*100));
    const progress=document.createElement('div');
    progress.className='wolf-colonization-progress';
    progress.innerHTML=`<div><strong>${fmt(tons)} / ${fmt(target)} t</strong><span>${pct.toFixed(1)}%</span></div><div class="wolf-colonization-track"><i style="width:${pct}%"></i></div>`;

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
        detail.textContent=`${fmt(member.tons)} t verified · ${fmt(member.completeBlocks)} complete reward block${number(member.completeBlocks)===1?'':'s'} · ${fmt(member.tonsToNextBlock)} t to next block`;
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
    meta.textContent=`Started ${date(job.startsAt)}${job.endsAt?` · ended ${date(job.endsAt)}`:''}${job.squadEvents?` · ${fmt(job.squadEvents)} verified contribution event${number(job.squadEvents)===1?'':'s'}`:''}`;

    const actions=document.createElement('div');
    actions.className='wolf-colonization-actions';
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
      empty.textContent='No ColonisationContribution events have been captured yet. After a qualifying delivery, sync Frontier Scout and refresh this panel.';
      observed.append(empty);
      return;
    }
    rows.forEach(site=>{
      const row=document.createElement('div');
      row.className='wolf-colonization-observed-row';
      row.title=site.marketId?`Internal MarketID ${site.marketId}`:'';
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
      const use=document.createElement('button');
      use.type='button';use.className='btn btn-secondary btn-compact';
      use.dataset.useMarketId=site.marketId||'';
      use.dataset.useSystem=site.system||'';
      use.dataset.useBuildName=site.station||'';
      use.textContent='Use This Site';
      row.append(main,commanders,use);
      observed.append(row);
    });
  }

  function render(data){
    const jobs=Array.isArray(data.jobs)?data.jobs:[];
    const observedRows=Array.isArray(data.observedMarkets)?data.observedMarkets:[];
    const active=jobs.filter(job=>job.status==='active').length;
    const verifiedTons=jobs.reduce((sum,job)=>sum+number(job.squadTons),0);
    setText('[data-colonization-active-count]',active.toLocaleString());
    setText('[data-colonization-observed-count]',observedRows.length.toLocaleString());
    setText('[data-colonization-verified-tons]',fmt(verifiedTons)+' t');
    setText('[data-colonization-connected]',number(data.connectedMembers).toLocaleString());

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
      await mutate({action:'create',job:payloadFromForm()});
      form.querySelector('[data-colonization-field="title"]').value='';
      form.querySelector('[data-colonization-field="buildName"]').value='';
      form.querySelector('[data-colonization-field="marketId"]').value='';
      form.querySelector('[data-colonization-field="commodity"]').value='';
      form.querySelector('[data-colonization-field="notes"]').value='';
      loadedAt=0;
      await load(true);
      setMessage('Colonization job created. Reward issuance remains OFF.','success');
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
    if(action==='delete'&&!window.confirm('Delete this Colonization Job definition? Verified Frontier events will remain stored, but the job will no longer match them.'))return;
    button.disabled=true;
    try{
      if(action==='delete')await mutate({action:'delete',id});
      else await mutate({action:'status',id,status:button.dataset.colonizationStatus});
      loadedAt=0;
      await load(true);
    }catch(error){
      console.error(error);
      setMessage('Could not update Colonization Job.','error');
      button.disabled=false;
    }
  });

  observed?.addEventListener('click',event=>{
    const button=event.target.closest('[data-use-market-id]');
    if(!button)return;
    const system=form.querySelector('[data-colonization-field="system"]');
    const market=form.querySelector('[data-colonization-field="marketId"]');
    const build=form.querySelector('[data-colonization-field="buildName"]');
    if(system)system.value=button.dataset.useSystem||'';
    if(scope)scope.value='market';
    if(market)market.value=button.dataset.useMarketId||'';
    if(build&&!build.value.trim())build.value=button.dataset.useBuildName||'';
    updateScope();
    setMessage('Construction site selected. The internal site ID was filled automatically.','success');
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
