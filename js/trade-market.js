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
  const resultTools=$('[data-market-result-tools]');
  const resultSort=$('[data-market-result-sort]');
  const resultRange=$('[data-market-result-range]');
  const pagination=$('[data-market-pagination]');
  const pageNumbers=$('[data-market-page-numbers]');
  const pageLabel=$('[data-market-page-label]');
  const prevPage=$('[data-market-page-prev]');
  const nextPage=$('[data-market-page-next]');
  const STORAGE_KEY='mongrels-trade-market-search-v1';
  const PAGE_SIZE=10;

  let activated=false;
  let searching=false;
  let currentPayload=null;
  let currentPage=1;

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
      limit:100,
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

  function sortedResults(){
    const list=Array.isArray(currentPayload?.results)?[...currentPayload.results]:[];
    const q=currentPayload?.query||{};
    const mode=resultSort?.value||q.sort||'price';
    const buying=q.direction==='buy';
    const priceOf=item=>buying?Number(item.buyPrice||0):Number(item.sellPrice||0);
    const volumeOf=item=>buying?Number(item.supply||0):Number(item.demand||0);
    const distanceOf=item=>{
      const value=Number(item.distanceLy);
      return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
    };
    const arrivalOf=item=>{
      const value=Number(item.distanceToArrivalLs);
      return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
    };
    const observedOf=item=>{
      const value=Date.parse(item.observedAt||'');
      return Number.isFinite(value)?value:0;
    };

    const compare={
      price:(a,b)=>buying?priceOf(a)-priceOf(b):priceOf(b)-priceOf(a),
      distance:(a,b)=>distanceOf(a)-distanceOf(b),
      freshness:(a,b)=>observedOf(b)-observedOf(a),
      volume:(a,b)=>volumeOf(b)-volumeOf(a),
      arrival:(a,b)=>arrivalOf(a)-arrivalOf(b),
    }[mode]||(()=>0);

    return list.sort((a,b)=>
      compare(a,b)
      || distanceOf(a)-distanceOf(b)
      || String(a.stationName||'').localeCompare(String(b.stationName||''))
    );
  }

  function pageButtons(totalPages){
    if(!pageNumbers)return;
    const values=[];
    if(totalPages<=7){
      for(let page=1;page<=totalPages;page++)values.push(page);
    }else{
      values.push(1);
      const start=Math.max(2,currentPage-1);
      const end=Math.min(totalPages-1,currentPage+1);
      if(start>2)values.push('ellipsis-left');
      for(let page=start;page<=end;page++)values.push(page);
      if(end<totalPages-1)values.push('ellipsis-right');
      values.push(totalPages);
    }

    pageNumbers.replaceChildren(...values.map(value=>{
      if(typeof value!=='number'){
        const span=document.createElement('span');
        span.className='trade-market-page-ellipsis';
        span.textContent='…';
        return span;
      }
      const button=document.createElement('button');
      button.type='button';
      button.className='trade-market-page-number'+(value===currentPage?' is-active':'');
      button.textContent=String(value);
      button.setAttribute('aria-label','Go to page '+value);
      if(value===currentPage)button.setAttribute('aria-current','page');
      button.addEventListener('click',()=>{
        currentPage=value;
        renderCurrentPage({scroll:true});
      });
      return button;
    }));
  }

  function renderCurrentPage({scroll=false}={}){
    if(!currentPayload)return;
    const list=sortedResults();
    const totalPages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
    currentPage=Math.min(Math.max(1,currentPage),totalPages);
    const start=(currentPage-1)*PAGE_SIZE;
    const page=list.slice(start,start+PAGE_SIZE);

    results.replaceChildren(...page.map(item=>resultCard(item,currentPayload.query||{})));
    empty.hidden=list.length>0;
    resultTools.hidden=list.length===0;
    pagination.hidden=list.length<=PAGE_SIZE;

    if(resultRange){
      const first=list.length?start+1:0;
      const last=Math.min(start+PAGE_SIZE,list.length);
      resultRange.textContent=list.length
        ?'Showing '+first+'–'+last+' of '+fmt(list.length)+' results'
        :'Showing 0 results';
    }
    if(pageLabel)pageLabel.textContent='Page '+currentPage+' of '+totalPages;
    if(prevPage)prevPage.disabled=currentPage<=1;
    if(nextPage)nextPage.disabled=currentPage>=totalPages;
    pageButtons(totalPages);

    if(scroll&&resultTools){
      resultTools.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }

  function renderResults(payload){
    currentPayload=payload;
    currentPage=1;
    if(resultSort)resultSort.value=['price','distance','freshness','volume'].includes(payload?.query?.sort)
      ?payload.query.sort
      :'price';
    renderSummary(payload);
    renderCurrentPage();
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
    resultTools.hidden=true;
    pagination.hidden=true;
    currentPayload=null;
    currentPage=1;
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
      resultTools.hidden=true;
      pagination.hidden=true;
      currentPayload=null;
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
  resultSort?.addEventListener('change',()=>{
    currentPage=1;
    renderCurrentPage();
  });
  prevPage?.addEventListener('click',()=>{
    if(currentPage<=1)return;
    currentPage-=1;
    renderCurrentPage({scroll:true});
  });
  nextPage?.addEventListener('click',()=>{
    const total=Math.max(1,Math.ceil(sortedResults().length/PAGE_SIZE));
    if(currentPage>=total)return;
    currentPage+=1;
    renderCurrentPage({scroll:true});
  });
  form.addEventListener('submit',submit);

  window.MongrelTradeMarket={activate};
})();
