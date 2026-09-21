(() => {
  const ORDERS_API='/api/operations/orders';
  const REVIEW_API='/api/operations/order-change-review';
  const queue=new Map();
  const suppressedSignatures=new Map();
  let panel=null;
  let syncing=false;
  let publishBusy=false;
  let evaluationRunning=false;
  const evaluatedFingerprints=new Map();
  const expandedSystems=new Set();
  let queueRenderSignature='';
  let publishedDocument={cycleId:null,orders:[]};
  let publishedLoaded=false;
  let publishedContextLoadedAt=0;
  let reviewState={};
  let changeAckBusy=false;
  let lastPublishMessage='';
  let lastPublishError='';

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
  const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,44)||'system';
  const num=value=>value===''||value===null||value===undefined?null:(Number.isFinite(Number(value))?Number(value):null);

  const norm=value=>clean(value).toLowerCase();
  function semanticTask(value){
    return norm(value)
      .replace(/\b\d+(?:\.\d+)?\s*m\s*cr\b/g,' amount ')
      .replace(/\b\d+(?:\.\d+)?\s*inf\b/g,' inf ')
      .replace(/\b\d+(?:\.\d+)?\s*(?:cz\s*)?(?:points?|pts?)\b/g,' cz ')
      .replace(/\b\d+(?:\.\d+)?\b/g,' number ')
      .replace(/\s+/g,' ')
      .trim()
      .slice(0,180)||'task';
  }
  function logicalKey(order){
    const explicit=clean(order?.logicalKey);
    if(explicit)return explicit;
    const reportingType=clean(order?.reporting?.type);
    return [
      norm(order?.source)||'manual',
      norm(order?.system)||'squad-wide',
      norm(order?.faction)||'any-faction',
      norm(order?.kind)||reportingType||'task',
      semanticTask(order?.task||order?.detail||order?.kind||'task'),
    ].join('|').slice(0,520);
  }
  function materialFingerprint(order){
    const reporting=order?.reporting&&typeof order.reporting==='object'
      ? {type:clean(order.reporting.type),target:num(order.reporting.target),blitz:Boolean(order.reporting.blitz)}
      : null;
    return JSON.stringify({
      system:clean(order?.system),faction:clean(order?.faction),kind:clean(order?.kind),
      source:clean(order?.source),priority:clean(order?.priority),task:clean(order?.task),
      detail:clean(order?.detail),status:clean(order?.status),reporting,
    });
  }
  function replacementGroup(order){
    return [norm(order?.faction),clean(order?.reporting?.type)||norm(order?.kind)||'task'].join('|');
  }
  function comparePlans(beforeTasks=[],afterTasks=[]){
    const before=Array.isArray(beforeTasks)?beforeTasks:[];
    const after=Array.isArray(afterTasks)?afterTasks:[];
    const used=new Set();
    let rows=after.map(afterTask=>{
      const key=logicalKey(afterTask);
      const priorIndex=before.findIndex((beforeTask,index)=>!used.has(index)&&logicalKey(beforeTask)===key);
      if(priorIndex<0)return{status:'new',after:afterTask,before:null};
      used.add(priorIndex);
      const beforeTask=before[priorIndex];
      return{
        status:materialFingerprint(beforeTask)===materialFingerprint(afterTask)?'unchanged':'changed',
        before:beforeTask,
        after:afterTask,
      };
    });
    rows.push(...before.map((beforeTask,index)=>used.has(index)?null:{status:'remove',before:beforeTask,after:null}).filter(Boolean));

    const removals=rows.filter(row=>row.status==='remove');
    const replacementRemovals=new Set();
    for(const row of rows){
      if(row.status!=='new')continue;
      const prior=removals.find(candidate=>!replacementRemovals.has(candidate)&&replacementGroup(candidate.before)===replacementGroup(row.after));
      if(!prior)continue;
      row.status='replaced';
      row.before=prior.before;
      replacementRemovals.add(prior);
    }
    rows=rows.filter(row=>!replacementRemovals.has(row));

    const counts={new:0,changed:0,remove:0,replaced:0,unchanged:0};
    rows.forEach(row=>{counts[row.status]=(counts[row.status]||0)+1;});
    return{
      rows,
      counts,
      material:rows.some(row=>row.status!=='unchanged'),
      changedTaskCount:counts.new+counts.changed+counts.remove+counts.replaced,
    };
  }
  function publishedForSystem(system){
    return (Array.isArray(publishedDocument?.orders)?publishedDocument.orders:[])
      .filter(order=>norm(order?.system)===norm(system));
  }
  function diffForItem(item){
    if(!publishedLoaded)return{rows:(item?.tasks||[]).map(task=>({status:'plain',after:task,before:null})),counts:{},material:false,changedTaskCount:0};
    return comparePlans(publishedForSystem(item.system),item.tasks||[]);
  }
  function targetText(order){
    const target=num(order?.reporting?.target);
    if(target===null)return'';
    const type=clean(order?.reporting?.type);
    if(type==='inf')return target+' INF';
    if(['bounties','trade','exploration'].includes(type))return target+'M Cr';
    if(type==='cz')return target+' CZ pts';
    return String(target);
  }
  function targetDelta(row){
    if(!row?.before||!row?.after)return'';
    const before=targetText(row.before),after=targetText(row.after);
    return before&&after&&before!==after?before+' → '+after:'';
  }
  function hashText(value){
    let hash=2166136261;
    for(let i=0;i<value.length;i++){
      hash^=value.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return (hash>>>0).toString(36);
  }
  function changeSignature(item){
    const before=publishedForSystem(item.system).map(materialFingerprint).sort();
    const after=(item.tasks||[]).map(materialFingerprint).sort();
    return hashText(JSON.stringify({cycleId:publishedDocument?.cycleId||'',system:item.system,before,after}));
  }
  function isReviewed(item,diff=diffForItem(item)){
    return !diff.material || reviewState?.[item.system]?.signature===changeSignature(item);
  }
  function changeSummary(systems){
    const states=systems.map(item=>{
      const diff=diffForItem(item);
      const signature=diff.material?changeSignature(item):'';
      const reviewed=!diff.material||reviewState?.[item.system]?.signature===signature;
      return{item,diff,signature,reviewed};
    });
    const material=states.filter(state=>state.diff.material);
    const unreviewed=material.filter(state=>!state.reviewed);
    return{
      states,material,unreviewed,
      changedTaskCount:material.reduce((sum,state)=>sum+state.diff.changedTaskCount,0),
      unreviewedTaskCount:unreviewed.reduce((sum,state)=>sum+state.diff.changedTaskCount,0),
    };
  }

  function isLab(card){return card?.dataset.bgsLab==='true'||card?.dataset.system==='Mandalore';}
  function maxSystems(){const n=Number(document.querySelector('[data-global="maxDailySystems"]')?.value);return Number.isFinite(n)&&n>0?n:6;}

  function reportingFor(kind,amount){
    if(kind==='mission-inf')return{type:'inf',target:amount,blitz:false};
    if(kind==='conflict-cz')return{type:'cz',target:amount,blitz:false};
    if(kind==='bounties')return{type:'bounties',target:amount,blitz:false};
    if(kind==='trade')return{type:'trade',target:amount,blitz:false};
    if(kind==='exploration')return{type:'exploration',target:amount,blitz:false};
    return null;
  }

  function taskSnapshot(task,index,system,priority){
    const kind=task.dataset.orderKind||'';
    const faction=task.dataset.orderFaction||'';
    const amount=num(task.dataset.orderAmount);
    const label=clean(task.querySelector('.wolf-order-task-type')?.textContent);
    const instruction=clean(task.querySelector('strong')?.textContent)||'Operational task';
    const details=[...task.querySelectorAll('p,small')].map(el=>clean(el.textContent)).filter(Boolean);
    const optional=task.dataset.orderOptional==='true'||/\bOPTIONAL\b/i.test(label);
    const recommended=task.dataset.orderRecommended==='true'||/\bRECOMMENDED\b/i.test(label);
    const reporting=reportingFor(kind,amount);
    if(reporting)reporting.blitz=/\bBLITZ\b/i.test(task.textContent||'');
    return {
      id:'bgs-'+slug(system)+'-'+String(index+1).padStart(2,'0')+'-'+Date.now().toString(36),
      system,
      faction,
      kind,
      source:'wolf-bgs',
      priority,
      task:instruction,
      detail:details.join(' ').slice(0,900),
      status:optional?'Optional':recommended?'Recommended':'Active',
      reporting,
    };
  }

  function currentSignature(card){
    return [...card.querySelectorAll('[data-order-preview-output] .wolf-order-task')].map(task=>[
      task.dataset.orderKind||'',task.dataset.orderFaction||'',task.dataset.orderAmount||'',clean(task.textContent)
    ].join('|')).join('||');
  }

  function snapshot(card,queueSource='manual'){
    const system=card.dataset.system||'';
    const priority=card.querySelector('[data-setting="priority"]')?.value||'normal';
    const tasks=[...card.querySelectorAll('[data-order-preview-output] .wolf-order-task')].map((task,index)=>taskSnapshot(task,index,system,priority));
    const warnings=[...card.querySelectorAll('[data-order-preview-output] .wolf-order-warnings li')].map(el=>clean(el.textContent)).filter(Boolean);
    return {system,priority,tasks,warnings,signature:currentSignature(card),queuedAt:new Date().toISOString(),queueSource};
  }

  function removalSnapshot(card){
    const system=card.dataset.system||'';
    const priority=card.querySelector('[data-setting="priority"]')?.value||'normal';
    return {
      system,
      priority,
      tasks:[],
      warnings:[],
      signature:currentSignature(card),
      queuedAt:new Date().toISOString(),
      queueSource:'removal',
      queueRevisionChanged:true,
    };
  }

  function shouldQueuePublishedRemoval(card,existing){
    const system=card?.dataset.system||'';
    if(!system||!publishedLoaded||!publishedForSystem(system).length)return false;
    const selectorFlag=card.dataset.queueSelected==='true';
    const retreatFlag=card.dataset.retreatPending==='true';
    const wasAutoManaged=['selector','retreat','removal'].includes(existing?.queueSource);
    return selectorFlag||retreatFlag||wasAutoManaged;
  }

  function eligible(card){
    if(!card||isLab(card))return false;
    const allowed=card.querySelector('[data-setting="allowDailyOrders"]');
    if(allowed&&!allowed.checked)return false;
    return card.querySelectorAll('[data-order-preview-output] .wolf-order-task').length>0;
  }


  function autoQueueSource(card){
    if(!eligible(card))return '';
    const allow=card.querySelector('[data-setting="allowDailyOrders"]');
    if(allow&&!allow.checked)return '';
    const retreat=card.dataset.retreatPending==='true';
    const reactRetreat=card.querySelector('[data-setting="reactRetreat"]');
    if(retreat&&(!reactRetreat||reactRetreat.checked))return 'retreat';
    const selected=card.dataset.queueSelected==='true';
    const auto=card.querySelector('[data-setting="autoGenerateOrders"]');
    if(selected&&(!auto||auto.checked))return 'selector';
    return '';
  }

  function autoSyncCard(card){
    if(!card||isLab(card))return false;
    const system=card.dataset.system||'';
    if(!system)return false;
    const existing=queue.get(system);
    const hasPreview=Boolean(card.querySelector('[data-order-preview-output]'));
    const selectorFlag=card.dataset.queueSelected==='true';
    const retreatFlag=card.dataset.retreatPending==='true';

    // Lazy cards may temporarily have no mounted preview after a list rerender.
    // Preserve an existing auto candidate until the card is hydrated again,
    // unless the condition that authorized it has actually been removed.
    if(!hasPreview){
      if(existing?.queueSource==='selector'&&!selectorFlag){queue.delete(system);return true;}
      if(existing?.queueSource==='retreat'&&!retreatFlag&&!selectorFlag){queue.delete(system);return true;}
      if(existing?.queueSource==='removal'&&!selectorFlag&&!retreatFlag){queue.delete(system);return true;}
      return false;
    }

    const source=autoQueueSource(card);
    const sig=currentSignature(card);

    if(!source){
      if(shouldQueuePublishedRemoval(card,existing)){
        if(suppressedSignatures.get(system)===sig)return false;
        if(suppressedSignatures.has(system)&&suppressedSignatures.get(system)!==sig)suppressedSignatures.delete(system);
        if(existing?.queueSource==='manual')return false;
        if(existing?.queueSource==='removal'&&existing.signature===sig)return false;
        queue.set(system,removalSnapshot(card));
        return true;
      }
      if(existing&&['selector','retreat','removal'].includes(existing.queueSource)){
        queue.delete(system);
        return true;
      }
      return false;
    }

    if(suppressedSignatures.get(system)===sig)return false;
    if(suppressedSignatures.has(system)&&suppressedSignatures.get(system)!==sig)suppressedSignatures.delete(system);
    if(existing?.queueSource==='manual')return false;
    if(existing&&existing.signature===sig&&existing.queueSource===source)return false;
    const next=snapshot(card,source);
    if(existing&&existing.signature!==next.signature){
      next.queueRevisionChanged=comparePlans(existing.tasks,next.tasks).material;
    }
    queue.set(system,next);
    return true;
  }

  function sourceLabel(item){
    if(item.queueSource==='retreat')return 'AUTO · RETREAT';
    if(item.queueSource==='selector')return 'AUTO · QUEUE SELECTOR';
    if(item.queueSource==='removal')return 'AUTO · ORDER REMOVAL';
    return 'MANUAL';
  }

  function queuedTaskMarkup(row,index){
    const status=row?.status||'plain';
    const order=row?.after||row?.before||{};
    const labels={new:'NEW',changed:'CHANGED',remove:'REMOVE',replaced:'REPLACED',unchanged:'UNCHANGED'};
    const chip=labels[status]
      ? '<span class="wolf-queue-diff-status is-'+status+'">'+labels[status]+'</span>'
      : '';
    const delta=targetDelta(row);
    return '<div class="wolf-publish-order-row is-'+esc(status)+'">'
      +'<div class="wolf-publish-order-index">'+String(index+1).padStart(2,'0')+'</div>'
      +'<div class="wolf-publish-order-line">'+chip
      +'<strong>'+esc(order.task||'Operational task')+'</strong>'
      +(delta?'<em>'+esc(delta)+'</em>':'')
      +'</div></div>';
  }

  function queuedSystemMarkup(item){
    const expanded=expandedSystems.has(item.system);
    const diff=diffForItem(item);
    const reviewed=isReviewed(item,diff);
    const diffChip=diff.material
      ? '<b class="wolf-queue-diff-chip'+(reviewed?' is-reviewed':' is-unreviewed')+'">'+(reviewed?'PLAN CHANGE REVIEWED':'PLAN CHANGED')+'</b>'
      : '';
    const removalChip=(Number(diff.counts?.remove||0)+Number(diff.counts?.replaced||0))>0
      ? '<b class="wolf-queue-diff-chip is-remove">REMOVES ORDERS</b>'
      : '';
    const freshChip=item.queueRevisionChanged&&diff.material&&['selector','retreat'].includes(item.queueSource)
      ? '<b class="wolf-queue-diff-chip is-fresh">FRESH DATA</b>'
      : '';
    const rows=diff.rows?.length?diff.rows:(item.tasks||[]).map(task=>({status:'plain',after:task,before:null}));
    const classes=[
      'wolf-publish-queued-system',
      expanded?'is-expanded':'',
      diff.material?'has-plan-change':'',
      diff.material&&!reviewed?'has-unreviewed-change':'',
    ].filter(Boolean).join(' ');
    return '<article class="'+classes+'">'
      +'<div class="wolf-publish-queued-head"><div>'
      +'<button type="button" class="wolf-publish-system-link" data-open-queued-system="'+esc(item.system)+'" title="Open the full '+esc(item.system)+' system card">'+esc(item.system)+'</button>'
      +'<span><b class="wolf-queue-source '+esc(item.queueSource||'manual')+'">'+esc(sourceLabel(item))+'</b> · '
      +(item.queueSource==='removal'?'0 replacement tasks':item.tasks.length+' task'+(item.tasks.length===1?'':'s'))+' · '+esc(item.priority)
      +(item.warnings.length?' · '+item.warnings.length+' warning'+(item.warnings.length===1?'':'s'):'')
      +(diffChip?' · '+diffChip:'')+(removalChip?' · '+removalChip:'')+(freshChip?' · '+freshChip:'')
      +'</span></div>'
      +'<div class="wolf-publish-queued-actions"><button type="button" class="wolf-publish-review-toggle" data-toggle-queued-system="'+esc(item.system)+'" aria-expanded="'+String(expanded)+'">'+(expanded?'HIDE ORDERS':'VIEW ORDERS')+'</button>'
      +'<button type="button" class="wolf-publish-remove" data-remove-queued-system="'+esc(item.system)+'" title="Hold this current queue candidate out" aria-label="Remove '+esc(item.system)+' from publish queue">×</button></div></div>'
      +'<div class="wolf-publish-order-detail"'+(expanded?'':' hidden')+'>'
      +'<div class="wolf-publish-order-list">'+rows.map(queuedTaskMarkup).join('')+'</div>'
      +'</div></article>';
  }

  function suppressCurrent(item){
    if(item?.system&&item?.signature)suppressedSignatures.set(item.system,item.signature);
  }


  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function evaluationFingerprint(card){
    return [card.dataset.snapshotTime||'',card.dataset.settingsUpdated||'',card.dataset.queueSelected||'',card.dataset.retreatPending||''].join('|');
  }

  async function waitForPreview(card,timeout=5000){
    const start=Date.now();
    while(Date.now()-start<timeout){
      const host=card.querySelector('[data-order-preview-output]');
      const text=clean(host?.textContent||'');
      if(host && !/Generating preview|Calculating whole-board preview/i.test(text) &&
        (host.querySelector('.wolf-order-task') || host.querySelector('.wolf-order-empty') || host.querySelector('.wolf-order-warnings') || host.querySelector('.wolf-order-ready'))) return true;
      await wait(70);
    }
    return false;
  }

  async function evaluateOperationalCards({forceSystem=''}={}){
    if(evaluationRunning)return;
    if(document.querySelector('.wolf-system-card[open]:not(.wolf-auto-evaluating)') && !forceSystem)return;
    evaluationRunning=true;
    try{
      const cards=[...document.querySelectorAll('.wolf-system-card')].filter(card=>{
        if(isLab(card))return false;
        if(forceSystem)return card.dataset.system===forceSystem;
        return card.dataset.queueSelected==='true'||card.dataset.retreatPending==='true';
      });
      for(const card of cards){
        const system=card.dataset.system||'';
        const fingerprint=evaluationFingerprint(card);
        if(!forceSystem && evaluatedFingerprints.get(system)===fingerprint)continue;
        const wasOpen=card.open;
        if(!wasOpen){
          card.classList.add('wolf-auto-evaluating');
          card.open=true;
          await wait(60);
        }
        const ready=await waitForPreview(card);
        if(ready){
          autoSyncCard(card);
          evaluatedFingerprints.set(system,fingerprint);
        }else{
          evaluatedFingerprints.delete(system);
        }
        if(!wasOpen){
          card.open=false;
          await wait(20);
          card.classList.remove('wolf-auto-evaluating');
        }
      }
    }finally{
      evaluationRunning=false;
      syncAll();
    }
  }

  function scheduleOperationalEvaluation(options={}){
    window.setTimeout(()=>evaluateOperationalCards(options),140);
  }

  async function loadPublishedContext(){
    try{
      const [ordersResponse,reviewResponse]=await Promise.all([
        fetch(ORDERS_API+'?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
        fetch(REVIEW_API+'?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
      ]);
      if(!ordersResponse.ok)throw new Error('Published Daily Orders unavailable ('+ordersResponse.status+')');
      const orders=await ordersResponse.json();
      const review=reviewResponse.ok?await reviewResponse.json():{reviews:{}};
      publishedDocument={
        cycleId:orders?.cycleId||null,
        orders:Array.isArray(orders?.orders)?orders.orders:[],
      };
      reviewState=review?.reviews&&typeof review.reviews==='object'?review.reviews:{};
      publishedLoaded=true;
      publishedContextLoadedAt=Date.now();
      queueRenderSignature='';
      syncAll();
    }catch(error){
      console.error('Could not load published Daily Orders comparison',error);
      publishedLoaded=false;
      syncPanel();
    }
  }

  async function acknowledgeOrderChanges(){
    if(changeAckBusy||!publishedLoaded)return;
    const summary=changeSummary([...queue.values()]);
    const reviews=summary.unreviewed.map(state=>({system:state.item.system,signature:state.signature}));
    if(!reviews.length)return;
    changeAckBusy=true;
    syncPanel();
    try{
      const response=await fetch(REVIEW_API,{
        method:'PUT',credentials:'same-origin',cache:'no-store',
        headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-bgs-order-review'},
        body:JSON.stringify({reviews}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('Review failed ('+response.status+')'));
      reviewState=data.reviews&&typeof data.reviews==='object'?data.reviews:reviewState;
      queueRenderSignature='';
    }catch(error){
      console.error('Could not acknowledge Daily Order changes',error);
    }finally{
      changeAckBusy=false;
      syncPanel();
    }
  }

  function ensurePanel(){
    if(panel)return panel;
    const privateRoot=document.querySelector('[data-wolf-private]');
    const systems=document.querySelector('.wolf-systems-section');
    if(!privateRoot||!systems)return null;
    const section=document.createElement('section');
    section.className='section-sm wolf-publish-section';
    section.dataset.dailyPublishPanel='true';
    section.innerHTML='<div class="container"><div class="wolf-publish-panel"><div class="wolf-publish-head"><div><span>DAILY ORDERS</span><h2>Publish Queue</h2><p>Queue Selectors feed routine work here automatically; pending Retreat can bypass the selector as an emergency. PLAN CHANGED highlights differences from the orders members currently see in Mission Control. Publishing is always Wolf-controlled.</p></div><div class="wolf-publish-command"><button type="button" class="wolf-order-change-alert is-extinguished" data-order-change-alert disabled><span>ORDER CHANGES</span><strong data-order-change-state>REVIEWED</strong><small data-order-change-substate>NO PENDING CHANGES</small></button><div class="wolf-publish-count"><strong data-publish-system-count>0 / 6</strong><small data-publish-task-count>0 tasks queued</small></div></div></div><div class="wolf-publish-queue" data-publish-queue><div class="wolf-publish-empty">No systems queued. Selected routine systems and pending Retreat emergencies will appear here when they generate actionable work.</div></div><div class="wolf-publish-actions"><span data-publish-status>Nothing published from BGS Control yet.</span><div><button type="button" class="btn btn-secondary btn-compact" data-clear-publish-queue disabled>Clear Queue</button><button type="button" class="btn btn-primary" data-publish-daily-orders disabled>Publish Daily Orders</button></div></div></div></div>';
    systems.parentNode.insertBefore(section,systems);
    panel=section;
    queueRenderSignature='';
    panel.addEventListener('click',event=>{
      if(event.target.closest('[data-order-change-alert]')){
        acknowledgeOrderChanges();
        return;
      }
      const openSystem=event.target.closest('[data-open-queued-system]');
      if(openSystem){
        window.dispatchEvent(new CustomEvent('wolf-bgs-open-system',{detail:{system:openSystem.dataset.openQueuedSystem||''}}));
        return;
      }
      const toggle=event.target.closest('[data-toggle-queued-system]');
      if(toggle){
        const system=toggle.dataset.toggleQueuedSystem||'';
        const card=toggle.closest('.wolf-publish-queued-system');
        const detail=card?.querySelector('.wolf-publish-order-detail');
        const expanded=expandedSystems.has(system);
        if(expanded){
          expandedSystems.delete(system);
          card?.classList.remove('is-expanded');
          if(detail)detail.hidden=true;
          toggle.textContent='VIEW ORDERS';
          toggle.setAttribute('aria-expanded','false');
        }else{
          expandedSystems.add(system);
          card?.classList.add('is-expanded');
          if(detail)detail.hidden=false;
          toggle.textContent='HIDE ORDERS';
          toggle.setAttribute('aria-expanded','true');
        }
        return;
      }
      const remove=event.target.closest('[data-remove-queued-system]');
      if(remove){
        lastPublishError='';
        const item=queue.get(remove.dataset.removeQueuedSystem);
        suppressCurrent(item);
        expandedSystems.delete(remove.dataset.removeQueuedSystem);
        queue.delete(remove.dataset.removeQueuedSystem);
        syncAll();
        return;
      }
      if(event.target.closest('[data-clear-publish-queue]')){
        lastPublishError='';
        [...queue.values()].forEach(suppressCurrent);
        queue.clear();
        expandedSystems.clear();
        syncAll();
        return;
      }
      if(event.target.closest('[data-publish-daily-orders]'))publish();
    });
    syncPanel();
    return panel;
  }

  function enhanceCard(card){
    if(!card||isLab(card))return;
    const host=card.querySelector('[data-order-preview-output]');
    const head=host?.querySelector('.wolf-order-preview-head');
    if(!host||!head)return;
    const legacy=head.querySelector('button[disabled]');
    if(legacy&&/Publish disabled/i.test(legacy.textContent||''))legacy.remove();
    let button=head.querySelector('[data-queue-preview]');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='btn btn-secondary btn-compact';
      button.dataset.queuePreview='true';
      head.append(button);
      button.addEventListener('click',()=>{
        const system=card.dataset.system||'';
        if(!eligible(card))return;
        const existing=queue.get(system);
        const sig=currentSignature(card);
        lastPublishError='';
        if(existing&&existing.signature===sig){
          suppressCurrent(existing);
          queue.delete(system);
        }else{
          suppressedSignatures.delete(system);
          const next=snapshot(card,'manual');
          if(existing&&existing.signature!==next.signature)next.queueRevisionChanged=comparePlans(existing.tasks,next.tasks).material;
          queue.set(system,next);
        }
        syncAll();
      });
    }
    const system=card.dataset.system||'';
    const existing=queue.get(system);
    const sig=currentSignature(card);
    const ok=eligible(card);
    button.disabled=!ok;
    button.classList.toggle('is-queued',Boolean(existing&&existing.signature===sig));
    button.classList.toggle('is-stale',Boolean(existing&&existing.signature!==sig));
    let nextText='';
    if(!ok){
      nextText=card.querySelector('[data-setting="allowDailyOrders"]')?.checked===false?'Daily Orders disabled':'No tasks to queue';
      button.title='Enable Allow into Daily Orders and generate at least one task.';
    }else if(existing&&existing.signature!==sig){
      nextText='Refresh Queued Preview';
      button.title='The preview changed after it was queued. Click to replace the queued snapshot.';
    }else if(existing){
      nextText='✓ Queued for Daily Orders';
      button.title='Click to remove this system from the publish queue.';
    }else{
      nextText='Add to Publish Queue';
      button.title='Queue this reviewed preview for the next Daily Orders publish.';
    }
    if(button.textContent!==nextText)button.textContent=nextText;
  }

  function syncPanel(){
    const p=ensurePanel();if(!p)return;
    const systems=[...queue.values()];
    const taskCount=systems.reduce((sum,item)=>sum+item.tasks.length,0);
    const warnings=systems.reduce((sum,item)=>sum+item.warnings.length,0);
    const changes=publishedLoaded?changeSummary(systems):{material:[],unreviewed:[],changedTaskCount:0,unreviewedTaskCount:0};
    const changeAlert=p.querySelector('[data-order-change-alert]');
    const changeState=p.querySelector('[data-order-change-state]');
    const changeSubstate=p.querySelector('[data-order-change-substate]');
    if(changeAlert){
      const active=changes.unreviewed.length>0;
      changeAlert.disabled=!active||changeAckBusy;
      changeAlert.classList.toggle('is-active',active);
      changeAlert.classList.toggle('is-extinguished',!active);
      if(changeState)changeState.textContent=changeAckBusy?'REVIEWING':active?'ACKNOWLEDGE':'REVIEWED';
      if(changeSubstate){
        changeSubstate.textContent=!publishedLoaded
          ? 'CHECKING MISSION CONTROL'
          : active
            ? changes.unreviewed.length+' SYSTEM'+(changes.unreviewed.length===1?'':'S')+' · '+changes.unreviewedTaskCount+' CHANGE'+(changes.unreviewedTaskCount===1?'':'S')
            : changes.material.length
              ? changes.changedTaskCount+' CHANGE'+(changes.changedTaskCount===1?'':'S')+' REVIEWED'
              : 'NO PENDING CHANGES';
      }
      changeAlert.setAttribute('aria-label',active
        ? 'Acknowledge '+changes.unreviewedTaskCount+' queued Daily Order changes across '+changes.unreviewed.length+' systems'
        : 'No unreviewed Daily Order changes');
    }
    p.querySelector('[data-publish-system-count]').textContent=systems.length+' / '+maxSystems();
    p.querySelector('[data-publish-task-count]').textContent=taskCount+' task'+(taskCount===1?'':'s')+' queued'+(warnings?' · '+warnings+' warning'+(warnings===1?'':'s'):'');
    const host=p.querySelector('[data-publish-queue]');
    const nextQueueSignature=JSON.stringify(systems.map(item=>({
      system:item.system,
      priority:item.priority,
      queueSource:item.queueSource,
      signature:item.signature,
      queueRevisionChanged:Boolean(item.queueRevisionChanged),
      warnings:item.warnings,
      tasks:item.tasks.map(task=>({
        id:task.id,
        faction:task.faction,
        kind:task.kind,
        task:task.task,
        detail:task.detail,
        status:task.status,
        reporting:task.reporting,
      })),
    })));
    if(nextQueueSignature!==queueRenderSignature){
      queueRenderSignature=nextQueueSignature;
      if(!systems.length){
        host.innerHTML='<div class="wolf-publish-empty">No systems queued. Selected routine systems and pending Retreat emergencies will appear here when they generate actionable work.</div>';
      }else{
        host.innerHTML=systems.map(queuedSystemMarkup).join('');
      }
    }
    const clear=p.querySelector('[data-clear-publish-queue]');
    const publishButton=p.querySelector('[data-publish-daily-orders]');
    if(clear)clear.disabled=!systems.length||publishBusy;
    const overSystems=systems.length>maxSystems(), overTasks=taskCount>24;
    if(publishButton){
      publishButton.disabled=!systems.length||overSystems||overTasks||publishBusy;
      publishButton.textContent=publishBusy?'Publishing…':'Publish Daily Orders';
    }
    const status=p.querySelector('[data-publish-status]');
    if(status&&!publishBusy){
      if(systems.length&&lastPublishError){status.textContent=lastPublishError;status.dataset.state='error';}
      else if(systems.length){lastPublishMessage='';status.dataset.state='';}
      if(lastPublishError&&systems.length){}
      else if(overSystems)status.textContent='Queue exceeds the '+maxSystems()+'-system Daily Orders limit.';
      else if(overTasks)status.textContent='Queue has '+taskCount+' tasks; the Daily Orders API supports at most 24 per cycle.';
      else if(changes.unreviewed.length)status.textContent=changes.unreviewedTaskCount+' material Daily Order change'+(changes.unreviewedTaskCount===1?'':'s')+' across '+changes.unreviewed.length+' system'+(changes.unreviewed.length===1?'':'s')+' need review. Publishing remains available as an explicit override.';
      else if(systems.length)status.textContent='Ready to reconcile these systems into the current Daily Orders cycle. Review warnings before continuing.';
      else if(lastPublishMessage){status.innerHTML=lastPublishMessage;status.dataset.state='success';}
      else status.textContent='Nothing published from BGS Control yet.';
    }
  }

  function syncAll(){
    if(syncing)return;
    syncing=true;
    const cards=[...document.querySelectorAll('.wolf-system-card')];
    cards.forEach(autoSyncCard);
    syncPanel();
    cards.forEach(enhanceCard);
    syncing=false;
  }

  async function publish(){
    if(publishBusy||!queue.size)return;
    const systems=[...queue.values()];
    const taskCount=systems.reduce((sum,item)=>sum+item.tasks.length,0);
    const warningCount=systems.reduce((sum,item)=>sum+item.warnings.length,0);
    if(systems.length>maxSystems()||taskCount>24)return;
    const warningText=warningCount?'\n\n'+warningCount+' preview warning'+(warningCount===1?' remains':'s remain')+' in the queued systems. Publishing is an explicit Wolf override.':'';
    const changeReview=publishedLoaded?changeSummary(systems):{material:[],unreviewed:[]};
    const totals={new:0,changed:0,remove:0,replaced:0,unchanged:0};
    changeReview.material.forEach(state=>{
      for(const key of Object.keys(totals))totals[key]+=Number(state.diff.counts?.[key]||0);
    });
    const changeParts=[
      totals.new?totals.new+' added':'',
      totals.changed?totals.changed+' changed':'',
      totals.replaced?totals.replaced+' replaced':'',
      totals.remove?totals.remove+' removed':'',
      totals.unchanged?totals.unchanged+' unchanged':'',
    ].filter(Boolean);
    const changeText=changeParts.length
      ? '\n\nPlan vs current Mission Control: '+changeParts.join(' · ')+'.'
        +(changeReview.unreviewed.length?'\n'+changeReview.unreviewed.length+' system'+(changeReview.unreviewed.length===1?' has':'s have')+' unreviewed order changes.':'')
      : '';
    const names=systems.map(item=>item.system).join(', ');
    if(!window.confirm('Publish '+taskCount+' task'+(taskCount===1?'':'s')+' across '+systems.length+' system'+(systems.length===1?'':'s')+'?\n\nSystems: '+names+changeText+'\n\nQueued systems will be reconciled into the CURRENT Daily Orders cycle. Unrelated systems remain published. Matching logical tasks keep their order identity, member progress, and future reward history; removed tasks from these queued systems stop being actionable.'+warningText))return;

    publishBusy=true;syncPanel();
    const status=panel?.querySelector('[data-publish-status]');if(status)status.textContent='Publishing reviewed BGS orders…';
    const orders=systems.flatMap(item=>item.tasks);
    try{
      const response=await fetch(ORDERS_API,{
        method:'PUT',credentials:'same-origin',cache:'no-store',
        headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'daily-orders-editor'},
        body:JSON.stringify({
          publishMode:'reconcile',
          reconcileSystems:systems.map(item=>item.system),
          title:'Squadron Daily Orders',
          briefing:'Generated from reviewed Wolf BGS Control previews. Open the system card for the full briefing, execute the ordered work, and report results beside the orders.',
          officerNote:'',
          orders,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('Publish failed ('+response.status+')'));
      lastPublishError='';
      lastPublishMessage='Reconciled '+orders.length+' task'+(orders.length===1?'':'s')+' into the current Daily Orders cycle. Unrelated systems were preserved. <a href="../operations/#daily-orders">Open Mission Control →</a>';
      publishedDocument={cycleId:data?.cycleId||publishedDocument.cycleId,orders:Array.isArray(data?.orders)?data.orders:publishedDocument.orders};
      publishedLoaded=true;
      queueRenderSignature='';
      systems.forEach(suppressCurrent);
      queue.clear();
      expandedSystems.clear();
      syncAll();
    }catch(error){
      console.error('Could not publish BGS Daily Orders',error);
      lastPublishError='Could not publish Daily Orders. The existing member order set remains in place.';
      if(status){status.textContent=lastPublishError;status.dataset.state='error';}
    }finally{
      publishBusy=false;syncPanel();
    }
  }

  function observe(){
    ensurePanel();
    loadPublishedContext();
    const root=document.querySelector('[data-system-list]')||document.querySelector('[data-wolf-private]')||document.body;
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;queued=true;
      setTimeout(()=>{queued=false;syncAll();},60);
    }).observe(root,{childList:true,subtree:true});
    document.addEventListener('change',event=>{
      if(event.target.matches('[data-setting="allowDailyOrders"],[data-setting="autoGenerateOrders"],[data-setting="reactRetreat"],[data-global="maxDailySystems"]'))setTimeout(syncAll,0);
    });
    window.addEventListener('wolf-bgs-queue-selector-updated',event=>{
      const system=event.detail?.system||'';
      const selected=Boolean(event.detail?.selected);
      evaluatedFingerprints.delete(system);
      if(selected){
        suppressedSignatures.delete(system);
        scheduleOperationalEvaluation({forceSystem:system});
      }else{
        const item=queue.get(system);
        if(['selector','removal'].includes(item?.queueSource))queue.delete(system);
        suppressedSignatures.delete(system);
        setTimeout(syncAll,0);
      }
    });
    window.addEventListener('wolf-bgs-payload-updated',()=>{
      setTimeout(syncAll,70);
      scheduleOperationalEvaluation();
    });
    const refreshPublishedIfStale=()=>{
      if(Date.now()-publishedContextLoadedAt>60000)loadPublishedContext();
    };
    window.addEventListener('focus',refreshPublishedIfStale);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPublishedIfStale();});
    syncAll();
    setTimeout(syncAll,250);
    setTimeout(()=>{syncAll();scheduleOperationalEvaluation();},700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();