(() => {
  const panel=document.querySelector('[data-order-history]');
  if(!panel)return;
  const API='/api/operations/order-history';
  const list=panel.querySelector('[data-order-history-list]');
  const message=panel.querySelector('[data-order-history-message]');
  const refresh=panel.querySelector('[data-order-history-refresh]');
  let loading=false,loadedAt=0;
  const FRESH_MS=5000;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date=value=>{if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString();};
  const short=value=>{const s=String(value||'');return s.length>12?s.slice(0,8)+'…'+s.slice(-4):s||'—';};
  const setText=(selector,value)=>{const el=panel.querySelector(selector);if(el)el.textContent=String(value);};
  function target(order){
    const r=order?.reporting;
    if(!r||r.target===null||r.target===undefined)return'';
    if(r.type==='inf')return r.target+' INF';
    if(['bounties','trade','exploration'].includes(r.type))return r.target+'M Cr';
    if(r.type==='cz')return r.target+' CZ pts';
    return String(r.target);
  }
  function stateInfo(record){
    if(record.state==='applied')return['APPLIED','is-applied'];
    if(record.state==='failed')return['FAILED','is-failed'];
    return['PREPARED','is-prepared'];
  }
  function actionText(action){return action==='baseline'?'BASELINE':action==='reconcile'?'RECONCILE':action==='delete'?'DELETE':'REPLACE';}
  function changeRow(row){
    const order=row.after||row.before||{};
    let delta='';
    if(row.status==='revised'&&row.before&&row.after){
      const a=target(row.before),b=target(row.after);
      if(a&&b&&a!==b)delta='<em>'+esc(a)+' → '+esc(b)+'</em>';
    }
    return '<div class="wolf-history-change is-'+esc(row.status||'unchanged')+'"><span>'+esc(String(row.status||'unchanged').toUpperCase())+'</span><div><strong>'+esc(order.task||'Operational task')+'</strong><small>'+esc(order.system||'Squad-wide')+(order.faction?' · '+esc(order.faction):'')+(order.kind?' · '+esc(order.kind):'')+'</small></div>'+delta+'</div>';
  }
  function activeOrderRow(order){
    const report=target(order);
    return '<div class="wolf-history-active-order"><div><strong>'+esc(order.task||'Operational task')+'</strong><small>'+esc(order.system||'Squad-wide')+(order.faction?' · '+esc(order.faction):'')+' · rev '+Number(order.revision||1)+'</small></div>'+(report?'<b>'+esc(report)+'</b>':'')+'</div>';
  }
  function recordMarkup(record,index){
    const info=stateInfo(record),stateLabel=info[0],stateClass=info[1];
    const counts=record?.changes?.counts||{};
    const rows=Array.isArray(record?.changes?.rows)?record.changes.rows:[];
    const materialRows=rows.filter(row=>row.status!=='unchanged');
    const afterOrders=Array.isArray(record?.after?.orders)?record.after.orders:[];
    const systems=Array.isArray(record.reconcileSystems)&&record.reconcileSystems.length?record.reconcileSystems.join(' · '):'Full document';
    const eventAt=record.appliedAt||record.failedAt||record.preparedAt;
    const parts=[];
    if(counts.added)parts.push(counts.added+' added');
    if(counts.revised)parts.push(counts.revised+' revised');
    if(counts.removed)parts.push(counts.removed+' removed');
    if(counts.unchanged)parts.push(counts.unchanged+' unchanged');
    const changeText=parts.join(' · ')||'No material order changes';
    let warning='';
    if(record.legacyBaseline)warning='<div class="wolf-history-warning">LEGACY BASELINE · This snapshot anchors the already-live Daily Orders from this point forward. Earlier work remains visible to the Reward Engine but cannot be paid from guessed historical provenance.</div>';
    if(record.state==='prepared')warning='<div class="wolf-history-warning">Write-ahead record exists but finalization is still marked PREPARED. The full before/after payload is preserved for recovery.</div>';
    if(record.state==='failed')warning='<div class="wolf-history-warning is-failed">Publication failed after history preparation. '+esc(record.failure||'No failure detail recorded.')+'</div>';
    return '<details class="wolf-history-record '+stateClass+'" '+(index===0?'open':'')+'><summary><div><span>'+esc(actionText(record.action))+'</span><strong>'+esc(date(eventAt))+'</strong><small>'+esc(record.actor||'Mongrel Officer')+' · '+esc(changeText)+'</small></div><div class="wolf-history-record-state"><b>'+esc(stateLabel)+'</b><small>'+afterOrders.length+' active order'+(afterOrders.length===1?'':'s')+' after</small></div></summary><div class="wolf-history-record-body"><div class="wolf-history-meta"><span>CYCLE <b>'+esc(short(record.cycleId))+'</b></span><span>PUBLICATION <b>'+esc(short(record.publicationId))+'</b></span><span>SCOPE <b>'+esc(systems)+'</b></span><span>BEFORE <b title="'+esc(record.beforeHash||'')+'">'+esc(short(record.beforeHash))+'</b></span><span>AFTER <b title="'+esc(record.afterHash||'')+'">'+esc(short(record.afterHash))+'</b></span></div>'+warning+'<section><h4>Material Changes</h4><div class="wolf-history-changes">'+(materialRows.length?materialRows.map(changeRow).join(''):'<div class="wolf-history-empty">No material order changes in this publication.</div>')+'</div></section><section><h4>Resulting Order Snapshot</h4><div class="wolf-history-active">'+(afterOrders.length?afterOrders.map(activeOrderRow).join(''):'<div class="wolf-history-empty">No active orders remained after this publication.</div>')+'</div></section></div></details>';
  }
  function render(data){
    const records=Array.isArray(data.records)?data.records:[];
    const summary=data.summary||{};
    setText('[data-order-history-records]',Number(summary.recordCount||records.length).toLocaleString());
    setText('[data-order-history-applied]',Number(summary.appliedCount||0).toLocaleString());
    setText('[data-order-history-removed]',Number(summary.removed||0).toLocaleString());
    setText('[data-order-history-revised]',Number(summary.revised||0).toLocaleString());
    if(!records.length){
      list.innerHTML='<div class="wolf-history-empty"><strong>No archived publications yet.</strong><span>The next Daily Order publish, reconcile, or removal will archive the current published state as its BEFORE snapshot and the new state as its AFTER snapshot.</span></div>';
      return;
    }
    list.innerHTML=records.map(recordMarkup).join('');
  }
  async function load(force=false){
    if(loading)return;
    if(!force&&loadedAt&&Date.now()-loadedAt<FRESH_MS)return;
    loading=true;if(refresh)refresh.disabled=true;if(message)message.textContent='Loading durable order history…';
    try{
      const response=await fetch(API+'?limit=40&_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('Request failed ('+response.status+')'));
      render(data);loadedAt=Date.now();
      if(message)message.textContent='Checked '+new Date(loadedAt).toLocaleString()+' · read-only archive';
    }catch(error){
      console.error('Could not load Daily Order history',error);
      if(message)message.textContent='Could not load Daily Order history.';
    }finally{loading=false;if(refresh)refresh.disabled=false;}
  }
  refresh?.addEventListener('click',()=>load(true));
  window.addEventListener('wolf-bgs-order-history-updated',()=>{loadedAt=0;if(panel.open)setTimeout(()=>load(true),120);});
  panel.addEventListener('toggle',()=>{if(!panel.open)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(panel.open)load();}));},{passive:true});
})();
