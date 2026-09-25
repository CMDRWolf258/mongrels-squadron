(() => {
  const section=document.querySelector('[data-trade-market]');
  const form=document.querySelector('[data-trade-market-form]');
  if(!section||!form)return;

  const $=sel=>section.querySelector(sel);
  const commodity=$('[data-market-commodity]');
  const commodityBox=$('[data-market-commodity-box]');
  const commodityToggle=$('[data-market-commodity-toggle]');
  const commodityMenu=$('[data-market-commodity-menu]');
  const commodityHelp=$('[data-market-commodity-help]');
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
  const summaryRow=$('[data-market-summary-row]');
  const summary=$('[data-market-summary]');
  const saveWatchButton=$('[data-market-save-watch]');
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
  const watchEditor=document.querySelector('[data-trade-watch-editor]');
  const watchForm=document.querySelector('[data-trade-watch-form]');
  const watchName=document.querySelector('[data-trade-watch-name]');
  const watchPriority=document.querySelector('[data-trade-watch-priority]');
  const watchDiscord=document.querySelector('[data-trade-watch-discord]');
  const watchPreview=document.querySelector('[data-trade-watch-preview]');
  const watchStatus=document.querySelector('[data-trade-watch-status]');
  const STORAGE_KEY='mongrels-trade-market-search-v1';
  const PAGE_SIZE=10;

  let activated=false;
  let searching=false;
  let viewerAccess='';
  let currentPayload=null;
  let currentPage=1;
  let commodityCatalog=[];
  let commodityCatalogComplete=false;
  let commodityMenuOpen=false;
  let commodityActiveIndex=-1;

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

  const normalizeCommodityText=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function commodityMatches(term){
    const q=normalizeCommodityText(term);
    const ranked=commodityCatalog.map(item=>{
      const label=item.label||item.name||'';
      const normalized=normalizeCommodityText(label);
      let rank=3;
      if(!q)rank=2;
      else if(normalized===q)rank=0;
      else if(normalized.startsWith(q))rank=1;
      else if(normalized.includes(q))rank=2;
      else return null;
      return {item,label,rank};
    }).filter(Boolean);
    ranked.sort((a,b)=>a.rank-b.rank||a.label.localeCompare(b.label,undefined,{sensitivity:'base'}));
    return ranked.slice(0,80);
  }

  function closeCommodityMenu(){
    if(!commodityMenu)return;
    commodityMenu.hidden=true;
    commodityMenuOpen=false;
    commodityActiveIndex=-1;
    commodity.setAttribute('aria-expanded','false');
    commodity.removeAttribute('aria-activedescendant');
  }

  function chooseCommodity(label){
    commodity.value=label;
    closeCommodityMenu();
    commodity.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function renderCommodityMenu(){
    if(!commodityMenu)return;
    const matches=commodityMatches(commodity.value);
    commodityMenu.replaceChildren();
    commodityActiveIndex=-1;
    if(!matches.length){
      const emptyItem=document.createElement('div');
      emptyItem.className='trade-commodity-empty';
      emptyItem.textContent=commodityCatalog.length
        ?'No matching commodity. Check the spelling or choose from the list.'
        :'Commodity catalog is unavailable; you can still type an exact commodity name.';
      commodityMenu.append(emptyItem);
    }else{
      matches.forEach(({label},index)=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='trade-commodity-option';
        button.id='tradeCommodityOption'+index;
        button.setAttribute('role','option');
        button.dataset.commodityIndex=String(index);
        button.textContent=label;
        button.addEventListener('mousedown',event=>event.preventDefault());
        button.addEventListener('click',()=>chooseCommodity(label));
        commodityMenu.append(button);
      });
    }
    commodityMenu.hidden=false;
    commodityMenuOpen=true;
    commodity.setAttribute('aria-expanded','true');
  }

  function moveCommoditySelection(delta){
    if(!commodityMenuOpen)renderCommodityMenu();
    const options=[...commodityMenu.querySelectorAll('.trade-commodity-option')];
    if(!options.length)return;
    commodityActiveIndex=(commodityActiveIndex+delta+options.length)%options.length;
    options.forEach((option,index)=>{
      const active=index===commodityActiveIndex;
      option.classList.toggle('is-active',active);
      option.setAttribute('aria-selected',active?'true':'false');
    });
    const active=options[commodityActiveIndex];
    commodity.setAttribute('aria-activedescendant',active.id);
    active.scrollIntoView({block:'nearest'});
  }

  function validateCommoditySelection(){
    if(!commodityCatalog.length||!commodityCatalogComplete)return true;
    const entered=normalizeCommodityText(commodity.value);
    const exact=commodityCatalog.find(item=>normalizeCommodityText(item.label||item.name)===entered);
    if(exact){
      commodity.value=exact.label||exact.name;
      return true;
    }
    const matches=commodityMatches(commodity.value);
    if(matches.length===1){
      commodity.value=matches[0].label;
      return true;
    }
    status.textContent='Choose a commodity from the matching list to avoid spelling errors.';
    renderCommodityMenu();
    commodity.focus();
    return false;
  }

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
      commodityCatalog=payload.items
        .map(item=>({name:String(item.name||item.label||'').trim(),label:String(item.label||item.name||'').trim()}))
        .filter(item=>item.label)
        .sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'}));
      commodityCatalogComplete=payload.includesRares!==false;
      if(commodityHelp){
        commodityHelp.textContent=payload.includesRares===false
          ?'Commodity suggestions are using a fallback catalog right now.'
          :'Standard and rare commodities use the same searchable list · '+commodityCatalog.length+' available.';
      }
    }catch{
      commodityCatalogComplete=false;
      if(commodityHelp)commodityHelp.textContent='Commodity suggestions are temporarily unavailable; exact names can still be typed.';
    }
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
    if(summaryRow)summaryRow.hidden=false;
    if(saveWatchButton)saveWatchButton.hidden=!['officer','site_admin'].includes(viewerAccess);
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

  function defaultWatchName(query){
    const action=query.direction==='buy'?'Buy':'Sell';
    return action+' '+(query.commodity||'Commodity')+' near '+(query.referenceSystem||'System');
  }

  function watchQueryPreview(query){
    const action=query.direction==='buy'?'Buy':'Sell';
    const volumeLabel=query.direction==='buy'?'supply':'demand';
    const priceText=Number(query.price)>0
      ?(query.direction==='buy'?'≤ ':'≥ ')+fmt(query.price)+' Cr/t'
      :'Any price';
    return '<div><span>Saved Search</span><strong>'+safe(action+' '+query.commodity)+'</strong></div>'
      +'<div><span>Area</span><strong>'+safe(query.referenceSystem)+' · '+fmt(query.radiusLy)+' ly</strong></div>'
      +'<div><span>Thresholds</span><strong>'+safe(priceText)+' · ≥ '+fmt(query.minVolume)+' t '+volumeLabel+'</strong></div>'
      +'<div><span>Freshness</span><strong>'+safe(String(query.priority||'standard'))+' · max '+safe(ageLabel(query.maxAgeMinutes).replace(' old',''))+'</strong></div>';
  }

  function openWatchEditor(){
    if(!currentPayload?.query||!['officer','site_admin'].includes(viewerAccess)||!watchEditor)return;
    const q=currentPayload.query;
    watchName.value=defaultWatchName(q);
    watchPriority.value=['critical','high','standard','low'].includes(q.priority)?q.priority:'standard';
    watchDiscord.value='true';
    watchPreview.innerHTML=watchQueryPreview(q);
    watchStatus.textContent='';
    watchEditor.hidden=false;
    document.body.classList.add('project-editor-open');
    requestAnimationFrame(()=>watchName.focus());
  }

  function closeWatchEditor(){
    if(!watchEditor)return;
    watchEditor.hidden=true;
    document.body.classList.remove('project-editor-open');
    if(watchStatus)watchStatus.textContent='';
  }

  async function saveWatch(event){
    event.preventDefault();
    if(!currentPayload?.query||!['officer','site_admin'].includes(viewerAccess))return;
    const button=watchForm?.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    watchStatus.textContent='Saving watch…';
    const query={...currentPayload.query,priority:watchPriority.value,limit:100};
    try{
      const response=await fetch('/api/trade-watches',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-watch-editor'},
        body:JSON.stringify({
          name:watchName.value.trim(),
          query,
          publishDiscord:watchDiscord.value==='true',
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to save watch.');
      watchStatus.textContent='Saved.';
      window.dispatchEvent(new CustomEvent('mongrels:trade-watch-saved',{detail:payload.watch}));
      setTimeout(closeWatchEditor,450);
    }catch(error){
      watchStatus.textContent=error.message||'Unable to save watch.';
    }finally{
      if(button)button.disabled=false;
    }
  }

  function ensureAgeOption(value){
    const text=String(value||'');
    if(!text)return;
    if([...age.options].some(option=>option.value===text))return;
    const option=document.createElement('option');
    option.value=text;
    option.textContent=text+' minutes (saved)';
    option.dataset.savedAge='true';
    age.append(option);
  }

  function loadQuery(query){
    if(!query||typeof query!=='object')return;
    commodity.value=query.commodity||'';
    direction.value=query.direction==='buy'?'buy':'sell';
    system.value=query.referenceSystem||'';
    radius.value=query.radiusLy||100;
    price.value=Number(query.price)>0?query.price:'';
    volume.value=query.minVolume??1;
    pad.value=String(query.minPad??0);
    carriers.value=['include','exclude','only'].includes(query.carrierMode)?query.carrierMode:'exclude';
    priority.value=['critical','high','standard','low'].includes(query.priority)?query.priority:'';
    if(query.maxAgeMinutes)ensureAgeOption(query.maxAgeMinutes);
    age.value=query.maxAgeMinutes?String(query.maxAgeMinutes):'';
    sort.value=['price','distance','freshness','volume'].includes(query.sort)?query.sort:'price';
    updateLabels();
    remember(queryFromForm());
    section.scrollIntoView({behavior:'smooth',block:'start'});
    status.textContent='Saved watch loaded. Review the filters, then Search Markets.';
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
    if(!commodity.value.trim()){status.textContent='Enter a commodity.';commodity.focus();return;}
    if(!validateCommoditySelection())return;
    const query=queryFromForm();
    if(!query.referenceSystem){status.textContent='Enter a reference system.';system.focus();return;}
    searching=true;
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    status.textContent='Searching live market data…';
    if(summaryRow)summaryRow.hidden=true;
    if(saveWatchButton)saveWatchButton.hidden=true;
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
      if(summaryRow)summaryRow.hidden=true;
      if(saveWatchButton)saveWatchButton.hidden=true;
      empty.hidden=true;
      resultTools.hidden=true;
      pagination.hidden=true;
      currentPayload=null;
    }finally{
      searching=false;
      if(button)button.disabled=false;
    }
  }

  function activate(viewer={}){
    viewerAccess=String(viewer?.access||viewerAccess||'');
    if(activated){
      if(saveWatchButton&&currentPayload?.query)saveWatchButton.hidden=!['officer','site_admin'].includes(viewerAccess);
      return;
    }
    activated=true;
    section.hidden=false;
    restore();
    loadCommodityCatalog();
  }

  commodity.addEventListener('focus',renderCommodityMenu);
  commodity.addEventListener('click',renderCommodityMenu);
  commodity.addEventListener('input',renderCommodityMenu);
  commodity.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();moveCommoditySelection(1);}
    else if(event.key==='ArrowUp'){event.preventDefault();moveCommoditySelection(-1);}
    else if(event.key==='Enter'&&commodityMenuOpen&&commodityActiveIndex>=0){
      event.preventDefault();
      const option=commodityMenu.querySelectorAll('.trade-commodity-option')[commodityActiveIndex];
      if(option)chooseCommodity(option.textContent);
    }else if(event.key==='Escape'){
      closeCommodityMenu();
    }
  });
  commodityToggle?.addEventListener('click',()=>{
    if(commodityMenuOpen)closeCommodityMenu();
    else{commodity.focus();renderCommodityMenu();}
  });
  document.addEventListener('pointerdown',event=>{
    if(commodityMenuOpen&&commodityBox&&!commodityBox.contains(event.target))closeCommodityMenu();
  });
  saveWatchButton?.addEventListener('click',openWatchEditor);
  watchForm?.addEventListener('submit',saveWatch);
  watchPriority?.addEventListener('change',()=>{
    if(currentPayload?.query&&watchPreview)watchPreview.innerHTML=watchQueryPreview({...currentPayload.query,priority:watchPriority.value});
  });
  document.querySelectorAll('[data-trade-watch-cancel]').forEach(button=>button.addEventListener('click',closeWatchEditor));
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

  window.MongrelTradeMarket={activate,loadQuery};
})();
