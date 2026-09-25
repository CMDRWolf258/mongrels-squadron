(() => {
  const squadGrid = document.querySelector('#squadTradeGrid');
  const creditGrid = document.querySelector('#creditTradeGrid');
  if (!squadGrid || !creditGrid) return;

  const $ = sel => document.querySelector(sel);
  const squadEmpty = $('#squadTradeEmpty');
  const creditEmpty = $('#creditTradeEmpty');
  const search = $('#tradeSearch');
  const padFilter = $('#tradePadFilter');
  const sort = $('#tradeSort');
  const shell = $('[data-trade-editor-shell]');
  const form = $('[data-trade-form]');
  let session = null;
  let staticRoutes = [];
  let postedRoutes = [];
  let editing = null;
  let dirty = false;
  const memberParam = new URLSearchParams(location.search).get('member') || '';
  let memberFilter = null;
  let tradeControlLoaded = false;
  let tradeControlState = null;

  const n = value => Number(value || 0);
  const fmt = value => n(value).toLocaleString();
  const safe = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dateLabel = value => { if (!value) return 'Not dated'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
  const ageLabel = value => { const t=Date.parse(value||''); if(!Number.isFinite(t)) return 'Unknown age'; const hours=Math.max(0,(Date.now()-t)/3600000); if(hours<1)return 'Updated <1h ago'; if(hours<24)return `Updated ${Math.floor(hours)}h ago`; const days=Math.floor(hours/24); return `Updated ${days}d ago`; };
  const isExpired = route => route.status === 'expired' || (route.expires && Date.parse(`${route.expires}T23:59:59`) < Date.now());
  const active = route => route.active !== false && route.status !== 'complete' && !isExpired(route);
  const apiFetch = async (url, options={}) => { const requestUrl=options.method?url:`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`; const response=await fetch(requestUrl,{credentials:'same-origin',cache:'no-store',...options}); const payload=await response.json().catch(()=>({})); return {response,payload}; };

  async function copySystem(system, button){try{await navigator.clipboard.writeText(system);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1000);}catch{}}

  function card(route) {
    const priority = route.category === 'squad' ? `<span class="trade-priority ${route.official?'high':'normal'}">${route.official?'Official':'Support'}</span>` : '';
    const profit = route.profitPerTon ? `${fmt(route.profitPerTon)} Cr/t` : (route.category==='squad'?'Objective route':'Profit not listed');
    const total = route.estimatedLoopProfit ? `${fmt(route.estimatedLoopProfit)} Cr / loop` : '';
    const tags = (route.tags || []).map(tag => `<span>${safe(tag)}</span>`).join('');
    const edit = route.canEdit ? '<button class="btn btn-secondary trade-edit-btn" type="button">Edit</button>' : '';
    const originSystem = route.originSystem ? `<span class="trade-system-inline">${safe(route.originSystem)} <button type="button" class="copy-system-btn" data-copy-origin aria-label="Copy origin system">⧉</button></span>` : '';
    const destSystem = route.destinationSystem ? `<span class="trade-system-inline">${safe(route.destinationSystem)} <button type="button" class="copy-system-btn" data-copy-destination aria-label="Copy destination system">⧉</button></span>` : '';
    const freshness = route.updatedAt ? ageLabel(route.updatedAt) : (route.updated ? `Updated ${dateLabel(route.updated)}` : 'No timestamp');
    const owner = route.ownerName ? `Posted by ${safe(route.ownerName)}` : 'Squad-curated';
    const quantity = route.quantity ? `<div><span>Quantity</span><strong>${safe(route.quantity)}</strong></div>` : '';
    const article = document.createElement('article');
    article.className = `trade-card${route.official?' trade-card-official':''}`;
    if (route.id) article.id = `trade-${route.id}`;
    article.innerHTML = `
      <div class="trade-card-head"><div><p class="trade-kicker">${safe(route.commodity || 'Commodity')}</p><h3>${safe(route.title || `${route.originSystem || ''} → ${route.destinationSystem || ''}`)}</h3></div><div class="trade-card-actions">${priority}${edit}</div></div>
      <div class="trade-route-line"><div><span>Buy / Load</span><strong>${safe(route.originStation || '—')}</strong><small>${originSystem}</small></div><div class="trade-arrow">→</div><div><span>Sell / Deliver</span><strong>${safe(route.destinationStation || '—')}</strong><small>${destSystem}</small></div></div>
      <div class="trade-metrics"><div><span>Profit</span><strong>${profit}</strong>${total?`<small>${total}</small>`:''}</div><div><span>Pad</span><strong>${safe(route.padSize || 'Unknown')}</strong></div><div><span>Distance</span><strong>${route.distanceLy?`${safe(route.distanceLy)} ly`:'—'}</strong></div>${quantity}</div>
      ${route.objective?`<p class="trade-objective"><strong>Objective:</strong> ${safe(route.objective)}</p>`:''}
      ${route.notes?`<p class="trade-notes">${safe(route.notes)}</p>`:''}
      <div class="trade-card-foot"><div class="trade-tags">${tags}</div><small>${owner} · ${freshness}${route.expires?` · Expires ${dateLabel(route.expires)}`:''}</small></div>`;
    article.querySelector('[data-copy-origin]')?.addEventListener('click',e=>copySystem(route.originSystem,e.currentTarget));
    article.querySelector('[data-copy-destination]')?.addEventListener('click',e=>copySystem(route.destinationSystem,e.currentTarget));
    article.querySelector('.trade-edit-btn')?.addEventListener('click',()=>openEditor(route));
    return article;
  }

  function allRoutes(){ return memberParam && memberFilter ? [...postedRoutes] : [...postedRoutes,...staticRoutes]; }
  function render() {
    const routes = allRoutes();
    const squad = routes.filter(r => r.category === 'squad' && active(r));
    squadGrid.replaceChildren(...squad.map(card)); squadEmpty.hidden = squad.length > 0;

    const q=(search.value||'').trim().toLowerCase(); const pad=padFilter.value;
    let credit=routes.filter(r=>r.category==='credits'&&active(r)).filter(r=>{const hay=[r.title,r.commodity,r.originStation,r.originSystem,r.destinationStation,r.destinationSystem,r.notes,...(r.tags||[])].join(' ').toLowerCase();return(!q||hay.includes(q))&&(pad==='all'||String(r.padSize||'').toLowerCase()===pad);});
    if(sort.value==='profit-desc')credit.sort((a,b)=>n(b.profitPerTon)-n(a.profitPerTon));
    if(sort.value==='updated-desc')credit.sort((a,b)=>Date.parse(b.updatedAt||b.updated||0)-Date.parse(a.updatedAt||a.updated||0));
    if(sort.value==='commodity-asc')credit.sort((a,b)=>String(a.commodity||'').localeCompare(String(b.commodity||'')));
    creditGrid.replaceChildren(...credit.map(card)); creditEmpty.hidden=credit.length>0;

    $('#squadRouteCount').textContent=squad.length; $('#creditRouteCount').textContent=routes.filter(r=>r.category==='credits'&&active(r)).length;
    const maxProfit=Math.max(0,...routes.filter(active).map(r=>n(r.profitPerTon))); $('#topProfit').textContent=maxProfit?`${fmt(maxProfit)} Cr/t`:'—';
    const newest=Math.max(0,...routes.map(r=>Date.parse(r.updatedAt||r.updated||0)).filter(Number.isFinite)); $('#tradeFreshness').textContent=newest?ageLabel(new Date(newest).toISOString()).replace('Updated ',''):'No posts';
  }

  function manager(){return session&&['officer','site_admin'].includes(session.access);}

  function controlFields(priority) {
    const root=document.querySelector(`[data-trade-priority="${priority}"]`);
    if(!root)return null;
    const read=name=>root.querySelector(`[data-priority-field="${name}"]`);
    return {
      root,
      refreshMinutes:read('refreshMinutes'),
      freshMinutes:read('freshMinutes'),
      agingMinutes:read('agingMinutes'),
    };
  }

  function renderTradeControl(payload) {
    const section=$('[data-trade-control]');
    if(!section||!payload?.control)return;
    tradeControlState=payload;
    section.hidden=false;
    const control=payload.control;
    $('[data-trade-control-default]').value=control.defaultPriority||'standard';
    for(const key of ['critical','high','standard','low']){
      const inputs=controlFields(key);
      const profile=control.priorities?.[key];
      if(!inputs||!profile)continue;
      inputs.refreshMinutes.value=profile.refreshMinutes;
      inputs.freshMinutes.value=profile.freshMinutes;
      inputs.agingMinutes.value=profile.agingMinutes;
    }
    $('[data-trade-discord-auto]').checked=control.discord?.autoPublish!==false;
    $('[data-trade-discord-threshold]').checked=control.discord?.thresholdMessages!==false;
    $('[data-trade-discord-compact]').checked=control.discord?.compactSuperseded!==false;
    const target=$('[data-trade-discord-target]');
    const mode=$('[data-trade-discord-mode]');
    if(target)target.textContent=payload.discord?.targetLabel||'🧪〡system-testing';
    if(mode)mode.textContent=`${String(payload.discord?.mode||'testing').toUpperCase()} · production routing is locked during development.`;
    const summary=$('[data-trade-control-summary]');
    if(summary)summary.textContent=`${String(payload.discord?.mode||'testing').toUpperCase()} · ${control.priorities?.critical?.refreshMinutes||5} min fastest`;
    const healthTitle=$('[data-trade-market-health-title]');
    const healthDetail=$('[data-trade-market-health-detail]');
    const health=payload.marketData||{};
    if(healthTitle)healthTitle.textContent=health.lastSuccessfulFetchAt?(String(health.source||'Market Source')+' Connected'):'Spansh Adapter Ready';
    if(healthDetail){
      if(health.lastWarning)healthDetail.textContent=health.lastWarning+' · '+fmt(health.lastReturnedCount||0)+' matches.';
      else if(health.lastError)healthDetail.textContent='Last market query error: '+health.lastError;
      else if(health.lastSuccessfulFetchAt)healthDetail.textContent='Last live fetch '+ageLabel(health.lastSuccessfulFetchAt).replace('Updated ','')+' · '+fmt(health.lastReturnedCount||0)+' matches · '+fmt(health.lastStoredCount||0)+' cached observations for that commodity.';
      else healthDetail.textContent='Waiting for the first live market query.';
    }
  }

  async function loadTradeControl(force=false) {
    if(!manager())return;
    if(tradeControlLoaded&&!force)return;
    const section=$('[data-trade-control]');
    if(section)section.hidden=false;
    const status=$('[data-trade-control-status]');
    if(status)status.textContent='Loading Trade Control…';
    try{
      const {response,payload}=await apiFetch('/api/trade-control');
      if(!response.ok)throw new Error(payload.error||'Unable to load Trade Control.');
      tradeControlLoaded=true;
      renderTradeControl(payload);
      if(status)status.textContent='';
    }catch(error){
      if(status)status.textContent=error.message||'Unable to load Trade Control.';
      const summary=$('[data-trade-control-summary]');
      if(summary)summary.textContent='Control unavailable';
    }
  }

  function tradeControlPayload() {
    const priorities={};
    for(const key of ['critical','high','standard','low']){
      const inputs=controlFields(key);
      if(!inputs)continue;
      priorities[key]={
        ...(tradeControlState?.control?.priorities?.[key]||{}),
        refreshMinutes:Number(inputs.refreshMinutes.value)||5,
        freshMinutes:Number(inputs.freshMinutes.value)||1,
        agingMinutes:Number(inputs.agingMinutes.value)||1,
      };
    }
    return {
      defaultPriority:$('[data-trade-control-default]').value,
      priorities,
      discord:{
        autoPublish:$('[data-trade-discord-auto]').checked,
        thresholdMessages:$('[data-trade-discord-threshold]').checked,
        compactSuperseded:$('[data-trade-discord-compact]').checked,
      },
    };
  }

  async function saveTradeControl(event) {
    event.preventDefault();
    if(!manager())return;
    const status=$('[data-trade-control-status]');
    status.textContent='Saving…';
    try{
      const {response,payload}=await apiFetch('/api/trade-control',{
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-control'},
        body:JSON.stringify(tradeControlPayload()),
      });
      if(!response.ok)throw new Error(payload.error||'Unable to save Trade Control.');
      tradeControlLoaded=true;
      renderTradeControl(payload);
      status.textContent='Saved.';
      setTimeout(()=>{if(status.textContent==='Saved.')status.textContent='';},1800);
    }catch(error){
      status.textContent=error.message||'Unable to save Trade Control.';
    }
  }
  function openEditor(route=null){editing=route;dirty=false;shell.hidden=false;document.body.classList.add('project-editor-open'); $('[data-trade-form-title]').textContent=route?'Edit Trade Route':'Post Trade Route'; $('[data-trade-id]').value=route?.id||''; $('[data-trade-category]').value=route?.category||'credits'; $('[data-trade-official]').value=route?.official?'true':'false'; $('[data-trade-title]').value=route?.title||''; $('[data-trade-commodity]').value=route?.commodity||''; $('[data-trade-origin-system]').value=route?.originSystem||''; $('[data-trade-origin-station]').value=route?.originStation||''; $('[data-trade-destination-system]').value=route?.destinationSystem||''; $('[data-trade-destination-station]').value=route?.destinationStation||''; $('[data-trade-profit]').value=route?.profitPerTon||''; $('[data-trade-loop-profit]').value=route?.estimatedLoopProfit||''; $('[data-trade-pad]').value=String(route?.padSize||'large').toLowerCase(); $('[data-trade-distance]').value=route?.distanceLy||''; $('[data-trade-quantity]').value=route?.quantity||''; $('[data-trade-expires]').value=route?.expires||''; $('[data-trade-status]').value=route?.status||'active'; $('[data-trade-tags]').value=(route?.tags||[]).join(', '); $('[data-trade-objective]').value=route?.objective||''; $('[data-trade-notes]').value=route?.notes||''; $('[data-trade-delete]').hidden=!route; $('[data-trade-form-status]').textContent=''; $('[data-trade-official-wrap]').hidden=!manager();}
  function closeEditor(){if(dirty&&!confirm('Discard unsaved trade changes?'))return;shell.hidden=true;document.body.classList.remove('project-editor-open');editing=null;dirty=false;}
  function payload(){return{id:$('[data-trade-id]').value||undefined,category:$('[data-trade-category]').value,official:$('[data-trade-official]').value==='true',title:$('[data-trade-title]').value,commodity:$('[data-trade-commodity]').value,originSystem:$('[data-trade-origin-system]').value,originStation:$('[data-trade-origin-station]').value,destinationSystem:$('[data-trade-destination-system]').value,destinationStation:$('[data-trade-destination-station]').value,profitPerTon:Number($('[data-trade-profit]').value)||0,estimatedLoopProfit:Number($('[data-trade-loop-profit]').value)||0,padSize:$('[data-trade-pad]').value,distanceLy:$('[data-trade-distance]').value,quantity:$('[data-trade-quantity]').value,expires:$('[data-trade-expires]').value,status:$('[data-trade-status]').value,tags:$('[data-trade-tags]').value,objective:$('[data-trade-objective]').value,notes:$('[data-trade-notes]').value};}
  async function save(event){event.preventDefault();const status=$('[data-trade-form-status]');status.textContent='Saving…';const {response,payload:result}=await apiFetch('/api/trades',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-editor'},body:JSON.stringify(payload())});if(!response.ok){status.textContent=result.error||'Unable to save route.';return;}dirty=false;await loadPosted();closeEditorForce();}
  function closeEditorForce(){shell.hidden=true;document.body.classList.remove('project-editor-open');editing=null;dirty=false;}
  async function remove(){if(!editing||!confirm('Delete this trade route?'))return;const {response,payload:result}=await apiFetch(`/api/trades?id=${encodeURIComponent(editing.id)}`,{method:'DELETE',headers:{'X-Mongrels-Request':'trade-editor'}});if(!response.ok){$('[data-trade-form-status]').textContent=result.error||'Unable to delete route.';return;}dirty=false;await loadPosted();closeEditorForce();}

  function renderMemberFilter() {
    document.querySelector('[data-member-filter-banner]')?.remove();
    if (!memberFilter) return;
    const section = document.querySelector('.trade-member-posting');
    const container = section?.closest('.container') || section?.parentElement;
    if (!section || !container) return;
    const banner = document.createElement('div');
    banner.className = 'member-filter-banner';
    banner.dataset.memberFilterBanner = '';
    banner.innerHTML = `<div><span>Member View</span><strong>${safe(memberFilter.name)}</strong><small>Showing active Trader's Outpost posts from this CMDR.</small></div><a class="btn btn-ghost" href="../trading/">Show Everyone</a>`;
    section.insertAdjacentElement('afterend', banner);
  }

  async function loadStatic(){try{const r=await fetch('../data/trades.json',{cache:'no-store'});if(!r.ok)throw 0;const data=await r.json();staticRoutes=Array.isArray(data)?data:(data.routes||[]);}catch{staticRoutes=[];}render();}
  async function loadPosted(){try{const memberQuery=memberParam?`?member=${encodeURIComponent(memberParam)}`:'';const {response,payload}=await apiFetch(`/api/trades${memberQuery}`);if(response.ok){postedRoutes=Array.isArray(payload.routes)?payload.routes:[];session=payload.viewer||session;memberFilter=payload.memberFilter||null;renderMemberFilter();const create=$('[data-trade-create]');const sign=$('[data-trade-sign-in]');if(create)create.hidden=!payload.canPost;if(sign)sign.hidden=Boolean(payload.canPost);if(memberParam&&memberFilter&&!window.__memberTradeAnchorHandled){window.__memberTradeAnchorHandled=true;requestAnimationFrame(()=>document.getElementById('member-trade-board')?.scrollIntoView({block:'start'}));}if(payload.viewer)window.MongrelTradeMarket?.activate(payload.viewer);if(manager())loadTradeControl();}}catch{}render();}

  window.addEventListener('mongrels:trade-market-search',()=>{if(manager())loadTradeControl(true);});
  [search,padFilter,sort].forEach(el=>el?.addEventListener(el===search?'input':'change',render)); $('[data-trade-create]')?.addEventListener('click',()=>openEditor()); document.querySelectorAll('[data-trade-cancel]').forEach(b=>b.addEventListener('click',closeEditor)); form?.addEventListener('submit',save);form?.addEventListener('input',()=>dirty=true); $('[data-trade-delete]')?.addEventListener('click',remove); $('[data-trade-control-form]')?.addEventListener('submit',saveTradeControl); window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  Promise.all([loadStatic(),loadPosted()]);
})();
