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
  const radiusField=$('[data-market-radius-field]');
  const rareSourceIndicator=$('[data-market-rare-source-indicator]');
  const radiusHelp=$('[data-market-radius-help]');
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
  const watchTitle=document.querySelector('[data-trade-watch-title]');
  const watchId=document.querySelector('[data-trade-watch-id]');
  const watchName=document.querySelector('[data-trade-watch-name]');
  const watchCommodity=document.querySelector('[data-trade-watch-commodity]');
  const watchCommodityList=document.querySelector('[data-trade-watch-commodity-list]');
  const watchDirection=document.querySelector('[data-trade-watch-direction]');
  const watchSystem=document.querySelector('[data-trade-watch-system]');
  const watchRadius=document.querySelector('[data-trade-watch-radius]');
  const watchRadiusField=document.querySelector('[data-trade-watch-radius-field]');
  const watchRareSourceIndicator=document.querySelector('[data-trade-watch-rare-source-indicator]');
  const watchRadiusHelp=document.querySelector('[data-trade-watch-radius-help]');
  const watchPrice=document.querySelector('[data-trade-watch-price]');
  const watchPriceLabel=document.querySelector('[data-trade-watch-price-label]');
  const watchVolume=document.querySelector('[data-trade-watch-volume]');
  const watchVolumeLabel=document.querySelector('[data-trade-watch-volume-label]');
  const watchPad=document.querySelector('[data-trade-watch-pad]');
  const watchCarriers=document.querySelector('[data-trade-watch-carriers]');
  const watchAge=document.querySelector('[data-trade-watch-age]');
  const watchPriority=document.querySelector('[data-trade-watch-priority]');
  const watchSort=document.querySelector('[data-trade-watch-sort]');
  const watchDiscord=document.querySelector('[data-trade-watch-discord]');
  const watchStatus=document.querySelector('[data-trade-watch-status]');
  const watchSubmit=document.querySelector('[data-trade-watch-submit]');
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
  const fmtLy=value=>{
    const n=Number(value);
    return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:2}):'—';
  };
  const integerValue=value=>{
    const digits=String(value??'').replace(/[^0-9]/g,'');
    return digits?Number(digits):0;
  };
  const formattedInteger=value=>{
    if(value===null||value===undefined||String(value).trim()==='')return'';
    return integerValue(value).toLocaleString('en-US');
  };
  function bindFormattedInteger(input){
    if(!input)return;
    const max=Number(input.dataset.numberMax)||Number.MAX_SAFE_INTEGER;
    input.addEventListener('input',()=>{
      const raw=String(input.value||'');
      const caret=input.selectionStart??raw.length;
      const digitsBefore=raw.slice(0,caret).replace(/\D/g,'').length;
      let digits=raw.replace(/\D/g,'').replace(/^0+(?=\d)/,'');
      if(!digits){input.value='';return;}
      let n=Math.min(Number(digits),max);
      if(!Number.isFinite(n))n=0;
      const normalized=String(Math.trunc(n));
      const formatted=Number(normalized).toLocaleString('en-US');
      input.value=formatted;
      const targetDigits=Math.min(digitsBefore,normalized.length);
      let seen=0;
      let pos=formatted.length;
      for(let i=0;i<formatted.length;i++){
        if(/\d/.test(formatted[i]))seen+=1;
        if(seen>=targetDigits){pos=i+1;break;}
      }
      try{input.setSelectionRange(pos,pos);}catch{}
    });
  }
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
  const commodityAliasKey=value=>{
    const normalized=normalizeCommodityText(value);
    return normalized==='soontil relics'?'soontill relics':normalized;
  };

  function commodityCatalogItem(value){
    const normalized=commodityAliasKey(value);
    return commodityCatalog.find(item=>commodityAliasKey(item.label||item.name)===normalized)||null;
  }

  function rareSourceSearch(commodityValue,directionValue){
    if(directionValue!=='buy')return false;
    const item=commodityCatalogItem(commodityValue);
    // Soontill is a pinned known rare source. Recognize it even if the
    // commodity catalog has not loaded yet (for example on a fresh device
    // or preview hostname without an existing member session).
    const knownRareSource=commodityAliasKey(commodityValue)==='soontill relics';
    return Boolean(item?.rare)||knownRareSource;
  }

  function updateRadiusMode(){
    const rareCommodity=Boolean(commodityCatalogItem(commodity.value)?.rare)||commodityAliasKey(commodity.value)==='soontill relics';
    const rareSource=rareSourceSearch(commodity.value,direction.value);
    radius.disabled=rareSource;
    if(radiusField)radiusField.hidden=rareSource;
    if(rareSourceIndicator)rareSourceIndicator.hidden=!rareSource;
    radius.closest('label')?.classList.toggle('is-rare-source',rareSource);
    if(radiusHelp)radiusHelp.textContent='Maximum distance from the reference system.';
    if(commodityHelp&&rareCommodity&&direction.value!=='buy'){
      commodityHelp.textContent='Rare commodity selected · Radius applies while finding a market to sell it. Choose Buy commodity to locate its unique source.';
    }else if(commodityHelp&&commodityCatalog.length){
      commodityHelp.textContent=commodityCatalogComplete
        ?'Standard and rare commodities use the same searchable list · '+commodityCatalog.length+' available.'
        :'Commodity suggestions are using a fallback catalog right now.';
    }
  }

  function updateWatchRadiusMode(){
    if(!watchRadius)return;
    const rareSource=rareSourceSearch(watchCommodity?.value,watchDirection?.value);
    watchRadius.disabled=rareSource;
    if(watchRadiusField)watchRadiusField.hidden=rareSource;
    if(watchRareSourceIndicator)watchRareSourceIndicator.hidden=!rareSource;
    watchRadius.closest('label')?.classList.toggle('is-rare-source',rareSource);
    if(watchRadiusHelp)watchRadiusHelp.textContent='Maximum distance from the reference system.';
  }

  function commodityMatches(term){
    const q=commodityAliasKey(term);
    const ranked=commodityCatalog.map(item=>{
      const label=item.label||item.name||'';
      const normalized=commodityAliasKey(label);
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
        button.dataset.commodityLabel=label;
        const text=document.createElement('span');
        text.textContent=label;
        button.append(text);
        if(matches[index]?.item?.rare){
          const badge=document.createElement('small');
          badge.className='trade-commodity-rare-badge';
          badge.textContent='RARE';
          button.append(badge);
        }
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
    const entered=commodityAliasKey(commodity.value);
    const exact=commodityCatalog.find(item=>commodityAliasKey(item.label||item.name)===entered);
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
    updateRadiusMode();
  }

  function restore(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
    commodity.value=saved.commodity||'';
    direction.value=saved.direction==='buy'?'buy':'sell';
    system.value=saved.referenceSystem||'Diaba';
    radius.value=saved.radiusLy||100;
    price.value=Number(saved.price)>0?formattedInteger(saved.price):'';
    volume.value=formattedInteger(saved.minVolume??1)||'1';
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
        .map(item=>({
          name:String(item.name||item.label||'').trim(),
          label:String(item.label||item.name||'').trim(),
          rare:Boolean(item.rare),
        }))
        .filter(item=>item.label)
        .sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'}));
      commodityCatalogComplete=payload.includesRares!==false;
      if(watchCommodityList){
        watchCommodityList.replaceChildren(...commodityCatalog.map(item=>{
          const option=document.createElement('option');
          option.value=item.label;
          return option;
        }));
      }
      if(commodityHelp){
        commodityHelp.textContent=payload.includesRares===false
          ?'Commodity suggestions are using a fallback catalog right now.'
          :'Standard and rare commodities use the same searchable list · '+commodityCatalog.length+' available.';
      }
      updateLabels();
      updateWatchLabels();
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
      price:integerValue(price.value),
      minVolume:integerValue(volume.value),
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
      '<span>Radius&nbsp;<strong>'+(q.radiusLimited===false?'All distances · rare source':fmt(q.radiusLy)+' ly')+'</strong></span>',
      q.rareSource?.stationName&&q.rareSource?.systemName
        ?'<span>Rare source&nbsp;<strong>'+safe(q.rareSource.stationName)+' · '+safe(q.rareSource.systemName)+'</strong></span>'
        :'',
      '<span>Profile&nbsp;<strong>'+safe(q.priority||'standard')+'</strong></span>',
      '<span>Max age&nbsp;<strong>'+safe(ageText)+'</strong></span>',
      q.rareSourceSearch&&Number(payload.qualifyingMatchCount||0)===0&&Array.isArray(payload.results)&&payload.results.some(item=>item?.qualifies===false)
        ?'<span><strong>0 qualifying</strong>&nbsp;· 1 known source shown</span>'
        :'<span><strong>'+fmt(Number.isFinite(Number(payload.qualifyingMatchCount))?payload.qualifyingMatchCount:(payload.results?.length||0))+'</strong>&nbsp;matches from '+fmt(payload.sourceResultCount||0)+' source candidates</span>',
      payload.partial?'<span><strong>Partial / fallback results</strong></span>':'',
    ].filter(Boolean).join('');
  }

  function resultCard(item,query){
    const buying=query.direction==='buy';
    const rareSourceBuy=buying&&Boolean(query.rareSourceSearch);
    const allocationSupply=rareSourceBuy?Number(item.allocationSupply||0):0;
    const reportedSupply=rareSourceBuy?Number(item.reportedSupply??item.supply??0):Number(item.supply||0);
    const allocationPrice=rareSourceBuy?Number(item.allocationBuyPrice||0):0;
    const primaryPrice=buying
      ?(rareSourceBuy?(allocationPrice||item.buyPrice):item.buyPrice)
      :item.sellPrice;
    const quantity=buying
      ?(rareSourceBuy
        ?fmt(allocationSupply||reportedSupply)+' t tracked allocation'
        :fmt(item.supply)+' t supply')
      :(Number(item.demand)===0?'∞ demand':fmt(item.demand)+' t demand');
    const carrier=item.carrier?'Fleet Carrier':item.stationType||'Station';
    const distance=Number.isFinite(Number(item.distanceLy))?fmtLy(item.distanceLy)+' ly':'Distance unknown';
    const freshness=['fresh','aging','stale'].includes(item.freshness)?item.freshness:'unknown';
    const bgs=item.bgs&&typeof item.bgs==='object'?item.bgs:{};
    const economies=[bgs.stationPrimaryEconomy,bgs.stationSecondaryEconomy].filter(Boolean);
    const bgsAge=Number.isFinite(Number(bgs.metadataAgeMinutes))?ageLabel(bgs.metadataAgeMinutes):'Unknown BGS age';
    const article=document.createElement('article');
    const nonqualifying=item.qualifies===false;
    article.className='trade-market-result is-'+freshness+(bgs.infrastructureFailureMetalOpportunity?' has-infra-metal-signal':'')+(nonqualifying?' is-known-rare-source':'');
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
      ${rareSourceBuy&&item.commanderSensitiveSupply?`<div class="trade-rare-source-stock-state"><strong>${reportedSupply===0&&allocationSupply>0?'Latest 0 t commander report ignored':'Rare allocation tracking'}</strong><span>${safe(rareAllocationStatusText(item))}</span></div>`:(nonqualifying?`<div class="trade-rare-source-stock-state"><strong>Known rare source · current observation does not qualify</strong><span>${safe(rareSourceStatusText(item.rareSourceStatus,item,query))}</span></div>`:'')}
      <div class="trade-market-result-sub">
        <span>${safe(carrier)}</span>
        <span>${safe(padLabel(item.maxLandingPadSize))} pad</span>
        <span>${safe(arrivalLabel(item.distanceToArrivalLs))} arrival</span>
        ${item.carrier&&item.carrierDockingAccess?`<span>${safe(item.carrierDockingAccess)} access</span>`:''}
      </div>
      ${bgs.infrastructureFailureMetalOpportunity?`<div class="trade-market-signal"><strong>⚠ Infrastructure Failure metal source</strong><span>${safe(bgs.controllingFaction||'Unknown controller')} · ${fmt(item.supply)} t supply at ${fmt(item.buyPrice)} Cr/t</span></div>`:''}
      ${bgs.controllingFaction||bgs.factionState||economies.length?`<div class="trade-market-bgs">
        <div><span>Port controller</span><strong>${safe(bgs.controllingFaction||'Unknown')}</strong></div>
        <div><span>Faction state</span><strong>${safe(bgs.factionState||'Unknown')}</strong></div>
        <div><span>Economy</span><strong>${safe(economies.join(' / ')||'Unknown')}</strong></div>
        <div><span>Ownership / BGS data</span><strong>${safe(bgsAge)} · ${safe(bgs.metadataFreshness||'unknown')}</strong></div>
      </div>`:''}
      ${bgs.ownershipNeedsConfirmation?`<p class="trade-market-ownership-warning">Ownership needs confirmation — market data is newer or fresher than the station ownership/BGS metadata, so a recent port-control change may not be reflected yet.</p>`:''}
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

  function rareAllocationStatusText(item){
    const reported=Math.max(0,Number(item?.reportedSupply??item?.supply??0)||0);
    const allocation=Math.max(0,Number(item?.allocationSupply||0)||0);
    const when=item?.allocationObservedAt?ageLabel(Math.max(0,(Date.now()-Date.parse(item.allocationObservedAt))/60000)):'unknown age';
    if(reported===0&&allocation>0){
      return'Latest uploader reported 0 t, which can reflect that commander exhausting their personal allotment. Last positive allocation: '+fmt(allocation)+' t · '+when+'.';
    }
    if(reported>0){
      return'Positive allocation report: '+fmt(reported)+' t. Daily Watch tracking ignores later zero/partial depletion noise and keeps the strongest meaningful allocation for the observation window.';
    }
    return'No positive allocation has been observed yet. Zero reports are not treated as station depletion.';
  }

  function rareSourceStatusText(statusValue,item,query){
    const state=String(statusValue||'');
    if(state==='no_positive_allocation_observed')return'No positive rare allocation has been observed yet; zero commander reports are ignored for station availability.';
    if(state==='allocation_below_threshold')return'The tracked positive allocation ('+fmt(item?.allocationSupply||0)+' t) is below your minimum of '+fmt(query?.minVolume||0)+' t.';
    if(state==='price_above_threshold')return'The latest observed buy price ('+fmt(item?.buyPrice||0)+' Cr/t) is above your saved maximum.';
    if(state==='price_unavailable')return'The latest observation does not include a usable buy price.';
    if(state==='pad_below_threshold')return'The known source does not meet the selected pad-size filter.';
    return'The source is still known, but the latest observation does not meet the selected filters.';
  }

  function defaultWatchName(query){
    const action=query.direction==='buy'?'Buy':'Sell';
    return action+' '+(query.commodity||'Commodity')+' near '+(query.referenceSystem||'System');
  }

  function updateWatchLabels(){
    const buying=watchDirection?.value==='buy';
    if(watchPriceLabel)watchPriceLabel.textContent=buying?'Maximum buy price':'Minimum sell price';
    if(watchVolumeLabel)watchVolumeLabel.textContent=buying?'Minimum supply':'Minimum demand';
    updateWatchRadiusMode();
  }

  function watchQueryFromEditor(){
    return{
      commodity:watchCommodity.value.trim(),
      direction:watchDirection.value==='buy'?'buy':'sell',
      referenceSystem:watchSystem.value.trim(),
      radiusLy:Number(watchRadius.value)||100,
      price:integerValue(watchPrice.value),
      minVolume:integerValue(watchVolume.value),
      minPad:Number(watchPad.value)||0,
      carrierMode:['include','exclude','only'].includes(watchCarriers.value)?watchCarriers.value:'exclude',
      maxAgeMinutes:Number(watchAge.value)||1,
      priority:['critical','high','standard','low'].includes(watchPriority.value)?watchPriority.value:'standard',
      sort:['price','distance','freshness','volume'].includes(watchSort.value)?watchSort.value:'price',
      limit:100,
    };
  }

  function validateWatchCommodity(){
    const entered=normalizeCommodityText(watchCommodity.value);
    if(!entered){
      watchStatus.textContent='Choose a commodity.';
      watchCommodity.focus();
      return false;
    }
    if(!commodityCatalog.length||!commodityCatalogComplete)return true;
    const exact=commodityCatalog.find(item=>normalizeCommodityText(item.label||item.name)===entered);
    if(exact){
      watchCommodity.value=exact.label||exact.name;
      return true;
    }
    const matches=commodityMatches(watchCommodity.value);
    if(matches.length===1){
      watchCommodity.value=matches[0].label;
      return true;
    }
    watchStatus.textContent='Choose a valid commodity from the suggestions.';
    watchCommodity.focus();
    return false;
  }

  function populateWatchEditor(query,{id='',name='',publishDiscord=true,editing=false}={}){
    const q=query&&typeof query==='object'?query:{};
    watchId.value=id||'';
    watchName.value=name||defaultWatchName(q);
    watchCommodity.value=q.commodity||'';
    watchDirection.value=q.direction==='buy'?'buy':'sell';
    watchSystem.value=q.referenceSystem||'';
    watchRadius.value=q.radiusLy||100;
    watchPrice.value=Number(q.price)>0?formattedInteger(q.price):'';
    watchVolume.value=formattedInteger(q.minVolume??1)||'1';
    watchPad.value=String(q.minPad??0);
    watchCarriers.value=['include','exclude','only'].includes(q.carrierMode)?q.carrierMode:'exclude';
    watchAge.value=q.maxAgeMinutes||2880;
    watchPriority.value=['critical','high','standard','low'].includes(q.priority)?q.priority:'standard';
    watchSort.value=['price','distance','freshness','volume'].includes(q.sort)?q.sort:'price';
    watchDiscord.value=publishDiscord?'true':'false';
    if(watchTitle)watchTitle.textContent=editing?'Edit Watch':'Save as Watch';
    if(watchSubmit)watchSubmit.textContent=editing?'Update Watch':'Save Watch';
    const noteTitle=document.querySelector('[data-trade-watch-note-title]');
    const note=document.querySelector('[data-trade-watch-note]');
    if(noteTitle)noteTitle.textContent=editing?'Criteria change':'Saved Watch only';
    const rareSourceBuy=q.direction==='buy'&&Boolean(q.rareSource?.stationName);
    if(note)note.textContent=rareSourceBuy
      ?'Rare-source BUY Watches run hourly from 1–8 PM CT. Zero/partial commander depletion reports do not lower the tracked daily allocation; Run Now still checks immediately.'
      :editing
        ?'Updating these criteria keeps the same watch but resets its evaluation state so the next scheduler run starts from the new rules.'
        :'The evaluator wakes on a five-minute floor and checks this watch when its selected priority cadence is due. Use Run Now from Saved Watches to test it immediately.';
    updateWatchLabels();
    if(watchStatus)watchStatus.textContent='';
  }

  function showWatchEditor(){
    watchEditor.hidden=false;
    document.body.classList.add('project-editor-open');
    requestAnimationFrame(()=>watchName.focus());
  }

  function openWatchEditor(){
    if(!currentPayload?.query||!['officer','site_admin'].includes(viewerAccess)||!watchEditor)return;
    populateWatchEditor(currentPayload.query,{publishDiscord:true,editing:false});
    showWatchEditor();
  }

  function editWatch(watch){
    if(!watch?.id||!watch?.query||!['officer','site_admin'].includes(viewerAccess)||!watchEditor)return;
    populateWatchEditor(watch.query,{
      id:watch.id,
      name:watch.name||'',
      publishDiscord:watch.discord?.publish!==false,
      editing:true,
    });
    showWatchEditor();
  }

  function closeWatchEditor(){
    if(!watchEditor)return;
    watchEditor.hidden=true;
    document.body.classList.remove('project-editor-open');
    if(watchStatus)watchStatus.textContent='';
    if(watchId)watchId.value='';
  }

  async function saveWatch(event){
    event.preventDefault();
    if(!['officer','site_admin'].includes(viewerAccess))return;
    if(!watchName.value.trim()){
      watchStatus.textContent='Enter a watch name.';
      watchName.focus();
      return;
    }
    if(!validateWatchCommodity())return;
    if(!watchSystem.value.trim()){
      watchStatus.textContent='Enter a reference system.';
      watchSystem.focus();
      return;
    }

    const editingId=watchId.value.trim();
    const query=watchQueryFromEditor();
    const button=watchSubmit||watchForm?.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    watchStatus.textContent=editingId?'Updating watch…':'Saving watch…';

    try{
      const response=await fetch('/api/trade-watches',{
        method:editingId?'PUT':'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'trade-watch-editor'},
        body:JSON.stringify({
          ...(editingId?{id:editingId,action:'edit'}:{}),
          name:watchName.value.trim(),
          query,
          publishDiscord:watchDiscord.value==='true',
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to save watch.');
      watchStatus.textContent=editingId?'Updated.':'Saved.';
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
    price.value=Number(query.price)>0?formattedInteger(query.price):'';
    volume.value=formattedInteger(query.minVolume??1)||'1';
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
    const rareSourceBuy=buying&&Boolean(q.rareSourceSearch);
    const priceOf=item=>buying
      ?Number(rareSourceBuy?(item.allocationBuyPrice||item.buyPrice||0):(item.buyPrice||0))
      :Number(item.sellPrice||0);
    const volumeOf=item=>buying
      ?Number(rareSourceBuy?(item.allocationSupply||item.supply||0):(item.supply||0))
      :Number(item.demand||0);
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
      const hasVisibleRareSource=Array.isArray(payload.results)&&payload.results.some(item=>item?.qualifies===false);
      status.textContent=hasVisibleRareSource
        ?'Known rare source shown — the current observation does not meet the selected stock/price filters.'
        :payload.warning
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
  commodity.addEventListener('input',()=>{
    renderCommodityMenu();
    updateRadiusMode();
  });
  commodity.addEventListener('change',updateRadiusMode);
  commodity.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();moveCommoditySelection(1);}
    else if(event.key==='ArrowUp'){event.preventDefault();moveCommoditySelection(-1);}
    else if(event.key==='Enter'&&commodityMenuOpen&&commodityActiveIndex>=0){
      event.preventDefault();
      const option=commodityMenu.querySelectorAll('.trade-commodity-option')[commodityActiveIndex];
      if(option)chooseCommodity(option.dataset.commodityLabel||option.textContent);
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
  [price,volume,watchPrice,watchVolume].forEach(bindFormattedInteger);
  saveWatchButton?.addEventListener('click',openWatchEditor);
  watchForm?.addEventListener('submit',saveWatch);
  watchDirection?.addEventListener('change',updateWatchLabels);
  watchCommodity?.addEventListener('input',updateWatchLabels);
  watchCommodity?.addEventListener('change',updateWatchLabels);
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

  window.MongrelTradeMarket={activate,loadQuery,editWatch};
})();
