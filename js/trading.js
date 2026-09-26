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
  let tradeWatches = [];

  const n = value => Number(String(value ?? '').replace(/[^0-9.-]/g,'')) || 0;
  const fmtInput = value => n(value)>0 ? Math.trunc(n(value)).toLocaleString('en-US') : '';
  const fmt = value => n(value).toLocaleString();
  const fmtLy = value => {
    const distance=Number(value);
    return Number.isFinite(distance)?distance.toLocaleString(undefined,{maximumFractionDigits:2}):'—';
  };
  const safe = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dateLabel = value => { if (!value) return 'Not dated'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
  const ageLabel = value => { const t=Date.parse(value||''); if(!Number.isFinite(t)) return 'Unknown age'; const hours=Math.max(0,(Date.now()-t)/3600000); if(hours<1)return 'Updated <1h ago'; if(hours<24)return `Updated ${Math.floor(hours)}h ago`; const days=Math.floor(hours/24); return `Updated ${days}d ago`; };
  const isExpired = route => route.status === 'expired' || (route.expires && Date.parse(`${route.expires}T23:59:59`) < Date.now());
  const active = route => route.active !== false && route.status !== 'complete' && !isExpired(route);
  const apiFetch = async (url, options={}) => { const requestUrl=options.method?url:`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`; const response=await fetch(requestUrl,{credentials:'same-origin',cache:'no-store',...options}); const payload=await response.json().catch(()=>({})); return {response,payload}; };

  async function copySystem(system, button){try{await navigator.clipboard.writeText(system);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1000);}catch{}}

  function card(route) {
    const priority = route.category === 'squad' ? `<span class="trade-priority ${route.official?'high':'normal'}">${route.official?'Official':'Support'}</span>` : '';
    const managed=Boolean(route?.optimizer?.managed)&&Array.isArray(route?.legs)&&route.legs.length>=2;
    const profit = managed
      ? (Number(route.optimizer.currentProfit||route.estimatedLoopProfit)>0?`${fmt(route.optimizer.currentProfit||route.estimatedLoopProfit)} Cr / loop`:'Managed loop')
      : route.profitPerTon ? `${fmt(route.profitPerTon)} Cr/t` : (route.category==='squad'?'Objective route':'Profit not listed');
    const total = !managed&&route.estimatedLoopProfit ? `${fmt(route.estimatedLoopProfit)} Cr / loop` : '';
    const tags = (route.tags || []).map(tag => `<span>${safe(tag)}</span>`).join('');
    const edit = route.canEdit ? '<button class="btn btn-secondary trade-edit-btn" type="button">Edit</button>' : '';
    const originSystem = route.originSystem ? `<span class="trade-system-inline">${safe(route.originSystem)} <button type="button" class="copy-system-btn" data-copy-origin aria-label="Copy origin system">⧉</button></span>` : '';
    const destSystem = route.destinationSystem ? `<span class="trade-system-inline">${safe(route.destinationSystem)} <button type="button" class="copy-system-btn" data-copy-destination aria-label="Copy destination system">⧉</button></span>` : '';
    const freshness = managed&&route.optimizer?.lastEvaluatedAt
      ? ageLabel(route.optimizer.lastEvaluatedAt)
      : route.updatedAt ? ageLabel(route.updatedAt) : (route.updated ? `Updated ${dateLabel(route.updated)}` : 'No timestamp');
    const owner = route.ownerName ? `Posted by ${safe(route.ownerName)}` : 'Squad-curated';
    const quantity = route.quantity ? `<div><span>Quantity</span><strong>${safe(fmtInput(route.quantity) || route.quantity)}</strong></div>` : '';
    const article = document.createElement('article');
    article.className = `trade-card${route.official?' trade-card-official':''}${managed?' trade-card-managed':''}`;
    if (route.id) article.id = `trade-${route.id}`;

    let routeBlock='';
    let metrics='';
    let managedState='';
    if(managed){
      routeBlock='<div class="trade-managed-legs">'+route.legs.map((leg,index)=>`
        <div class="trade-managed-leg">
          <div><span>Leg ${index+1} · ${safe(leg.commodity||'Cargo')}</span><strong>${safe(leg.sourceStation||'—')}</strong><small>${safe(leg.sourceSystem||'')}</small></div>
          <div class="trade-arrow">→</div>
          <div><span>Deliver</span><strong>${safe(leg.destinationStation||'—')}</strong><small>${safe(leg.destinationSystem||'')}</small></div>
          <div class="trade-managed-leg-profit"><strong>+${fmt(leg.profitPerTon)} Cr/t</strong><small>${fmt(leg.quantity)} t · ${fmt(leg.tripProfit)} Cr</small></div>
        </div>`).join('')+'</div>';
      const current=Number(route.optimizer.currentProfit||route.estimatedLoopProfit)||0;
      const baseline=Number(route.optimizer.baselineProfit)||0;
      const thresholdDrop=Number(route.optimizer.thresholdDropPercent)||25;
      const thresholdValue=baseline>0?Math.round(baseline*(1-thresholdDrop/100)):0;
      const state=route.optimizer.state||'healthy';
      const alternative=route.optimizer.alternative;
      managedState=`<div class="trade-managed-state ${state==='degraded'||state==='unavailable'?'is-warning':''}">
        <div><span>Managed Loop</span><strong>${state==='healthy'?'Monitoring':'Needs attention'}</strong><small>Alerts below ${fmt(thresholdValue)} Cr / loop · ${thresholdDrop}% drop threshold</small></div>
        ${alternative&&Number(alternative.loopProfit)>current?`<div><span>Better Match</span><strong>${fmt(alternative.loopProfit)} Cr / loop</strong><small>${safe((alternative.legs||[]).map(leg=>leg.commodity).join(' → '))}</small></div>`:''}
      </div>`;
      metrics=`<div class="trade-metrics"><div><span>Loop Profit</span><strong>${profit}</strong></div><div><span>Pad</span><strong>${safe(route.padSize || 'Unknown')}</strong></div><div><span>Loop Distance</span><strong>${route.distanceLy?`${fmtLy(route.distanceLy)} ly`:'—'}</strong></div><div><span>Legs</span><strong>${route.legs.length}</strong></div></div>`;
    }else{
      const returnProfit = route.returnProfitPerTon ? `${fmt(route.returnProfitPerTon)} Cr/t` : 'Profit not listed';
      const returnQuantity = route.returnQuantity ? `${safe(fmtInput(route.returnQuantity) || route.returnQuantity)} t` : '';
      const returnLeg = route.returnCommodity ? `<div class="trade-return-leg"><div class="trade-return-meta"><span>Return cargo</span><strong>${safe(route.returnCommodity)}</strong>${route.returnProfitPerTon?`<small>${returnProfit}</small>`:''}${returnQuantity?`<small>${returnQuantity}</small>`:''}</div><div class="trade-route-line trade-route-line-return"><div><span>Return / Deliver</span><strong>${safe(route.originStation || '—')}</strong><small>${safe(route.originSystem || '')}</small></div><div class="trade-arrow">←</div><div><span>Return / Load</span><strong>${safe(route.destinationStation || '—')}</strong><small>${safe(route.destinationSystem || '')}</small></div></div></div>` : '';
      routeBlock=`<div class="trade-route-line"><div><span>Buy / Load</span><strong>${safe(route.originStation || '—')}</strong><small>${originSystem}</small></div><div class="trade-arrow">→</div><div><span>Sell / Deliver</span><strong>${safe(route.destinationStation || '—')}</strong><small>${destSystem}</small></div></div>${returnLeg}`;
      metrics=`<div class="trade-metrics"><div><span>Profit</span><strong>${profit}</strong>${total?`<small>${total}</small>`:''}</div><div><span>Pad</span><strong>${safe(route.padSize || 'Unknown')}</strong></div><div><span>Distance</span><strong>${route.distanceLy?`${fmtLy(route.distanceLy)} ly`:'—'}</strong></div>${quantity}</div>`;
    }

    article.innerHTML = `
      <div class="trade-card-head"><div><p class="trade-kicker">${safe(route.commodity || 'Commodity')}</p><h3>${safe(route.title || `${route.originSystem || ''} → ${route.destinationSystem || ''}`)}</h3></div><div class="trade-card-actions">${priority}${edit}</div></div>
      ${routeBlock}
      ${metrics}
      ${managedState}
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
    let credit=routes.filter(r=>r.category==='credits'&&active(r)).filter(r=>{const legText=Array.isArray(r.legs)?r.legs.flatMap(leg=>[leg.commodity,leg.sourceStation,leg.sourceSystem,leg.destinationStation,leg.destinationSystem]):[];const hay=[r.title,r.commodity,r.originStation,r.originSystem,r.destinationStation,r.destinationSystem,r.notes,...legText,...(r.tags||[])].join(' ').toLowerCase();return(!q||hay.includes(q))&&(pad==='all'||String(r.padSize||'').toLowerCase()===pad);});
    if(sort.value==='profit-desc')credit.sort((a,b)=>n(b.optimizer?.managed?(b.optimizer.currentProfit||b.estimatedLoopProfit):b.profitPerTon)-n(a.optimizer?.managed?(a.optimizer.currentProfit||a.estimatedLoopProfit):a.profitPerTon));
    if(sort.value==='updated-desc')credit.sort((a,b)=>Date.parse(b.updatedAt||b.updated||0)-Date.parse(a.updatedAt||a.updated||0));
    if(sort.value==='commodity-asc')credit.sort((a,b)=>String(a.commodity||'').localeCompare(String(b.commodity||'')));
    creditGrid.replaceChildren(...credit.map(card)); creditEmpty.hidden=credit.length>0;

    $('#squadRouteCount').textContent=squad.length; $('#creditRouteCount').textContent=routes.filter(r=>r.category==='credits'&&active(r)).length;
    const maxProfit=Math.max(0,...routes.filter(active).map(r=>n(r.profitPerTon))); $('#topProfit').textContent=maxProfit?`${fmt(maxProfit)} Cr/t`:'—';
    const newest=Math.max(0,...routes.map(r=>Date.parse(r.updatedAt||r.updated||0)).filter(Number.isFinite)); $('#tradeFreshness').textContent=newest?ageLabel(new Date(newest).toISOString()).replace('Updated ',''):'No posts';
  }

  function manager(){return session&&['officer','site_admin'].includes(session.access);}

  const PRIORITY_DURATION_LIMITS={
    refreshMinutes:{min:5,max:10080},
    freshMinutes:{min:1,max:43200},
    agingMinutes:{min:1,max:43200},
  };

  function controlFields(priority) {
    const root=document.querySelector(`[data-trade-priority="${priority}"]`);
    if(!root)return null;
    const read=name=>root.querySelector(`[data-priority-duration="${name}"]`);
    return {
      root,
      refreshMinutes:read('refreshMinutes'),
      freshMinutes:read('freshMinutes'),
      agingMinutes:read('agingMinutes'),
    };
  }

  function durationInputs(container){
    if(!container)return{hours:null,minutes:null};
    return{
      hours:container.querySelector('[data-duration-hours]'),
      minutes:container.querySelector('[data-duration-minutes]'),
    };
  }

  function setDuration(container,totalMinutes){
    const {hours,minutes}=durationInputs(container);
    if(!hours||!minutes)return;
    const total=Math.max(0,Math.round(Number(totalMinutes)||0));
    hours.value=Math.floor(total/60);
    minutes.value=total%60;
  }

  function normalizeDurationOverflow(container){
    const {hours,minutes}=durationInputs(container);
    if(!hours||!minutes)return;
    let minuteValue=Math.max(0,Math.floor(Number(minutes.value)||0));
    if(minuteValue>=60){
      const hourValue=Math.floor(minuteValue/60);
      minuteValue%=60;
      hours.value=hourValue;
      minutes.value=minuteValue;
    }
  }

  function readDuration(container,field,{normalize=true}={}){
    const {hours,minutes}=durationInputs(container);
    const limits=PRIORITY_DURATION_LIMITS[field]||{min:0,max:43200};
    const hourValue=Math.max(0,Math.floor(Number(hours?.value)||0));
    const minuteValue=Math.max(0,Math.floor(Number(minutes?.value)||0));
    const total=Math.min(limits.max,Math.max(limits.min,hourValue*60+minuteValue));
    if(normalize)setDuration(container,total);
    return total;
  }

  function bindPriorityDurationInputs(){
    document.querySelectorAll('[data-priority-duration]').forEach(container=>{
      if(container.dataset.durationBound==='true')return;
      container.dataset.durationBound='true';
      const field=container.dataset.priorityDuration;
      const {hours,minutes}=durationInputs(container);
      minutes?.addEventListener('input',()=>normalizeDurationOverflow(container));
      [hours,minutes].forEach(input=>input?.addEventListener('change',()=>{
        normalizeDurationOverflow(container);
        readDuration(container,field,{normalize:true});
      }));
    });
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
      setDuration(inputs.refreshMinutes,profile.refreshMinutes);
      setDuration(inputs.freshMinutes,profile.freshMinutes);
      setDuration(inputs.agingMinutes,profile.agingMinutes);
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
    if(tradeWatches.length)renderTradeWatches();
  }

  function watchStatusLabel(watch){
    if(watch.status==='paused')return'Paused';
    const state=watch.evaluation?.state||'pending_scheduler';
    if(state==='pending_scheduler')return'Pending Scheduler';
    if(state==='healthy')return'Healthy';
    if(state==='warning')return'Warning';
    if(state==='error')return'Error';
    return'Active';
  }

  function watchPriorityLabel(value){
    const key=String(value||'standard');
    return key.charAt(0).toUpperCase()+key.slice(1);
  }

  function watchTimeLabel(value){
    const timestamp=Date.parse(value||'');
    if(!Number.isFinite(timestamp))return'Never';
    const delta=timestamp-Date.now();
    const absolute=Math.abs(delta);
    if(absolute<60000)return delta>0?'Due <1m':'<1m ago';
    const minutes=Math.round(absolute/60000);
    if(minutes<60)return delta>0?'in '+minutes+'m':minutes+'m ago';
    const hours=Math.round(absolute/3600000);
    if(hours<48)return delta>0?'in '+hours+'h':hours+'h ago';
    const days=Math.round(absolute/86400000);
    return delta>0?'in '+days+'d':days+'d ago';
  }

  function watchTransitionLabel(value){
    const type=String(value?.type||'');
    if(type==='baseline')return'Baseline established';
    if(type==='condition_met')return'Condition met';
    if(type==='condition_cleared')return'Condition cleared';
    if(type==='best_market_changed')return'Best market changed';
    return'';
  }

  function renderTradeWatches(){
    const list=$('[data-trade-watch-list]');
    const count=$('[data-trade-watch-count]');
    if(!list)return;
    if(count)count.textContent=tradeWatches.length+' saved';
    if(!tradeWatches.length){
      list.innerHTML='<div class="trade-engine-state"><span>Saved Watches</span><strong>No watches saved yet</strong><small>Run a Commodity Search, then use Save as Watch.</small></div>';
      return;
    }

    list.replaceChildren(...tradeWatches.map(watch=>{
      const article=document.createElement('article');
      article.className='trade-watch-card'+(watch.status==='paused'?' is-paused':'');
      article.id='watch-'+watch.id;
      const q=watch.query||{};
      const profile=tradeControlState?.control?.priorities?.[q.priority]||{};
      const rareSourceBuy=q.direction==='buy'&&Boolean(q.rareSource?.stationName);
      const refresh=rareSourceBuy?'Hourly · 1–8 PM CT':(profile.refreshMinutes?profile.refreshMinutes+' min':'Profile');
      const state=watchStatusLabel(watch);
      const evaluation=watch.evaluation||{};
      const best=evaluation.currentBest||null;
      const ranked=Array.isArray(evaluation.rankedMarkets)?evaluation.rankedMarkets.filter(Boolean).slice(0,5):[];
      const bestBgs=best?.bgs&&typeof best.bgs==='object'?best.bgs:{};
      const volumeLabel=q.direction==='buy'?'supply':'demand';
      const transition=watchTransitionLabel(evaluation.lastTransition);
      const discordLabel=watch.discord?.publish===false
        ?'Off'
        :watch.discord?.messageId
          ?'Live'
          :watch.discord?.lastError
            ?'Error'
            :'Waiting';
      article.innerHTML=`
        <div class="trade-watch-card-head">
          <div><span>${safe(watchPriorityLabel(q.priority))} · ${safe(state)}</span><strong>${safe(watch.name||'Saved Watch')}</strong><small>${safe(watch.summary||'')}</small></div>
          <div class="trade-watch-card-actions">
            <button class="btn btn-secondary btn-compact" type="button" data-watch-run ${watch.status==='paused'?'disabled title="Resume this watch before running it"':''}>Run Now</button>
            <button class="btn btn-secondary btn-compact" type="button" data-watch-test-alert ${(watch.status==='paused'||watch.discord?.publish===false)?'disabled title="Resume this Watch and enable Discord publishing before testing alerts"':''}>Test Alert</button>
            <button class="btn btn-secondary btn-compact" type="button" data-watch-edit>Edit</button>
            <button class="btn btn-secondary btn-compact" type="button" data-watch-load>Load Search</button>
            <button class="btn btn-secondary btn-compact" type="button" data-watch-toggle>${watch.status==='paused'?'Resume':'Pause'}</button>
            <button class="btn btn-ghost btn-compact" type="button" data-watch-remove>Remove</button>
          </div>
        </div>
        <div class="trade-watch-meta">
          <span>Refresh <strong>${safe(refresh)}</strong></span>
          <span>Matches <strong>${evaluation.matchCount===null||evaluation.matchCount===undefined?'—':fmt(evaluation.matchCount)}</strong></span>
          <span>Last check <strong>${safe(watchTimeLabel(evaluation.lastAttemptAt||evaluation.lastEvaluatedAt))}</strong></span>
          <span>Next due <strong>${watch.status==='paused'?'Paused':safe(watchTimeLabel(evaluation.nextEvaluationAt))}</strong></span>
          <span>Discord <strong>${safe(discordLabel)}</strong></span>
        </div>
        ${best?`<div class="trade-watch-best"><div><span>Current Best</span><strong>${safe(best.stationName||'Unknown station')}</strong><small>${safe(best.systemName||'Unknown system')}</small></div><div><span>Price</span><strong>${fmt(best.price)} Cr/t</strong></div><div><span>${safe(volumeLabel)}</span><strong>${fmt(best.volume)} t</strong></div><div><span>Distance</span><strong>${best.distanceLy===null||best.distanceLy===undefined?'—':fmtLy(best.distanceLy)+' ly'}</strong></div></div>`:''}
        ${!best&&q.rareSource?.stationName&&q.rareSource?.systemName?`<div class="trade-watch-known-source"><span>Known Rare Source</span><strong>${safe(q.rareSource.stationName)}</strong><small>${safe(q.rareSource.systemName)} · no current qualifying market observation</small></div>`:''}
        ${best&&bestBgs.infrastructureFailureMetalOpportunity?`<div class="trade-watch-bgs-signal"><strong>⚠ Infrastructure Failure metal source</strong><span>${safe(bestBgs.controllingFaction||'Unknown controller')} · ${fmt(best.volume)} t available</span></div>`:''}
        ${best&&(bestBgs.controllingFaction||bestBgs.factionState)?`<div class="trade-watch-bgs"><span>Controller <strong>${safe(bestBgs.controllingFaction||'Unknown')}</strong></span><span>State <strong>${safe(bestBgs.factionState||'Unknown')}</strong></span><span>Ownership/BGS <strong>${safe(bestBgs.metadataFreshness||'unknown')}${Number.isFinite(Number(bestBgs.metadataAgeMinutes))?' · '+safe(watchTimeLabel(new Date(Date.now()-Number(bestBgs.metadataAgeMinutes)*60000).toISOString())):''}</strong></span></div>`:''}
        ${bestBgs.ownershipNeedsConfirmation?`<p class="trade-watch-evaluation-message is-warning">Ownership needs confirmation — this Infrastructure Failure signal is using station ownership/BGS metadata that may lag the market observation.</p>`:''}
        ${ranked.length>1?`<div class="trade-watch-alternatives"><div class="trade-watch-alternatives-head"><span>Fallback Markets</span><strong>Next ${Math.min(4,ranked.length-1)} qualifying market${ranked.length-1===1?'':'s'}</strong></div>${ranked.slice(1,5).map((market,index)=>`<div class="trade-watch-alternative${market?.bgs?.infrastructureFailureMetalOpportunity?' has-infra-metal-signal':''}"><b>#${index+2}</b><span><strong>${safe(market.stationName||'Unknown station')}</strong><small>${safe(market.systemName||'Unknown system')}${market?.bgs?.infrastructureFailure?' · Infrastructure Failure':''}</small></span><span>${fmt(market.price)} Cr/t</span><span>${fmt(market.volume)} t</span><span>${market.distanceLy===null||market.distanceLy===undefined?'—':fmtLy(market.distanceLy)+' ly'}</span></div>`).join('')}</div>`:''}
        ${evaluation.lastError?`<p class="trade-watch-evaluation-message is-error">Last check: ${safe(evaluation.lastError)}</p>`:evaluation.warning?`<p class="trade-watch-evaluation-message is-warning">${safe(evaluation.warning)}</p>`:''}
        ${watch.discord?.lastError?`<p class="trade-watch-evaluation-message is-error">Discord: ${safe(watch.discord.lastError)}</p>`:''}
        ${transition?`<p class="trade-watch-transition">${safe(transition)} · ${safe(watchTimeLabel(evaluation.lastTransition?.at))}</p>`:''}`;

      article.querySelector('[data-watch-run]')?.addEventListener('click',event=>runTradeWatch(watch,event.currentTarget));
      article.querySelector('[data-watch-test-alert]')?.addEventListener('click',event=>testTradeWatchAlert(watch,event.currentTarget));
      article.querySelector('[data-watch-edit]')?.addEventListener('click',()=>{
        window.MongrelTradeMarket?.editWatch(watch);
      });
      article.querySelector('[data-watch-load]')?.addEventListener('click',()=>{
        window.MongrelTradeMarket?.loadQuery(q);
      });
      article.querySelector('[data-watch-toggle]')?.addEventListener('click',()=>updateTradeWatch(watch,watch.status==='paused'?'resume':'pause'));
      article.querySelector('[data-watch-remove]')?.addEventListener('click',()=>removeTradeWatch(watch));
      return article;
    }));
  }

  async function loadTradeWatches(){
    if(!manager())return;
    try{
      const {response,payload}=await apiFetch('/api/trade-watches');
      if(!response.ok)throw new Error(payload.error||'Unable to load saved watches.');
      tradeWatches=Array.isArray(payload.watches)?payload.watches:[];
      renderTradeWatches();
    }catch(error){
      const list=$('[data-trade-watch-list]');
      if(list)list.innerHTML='<div class="trade-engine-state"><span>Saved Watches</span><strong>Unable to load watches</strong><small>'+safe(error.message||'Unknown error')+'</small></div>';
    }
  }

  async function runTradeWatch(watch,button){
    if(!manager()||watch?.status==='paused')return;
    const status=$('[data-trade-control-status]');
    const original=button?.textContent||'Run Now';
    if(button){button.disabled=true;button.textContent='Checking…';}
    if(status)status.textContent='Evaluating '+(watch.name||'Trade Watch')+'…';
    try{
      const {response,payload}=await apiFetch('/api/trade-watches/evaluate',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-watch-evaluate'},
        body:JSON.stringify({id:watch.id}),
      });
      if(!response.ok)throw new Error(payload.error||'Unable to evaluate watch.');
      await loadTradeWatches();
      loadTradeControl(true);
      const row=Array.isArray(payload.results)?payload.results[0]:null;
      if(status)status.textContent=row?.ok===false
        ?'Watch check completed with an error.'
        :'Watch evaluated'+(row?.matchCount===null||row?.matchCount===undefined?'.':': '+fmt(row.matchCount)+' matching market'+(Number(row.matchCount)===1?'':'s')+'.');
      setTimeout(()=>{if(status&&status.textContent.startsWith('Watch '))status.textContent='';},3500);
    }catch(error){
      if(status)status.textContent=error.message||'Unable to evaluate watch.';
    }finally{
      if(button){button.disabled=false;button.textContent=original;}
    }
  }

  async function testTradeWatchAlert(watch,button){
    if(!manager()||watch?.status==='paused'||watch?.discord?.publish===false)return;
    if(!confirm('Send a TEST alert for “'+(watch.name||'this Watch')+'” to everyone currently subscribed to it?\n\nThis uses the real Discord/DM delivery path but will not change the Watch state.'))return;

    const status=$('[data-trade-control-status]');
    const original=button?.textContent||'Test Alert';
    if(button){button.disabled=true;button.textContent='Sending…';}
    if(status)status.textContent='Sending test alert for '+(watch.name||'Trade Watch')+'…';

    try{
      const {response,payload}=await apiFetch('/api/trade-watches/test-alert',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-watch-test-alert'},
        body:JSON.stringify({id:watch.id}),
      });
      if(!response.ok)throw new Error(payload.error||'Unable to send test alert.');

      const subscribers=Number(payload.subscriberCount)||0;
      const delivered=Number(payload.delivered)||0;
      const failed=Number(payload.failed)||0;
      if(status){
        status.textContent=subscribers
          ?'Test alert sent: '+delivered+' of '+subscribers+' subscriber DM'+(subscribers===1?'':'s')+' delivered'+(failed?' · '+failed+' failed':'')+'.'
          :'Test alert posted to the test channel. This Watch currently has no alert subscribers.';
      }
      setTimeout(()=>{if(status&&status.textContent.startsWith('Test alert'))status.textContent='';},5000);
    }catch(error){
      if(status)status.textContent=error.message||'Unable to send test alert.';
    }finally{
      if(button){button.disabled=false;button.textContent=original;}
    }
  }

  async function updateTradeWatch(watch,action){
    try{
      const {response,payload}=await apiFetch('/api/trade-watches',{
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-watch-editor'},
        body:JSON.stringify({id:watch.id,action}),
      });
      if(!response.ok)throw new Error(payload.error||'Unable to update watch.');
      const index=tradeWatches.findIndex(item=>item.id===watch.id);
      if(index>=0)tradeWatches[index]=payload.watch;
      renderTradeWatches();
    }catch(error){
      const status=$('[data-trade-control-status]');
      if(status)status.textContent=error.message||'Unable to update watch.';
    }
  }

  async function removeTradeWatch(watch){
    if(!confirm('Remove saved watch “'+(watch.name||'this watch')+'”?'))return;
    try{
      const {response,payload}=await apiFetch('/api/trade-watches?id='+encodeURIComponent(watch.id),{
        method:'DELETE',
        headers:{'X-Mongrels-Request':'trade-watch-editor'},
      });
      if(!response.ok)throw new Error(payload.error||'Unable to remove watch.');
      tradeWatches=tradeWatches.filter(item=>item.id!==watch.id);
      renderTradeWatches();
    }catch(error){
      const status=$('[data-trade-control-status]');
      if(status)status.textContent=error.message||'Unable to remove watch.';
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
      const refreshMinutes=readDuration(inputs.refreshMinutes,'refreshMinutes',{normalize:true});
      const freshMinutes=readDuration(inputs.freshMinutes,'freshMinutes',{normalize:true});
      const agingMinutes=Math.max(
        freshMinutes,
        readDuration(inputs.agingMinutes,'agingMinutes',{normalize:true}),
      );
      setDuration(inputs.agingMinutes,agingMinutes);
      priorities[key]={
        ...(tradeControlState?.control?.priorities?.[key]||{}),
        refreshMinutes,
        freshMinutes,
        agingMinutes,
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
  function openEditor(route=null){
    editing=route;dirty=false;shell.hidden=false;document.body.classList.add('project-editor-open');
    $('[data-trade-form-title]').textContent=route?'Edit Trade Route':'Post Trade Route';
    $('[data-trade-id]').value=route?.id||'';
    $('[data-trade-category]').value=route?.category||'credits';
    $('[data-trade-official]').value=route?.official?'true':'false';
    $('[data-trade-title]').value=route?.title||'';
    $('[data-trade-commodity]').value=route?.commodity||'';
    $('[data-trade-origin-system]').value=route?.originSystem||'';
    $('[data-trade-origin-station]').value=route?.originStation||'';
    $('[data-trade-destination-system]').value=route?.destinationSystem||'';
    $('[data-trade-destination-station]').value=route?.destinationStation||'';
    $('[data-trade-profit]').value=fmtInput(route?.profitPerTon);
    $('[data-trade-loop-profit]').value=fmtInput(route?.estimatedLoopProfit);
    $('[data-trade-pad]').value=String(route?.padSize||'large').toLowerCase();
    $('[data-trade-distance]').value=route?.distanceLy||'';
    $('[data-trade-quantity]').value=fmtInput(route?.quantity)||route?.quantity||'';
    $('[data-trade-return-commodity]').value=route?.returnCommodity||'';
    $('[data-trade-return-profit]').value=fmtInput(route?.returnProfitPerTon);
    $('[data-trade-return-quantity]').value=fmtInput(route?.returnQuantity)||route?.returnQuantity||'';
    $('[data-trade-expires]').value=route?.expires||'';
    $('[data-trade-status]').value=route?.status||'active';
    $('[data-trade-tags]').value=(route?.tags||[]).join(', ');
    $('[data-trade-objective]').value=route?.objective||'';
    $('[data-trade-notes]').value=route?.notes||'';
    $('[data-trade-delete]').hidden=!route;
    $('[data-trade-form-status]').textContent='';
    $('[data-trade-official-wrap]').hidden=!manager();
    const managed=Boolean(route?.optimizer?.managed);
    const managedNote=$('[data-trade-managed-note]');
    if(managedNote)managedNote.hidden=!managed;
    const managedThreshold=$('[data-trade-managed-threshold]');
    if(managedThreshold)managedThreshold.value=String(route?.optimizer?.thresholdDropPercent||25);
    const optimizerOwned=[
      '[data-trade-commodity]','[data-trade-origin-system]','[data-trade-origin-station]',
      '[data-trade-destination-system]','[data-trade-destination-station]','[data-trade-profit]',
      '[data-trade-loop-profit]','[data-trade-pad]','[data-trade-distance]','[data-trade-quantity]',
      '[data-trade-return-commodity]','[data-trade-return-profit]','[data-trade-return-quantity]'
    ];
    optimizerOwned.forEach(selector=>{const input=$(selector);if(input)input.disabled=managed;});
    form.querySelectorAll('input[data-number-format]').forEach(input=>window.MongrelNumbers?.format(input));
  }
  function closeEditor(){if(dirty&&!confirm('Discard unsaved trade changes?'))return;shell.hidden=true;document.body.classList.remove('project-editor-open');editing=null;dirty=false;}
  function payload(){
    const value={
      id:$('[data-trade-id]').value||undefined,
      category:$('[data-trade-category]').value,
      official:$('[data-trade-official]').value==='true',
      title:$('[data-trade-title]').value,
      commodity:$('[data-trade-commodity]').value,
      originSystem:$('[data-trade-origin-system]').value,
      originStation:$('[data-trade-origin-station]').value,
      destinationSystem:$('[data-trade-destination-system]').value,
      destinationStation:$('[data-trade-destination-station]').value,
      profitPerTon:n($('[data-trade-profit]').value),
      estimatedLoopProfit:n($('[data-trade-loop-profit]').value),
      padSize:$('[data-trade-pad]').value,
      distanceLy:$('[data-trade-distance]').value,
      quantity:String(Math.trunc(n($('[data-trade-quantity]').value))||''),
      returnCommodity:$('[data-trade-return-commodity]').value,
      returnProfitPerTon:n($('[data-trade-return-profit]').value),
      returnQuantity:String(Math.trunc(n($('[data-trade-return-quantity]').value))||''),
      expires:$('[data-trade-expires]').value,
      status:$('[data-trade-status]').value,
      tags:$('[data-trade-tags]').value,
      objective:$('[data-trade-objective]').value,
      notes:$('[data-trade-notes]').value
    };
    if(editing?.optimizer?.managed){
      value.optimizer={...editing.optimizer,thresholdDropPercent:Math.max(5,Math.min(90,n($('[data-trade-managed-threshold]').value)||25))};
    }
    return value;
  }
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
  async function loadPosted(){try{const memberQuery=memberParam?`?member=${encodeURIComponent(memberParam)}`:'';const {response,payload}=await apiFetch(`/api/trades${memberQuery}`);if(response.ok){postedRoutes=Array.isArray(payload.routes)?payload.routes:[];session=payload.viewer||session;memberFilter=payload.memberFilter||null;renderMemberFilter();const create=$('[data-trade-create]');const sign=$('[data-trade-sign-in]');if(create)create.hidden=!payload.canPost;if(sign)sign.hidden=Boolean(payload.canPost);if(memberParam&&memberFilter&&!window.__memberTradeAnchorHandled){window.__memberTradeAnchorHandled=true;requestAnimationFrame(()=>document.getElementById('member-trade-board')?.scrollIntoView({block:'start'}));}if(payload.viewer){window.MongrelTradeMarket?.activate(payload.viewer);window.MongrelTradeLoops?.activate(payload.viewer);}if(manager()){loadTradeControl();loadTradeWatches();}}}catch{}render();}

  bindPriorityDurationInputs();
  window.addEventListener('mongrels:trade-market-search',()=>{if(manager())loadTradeControl(true);});
  window.addEventListener('mongrels:trade-watch-saved',()=>{if(manager())loadTradeWatches();});
  window.addEventListener('mongrels:trade-route-posted',()=>loadPosted());
  setInterval(()=>{if(manager()&&!document.hidden)loadTradeWatches();},60000);
  [search,padFilter,sort].forEach(el=>el?.addEventListener(el===search?'input':'change',render)); $('[data-trade-create]')?.addEventListener('click',()=>openEditor()); document.querySelectorAll('[data-trade-cancel]').forEach(b=>b.addEventListener('click',closeEditor)); form?.addEventListener('submit',save);form?.addEventListener('input',()=>dirty=true); $('[data-trade-delete]')?.addEventListener('click',remove); $('[data-trade-control-form]')?.addEventListener('submit',saveTradeControl); window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  Promise.all([loadStatic(),loadPosted()]);
})();
