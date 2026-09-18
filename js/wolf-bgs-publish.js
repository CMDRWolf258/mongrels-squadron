(() => {
  const ORDERS_API='/api/operations/orders';
  const queue=new Map();
  let panel=null;
  let publishBusy=false;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
  const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,44)||'system';
  const num=value=>value===''||value===null||value===undefined?null:(Number.isFinite(Number(value))?Number(value):null);

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

  function snapshot(card){
    const system=card.dataset.system||'';
    const priority=card.querySelector('[data-setting="priority"]')?.value||'normal';
    const tasks=[...card.querySelectorAll('[data-order-preview-output] .wolf-order-task')].map((task,index)=>taskSnapshot(task,index,system,priority));
    const warnings=[...card.querySelectorAll('[data-order-preview-output] .wolf-order-warnings li')].map(el=>clean(el.textContent)).filter(Boolean);
    return {system,priority,tasks,warnings,signature:currentSignature(card),queuedAt:new Date().toISOString()};
  }

  function eligible(card){
    if(!card||isLab(card))return false;
    const allowed=card.querySelector('[data-setting="allowDailyOrders"]');
    if(allowed&&!allowed.checked)return false;
    return card.querySelectorAll('[data-order-preview-output] .wolf-order-task').length>0;
  }

  function ensurePanel(){
    if(panel)return panel;
    const privateRoot=document.querySelector('[data-wolf-private]');
    const systems=document.querySelector('.wolf-systems-section');
    if(!privateRoot||!systems)return null;
    const section=document.createElement('section');
    section.className='section-sm wolf-publish-section';
    section.dataset.dailyPublishPanel='true';
    section.innerHTML='<div class="container"><div class="wolf-publish-panel"><div class="wolf-publish-head"><div><span>DAILY ORDERS</span><h2>Publish Queue</h2><p>Queue reviewed live-system previews here. Publishing replaces the current Daily Orders set and starts a new member-reporting cycle.</p></div><div class="wolf-publish-count"><strong data-publish-system-count>0 / 6</strong><small data-publish-task-count>0 tasks queued</small></div></div><div class="wolf-publish-queue" data-publish-queue><div class="wolf-publish-empty">No systems queued yet. Add a reviewed preview from any live system card.</div></div><div class="wolf-publish-actions"><span data-publish-status>Nothing published from BGS Control yet.</span><div><button type="button" class="btn btn-secondary btn-compact" data-clear-publish-queue disabled>Clear Queue</button><button type="button" class="btn btn-primary" data-publish-daily-orders disabled>Publish Daily Orders</button></div></div></div></div>';
    systems.parentNode.insertBefore(section,systems);
    panel=section;
    panel.addEventListener('click',event=>{
      const remove=event.target.closest('[data-remove-queued-system]');
      if(remove){queue.delete(remove.dataset.removeQueuedSystem);syncAll();return;}
      if(event.target.closest('[data-clear-publish-queue]')){queue.clear();syncAll();return;}
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
        if(existing&&existing.signature===sig){queue.delete(system);}
        else{queue.set(system,snapshot(card));}
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
    if(!ok){
      button.textContent=card.querySelector('[data-setting="allowDailyOrders"]')?.checked===false?'Daily Orders disabled':'No tasks to queue';
      button.title='Enable Allow into Daily Orders and generate at least one task.';
    }else if(existing&&existing.signature!==sig){
      button.textContent='Refresh Queued Preview';
      button.title='The preview changed after it was queued. Click to replace the queued snapshot.';
    }else if(existing){
      button.textContent='✓ Queued for Daily Orders';
      button.title='Click to remove this system from the publish queue.';
    }else{
      button.textContent='Add to Publish Queue';
      button.title='Queue this reviewed preview for the next Daily Orders publish.';
    }
  }

  function syncPanel(){
    const p=ensurePanel();if(!p)return;
    const systems=[...queue.values()];
    const taskCount=systems.reduce((sum,item)=>sum+item.tasks.length,0);
    const warnings=systems.reduce((sum,item)=>sum+item.warnings.length,0);
    p.querySelector('[data-publish-system-count]').textContent=systems.length+' / '+maxSystems();
    p.querySelector('[data-publish-task-count]').textContent=taskCount+' task'+(taskCount===1?'':'s')+' queued'+(warnings?' · '+warnings+' warning'+(warnings===1?'':'s'):'');
    const host=p.querySelector('[data-publish-queue]');
    if(!systems.length){
      host.innerHTML='<div class="wolf-publish-empty">No systems queued yet. Add a reviewed preview from any live system card.</div>';
    }else{
      host.innerHTML=systems.map(item=>'<article class="wolf-publish-queued-system"><div><strong>'+esc(item.system)+'</strong><span>'+item.tasks.length+' task'+(item.tasks.length===1?'':'s')+' · '+esc(item.priority)+(item.warnings.length?' · '+item.warnings.length+' warning'+(item.warnings.length===1?'':'s'):'')+'</span></div><button type="button" data-remove-queued-system="'+esc(item.system)+'" title="Remove from queue">×</button></article>').join('');
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
      if(overSystems)status.textContent='Queue exceeds the '+maxSystems()+'-system Daily Orders limit.';
      else if(overTasks)status.textContent='Queue has '+taskCount+' tasks; the Daily Orders API supports at most 24 per cycle.';
      else if(systems.length)status.textContent='Ready to publish a new reporting cycle. Review warnings before continuing.';
      else status.textContent='Nothing published from BGS Control yet.';
    }
  }

  function syncAll(){
    syncPanel();
    document.querySelectorAll('.wolf-system-card').forEach(enhanceCard);
  }

  async function publish(){
    if(publishBusy||!queue.size)return;
    const systems=[...queue.values()];
    const taskCount=systems.reduce((sum,item)=>sum+item.tasks.length,0);
    const warningCount=systems.reduce((sum,item)=>sum+item.warnings.length,0);
    if(systems.length>maxSystems()||taskCount>24)return;
    const warningText=warningCount?'\n\n'+warningCount+' preview warning'+(warningCount===1?' remains':'s remain')+' in the queued systems. Publishing is an explicit Wolf override.':'';
    const names=systems.map(item=>item.system).join(', ');
    if(!window.confirm('Publish '+taskCount+' task'+(taskCount===1?'':'s')+' across '+systems.length+' system'+(systems.length===1?'':'s')+'?\n\nSystems: '+names+'\n\nThis replaces the current Daily Orders set and starts a NEW reporting cycle. Existing report history is retained, but current progress will reset for members.'+warningText))return;

    publishBusy=true;syncPanel();
    const status=panel?.querySelector('[data-publish-status]');if(status)status.textContent='Publishing reviewed BGS orders…';
    const orders=systems.flatMap(item=>item.tasks);
    try{
      const response=await fetch(ORDERS_API,{
        method:'PUT',credentials:'same-origin',cache:'no-store',
        headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'daily-orders-editor'},
        body:JSON.stringify({
          title:'Squadron Daily Orders',
          briefing:'Generated from reviewed Wolf BGS Control previews. Open the system card for the full briefing, execute the ordered work, and report results beside the orders.',
          officerNote:'Published from Wolf BGS Control.',
          orders,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('Publish failed ('+response.status+')'));
      queue.clear();
      syncAll();
      if(status){
        status.innerHTML='Published '+orders.length+' task'+(orders.length===1?'':'s')+' in a new Daily Orders cycle. <a href="../operations/#daily-orders">Open Mission Control →</a>';
        status.dataset.state='success';
      }
    }catch(error){
      console.error('Could not publish BGS Daily Orders',error);
      if(status){status.textContent='Could not publish Daily Orders. Current member orders were not intentionally replaced by this failed request.';status.dataset.state='error';}
    }finally{
      publishBusy=false;syncPanel();
    }
  }

  function observe(){
    ensurePanel();
    const root=document.querySelector('[data-wolf-private]')||document.body;
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;queued=true;
      setTimeout(()=>{queued=false;syncAll();},60);
    }).observe(root,{childList:true,subtree:true});
    document.addEventListener('change',event=>{
      if(event.target.matches('[data-setting="allowDailyOrders"],[data-global="maxDailySystems"]'))setTimeout(syncAll,0);
    });
    syncAll();
    setTimeout(syncAll,250);
    setTimeout(syncAll,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();