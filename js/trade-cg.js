(() => {
  const section=document.querySelector('[data-trade-cg]');
  const list=document.querySelector('[data-cg-list]');
  const shellStatus=document.querySelector('[data-cg-status]');
  const createButton=document.querySelector('[data-cg-create]');
  const editor=document.querySelector('[data-cg-editor]');
  const editorForm=document.querySelector('[data-cg-form]');
  if(!section||!list)return;

  let viewer=null;
  let campaigns=[];
  let canManage=false;
  let editing=null;
  const PREF_KEY='mongrels-cg-solver-v1';
  const $=selector=>document.querySelector(selector);
  const safe=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num=value=>Number(String(value??'').replace(/[^0-9.-]/g,''))||0;
  const fmt=value=>Math.round(Number(value)||0).toLocaleString();
  const fmtSigned=value=>{const n=Math.round(Number(value)||0);return(n>=0?'+':'')+n.toLocaleString();};
  const fmtLy=value=>Number.isFinite(Number(value))?Number(value).toLocaleString(undefined,{maximumFractionDigits:2})+' ly':'—';

  function manager(){return viewer&&['officer','site_admin'].includes(viewer.access);}

  async function activate(session){
    viewer=session||viewer;
    section.hidden=false;
    await load();
  }

  async function load(){
    try{
      shellStatus.textContent='Loading Community Goal operations…';
      const response=await fetch('/api/trade-cg',{credentials:'same-origin',cache:'no-store'});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to load Community Goals.');
      campaigns=Array.isArray(payload.campaigns)?payload.campaigns:[];
      canManage=Boolean(payload.canManage);
      if(createButton)createButton.hidden=!canManage;
      render();
      shellStatus.textContent=campaigns.some(item=>item.status==='active')?'Automation checks active CGs every 15 minutes.':'No active Community Goal.';
    }catch(error){
      shellStatus.textContent=error.message||'Unable to load Community Goals.';
      list.innerHTML='<div class="trade-cg-empty">Community Goal operations are unavailable.</div>';
    }
  }

  function render(){
    const active=campaigns.filter(campaign=>campaign.status==='active'&&(!campaign.endsAt||Date.parse(campaign.endsAt)>Date.now()));
    if(!active.length){
      list.innerHTML='<div class="trade-cg-empty"><strong>No active Community Goal.</strong><br>Officers can create one when Frontier opens a hauling CG.</div>';
      return;
    }
    list.replaceChildren(...active.map(campaign=>campaignCard(campaign)));
    const hash=location.hash.match(/^#cg-(.+)$/)?.[1];
    if(hash)requestAnimationFrame(()=>document.getElementById('cg-'+CSS.escape(hash))?.scrollIntoView({block:'start'}));
  }

  function campaignCard(campaign){
    const article=document.createElement('article');
    article.className='trade-cg-card';
    article.id='cg-'+campaign.id;
    const primary=campaign.primary||null;
    const pending=campaign.pendingPrimary||null;
    const automation=campaign.automation||{};
    const commodities=(campaign.commodities||[]).join(' · ');
    article.innerHTML=`
      <div class="trade-cg-card-head">
        <div><span class="eyebrow">Active Community Goal</span><h3>${safe(campaign.title)}</h3><small>${safe(campaign.destinationStation)} · ${safe(campaign.destinationSystem)}</small></div>
        <div class="trade-cg-actions">
          ${canManage?'<button class="btn btn-secondary btn-compact" type="button" data-cg-run>Run Solver Now</button><button class="btn btn-secondary btn-compact" type="button" data-cg-edit>Edit CG</button>':''}
          ${canManage&&pending?.route?'<button class="btn btn-secondary btn-compact" type="button" data-cg-promote>Promote Pending Now</button>':''}
          ${canManage?'<button class="btn btn-ghost btn-compact" type="button" data-cg-close>Close CG</button>':''}
        </div>
      </div>
      <div class="trade-cg-meta">
        <span>${safe(commodities)}</span>
        <span>Auto-check every ${fmt(automation.refreshMinutes||15)} min</span>
        <span>Primary supply ≥ ${fmt(automation.minPrimarySupply||5000)} t</span>
        <span>Fresh ≤ ${fmt(automation.primaryFreshMinutes||60)} min</span>
        <span>Replacement hold 1 hr</span>
        ${campaign.endsAt?'<span>Ends '+safe(timeLabel(campaign.endsAt))+'</span>':''}
      </div>
      <div class="trade-cg-body">
        ${primary?primaryHtml(primary,campaign):'<div class="trade-cg-route is-warning"><div><span class="trade-cg-route-label">Primary Squad Route</span><h4>Waiting for a healthy source</h4><p>The solver has not found a source that meets the campaign supply and freshness rules yet.</p></div></div>'}
        ${pending?.route?pendingHtml(pending):''}
        <div class="trade-cg-solver">
          <div class="trade-cg-solver-head"><div><strong>Find My Best CG Route</strong><small>Uses the same accepted commodities, but your own ship/range settings.</small></div></div>
          <form data-cg-search-form>
            <div class="trade-cg-solver-grid">
              <label><span>Cargo Capacity</span><input type="text" inputmode="numeric" data-number-format data-cg-cargo value="${fmt(savedPref('cargoCapacity',automation.cargoCapacity||784))}"></label>
              <label><span>Max Radius</span><input type="number" min="1" max="500" data-cg-radius value="${savedPref('radiusLy',automation.radiusLy||100)}"></label>
              <label><span>Minimum Pad</span><select data-cg-pad><option value="3">Large</option><option value="2">Medium+</option><option value="1">Small+</option><option value="0">Any</option></select></label>
              <label><span>Fleet Carriers</span><select data-cg-carriers><option value="exclude">Exclude</option><option value="include">Include</option><option value="only">Only carriers</option></select></label>
              <label><span>Rank By</span><select data-cg-ranking><option value="profit">Best Profit / Trip</option><option value="supply">Highest Source Supply</option></select></label>
            </div>
            <div class="trade-cg-solver-actions"><span data-cg-search-status>Ready.</span><button class="btn btn-primary btn-compact" type="submit">Find Best CG Routes</button></div>
          </form>
          <div class="trade-cg-results" data-cg-results></div>
        </div>
      </div>`;
    const pref=prefs();
    article.querySelector('[data-cg-pad]').value=String(pref.minPad??automation.minPad??3);
    article.querySelector('[data-cg-carriers]').value=pref.carrierMode||automation.carrierMode||'exclude';
    article.querySelector('[data-cg-ranking]').value=pref.ranking||'profit';
    article.querySelector('[data-cg-search-form]')?.addEventListener('submit',event=>searchCampaign(campaign,article,event));
    article.querySelector('[data-cg-run]')?.addEventListener('click',event=>runCampaign(campaign,event.currentTarget));
    article.querySelector('[data-cg-edit]')?.addEventListener('click',()=>openEditor(campaign));
    article.querySelector('[data-cg-promote]')?.addEventListener('click',event=>promotePending(campaign,event.currentTarget));
    article.querySelector('[data-cg-close]')?.addEventListener('click',event=>closeCampaign(campaign,event.currentTarget));
    return article;
  }

  function primaryHtml(route,campaign){
    const warning=route.state!=='healthy';
    return `<div class="trade-cg-route ${warning?'is-warning':''}">
      <div><span class="trade-cg-route-label">Primary Squad Route · ${warning?'Needs Attention':'Live'}</span><h4>${safe(route.commodity)} · ${safe(route.sourceStation)} → ${safe(campaign.destinationStation)}</h4><p>${safe(route.sourceSystem)} → ${safe(campaign.destinationSystem)} · ${safe(route.sourceFaction||'Controller unknown')}</p></div>
      <div class="trade-cg-route-metrics">
        <div><span>Profit / Trip</span><strong>${fmtSigned(route.tripProfit)} Cr</strong></div>
        <div><span>Profit / t</span><strong>${fmtSigned(route.profitPerTon)} Cr</strong></div>
        <div><span>Source Supply</span><strong>${fmt(route.sourceSupply)} t</strong></div>
        <div><span>Distance</span><strong>${fmtLy(route.distanceLy)}</strong></div>
      </div>
    </div>`;
  }

  function pendingHtml(pending){
    const route=pending.route;
    return `<div class="trade-cg-pending"><strong>⏳ Pending Primary:</strong> ${safe(route.commodity)} · ${safe(route.sourceStation)} · ${safe(route.sourceSystem)} · ${fmtSigned(route.tripProfit)} Cr/trip · ${fmt(route.sourceSupply)} t supply.<br>Auto-promotes ${safe(timeLabel(pending.promoteAfter))} if it remains #1 and healthy.</div>`;
  }

  async function searchCampaign(campaign,article,event){
    event.preventDefault();
    const form=event.currentTarget;
    const status=article.querySelector('[data-cg-search-status]');
    const results=article.querySelector('[data-cg-results]');
    const settings={
      cargoCapacity:num(form.querySelector('[data-cg-cargo]').value)||784,
      radiusLy:Number(form.querySelector('[data-cg-radius]').value)||100,
      minPad:Number(form.querySelector('[data-cg-pad]').value)||0,
      carrierMode:form.querySelector('[data-cg-carriers]').value,
      ranking:form.querySelector('[data-cg-ranking]').value,
      maxAgeMinutes:campaign.automation?.maxAgeMinutes||120,
      primaryFreshMinutes:campaign.automation?.primaryFreshMinutes||60,
      minPrimarySupply:campaign.automation?.minPrimarySupply||5000,
      limit:10,
    };
    savePrefs(settings);
    status.textContent='Building live CG market snapshot…';
    results.replaceChildren();
    try{
      const response=await fetch('/api/trade-cg/search',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-cg-search'},
        body:JSON.stringify({campaignId:campaign.id,settings}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||payload.error||'CG search failed.');
      const routes=Array.isArray(payload.results)?payload.results:[];
      status.textContent=routes.length?'Top '+routes.length+' routes from '+fmt(payload.stationCount)+' market stations.':'No matching CG supply routes found.';
      renderResults(campaign,routes,results);
    }catch(error){
      status.textContent=error.message||'CG search failed.';
      results.innerHTML='<div class="trade-cg-empty">Unable to solve CG routes with those settings.</div>';
    }
  }

  function renderResults(campaign,routes,container){
    if(!routes.length){container.innerHTML='<div class="trade-cg-empty">No current source matched the selected range, pad, freshness, and accepted cargo.</div>';return;}
    container.replaceChildren(...routes.map((route,index)=>{
      const row=document.createElement('div');
      row.className='trade-cg-result';
      row.innerHTML=`
        <div class="trade-cg-result-rank">#${index+1}</div>
        <div><span>${safe(route.commodity)}</span><strong>${safe(route.sourceStation)}</strong><small>${safe(route.sourceSystem)}</small></div>
        <div><span>Trip Profit</span><strong>${fmtSigned(route.tripProfit)} Cr</strong></div>
        <div><span>Supply</span><strong class="${route.healthy?'is-healthy':'is-low'}">${fmt(route.sourceSupply)} t</strong></div>
        <div><span>Distance</span><strong>${fmtLy(route.distanceLy)}</strong></div>
        <div><span>Market Age</span><strong>${route.ageMinutes===null?'—':fmt(route.ageMinutes)+' min'}</strong></div>
        <button class="btn btn-secondary btn-compact" type="button" data-cg-post>Post Route</button>`;
      row.querySelector('[data-cg-post]')?.addEventListener('click',event=>postRoute(campaign,route,event.currentTarget));
      return row;
    }));
  }

  async function postRoute(campaign,route,button){
    const old=button.textContent;button.disabled=true;button.textContent='Posting…';
    try{
      const response=await fetch('/api/trades',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-editor'},
        body:JSON.stringify({
          category:'squad',
          official:Boolean(manager()),
          title:'CG · '+campaign.title+' · '+route.commodity,
          commodity:route.commodity,
          originSystem:route.sourceSystem,
          originStation:route.sourceStation,
          destinationSystem:campaign.destinationSystem,
          destinationStation:campaign.destinationStation,
          profitPerTon:Math.max(0,Number(route.profitPerTon)||0),
          padSize:padLabel(campaign.automation?.minPad||0),
          distanceLy:String(route.distanceLy??''),
          quantity:String(route.sourceSupply||''),
          expires:campaign.endsAt||'',
          objective:'Supply the active Community Goal: '+campaign.title,
          notes:'CG Solver estimate: '+fmtSigned(route.tripProfit)+' Cr per modeled trip using '+fmt(route.quantity)+' t. Source market observed '+timeLabel(route.observedAt)+'.',
          status:'active',
          tags:['Community Goal','CG Solver',route.commodity],
          intelligence:{enabled:true,priority:'critical'},
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to post route.');
      button.textContent='Posted ✓';
      window.dispatchEvent(new CustomEvent('mongrels:trade-route-posted',{detail:{route:payload.route}}));
    }catch(error){button.disabled=false;button.textContent=old;shellStatus.textContent=error.message||'Unable to post route.';}
  }

  async function runCampaign(campaign,button){
    const old=button.textContent;button.disabled=true;button.textContent='Running…';
    try{
      const response=await fetch('/api/trade-cg/evaluate',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-cg-evaluate'},
        body:JSON.stringify({campaignId:campaign.id}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to evaluate CG.');
      await load();
    }catch(error){shellStatus.textContent=error.message||'Unable to evaluate CG.';}
    finally{button.disabled=false;button.textContent=old;}
  }

  async function promotePending(campaign,button){
    if(!campaign.pendingPrimary?.route)return;
    const old=button.textContent;button.disabled=true;button.textContent='Promoting…';
    try{
      await updateCampaign({id:campaign.id,action:'promote_pending'});
      await load();
    }catch(error){shellStatus.textContent=error.message||'Unable to promote route.';}
    finally{button.disabled=false;button.textContent=old;}
  }

  async function closeCampaign(campaign,button){
    if(!confirm('Close this Community Goal?'))return;
    button.disabled=true;
    try{await updateCampaign({id:campaign.id,action:'close'});await load();}
    catch(error){shellStatus.textContent=error.message||'Unable to close CG.';button.disabled=false;}
  }

  async function updateCampaign(body){
    const response=await fetch('/api/trade-cg',{
      method:'PUT',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-cg-editor'},
      body:JSON.stringify(body),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Unable to update Community Goal.');
    return payload;
  }

  function openEditor(campaign=null){
    if(!canManage||!editor||!editorForm)return;
    editing=campaign;
    $('[data-cg-editor-title]').textContent=campaign?'Edit Community Goal':'Create Community Goal';
    $('[data-cg-id]').value=campaign?.id||'';
    $('[data-cg-title]').value=campaign?.title||'';
    $('[data-cg-destination-system]').value=campaign?.destinationSystem||'';
    $('[data-cg-destination-station]').value=campaign?.destinationStation||'';
    $('[data-cg-commodities]').value=(campaign?.commodities||[]).join('\n');
    $('[data-cg-end]').value=toLocalInput(campaign?.endsAt);
    $('[data-cg-notes]').value=campaign?.notes||'';
    const a=campaign?.automation||{};
    $('[data-cg-auto-cargo]').value=fmt(a.cargoCapacity||784);
    $('[data-cg-auto-radius]').value=a.radiusLy||100;
    $('[data-cg-auto-pad]').value=String(a.minPad??3);
    $('[data-cg-auto-carriers]').value=a.carrierMode||'exclude';
    $('[data-cg-auto-age]').value=a.maxAgeMinutes||120;
    $('[data-cg-auto-fresh]').value=a.primaryFreshMinutes||60;
    $('[data-cg-auto-supply]').value=fmt(a.minPrimarySupply||5000);
    $('[data-cg-auto-ranking]').value=a.ranking||'profit';
    $('[data-cg-form-status]').textContent='';
    editor.hidden=false;
    document.body.classList.add('project-editor-open');
  }

  function closeEditor(){
    if(!editor)return;
    editor.hidden=true;editing=null;document.body.classList.remove('project-editor-open');
  }

  async function saveEditor(event){
    event.preventDefault();
    const status=$('[data-cg-form-status]');
    const button=editorForm.querySelector('button[type="submit"]');
    button.disabled=true;status.textContent=editing?'Updating CG…':'Creating CG…';
    const body={
      ...(editing?{id:editing.id,action:'edit'}:{}),
      title:$('[data-cg-title]').value.trim(),
      destinationSystem:$('[data-cg-destination-system]').value.trim(),
      destinationStation:$('[data-cg-destination-station]').value.trim(),
      commodities:$('[data-cg-commodities]').value,
      endsAt:fromLocalInput($('[data-cg-end]').value),
      notes:$('[data-cg-notes]').value.trim(),
      automation:{
        cargoCapacity:num($('[data-cg-auto-cargo]').value)||784,
        radiusLy:Number($('[data-cg-auto-radius]').value)||100,
        minPad:Number($('[data-cg-auto-pad]').value)||0,
        carrierMode:$('[data-cg-auto-carriers]').value,
        maxAgeMinutes:Number($('[data-cg-auto-age]').value)||120,
        primaryFreshMinutes:Number($('[data-cg-auto-fresh]').value)||60,
        minPrimarySupply:num($('[data-cg-auto-supply]').value)||5000,
        refreshMinutes:15,
        ranking:$('[data-cg-auto-ranking]').value,
      },
    };
    try{
      const response=await fetch('/api/trade-cg',{
        method:editing?'PUT':'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-cg-editor'},
        body:JSON.stringify(body),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to save Community Goal.');
      closeEditor();await load();
    }catch(error){status.textContent=error.message||'Unable to save Community Goal.';}
    finally{button.disabled=false;}
  }

  function prefs(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch{return{};}}
  function savedPref(key,fallback){const value=prefs()[key];return value===undefined||value===null||value===''?fallback:value;}
  function savePrefs(value){try{localStorage.setItem(PREF_KEY,JSON.stringify(value));}catch{}}
  function padLabel(value){return Number(value)>=3?'large':Number(value)===2?'medium':Number(value)===1?'small':'unknown';}
  function timeLabel(value){
    const time=Date.parse(value||'');if(!Number.isFinite(time))return'not set';
    const delta=time-Date.now(),abs=Math.abs(delta);
    if(abs<60000)return delta>=0?'in <1m':'<1m ago';
    const min=Math.round(abs/60000);if(min<60)return delta>=0?'in '+min+'m':min+'m ago';
    const hr=Math.round(abs/3600000);if(hr<48)return delta>=0?'in '+hr+'h':hr+'h ago';
    const day=Math.round(abs/86400000);return delta>=0?'in '+day+'d':day+'d ago';
  }
  function toLocalInput(value){
    const time=Date.parse(value||'');if(!Number.isFinite(time))return'';
    const d=new Date(time),pad=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  }
  function fromLocalInput(value){
    if(!value)return'';const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():'';
  }

  createButton?.addEventListener('click',()=>openEditor(null));
  editorForm?.addEventListener('submit',saveEditor);
  editor?.querySelectorAll('[data-cg-cancel]').forEach(button=>button.addEventListener('click',closeEditor));
  window.MongrelTradeCg={activate,load};
})();