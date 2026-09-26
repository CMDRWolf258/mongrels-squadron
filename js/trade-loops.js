(() => {
  const section=document.querySelector('[data-trade-loops]');
  const form=document.querySelector('[data-trade-loop-form]');
  if(!section||!form)return;

  const $=sel=>section.querySelector(sel);
  const start=$('[data-loop-start]');
  const scope=$('[data-loop-scope]');
  const radius=$('[data-loop-radius]');
  const legs=$('[data-loop-legs]');
  const cargo=$('[data-loop-cargo]');
  const pad=$('[data-loop-pad]');
  const carriers=$('[data-loop-carriers]');
  const priority=$('[data-loop-priority]');
  const age=$('[data-loop-age]');
  const threshold=$('[data-loop-threshold]');
  const status=$('[data-loop-status]');
  const results=$('[data-loop-results]');
  const resultsHead=$('[data-loop-results-head]');
  const resultsSummary=$('[data-loop-results-summary]');
  const warning=$('[data-loop-warning]');
  const STORAGE_KEY='mongrels-trade-loop-search-v1';
  let viewer=null;
  let currentSettings=null;
  let currentResults=[];

  const safe=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const numberValue=value=>Number(String(value??'').replace(/[^0-9.-]/g,''))||0;
  const fmt=value=>Number(value||0).toLocaleString();
  const fmtLy=value=>Number.isFinite(Number(value))?Number(value).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
  const ageLabel=value=>{
    const time=Date.parse(value||'');
    if(!Number.isFinite(time))return'Unknown age';
    const minutes=Math.max(0,Math.floor((Date.now()-time)/60000));
    if(minutes<60)return minutes+' min old';
    const hours=minutes/60;
    if(hours<24)return (hours<10?hours.toFixed(1):Math.floor(hours))+' hr old';
    const days=hours/24;
    return (days<10?days.toFixed(1):Math.floor(days))+' d old';
  };

  function activate(session){
    viewer=session||viewer;
    section.hidden=false;
    restore();
    updateMode();
  }

  function restore(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
    start.value=saved.startSystem||start.value||'';
    scope.value=saved.scope==='same'?'same':'radius';
    legs.value=Number(saved.legCount)===3?'3':'2';
    radius.value=Number(saved.radiusLy)>0?saved.radiusLy:50;
    cargo.value=Number(saved.cargoCapacity)>0?Number(saved.cargoCapacity).toLocaleString('en-US'):'784';
    pad.value=['0','1','2','3'].includes(String(saved.minPad))?String(saved.minPad):'3';
    carriers.value=['include','exclude','only'].includes(saved.carrierMode)?saved.carrierMode:'exclude';
    priority.value=['critical','high','standard','low'].includes(saved.priority)?saved.priority:'standard';
    age.value=Number(saved.maxAgeMinutes)>0?String(saved.maxAgeMinutes):'';
    threshold.value=Number(saved.thresholdDropPercent)>=5?String(saved.thresholdDropPercent):'25';
  }

  function settings(){
    const legCount=Number(legs.value)===3?3:2;
    const same=scope.value==='same';
    const radiusCap=legCount===3?100:500;
    return{
      startSystem:start.value.trim(),
      scope:same?'same':'radius',
      legCount,
      radiusLy:same?0:Math.max(1,Math.min(radiusCap,numberValue(radius.value)||50)),
      cargoCapacity:Math.max(1,Math.min(2000,numberValue(cargo.value)||784)),
      minPad:Number(pad.value)||0,
      carrierMode:carriers.value,
      priority:priority.value,
      maxAgeMinutes:Number(age.value)||undefined,
      thresholdDropPercent:Math.max(5,Math.min(90,Number(threshold.value)||25)),
      limit:10,
    };
  }

  function remember(value){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}
  }

  function updateMode(){
    const legCount=Number(legs.value)===3?3:2;
    const same=scope.value==='same';
    radius.disabled=same;
    radius.max=legCount===3?'100':'500';
    if(legCount===3&&!same&&numberValue(radius.value)>100)radius.value='100';
    const help=$('[data-loop-radius-help]');
    if(help)help.textContent=same
      ?'All stops stay inside the selected start system.'
      :legCount===3
        ?'3-leg triangles are limited to 100 ly maximum per leg.'
        :'Maximum distance from the start system; each loop returns to it.';
  }

  async function search(event){
    event.preventDefault();
    const query=settings();
    if(!query.startSystem){status.textContent='Enter a start system.';start.focus();return;}
    remember(query);
    currentSettings=query;
    currentResults=[];
    status.textContent='Building live market snapshot and ranking loops…';
    results.replaceChildren();
    resultsHead.hidden=true;
    warning.hidden=true;
    form.querySelector('button[type="submit"]').disabled=true;
    try{
      const response=await fetch('/api/trade-loops/search',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-loop-search'},
        body:JSON.stringify(query),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||payload.error||'Unable to search trade loops.');
      currentResults=Array.isArray(payload.results)?payload.results:[];
      currentSettings={...query,...(payload.query||{})};
      render(payload);
      status.textContent=currentResults.length
        ?'Found '+currentResults.length+' ranked loop'+(currentResults.length===1?'':'s')+'.'
        :'No profitable complete loops matched those settings.';
    }catch(error){
      status.textContent=error.message||'Unable to search trade loops.';
      results.innerHTML='<div class="trade-loop-empty">The route optimizer could not complete this search.</div>';
    }finally{
      form.querySelector('button[type="submit"]').disabled=false;
    }
  }

  function render(payload){
    resultsHead.hidden=false;
    resultsSummary.textContent=currentResults.length
      ?'Top '+currentResults.length+' · '+fmt(payload.stationCount)+' market stations analyzed'
      :'No qualifying complete loops';
    if(payload.warning){
      warning.hidden=false;
      warning.textContent=payload.warning;
    }
    if(!currentResults.length){
      results.innerHTML='<div class="trade-loop-empty">No profitable '+currentSettings.legCount+'-leg loop could be completed with the current pad, freshness, cargo, and distance settings.</div>';
      return;
    }
    results.replaceChildren(...currentResults.map((route,index)=>resultCard(route,index)));
  }

  function resultCard(route,index){
    const article=document.createElement('article');
    article.className='trade-loop-card';
    const legHtml=(route.legs||[]).map((leg,legIndex)=>`
      <div class="trade-loop-leg">
        <div class="trade-loop-stop"><span>Leg ${legIndex+1} · Load</span><strong>${safe(leg.sourceStation)}</strong><small>${safe(leg.sourceSystem)}</small></div>
        <div class="trade-loop-leg-arrow">→</div>
        <div class="trade-loop-stop"><span>Deliver</span><strong>${safe(leg.destinationStation)}</strong><small>${safe(leg.destinationSystem)}</small></div>
        <div class="trade-loop-cargo"><strong>${safe(leg.commodity)}</strong><span>Buy ${fmt(leg.buyPrice)} · Sell ${fmt(leg.sellPrice)} Cr/t</span><span>+${fmt(leg.profitPerTon)} Cr/t</span><span>${fmt(leg.quantity)} t used</span><span>${fmt(leg.tripProfit)} Cr leg profit</span></div>
      </div>`).join('');
    article.innerHTML=`
      <div class="trade-loop-card-head">
        <div class="trade-loop-card-rank"><span>#${index+1}</span><strong>${route.legCount}-leg loop</strong></div>
        <div class="trade-loop-profit"><strong>${fmt(route.loopProfit)} Cr</strong><small>estimated profit / completed loop · ${fmt(route.equivalentProfitPerTon)} Cr per cargo-ton equivalent</small></div>
      </div>
      <div class="trade-loop-legs">${legHtml}</div>
      <div class="trade-loop-card-foot">
        <div class="trade-loop-card-meta"><span>${fmtLy(route.totalDistanceLy)} ly loop</span><span>${fmt(route.cargoCapacity)} t capacity</span><span>${ageLabel(route.observedAt)}</span></div>
        <button class="btn btn-primary btn-compact" type="button" data-post-loop>Post Managed Route</button>
      </div>`;
    article.querySelector('[data-post-loop]')?.addEventListener('click',event=>postRoute(route,event.currentTarget));
    return article;
  }

  async function postRoute(result,button){
    if(!viewer||!currentSettings)return;
    const original=button.textContent;
    button.disabled=true;
    button.textContent='Posting…';
    try{
      const payload=routePayload(result,currentSettings);
      const response=await fetch('/api/trades',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-editor'},
        body:JSON.stringify(payload),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'Unable to post managed route.');
      button.textContent='Posted ✓';
      button.classList.add('trade-loop-posted');
      window.dispatchEvent(new CustomEvent('mongrels:trade-route-posted',{detail:{route:body.route}}));
    }catch(error){
      button.disabled=false;
      button.textContent=original;
      status.textContent=error.message||'Unable to post managed route.';
    }
  }

  function routePayload(result,query){
    const routeLegs=Array.isArray(result.legs)?result.legs:[];
    const first=routeLegs[0]||{};
    const second=routeLegs[1]||{};
    const commodities=[...new Set(routeLegs.map(leg=>leg.commodity).filter(Boolean))];
    const title=(commodities.slice(0,3).join(' / ')||'Managed Trade')+' Loop · '+query.startSystem;
    return{
      category:'credits',
      official:false,
      title,
      commodity:commodities.join(' / ').slice(0,100),
      originSystem:first.sourceSystem||query.startSystem,
      originStation:first.sourceStation||'',
      destinationSystem:first.destinationSystem||'',
      destinationStation:first.destinationStation||'',
      profitPerTon:Number(first.profitPerTon)||0,
      estimatedLoopProfit:Number(result.loopProfit)||0,
      padSize:padLabel(query.minPad),
      distanceLy:String(result.totalDistanceLy??''),
      quantity:String(first.quantity||''),
      returnCommodity:routeLegs.length===2?(second.commodity||''):'',
      returnProfitPerTon:routeLegs.length===2?(Number(second.profitPerTon)||0):0,
      returnQuantity:routeLegs.length===2?String(second.quantity||''):'',
      objective:'Managed Trade Loop Finder route. Prices, supply, demand, and better matching alternatives are reevaluated automatically.',
      notes:'Generated from a live community market snapshot. Verify market freshness before committing a large haul.',
      status:'active',
      tags:['Managed Loop',routeLegs.length+'-Leg',query.scope==='same'?'Same System':query.radiusLy+' ly'],
      intelligence:{enabled:true,priority:query.priority},
      legs:routeLegs,
      optimizer:{
        managed:true,
        startSystem:query.startSystem,
        legCount:query.legCount,
        scope:query.scope,
        radiusLy:query.radiusLy,
        cargoCapacity:query.cargoCapacity,
        minPad:query.minPad,
        carrierMode:query.carrierMode,
        priority:query.priority,
        maxAgeMinutes:query.maxAgeMinutes,
        thresholdDropPercent:query.thresholdDropPercent,
        baselineProfit:Number(result.loopProfit)||0,
        currentProfit:Number(result.loopProfit)||0,
        state:'healthy',
        lastEvaluatedAt:'',
        lastAlertAt:'',
        alternative:null,
      },
    };
  }

  function padLabel(value){
    return Number(value)>=3?'large':Number(value)===2?'medium':Number(value)===1?'small':'unknown';
  }

  form.addEventListener('submit',search);
  scope.addEventListener('change',updateMode);
  legs.addEventListener('change',updateMode);
  window.MongrelTradeLoops={activate};
})();
