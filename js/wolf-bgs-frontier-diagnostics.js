(() => {
  const panel=document.querySelector('[data-frontier-diagnostics]');
  if(!panel)return;

  const parent=panel.closest('[data-verification-review]');
  const memberSelect=panel.querySelector('[data-frontier-diagnostics-member]');
  const typeSelect=panel.querySelector('[data-frontier-diagnostics-type]');
  const systemInput=panel.querySelector('[data-frontier-diagnostics-system]');
  const refresh=panel.querySelector('[data-frontier-diagnostics-refresh]');
  const summary=panel.querySelector('[data-frontier-diagnostics-member-summary]');
  const status=panel.querySelector('[data-frontier-diagnostics-status]');
  const list=panel.querySelector('[data-frontier-diagnostics-list]');
  const STORAGE_KEY='mongrels-frontier-diagnostics-member';

  let members=[];
  let selected=null;
  let events=[];
  let loading=false;
  let initialized=false;

  const dateTime=value=>{
    if(!value)return'—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleString();
  };
  const credits=value=>Math.round(Number(value)||0).toLocaleString()+' Cr';
  const millions=value=>{
    const n=Number(value)||0;
    return (Math.round((n/1_000_000)*100)/100).toLocaleString()+'M Cr';
  };
  const count=value=>Math.round(Number(value)||0).toLocaleString();

  function reasonLabel(value){
    return ({
      eligible:'Eligible',
      not_profitable:'Not profitable',
      mined_or_zero_cost:'Mined / zero-cost cargo',
      purchase_provenance_unverified:'Purchase provenance not verified',
      carrier_market_source:'Cargo bought from fleet carrier',
      mined_source:'Mined cargo',
      mixed_or_nonstation_source:'Mixed / non-station cargo source',
      nonstandard_market:'Black market / stolen goods',
    })[String(value||'')]||String(value||'Unknown');
  }

  function typeLabel(value){
    return ({
      market_sell:'Trade sale',
      mission_inf:'Mission INF',
      bounties_redeemed:'Bounty vouchers',
      combat_bonds_redeemed:'Combat bonds',
      cz_bond_awarded:'CZ bond award',
      exploration_sale:'Exploration sale',
      colonization_contribution:'Colonization contribution',
      colonization_depot:'Colonization depot',
      colonization_system_claim:'Colonization claim',
      colonization_system_claim_release:'Colonization claim release',
    })[String(value||'')]||String(value||'event').replaceAll('_',' ');
  }

  function setStatus(message,error=false){
    if(!status)return;
    status.textContent=message;
    status.classList.toggle('error',Boolean(error));
  }

  async function request(ownerId=''){
    const params=new URLSearchParams({_ : String(Date.now())});
    if(ownerId)params.set('ownerId',ownerId);
    const response=await fetch('/api/frontier/admin-events?'+params.toString(),{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json'},
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Frontier diagnostics request failed ('+response.status+')');
    return payload;
  }

  function populateMembers(){
    const current=memberSelect.value||sessionStorage.getItem(STORAGE_KEY)||'';
    memberSelect.innerHTML='<option value="">Select a connected CMDR…</option>';
    for(const member of members){
      const option=document.createElement('option');
      option.value=member.ownerId;
      option.textContent=member.commander+(member.lastSyncAt?' · synced '+dateTime(member.lastSyncAt):' · never synced');
      memberSelect.append(option);
    }
    if(current&&members.some(member=>member.ownerId===current))memberSelect.value=current;
  }

  function fillSummary(){
    if(!summary)return;
    summary.hidden=!selected;
    const set=(selector,value)=>{
      const target=summary.querySelector(selector);
      if(target)target.textContent=value;
    };
    if(!selected)return;
    set('[data-frontier-last-sync]',dateTime(selected.lastSyncAt));
    set('[data-frontier-last-event]',dateTime(selected.lastJournalEventAt));
    set('[data-frontier-last-system]',selected.lastSystem||'—');
    set('[data-frontier-event-count]',count(selected.storedEventCount));
  }

  function matchBadge(event){
    const matches=Array.isArray(event.orderMatches)?event.orderMatches:[];
    if(matches.length){
      const text=matches.map(match=>{
        const amount=Number(match.contribution)||0;
        return (match.task||'Daily Order')+(amount?' · '+amount.toLocaleString()+' '+(match.unit||''):'');
      }).join(' | ');
      return '<div class="wolf-frontier-order-match is-matched"><strong>DAILY ORDER MATCH</strong><span>'+escapeHtml(text)+'</span></div>';
    }
    if(Number(event.ambiguousCount)>0){
      return '<div class="wolf-frontier-order-match is-ambiguous"><strong>AMBIGUOUS ORDER MATCH</strong><span>'+Number(event.ambiguousCount)+' possible match component(s)</span></div>';
    }
    return '<div class="wolf-frontier-order-match is-unmatched"><strong>NO DAILY ORDER MATCH</strong><span>Stored evidence exists, but it did not attach to an active matching order.</span></div>';
  }

  function tradeCard(event){
    const eligible=event.bgsTradeEligible===true;
    const profitKnown=event.profitKnown===true&&Number.isFinite(Number(event.profit));
    const title=(event.commodity||'Commodity')+' · '+count(event.count)+' t';
    const source=String(event.tradeSource||'unknown').replaceAll('_',' ');
    return '<article class="wolf-frontier-event is-trade">'+
      '<div class="wolf-frontier-event-head"><div><span>'+escapeHtml(typeLabel(event.type))+'</span><strong>'+escapeHtml(title)+'</strong></div>'+
      '<b class="wolf-frontier-eligibility '+(eligible?'is-eligible':'is-ineligible')+'">'+(eligible?'BGS TRADE ELIGIBLE':'INELIGIBLE')+'</b></div>'+
      eventContext(event)+
      '<div class="wolf-frontier-trade-grid">'+
        metric('Sale',credits(event.total))+
        metric('Profit',profitKnown?credits(event.profit):'Unknown')+
        metric('Avg Buy',event.avgPricePaid!==null?credits(event.avgPricePaid):'Unknown')+
        metric('Sell / t',credits(event.sellPrice))+
        metric('Cargo Source',source)+
        metric('Eligibility',reasonLabel(event.tradeEligibilityReason))+
      '</div>'+
      matchBadge(event)+
    '</article>';
  }

  function genericCard(event){
    const details=[];
    if(event.type==='mission_inf'){
      const total=(event.effects||[]).reduce((sum,row)=>sum+(Number(row.infUnits)||0),0);
      details.push(metric('INF',count(total)));
      if(event.sourceFaction)details.push(metric('Mission Faction',event.sourceFaction));
    }else if(['bounties_redeemed','combat_bonds_redeemed','cz_bond_awarded','exploration_sale'].includes(event.type)){
      details.push(metric('Amount',credits(event.amount)));
    }else if(event.type==='colonization_contribution'){
      details.push(metric('Delivered',count(event.totalTons)+' t'));
      const cargo=(event.contributions||[]).map(row=>(row.commodity||'Commodity')+' '+count(row.amount)+' t').join(' · ');
      if(cargo)details.push(metric('Cargo',cargo));
    }

    return '<article class="wolf-frontier-event">'+
      '<div class="wolf-frontier-event-head"><div><span>Stored Frontier Event</span><strong>'+escapeHtml(typeLabel(event.type))+'</strong></div>'+
      '<b class="wolf-frontier-event-type">'+escapeHtml(event.sourceEvent||event.type||'EVENT')+'</b></div>'+
      eventContext(event)+
      (details.length?'<div class="wolf-frontier-trade-grid">'+details.join('')+'</div>':'')+
      matchBadge(event)+
    '</article>';
  }

  function eventContext(event){
    return '<div class="wolf-frontier-event-context">'+
      '<span>'+escapeHtml(dateTime(event.timestamp))+'</span>'+
      (event.system?'<strong>'+escapeHtml(event.system)+'</strong>':'')+
      (event.station?'<span>'+escapeHtml(event.station)+'</span>':'')+
      (event.stationFaction?'<span>'+escapeHtml(event.stationFaction)+'</span>':'')+
    '</div>';
  }

  function metric(label,value){
    return '<div><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>';
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function filteredEvents(){
    const type=typeSelect?.value||'all';
    const system=String(systemInput?.value||'').trim().toLowerCase();
    return events.filter(event=>{
      if(type!=='all'&&event.type!==type)return false;
      if(system&&!String(event.system||'').toLowerCase().includes(system))return false;
      return true;
    });
  }

  function render(){
    fillSummary();
    if(!selected){
      list.innerHTML='';
      setStatus('Select a CMDR to inspect stored Frontier events.');
      return;
    }
    const rows=filteredEvents();
    setStatus(
      rows.length
        ?rows.length.toLocaleString()+' event'+(rows.length===1?'':'s')+' shown · '+events.length.toLocaleString()+' recent stored event'+(events.length===1?'':'s')+' loaded'
        :'No stored events match the selected filters.'
    );
    if(!rows.length){
      list.innerHTML='<div class="wolf-scout-empty"><strong>No matching stored activity.</strong><small>Try All stored activity or clear the system filter.</small></div>';
      return;
    }
    list.innerHTML=rows.map(event=>event.type==='market_sell'?tradeCard(event):genericCard(event)).join('');
  }

  async function loadMembers(force=false){
    if(loading)return;
    if(initialized&&!force)return;
    loading=true;
    if(refresh)refresh.disabled=true;
    setStatus('Loading connected CMDRs…');
    let remembered='';
    try{
      const data=await request();
      members=Array.isArray(data.members)?data.members:[];
      populateMembers();
      initialized=true;
      remembered=memberSelect.value;
      if(!remembered){
        selected=null;
        events=[];
        render();
      }
    }catch(error){
      console.error('Could not load Frontier diagnostics members',error);
      setStatus('Frontier diagnostics unavailable · '+String(error.message||error),true);
    }finally{
      loading=false;
      if(refresh)refresh.disabled=false;
    }
    if(remembered)loadMember(remembered);
  }

  async function loadMember(ownerId){
    if(!ownerId){
      selected=null;
      events=[];
      sessionStorage.removeItem(STORAGE_KEY);
      render();
      return;
    }
    if(loading)return;
    loading=true;
    if(refresh)refresh.disabled=true;
    setStatus('Loading stored Frontier activity…');
    try{
      const data=await request(ownerId);
      members=Array.isArray(data.members)?data.members:members;
      selected=data.selected||null;
      events=Array.isArray(data.events)?data.events:[];
      sessionStorage.setItem(STORAGE_KEY,ownerId);
      populateMembers();
      memberSelect.value=ownerId;
      render();
    }catch(error){
      console.error('Could not load member Frontier diagnostics',error);
      setStatus('Could not load stored activity · '+String(error.message||error),true);
    }finally{
      loading=false;
      if(refresh)refresh.disabled=false;
    }
  }

  memberSelect?.addEventListener('change',()=>loadMember(memberSelect.value));
  typeSelect?.addEventListener('change',render);
  systemInput?.addEventListener('input',render);
  refresh?.addEventListener('click',()=>{
    const ownerId=memberSelect?.value||'';
    initialized=false;
    if(ownerId){
      loading=false;
      loadMember(ownerId);
    }else loadMembers(true);
  });

  const begin=()=>{
    if(parent&&!parent.open)return;
    loadMembers();
  };
  parent?.addEventListener('toggle',begin,{passive:true});
  if(parent?.open)begin();
})();
