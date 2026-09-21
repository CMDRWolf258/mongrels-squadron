(() => {
  const panel=document.querySelector('[data-colonization-history]');
  if(!panel)return;

  const API='/api/operations/colonization-job-history';
  const list=panel.querySelector('[data-colonization-history-list]');
  const message=panel.querySelector('[data-colonization-history-message]');
  const refresh=panel.querySelector('[data-colonization-history-refresh]');
  let loading=false,loadedAt=0;
  const FRESH_MS=5000;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date=value=>{if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString();};
  const short=value=>{const s=String(value||'');return s.length>12?s.slice(0,8)+'…'+s.slice(-4):s||'—';};
  const fmt=value=>Number(value||0).toLocaleString();
  const money=value=>(Math.round((Number(value)||0)*10)/10)+'M Cr';
  const setText=(selector,value)=>{const el=panel.querySelector(selector);if(el)el.textContent=String(value);};

  function stateInfo(record){
    if(record.state==='applied')return['APPLIED','is-applied'];
    if(record.state==='failed')return['FAILED','is-failed'];
    return['PREPARED','is-prepared'];
  }

  function actionText(action){
    if(action==='baseline')return'BASELINE';
    if(action==='create')return'CREATE';
    if(action==='status')return'STATUS';
    if(action==='delete')return'DELETE';
    return'UPDATE';
  }

  function jobScope(job){
    if(job?.scope==='market')return job.buildName||job.marketId||'Specific build';
    return'Any construction in system';
  }

  function payout(job){
    const cap=job?.personalCapMillions===null||job?.personalCapMillions===undefined
      ? 'no personal cap'
      : 'cap '+money(job.personalCapMillions);
    return money(job?.rewardBlockMillions)+' / '+fmt(job?.rewardBlockTons)+' t · '+cap;
  }

  function changeRow(row){
    const job=row.after||row.before||{};
    const beforeRevision=Number(row.before?.revision||0);
    const afterRevision=Number(row.after?.revision||0);
    const revision=row.status==='revised'
      ? '<em>rev '+beforeRevision+' → '+afterRevision+'</em>'
      : '<em>rev '+Number(job.revision||1)+'</em>';
    return '<div class="wolf-history-change is-'+esc(row.status||'unchanged')+'"><span>'+
      esc(String(row.status||'unchanged').toUpperCase())+'</span><div><strong>'+
      esc(job.title||job.buildName||job.system||'Colonization Job')+'</strong><small>'+
      esc(job.system||'Unknown system')+' · '+esc(jobScope(job))+
      (job.commodity?' · '+esc(job.commodity)+' only':'')+
      ' · '+esc(payout(job))+'</small></div>'+revision+'</div>';
  }

  function activeJobRow(job){
    return '<div class="wolf-history-active-order"><div><strong>'+
      esc(job.title||job.buildName||job.system||'Colonization Job')+'</strong><small>'+
      esc(job.system||'Unknown system')+' · '+esc(jobScope(job))+
      (job.commodity?' · '+esc(job.commodity)+' only':'')+
      ' · '+esc(String(job.status||'active').toUpperCase())+
      ' · rev '+Number(job.revision||1)+'</small></div><b>'+esc(payout(job))+'</b></div>';
  }

  function recordMarkup(record,index){
    const info=stateInfo(record),stateLabel=info[0],stateClass=info[1];
    const counts=record?.changes?.counts||{};
    const rows=Array.isArray(record?.changes?.rows)?record.changes.rows:[];
    const materialRows=rows.filter(row=>row.status!=='unchanged');
    const afterJobs=Array.isArray(record?.after?.jobs)?record.after.jobs:[];
    const eventAt=record.appliedAt||record.failedAt||record.preparedAt;
    const parts=[];
    if(counts.added)parts.push(counts.added+' added');
    if(counts.revised)parts.push(counts.revised+' revised');
    if(counts.removed)parts.push(counts.removed+' removed');
    if(counts.unchanged)parts.push(counts.unchanged+' unchanged');
    const changeText=parts.join(' · ')||'No material job changes';

    let warning='';
    if(record.action==='baseline')warning='<div class="wolf-history-warning">Legacy baseline captured the Colonization Jobs that already existed when durable history was enabled. Earlier edits cannot be reconstructed, but this snapshot is now the provenance anchor for revision 1.</div>';
    if(record.state==='prepared')warning='<div class="wolf-history-warning">Write-ahead record exists but finalization is still marked PREPARED. The complete BEFORE/AFTER payload is preserved for recovery.</div>';
    if(record.state==='failed')warning='<div class="wolf-history-warning is-failed">Job mutation failed after history preparation. '+esc(record.failure||'No failure detail recorded.')+'</div>';

    return '<details class="wolf-history-record '+stateClass+'" '+(index===0?'open':'')+'><summary><div><span>'+
      esc(actionText(record.action))+'</span><strong>'+esc(date(eventAt))+'</strong><small>'+
      esc(record.actor||'Mongrel Officer')+' · '+esc(changeText)+'</small></div><div class="wolf-history-record-state"><b>'+
      esc(stateLabel)+'</b><small>'+afterJobs.length+' job'+(afterJobs.length===1?'':'s')+' after</small></div></summary>'+
      '<div class="wolf-history-record-body"><div class="wolf-history-meta"><span>PUBLICATION <b>'+
      esc(short(record.publicationId))+'</b></span><span>TARGET <b>'+esc(short(record.targetJobId))+
      '</b></span><span>BEFORE <b title="'+esc(record.beforeHash||'')+'">'+esc(short(record.beforeHash))+
      '</b></span><span>AFTER <b title="'+esc(record.afterHash||'')+'">'+esc(short(record.afterHash))+
      '</b></span></div>'+warning+
      '<section><h4>Material Changes</h4><div class="wolf-history-changes">'+
      (materialRows.length?materialRows.map(changeRow).join(''):'<div class="wolf-history-empty">No material Colonization Job changes in this publication.</div>')+
      '</div></section><section><h4>Resulting Job Snapshot</h4><div class="wolf-history-active">'+
      (afterJobs.length?afterJobs.map(activeJobRow).join(''):'<div class="wolf-history-empty">No Colonization Jobs remained after this change.</div>')+
      '</div></section></div></details>';
  }

  function render(data){
    const records=Array.isArray(data.records)?data.records:[];
    const summary=data.summary||{};
    setText('[data-colonization-history-records]',Number(summary.recordCount||records.length).toLocaleString());
    setText('[data-colonization-history-applied]',Number(summary.appliedCount||0).toLocaleString());
    setText('[data-colonization-history-revised]',Number(summary.revised||0).toLocaleString());
    setText('[data-colonization-history-removed]',Number(summary.removed||0).toLocaleString());

    if(!records.length){
      list.innerHTML='<div class="wolf-history-empty"><strong>No archived Colonization Job changes yet.</strong><span>Existing jobs will receive a one-time baseline snapshot; every later create, edit, site binding, status change, or removal is archived before it is applied.</span></div>';
      return;
    }
    list.innerHTML=records.map(recordMarkup).join('');
  }

  async function load(force=false){
    if(loading)return;
    if(!force&&loadedAt&&Date.now()-loadedAt<FRESH_MS)return;
    loading=true;
    if(refresh)refresh.disabled=true;
    if(message)message.textContent='Loading durable Colonization Job history…';
    try{
      const response=await fetch(API+'?limit=40&_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('Request failed ('+response.status+')'));
      render(data);
      loadedAt=Date.now();
      if(message)message.textContent='Checked '+new Date(loadedAt).toLocaleString()+' · read-only archive · automatic payouts OFF';
    }catch(error){
      console.error('Could not load Colonization Job history',error);
      if(message)message.textContent='Could not load Colonization Job history.';
    }finally{
      loading=false;
      if(refresh)refresh.disabled=false;
    }
  }

  refresh?.addEventListener('click',()=>load(true));
  window.addEventListener('wolf-bgs-colonization-history-updated',()=>{loadedAt=0;if(panel.open)setTimeout(()=>load(true),120);});
  panel.addEventListener('toggle',()=>{if(!panel.open)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(panel.open)load();}));},{passive:true});
})();
