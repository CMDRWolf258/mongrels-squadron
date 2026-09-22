(() => {
  const board=document.querySelector('[data-colonization-board]');
  if(!board)return;
  const $=sel=>document.querySelector(sel);
  const privateView=board.querySelector('[data-colony-private]');
  const list=board.querySelector('[data-colony-list]');
  const createButton=board.querySelector('[data-colony-create]');
  const signIn=board.querySelector('[data-colony-sign-in]');
  const refresh=board.querySelector('[data-colony-refresh]');
  const filter=board.querySelector('[data-colony-filter]');
  const status=board.querySelector('[data-colony-status]');
  const shell=$('[data-colony-editor-shell]');
  const form=$('[data-colony-form]');
  let payload=null,editing=null,dirty=false;
  const recentJobUpdates=new Map();
  const RECENT_JOB_TTL_MS=120000;

  const n=value=>Number(value||0);
  const fmt=value=>Math.round(n(value)).toLocaleString();
  const moneyM=value=>n(value).toLocaleString(undefined,{maximumFractionDigits:1})+'M Cr';
  const dateLabel=value=>{const d=new Date(value||'');return Number.isNaN(d.getTime())?'Unknown':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
  const safe=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function api(url,options={}){
    const requestUrl=options.method?url:url+(url.includes('?')?'&':'?')+'_='+Date.now();
    const response=await fetch(requestUrl,{credentials:'same-origin',cache:'no-store',...options});
    const body=await response.json().catch(()=>({}));
    return{response,body};
  }
  async function copySystem(system,button){
    try{await navigator.clipboard.writeText(system);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1000);}catch{}
  }
  function rememberJobUpdate(job){
    if(!job?.id)return;
    recentJobUpdates.set(String(job.id),{job:{...job},at:Date.now()});
  }
  function overlayRecentJobUpdates(rows=[]){
    const now=Date.now();
    for(const [id,record] of recentJobUpdates){
      if(now-record.at>RECENT_JOB_TTL_MS){recentJobUpdates.delete(id);continue;}
      const index=rows.findIndex(job=>String(job?.id||'')===id);
      if(index>=0)rows[index]={...rows[index],...record.job};
    }
    return rows;
  }
  function fundingMeta(job){
    if(job.fundingMode==='none')return{label:'No Reward',className:'is-none',detail:'Volunteer hauling'};
    if(job.fundingMode==='member')return{label:'Member Funded',className:'is-member',detail:'Paid by '+(job.fundingPayerName||job.postingCommander||'posting CMDR')};
    if(job.fundingApprovalStatus==='pending')return{label:'Squad Funding Pending',className:'is-pending',detail:'Awaiting leadership approval'};
    if(job.fundingApprovalStatus==='rejected')return{label:'Funding Rejected',className:'is-rejected',detail:'No squad reward approved'};
    return{label:'Squad Funded',className:'',detail:'Approved squad reward'};
  }
  function jobCard(job){
    const funding=fundingMeta(job);
    const target=Math.max(0,n(job.targetTons)),tons=n(job.squadTons),openEnded=target<=0,pct=openEnded?0:Math.min(100,Math.max(0,tons/target*100));
    const article=document.createElement('article');
    article.className='colonization-job-card'+(job.fundingApprovalStatus==='pending'?' is-pending':'')+(job.status==='completed'?' is-completed':'');
    const reward=job.fundingMode==='none'?'No reward':moneyM(job.rewardBlockMillions)+' / '+fmt(job.rewardBlockTons)+' t';
    const budget=job.fundingMode==='none'?'—':moneyM(job.rewardBudgetMillions)+' max';
    const build=job.scope==='market'?(job.buildName||'Specific build · awaiting site link'):'Any construction in system';
    let extra='';
    if(job.fundingMode==='squad'&&job.fundingApprovalStatus==='pending')extra+='<p class="colonization-job-warning"><strong>Funding request:</strong> hauling can be tracked now, but cargo moved before approval does not earn the requested reward. Reward eligibility begins when leadership approves the funding request.</p>';
    if(job.fundingMode==='member')extra+='<p class="colonization-job-warning"><strong>Member pledge:</strong> '+safe(job.fundingPayerName||job.postingCommander||'The posting CMDR')+' is the payer. Verified rewards stay separate from the squad treasury.</p>';
    if(n(job.ambiguousEvents)>0)extra+='<p class="colonization-job-warning">'+fmt(job.ambiguousEvents)+' verified contribution event'+(n(job.ambiguousEvents)===1?'':'s')+' currently need arbitration before reward credit can be trusted.</p>';
    const actions=[];
    if(job.canEdit)actions.push('<button class="btn btn-secondary btn-compact" type="button" data-colony-action="edit">Edit</button>');
    if(job.canEdit&&job.status==='active')actions.push('<button class="btn btn-secondary btn-compact" type="button" data-colony-action="pause">Pause</button>');
    if(job.canEdit&&job.status==='paused')actions.push('<button class="btn btn-secondary btn-compact" type="button" data-colony-action="resume">Resume</button>');
    if(job.canEdit&&job.status!=='completed')actions.push('<button class="btn btn-secondary btn-compact" type="button" data-colony-action="complete">Complete</button>');
    if(job.canApproveFunding){actions.push('<button class="btn btn-primary btn-compact" type="button" data-colony-action="approve">Approve Funding</button>');actions.push('<button class="btn btn-secondary btn-compact" type="button" data-colony-action="reject">Reject</button>');}
    article.innerHTML=
      '<div class="colonization-job-head"><div><p class="colonization-job-kicker">'+safe(job.commodity||'All construction cargo')+'</p><h3>'+safe(job.title||'Colonization Job')+'</h3></div><div class="colonization-job-badges"><span class="colonization-job-badge '+safe(funding.className)+'">'+safe(funding.label)+'</span><span class="colonization-job-badge is-none">'+safe(job.status==='completed'?'archived':(job.status||'active'))+'</span></div></div>'+
      '<div class="colonization-system-line"><strong>'+safe(job.system)+'</strong><button class="copy-system-btn" type="button" data-copy-system aria-label="Copy system name">⧉</button></div>'+
      '<span class="colonization-build-line">'+safe(build)+'</span>'+
      '<div class="colonization-progress"><div><strong>'+(openEnded?fmt(tons)+' t hauled':fmt(tons)+' / '+fmt(target)+' t')+'</strong><span>'+(openEnded?'OPEN-ENDED':pct.toFixed(1)+'%')+'</span></div>'+(openEnded?'':'<div class="colonization-progress-track"><i style="width:'+pct+'%"></i></div>')+'</div>'+
      '<div class="colonization-job-metrics"><div><span>Reward</span><strong>'+safe(reward)+'</strong></div><div><span>Pledge / Budget</span><strong>'+safe(budget)+'</strong></div><div><span>Contributors</span><strong>'+fmt(job.contributorCount)+'</strong></div></div>'+
      (job.notes?'<p class="colonization-job-notes">'+safe(job.notes)+'</p>':'')+extra+
      '<div class="colonization-job-foot"><small>'+safe(funding.detail)+' · Posted by '+safe(job.postingCommander||job.postingOwnerName||'Mongrel Member')+' · '+dateLabel(job.createdAt)+'</small><div class="colonization-job-actions">'+actions.join('')+'</div></div>';
    article.querySelector('[data-copy-system]')?.addEventListener('click',event=>copySystem(job.system,event.currentTarget));
    article.querySelectorAll('[data-colony-action]').forEach(button=>button.addEventListener('click',()=>handleCardAction(job,button.dataset.colonyAction,button)));
    return article;
  }
  function setStat(key,value){const el=board.querySelector('[data-colony-stat="'+key+'"]');if(el)el.textContent=String(value);}
  function render(){
    if(!payload||!list)return;
    const jobs=Array.isArray(payload.jobs)?payload.jobs:[];
    const mode=filter?.value||'active';
    let rows=jobs;
    if(mode==='active')rows=jobs.filter(job=>job.status==='active');
    if(mode==='mine')rows=jobs.filter(job=>job.isMine);
    if(mode==='pending')rows=jobs.filter(job=>job.fundingMode==='squad'&&job.fundingApprovalStatus==='pending');
    if(mode==='archived')rows=jobs.filter(job=>job.status==='completed');
    rows=[...rows].sort((a,b)=>(a.fundingApprovalStatus==='pending'?0:1)-(b.fundingApprovalStatus==='pending'?0:1)||String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
    list.replaceChildren();
    if(!rows.length){const empty=document.createElement('div');empty.className='data-empty-state';empty.innerHTML='<div><strong>No Colonization Jobs match this view.</strong><p>Post a construction hauling job when the squad has cargo to move.</p></div>';list.append(empty);}
    else rows.forEach(job=>list.append(jobCard(job)));
    const activeJobs=jobs.filter(job=>job.status==='active');
    setStat('active',activeJobs.length);
    setStat('tons',fmt(activeJobs.reduce((sum,job)=>sum+n(job.squadTons),0))+' t');
    setStat('pending',jobs.filter(job=>job.fundingMode==='squad'&&job.fundingApprovalStatus==='pending').length);
    setStat('mine',jobs.filter(job=>job.isMine).length);
  }
  async function load(){
    if(status)status.textContent='Refreshing Colonization Jobs…';
    try{
      const result=await api('/api/colonization-jobs');
      if(result.response.status===401||result.response.status===403){
        payload=null;if(privateView)privateView.hidden=true;if(createButton)createButton.hidden=true;if(signIn)signIn.hidden=false;if(status)status.textContent='Member sign-in required';return;
      }
      if(!result.response.ok)throw new Error(result.body.message||result.body.error||'Could not load Colonization Jobs');
      payload={...result.body,jobs:overlayRecentJobUpdates([...(Array.isArray(result.body.jobs)?result.body.jobs:[])])};
      if(privateView)privateView.hidden=false;if(createButton)createButton.hidden=!result.body.canPost;if(signIn)signIn.hidden=Boolean(result.body.canPost);
      if(status)status.textContent=(result.body.jobs||[]).length.toLocaleString()+' job'+((result.body.jobs||[]).length===1?'':'s')+' · Frontier verification linked';
      render();
      if(location.hash==='#colonization-jobs'&&!window.__colonyBoardAnchored){window.__colonyBoardAnchored=true;requestAnimationFrame(()=>document.getElementById('colonization-jobs')?.scrollIntoView({block:'start'}));}
    }catch(error){console.error('Could not load Colonization Job board',error);if(status)status.textContent=String(error.message||error);}
  }
  function openEditor(job=null){
    editing=job;dirty=false;shell.hidden=false;document.body.classList.add('project-editor-open');
    $('[data-colony-form-title]').textContent=job?'Edit Colonization Job':'Post Colonization Job';
    $('[data-colony-id]').value=job?.id||'';$('[data-colony-title]').value=job?.title||'';$('[data-colony-system]').value=job?.system||'';$('[data-colony-scope]').value=job?.scope||'system';$('[data-colony-build]').value=job?.buildName||'';$('[data-colony-commodity]').value=job?.commodity||'';$('[data-colony-target]').value=n(job?.targetTons)>0?job.targetTons:'';$('[data-colony-funding]').value=job?.fundingMode||'none';$('[data-colony-job-status]').value=job?.status||'active';$('[data-colony-reward-tons]').value=job?.rewardBlockTons||1000;$('[data-colony-reward-millions]').value=job?.rewardBlockMillions||10;$('[data-colony-budget]').value=job?.rewardBudgetMillions||100;$('[data-colony-personal-cap]').value=job?.personalCapMillions??'';$('[data-colony-notes]').value=job?.notes||'';$('[data-colony-form-status]').textContent='';$('[data-colony-close-job]').hidden=!job||job.status==='completed';
    const immutable=Boolean(job);$('[data-colony-system]').disabled=immutable&&!job?.canModerate;$('[data-colony-scope]').disabled=immutable&&!job?.canModerate;$('[data-colony-build]').disabled=immutable&&!job?.canModerate;$('[data-colony-commodity]').disabled=immutable&&!job?.canModerate;
    const lockRewards=Boolean(job&&!job.canEditFunding);$('[data-colony-funding]').disabled=lockRewards;
    ['[data-colony-reward-tons]','[data-colony-reward-millions]','[data-colony-budget]','[data-colony-personal-cap]'].forEach(sel=>{const el=$(sel);if(el)el.disabled=lockRewards;});
    if(lockRewards&&$('[data-colony-form-status]'))$('[data-colony-form-status]').textContent='Reward settings are locked because hauling, reward issuance, or squad approval has already started.';
    syncEditor();
  }
  function closeEditor(force=false){if(!force&&dirty&&!confirm('Discard unsaved Colonization Job changes?'))return;shell.hidden=true;document.body.classList.remove('project-editor-open');editing=null;dirty=false;}
  function syncEditor(){
    $('[data-colony-build-wrap]').hidden=$('[data-colony-scope]').value!=='market';
    const funding=$('[data-colony-funding]').value,fields=$('[data-colony-funding-fields]'),summary=$('[data-colony-funding-summary]');
    fields.hidden=funding==='none';
    if(funding==='none'){summary.textContent='No credits are promised. Members can still use this as a coordinated hauling request.';return;}
    const blockTons=Math.max(1,n($('[data-colony-reward-tons]').value)),reward=n($('[data-colony-reward-millions]').value),budget=n($('[data-colony-budget]').value),target=Math.max(0,n($('[data-colony-target]').value)),theoretical=target>0?Math.ceil(target/blockTons)*reward:0;
    if(funding==='member'){
      const commander=payload?.viewer?.commander||'';
      const targetCopy=target>0?' The target/rate would total '+safe(moneyM(theoretical))+' if every block is rewarded.':' This is an open-ended hauling job; the maximum pledge is the reward cap, not a cargo stopping point.';
      summary.innerHTML=commander?'<strong>'+safe(commander)+'</strong> will be responsible for paying verified rewards. Maximum pledged liability: <strong>'+safe(moneyM(budget))+'</strong>.'+targetCopy:'<strong>Elite connection required.</strong> Connect your Elite account before posting a member-funded reward so the payer CMDR can be verified.';
    }else summary.innerHTML='This is a <strong>funding request</strong>, not an immediate squad debt. Leadership must approve it before reward-eligible hauling begins. Requested maximum budget: <strong>'+safe(moneyM(budget))+'</strong>.'+(target<=0?' The hauling job itself remains open-ended.':'');
  }
  function formPayload(){return{id:$('[data-colony-id]').value||undefined,title:$('[data-colony-title]').value,system:$('[data-colony-system]').value,scope:$('[data-colony-scope]').value,buildName:$('[data-colony-build]').value,commodity:$('[data-colony-commodity]').value,targetTons:$('[data-colony-target]').value===''?0:n($('[data-colony-target]').value),fundingMode:$('[data-colony-funding]').value,status:$('[data-colony-job-status]').value,rewardBlockTons:n($('[data-colony-reward-tons]').value),rewardBlockMillions:n($('[data-colony-reward-millions]').value),rewardBudgetMillions:n($('[data-colony-budget]').value),personalCapMillions:$('[data-colony-personal-cap]').value===''?null:n($('[data-colony-personal-cap]').value),notes:$('[data-colony-notes]').value};}
  async function save(event){
    event.preventDefault();const out=$('[data-colony-form-status]');out.textContent='Saving Colonization Job…';
    try{
      const result=await api('/api/colonization-jobs',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json','X-Mongrels-Request':'colonization-post-editor'},body:JSON.stringify(editing?{action:'update',id:editing.id,job:formPayload()}:{job:formPayload()})});
      if(!result.response.ok)throw new Error(result.body.message||friendlyError(result.body.error));
      dirty=false;closeEditor(true);await load();
    }catch(error){out.textContent=String(error.message||error);}
  }
  async function mutate(job,action,button){
    if(button)button.disabled=true;let body={id:job.id};
    if(action==='pause')body={...body,action:'status',status:'paused'};if(action==='resume')body={...body,action:'status',status:'active'};if(action==='complete')body={...body,action:'status',status:'completed'};if(action==='approve')body={...body,action:'approve-funding'};if(action==='reject')body={...body,action:'reject-funding'};
    const prior={...job};
    if(action==='complete'&&payload&&Array.isArray(payload.jobs)){
      const index=payload.jobs.findIndex(row=>String(row?.id||'')===String(job.id||''));
      if(index>=0){
        const optimistic={...payload.jobs[index],status:'completed',endsAt:payload.jobs[index].endsAt||new Date().toISOString()};
        payload.jobs[index]=optimistic;
        rememberJobUpdate(optimistic);
        render();
      }
      if(status)status.textContent='Completing job…';
    }
    try{
      const result=await api('/api/colonization-jobs',{method:'PUT',headers:{'Content-Type':'application/json','X-Mongrels-Request':'colonization-post-editor'},body:JSON.stringify(body)});
      if(!result.response.ok)throw new Error(result.body.message||friendlyError(result.body.error));
      if(result.body?.job){
        rememberJobUpdate(result.body.job);
        if(payload&&Array.isArray(payload.jobs)){
          const index=payload.jobs.findIndex(row=>String(row?.id||'')===String(result.body.job.id||''));
          if(index>=0)payload.jobs[index]={...payload.jobs[index],...result.body.job};
          render();
        }
      }
      if(action==='complete'&&status)status.textContent='Job completed. It is now in Archived.';
      setTimeout(()=>load(),1600);
    }
    catch(error){
      if(action==='complete'&&payload&&Array.isArray(payload.jobs)){
        const index=payload.jobs.findIndex(row=>String(row?.id||'')===String(job.id||''));
        if(index>=0)payload.jobs[index]=prior;
        recentJobUpdates.delete(String(job.id||''));
        render();
      }
      if(status)status.textContent=String(error.message||error);
      window.alert('The Colonization Job was not completed.\n\n'+String(error.message||error));
      if(button)button.disabled=false;
    }
  }
  function handleCardAction(job,action,button){
    if(action==='edit'){openEditor(job);return;}
    if(action==='complete'&&!confirm('Complete this Colonization Job? It will leave the Active board and remain available under Archived. Existing verified work and any earned obligations remain preserved.'))return;
    if(action==='approve'&&!confirm('Approve the requested squad reward budget of '+moneyM(job.rewardBudgetMillions)+'?'))return;
    if(action==='reject'&&!confirm('Reject this squad funding request? The hauling job can remain visible, but no squad reward will be approved.'))return;
    mutate(job,action,button);
  }
  function friendlyError(code){
    const map={frontier_required_for_member_funding:'Connect your Elite account before posting a member-funded reward.',colonization_reward_required:'Enter a reward greater than 0 M Cr.',colonization_reward_budget_required:'Enter a maximum pledged reward budget.',colonization_reward_budget_too_small:'The maximum pledge must cover at least one reward block.',colonization_system_required:'Enter the destination system.',colonization_funding_terms_locked:'Reward settings are locked because hauling, reward issuance, or squad approval has already started.'};
    return map[code]||code||'Could not save Colonization Job.';
  }
  form?.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.target?.tagName!=='INPUT'||event.target?.type==='submit')return;
    event.preventDefault();
  });
    createButton?.addEventListener('click',()=>openEditor());refresh?.addEventListener('click',load);filter?.addEventListener('change',render);form?.addEventListener('submit',save);form?.addEventListener('input',()=>{dirty=true;syncEditor();});form?.addEventListener('change',syncEditor);document.querySelectorAll('[data-colony-cancel]').forEach(button=>button.addEventListener('click',()=>closeEditor()));$('[data-colony-close-job]')?.addEventListener('click',()=>{if(editing)handleCardAction(editing,'complete',$('[data-colony-close-job]'));});
  load();
})();
