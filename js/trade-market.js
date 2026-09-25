(() => {
  const section=document.querySelector('[data-trade-market]');
  const form=document.querySelector('[data-trade-market-form]');
  if(!section||!form)return;

  const $=sel=>section.querySelector(sel);
  const commodity=$('[data-market-commodity]');
  const commodityList=$('[data-market-commodity-list]');
  const direction=$('[data-market-direction]');
  const system=$('[data-market-system]');
  const radius=$('[data-market-radius]');
  const price=$('[data-market-price]');
  const volume=$('[data-market-volume]');
  const pad=$('[data-market-pad]');
  const carriers=$('[data-market-carriers]');
  const priority=$('[data-market-priority]');
  const age=$('[data-market-age]');
  const sort=$('[data-market-sort]');
  const priceLabel=$('[data-market-price-label]');
  const volumeLabel=$('[data-market-volume-label]');
  const status=$('[data-market-status]');
  const summary=$('[data-market-summary]');
  const results=$('[data-market-results]');
  const empty=$('[data-market-empty]');
  const STORAGE_KEY='mongrels-trade-market-search-v1';

  let activated=false;
  let searching=false;

  const safe=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=value=>Number(value||0).toLocaleString();
  const padLabel=value=>({1:'Small',2:'Medium',3:'Large'})[Number(value)]||'Unknown';
  const ageLabel=minutes=>{
    const n=Number(minutes);
    if(!Number.isFinite(n))return'Unknown age';
    if(n<1)return'<1 min old';
    if(n<60)return Math.floor(n)+' min old';
    const hours=n/60;
    if(hours<24)return (hours<10?hours.toFixed(1):Math.floor(hours))+' hr old';
    const days=hours/24;
    return (days<10?days.toFixed(1):Math.floor(days))+' d old';
  };
  const arrivalLabel=value=>{
    const n=Number(value);
    if(!Number.isFinite(n)||n<0)return'Arrival unknown';
    return fmt(Math.round(n))+' ls';
  };

  function updateLabels(){
    const buying=direction.value==='buy';
    priceLabel.textContent=buying?'Maximum buy price':'Minimum sell price';
    volumeLabel.textContent=buying?'Minimum supply':'Minimum demand';
    price.placeholder='Any';
  }

  function restore(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
    commodity.value=saved.commodity||'';
    direction.value=saved.direction==='buy'?'buy':'sell';
    system.value=saved.referenceSystem||'Diaba';
    radius.value=saved.radiusLy||100;
    price.value=saved.price||'';
    volume.value=saved.minVolume??1;
    pad.value=String(saved.minPad??0);
    carriers.value=['include','exclude','only'].includes(saved.carrierMode)?saved.carrierMode:'exclude';
    priority.value=['critical','high','standard','low'].includes(saved.priority)?saved.priority:'';
    age.value=saved.maxAgeMinutes?String(saved.maxAgeMinutes):'';
    sort.value=['price','distance','freshness','volume'].includes(saved.sort)?saved.sort:'price';
    updateLabels();
  }

  function remember(query){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(query));}catch{}
  }

  async function loadCommodityCatalog(){
    try{
      const response=await fetch('/api/trade-market/commodities',{credentials:'same-origin',cache:'no-store'});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!Array.isArray(payload.items))return;
      commodityList.replaceChildren(...payload.items.slice(0,500).map(item=>{
        const option=document.createElement('option');
        option.value=item.label||item.name;
        option.dataset.marketCommodityName=item.name;
        return option;
      }));
    }catch{}
  }

  function queryFromForm(){
    return {
      commodity:commodity.value.trim(),
      direction:direction.value,
      referenceSystem:system.value.trim(),
      radiusLy:Number(radius.value)||100,
      price:Number(price.value)||0,
      minVolume:Number(volume.value)||0,
      minPad:Number(pad.value)||0,
      carrierMode:carriers.value,
      priority:priority.value,
      maxAgeMinutes:age.value?Number(age.value):null,
      sort:sort.value,
      limit:50,
    };
  }

  function buildUrl(query){
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(query)){
      if(value===null||value===undefined||value==='')continue;
      params.set(key,String(value));
    }
    return '/api/trade-market/search?'+params.toString();
  }

  function renderSummary(payload){
    const q=payload.query||{};
    const action=q.direction==='buy'?'BUY':'SELL';
    const ageText=q.maxAgeMinutes?ageLabel(q.maxAgeMinutes).replace(' old',''):'Profile limit';
    summary.hidden=false;
    summary.innerHTML=[
      '<span><strong>'+safe(action)+'</strong>&nbsp;'+safe(q.commodity||'')+'</span>',
      '<span>Near&nbsp;<strong>'+safe(q.referenceSystem||'')+'</strong></span>',
      '<span>Radius&nbsp;<strong>'+fmt(q.radiusLy)+' ly</strong></span>',
      '<span>Profile&nbsp;<strong>'+safe(q.priority||'standard')+'</strong></span>',
      '<span>Max age&nbsp;<strong>'+safe(ageText)+'</strong></span>',
      '<span><strong>'+fmt(payload.results?.length||0)+'</strong>&nbsp;matches from '+fmt(payload.sourceResultCount||0)+' source candidates</span>',
      payload.partial?'<span><strong>Partial / fallback results</strong></span>':'',
    ].filter(Boolean).join('');
  }

  function resultCard(item,query){
    const buying=query.direction==='buy';
    const primaryPrice=buying?item.buyPrice:item.sellPrice;
    const quantity=buying
      ?fmt(item.supply)+' t supply'
      :(Number(item.demand)===0?'∞ demand':fmt(item.demand)+' t demand');
    const carrier=item.carrier?'Fleet Carrier':item.stationType||'Station';
    const distance=Number.isFinite(Number(item.distanceLy))?fmt(item.distanceLy)+' ly':'Distance unknown';
    const freshness=['fresh','aging','stale'].includes(item.freshness)?item.freshness:'unknown';
    const article=document.createElement('article');
    article.className='trade-market-result is-'+freshness;
    article.innerHTML=`
      <div class="trade-market-result-head">
        <div><p>${safe(item.systemName)}</p><h3>${safe(item.stationName)}</h3></div>
        <span class="trade-market-freshness">${safe(freshness)}</span>
      </div>
      <div class="trade-market-result-main">
        <div><span>${buying?'Buy price':'Sell price'}</span><strong>${fmt(primaryPrice)} Cr/t</strong></div>
        <div><span>${buying?'Supply':'Demand'}</span><strong>${safe(quantity)}</strong></div>
        <div><span>Distance</span><strong>${safe(distance)}</strong></div>
      </div>
      <div class="trade-market-result-sub">
        <span>${safe(carrier)}</span>
        <span>${safe(padLabel(item.maxLandingPadSize))} pad</span>
        <span>${safe(arrivalLabel(item.distanceToArrivalLs))} arrival</span>
        ${item.carrier&&item.carrierDockingAccess?`<span>${safe(item.carrierDockingAccess)} access</span>`:''}
      </div>
      <div class="trade-market-result-foot">
        <small>${safe(ageLabel(item.ageMinutes))} · ${safe(item.source||'EDData / EDDN')}</small>
        <button class="btn btn-secondary" type="button" data-copy-market-system>Copy System</button>
      </div>`;
    article.querySelector('[data-copy-market-system]')?.addEventListener('click',async event=>{
      try{
        await navigator.clipboard.writeText(item.systemName);
        const button=event.currentTarget;
        const old=button.textContent;
        button.textContent='Copied';
        setTimeout(()=>button.textContent=old,1000);
      }catch{}
    });
    return article;
  }

  function renderResults(payload){
    const list=Array.isArray(payload.results)?payload.results:[];
    results.replaceChildren(...list.map(item=>resultCard(item,payload.query||{})));
    empty.hidden=list.length>0;
    renderSummary(payload);
  }

  async function submit(event){
    event.preventDefault();
    if(searching)return;
    const query=queryFromForm();
    if(!query.commodity){status.textContent='Enter a commodity.';commodity.focus();return;}
    if(!query.referenceSystem){status.textContent='Enter a reference system.';system.focus();return;}
    searching=true;
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    status.textContent='Searching live market data…';
    summary.hidden=true;
    empty.hidden=true;
    results.replaceChildren();

    remember(query);
    try{
      const response=await fetch(buildUrl(query),{credentials:'same-origin',cache:'no-store'});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Market search failed.');
      renderResults(payload);
      status.textContent=payload.warning
        ?payload.warning
        :payload.results?.length
          ?'Live market search complete.'
          :'Search complete — no matching markets.';
      window.dispatchEvent(new CustomEvent('mongrels:trade-market-search',{detail:payload}));
    }catch(error){
      status.textContent=error.message||'Market search failed.';
      results.replaceChildren();
      summary.hidden=true;
      empty.hidden=true;
    }finally{
      searching=false;
      if(button)button.disabled=false;
    }
  }

  function activate(){
    if(activated)return;
    activated=true;
    section.hidden=false;
    restore();
    loadCommodityCatalog();
  }

  direction.addEventListener('change',updateLabels);
  form.addEventListener('submit',submit);

  window.MongrelTradeMarket={activate};
})();
