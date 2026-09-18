(() => {
  const section=document.querySelector('[data-daily-orders]');
  const list=section?.querySelector('[data-orders-list]');
  if(!section||!list)return;

  const WEIGHTS={low:1,medium:1.3,high:1.6};
  const REPORT_TYPES=new Set(['cz','inf','bounties','trade','exploration']);
  const CREDIT_TYPES=new Set(['bounties','trade','exploration']);
  let refreshTimer=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const fmt=value=>Number.isInteger(n(value))?String(n(value)):n(value).toFixed(1);
  const active=order=>!['complete','completed','closed','cancelled','canceled','inactive'].includes(String(order?.status||'').toLowerCase());

  function spec(order){
    const explicit=order?.reporting||{};
    let type=REPORT_TYPES.has(explicit.type)?explicit.type:'';
    const text=[order?.task,order?.detail].filter(Boolean).join(' ');
    if(!type&&/\b(?:CZ|Conflict Zones?)\b/i.test(text))type='cz';
    if(!type&&/\bINF\b/i.test(text))type='inf';
    if(!type&&/\bbount(?:y|ies)\b[^.]{0,80}\bvouchers?\b|\bbounty vouchers?\b/i.test(text))type='bounties';
    if(!type&&/\bexploration data\b/i.test(text))type='exploration';
    if(!type&&/\bprofitable trade\b|\btrade profit\b/i.test(text))type='trade';
    let target=Number.isFinite(Number(explicit.target))?Number(explicit.target):null;
    if(target===null&&type==='cz'){const m=text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:CZ\s*)?(?:points?|pts?)\b/i);if(m)target=Number(m[1]);}
    if(target===null&&type==='inf'){const m=text.match(/([0-9]+(?:\.[0-9]+)?)\s*INF\b/i);if(m)target=Number(m[1]);}
    if(target===null&&CREDIT_TYPES.has(type)){const m=text.match(/([0-9]+(?:\.[0-9]+)?)\s*M\s*Cr\b/i);if(m)target=Number(m[1]);}
    return{type,target,blitz:Boolean(explicit.blitz||/\bBLITZ\b/i.test(text))};
  }

  async function load(){
    try{
      const [ordersRes,reportsRes]=await Promise.all([
        fetch('/api/operations/orders?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
        fetch('/api/operations/order-reports?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
      ]);
      if(!ordersRes.ok||!reportsRes.ok)return;
      render(await ordersRes.json(),await reportsRes.json());
    }catch(error){console.error('Mission Control structured order view failed',error);}
  }

  function render(payload,reportPayload){
    const openSystems=new Set([...list.querySelectorAll('.mc-system-order-card[open]')].map(card=>card.dataset.system));
    const orders=(Array.isArray(payload.orders)?payload.orders:[]).filter(active);
    if(!orders.length)return;
    const groups=new Map();
    for(const order of orders){
      const key=order.system||'Squad-wide';
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(order);
    }
    list.classList.add('mc-orders-v2');
    list.replaceChildren();
    let index=0;
    for(const [system,items] of groups){
      index+=1;
      const card=document.createElement('details');
      card.className='mc-system-order-card';
      card.dataset.system=system;
      card.open=openSystems.has(system);
      const priorities=items.map(x=>x.priority).filter(Boolean);
      const priority=priorities[0]||'Active';
      const reportable=items.filter(x=>spec(x).type);
      const progress=collapsedProgress(reportable,reportPayload.summaries||{});
      card.innerHTML='<summary><span class="mc-order-index">'+String(index).padStart(2,'0')+'</span><span class="mc-system-summary"><strong>'+esc(system)+'</strong><small>'+esc(items[0]?.task||'Operational task')+'</small></span><span class="mc-system-tags"><b>'+esc(priority)+'</b>'+(items.length>1?'<b>'+items.length+' orders</b>':'')+'</span><span class="mc-system-progress">'+progress+'</span><span class="mc-expand-mark" aria-hidden="true">+</span></summary><div class="mc-system-order-body"><div class="mc-briefing-column"></div><aside class="mc-report-column"></aside></div>';
      const brief=card.querySelector('.mc-briefing-column'),reports=card.querySelector('.mc-report-column');
      if(system!=='Squad-wide')brief.append(copySystem(system));
      items.forEach((order,i)=>brief.append(orderBrief(order,i)));
      if(reportable.length){
        reportable.forEach(order=>reports.append(reportBlock(order,reportPayload.summaries?.[order.id])));
      }else{
        reports.innerHTML='<div class="mc-no-report"><span>REPORTING</span><strong>No structured report requested</strong><p>Execute the briefing as written. A report block appears here when the order has a measurable squad target.</p></div>';
      }
      list.append(card);
    }
  }

  function collapsedProgress(orders,summaries){
    if(!orders.length)return '<small>Briefing only</small>';
    if(orders.length>1)return '<small>'+orders.length+' tracked tasks</small>';
    const order=orders[0],s=spec(order),sum=summaries[order.id],score=sum?.squad?.score||0;
    if(s.target===null)return '<strong>'+fmt(score)+'</strong><small>'+label(s.type)+' reported</small>';
    const met=score>=s.target;
    return '<strong>'+fmt(score)+' / '+fmt(s.target)+'</strong><small>'+(s.blitz?'BLITZ · keep pushing':met?'Target met':label(s.type)+' squad progress')+'</small>';
  }

  function copySystem(system){
    const row=document.createElement('div');row.className='mc-system-copy-row';
    row.innerHTML='<span>System</span><strong>'+esc(system)+'</strong><button type="button" title="Copy system name">⧉</button><small aria-live="polite"></small>';
    row.querySelector('button').addEventListener('click',async e=>{e.preventDefault();const out=row.querySelector('small');try{await navigator.clipboard.writeText(system);out.textContent='Copied';}catch{out.textContent='Copy failed';}setTimeout(()=>out.textContent='',1200);});
    return row;
  }

  function orderBrief(order,index){
    const el=document.createElement('article');el.className='mc-order-brief';
    el.innerHTML='<div class="mc-order-brief-top"><span>ORDER '+(index+1)+'</span>'+(order.priority?'<b>'+esc(order.priority)+'</b>':'')+(order.status?'<b>'+esc(order.status)+'</b>':'')+'</div><h3>'+esc(order.task||'Operational task')+'</h3>'+(order.detail?'<p>'+esc(order.detail)+'</p>':'');
    return el;
  }

  function reportBlock(order,summary){
    const s=spec(order),squad=summary?.squad||{},viewer=summary?.viewer||{},score=n(squad.score),mine=n(viewer.score),target=s.target;
    const host=document.createElement('section');host.className='mc-report-block';host.dataset.orderId=order.id;
    if(s.blitz)host.classList.add('is-blitz');
    const progress=target&&target>0?Math.max(0,Math.min(100,(score/target)*100)):0;
    const status=s.blitz?'OPEN · CONTINUE PUSHING':target!==null&&score>=target?'TARGET MET':target!==null?fmt(Math.max(0,target-score))+' remaining':'Reporting open';
    host.innerHTML='<div class="mc-report-head"><div><span>SQUAD PROGRESS</span><strong>'+fmt(score)+(target!==null?' / '+fmt(target):'')+' '+label(s.type)+'</strong></div><b>'+status+'</b></div>'+(target!==null?'<div class="mc-progress-track"><i style="width:'+progress+'%"></i></div>':'')+'<div class="mc-progress-meta"><span>You: <b>'+fmt(mine)+' '+label(s.type)+'</b></span><span>'+n(squad.reporterCount)+' CMDR'+(n(squad.reporterCount)===1?'':'s')+' reporting · '+n(squad.reportCount)+' reports</span></div><div class="mc-report-form"></div><div class="mc-report-status" aria-live="polite"></div>';
    const form=host.querySelector('.mc-report-form');
    if(s.type==='cz')form.append(czForm(order));
    else if(s.type==='inf')form.append(infForm(order));
    else if(CREDIT_TYPES.has(s.type))form.append(creditForm(order,s.type));
    return host;
  }

  function label(type){
    if(type==='cz')return'CZ pts';
    if(type==='inf')return'INF';
    if(type==='bounties')return'M Cr bounties';
    if(type==='trade')return'M Cr profit';
    if(type==='exploration')return'M Cr exploration';
    return'units';
  }

  function counter(name,labelText){
    const el=document.createElement('div');el.className='mc-counter';el.dataset.counter=name;
    el.innerHTML='<span>'+esc(labelText)+'</span><div><button type="button" data-delta="-1" aria-label="Subtract one '+esc(labelText)+'">−</button><b data-count>0</b><button type="button" data-delta="1" aria-label="Add one '+esc(labelText)+'">+</button></div>';
    el.addEventListener('click',e=>{const b=e.target.closest('[data-delta]');if(!b)return;const v=el.querySelector('[data-count]');v.textContent=String(Math.max(0,n(v.textContent)+n(b.dataset.delta)));updateDraft(el.closest('.mc-report-form'));});
    return el;
  }

  function czForm(order){
    const wrap=document.createElement('div');wrap.className='mc-cz-form';
    wrap.innerHTML='<div class="mc-report-mode"><button type="button" data-mode="solo" class="is-active">Solo</button><button type="button" data-mode="wing">Wing</button></div><div class="mc-form-label"><strong>CZ victories</strong><small>One shared wing instance = one result.</small></div><div class="mc-counters mc-cz-wins"></div><details class="mc-failures"><summary>Losses / disconnects <span data-failure-total>0</span></summary><div class="mc-failure-grid"><div><strong>Lost / abandoned</strong><div data-loss></div></div><div><strong>Full-instance disconnect</strong><div data-disconnect></div></div></div><small>If one wingmate drops but another Mongrel remains and wins, report the CZ as a win — not a failure.</small></details><button type="button" class="mc-bonds" aria-pressed="false">Combat Bonds not redeemed</button><div class="mc-draft-score">This report: <strong data-draft>0.0 net CZ pts</strong></div><button type="button" class="btn btn-primary mc-submit-report">Submit Report</button>';
    const wins=wrap.querySelector('.mc-cz-wins'),loss=wrap.querySelector('[data-loss]'),disc=wrap.querySelector('[data-disconnect]');
    [['low','Low'],['medium','Medium'],['high','High']].forEach(([k,l])=>wins.append(counter(k,l)));
    [['lossLow','Low'],['lossMedium','Medium'],['lossHigh','High']].forEach(([k,l])=>loss.append(counter(k,l)));
    [['disconnectLow','Low'],['disconnectMedium','Medium'],['disconnectHigh','High']].forEach(([k,l])=>disc.append(counter(k,l)));
    wrap.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{wrap.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('is-active',x===btn));}));
    const bonds=wrap.querySelector('.mc-bonds');bonds.addEventListener('click',()=>{const on=bonds.getAttribute('aria-pressed')!=='true';bonds.setAttribute('aria-pressed',String(on));bonds.textContent=on?'✓ Combat Bonds redeemed':'Combat Bonds not redeemed';});
    wrap.querySelector('.mc-submit-report').addEventListener('click',()=>submit(order,wrap,'cz'));
    return wrap;
  }

  function infForm(order){
    const wrap=document.createElement('div');wrap.className='mc-inf-form';
    wrap.innerHTML='<div class="mc-form-label"><strong>Mission INF</strong><small>Tap the reward once as you turn it in. Use − to correct before submitting.</small></div><div class="mc-inf-rewards"></div><div class="mc-draft-score">This report: <strong data-draft>0 INF</strong></div><button type="button" class="btn btn-primary mc-submit-report">Submit Report</button>';
    const rewards=wrap.querySelector('.mc-inf-rewards');
    [['inf2','+2'],['inf3','+3'],['inf4','+4'],['inf5','+5']].forEach(([k,l])=>rewards.append(counter(k,l)));
    wrap.querySelector('.mc-submit-report').addEventListener('click',()=>submit(order,wrap,'inf'));
    return wrap;
  }

  function creditForm(order,type){
    const copy={
      bounties:{title:'Bounty vouchers',note:'Report voucher value actually redeemed for the ordered faction.'},
      trade:{title:'Profitable trade',note:'Report qualifying trade profit, not gross cargo sale value.'},
      exploration:{title:'Exploration data',note:'Report the Universal Cartographics sale value delivered to the ordered faction.'},
    }[type];
    const wrap=document.createElement('div');wrap.className='mc-credit-form';wrap.dataset.reportType=type;
    wrap.innerHTML='<div class="mc-form-label"><strong>'+esc(copy.title)+'</strong><small>'+esc(copy.note)+'</small></div><label class="mc-credit-entry"><span>Amount this report</span><div><input type="number" min="0" max="100000" step="0.1" value="0" inputmode="decimal" data-credit-amount><b>M Cr</b></div></label><div class="mc-credit-quick"><button type="button" data-credit-delta="-5">−5M</button><button type="button" data-credit-delta="-1">−1M</button><button type="button" data-credit-delta="1">+1M</button><button type="button" data-credit-delta="5">+5M</button><button type="button" data-credit-delta="10">+10M</button></div><div class="mc-draft-score">This report: <strong data-draft>0 M Cr</strong></div><button type="button" class="btn btn-primary mc-submit-report">Submit Report</button>';
    const input=wrap.querySelector('[data-credit-amount]');
    input.addEventListener('input',()=>updateDraft(wrap.closest('.mc-report-form')));
    wrap.querySelector('.mc-credit-quick').addEventListener('click',e=>{const btn=e.target.closest('[data-credit-delta]');if(!btn)return;input.value=String(Math.max(0,Math.round((n(input.value)+n(btn.dataset.creditDelta))*10)/10));updateDraft(wrap.closest('.mc-report-form'));});
    wrap.querySelector('.mc-submit-report').addEventListener('click',()=>submit(order,wrap,type));
    return wrap;
  }

  function collect(form,type){
    const value=name=>n(form.querySelector('[data-counter="'+name+'"] [data-count]')?.textContent);
    if(type==='inf')return{inf:{inf2:value('inf2'),inf3:value('inf3'),inf4:value('inf4'),inf5:value('inf5')}};
    if(CREDIT_TYPES.has(type))return{millions:Math.max(0,n(form.querySelector('[data-credit-amount]')?.value))};
    return{mode:form.querySelector('[data-mode].is-active')?.dataset.mode||'solo',bondsRedeemed:form.querySelector('.mc-bonds')?.getAttribute('aria-pressed')==='true',cz:{low:value('low'),medium:value('medium'),high:value('high'),lossLow:value('lossLow'),lossMedium:value('lossMedium'),lossHigh:value('lossHigh'),disconnectLow:value('disconnectLow'),disconnectMedium:value('disconnectMedium'),disconnectHigh:value('disconnectHigh')}};
  }

  function updateDraft(form){
    if(!form)return;const draft=form.querySelector('[data-draft]');if(!draft)return;
    const failureBadge=form.querySelector('[data-failure-total]');
    if(form.classList.contains('mc-inf-form')){
      const x=collect(form,'inf').inf;draft.textContent=(x.inf2*2+x.inf3*3+x.inf4*4+x.inf5*5)+' INF';return;
    }
    if(form.classList.contains('mc-credit-form')){
      const type=form.dataset.reportType, amount=collect(form,type).millions;
      draft.textContent=fmt(amount)+' M Cr';return;
    }
    const c=collect(form,'cz').cz;
    const score=(c.low-c.lossLow-c.disconnectLow)*WEIGHTS.low+(c.medium-c.lossMedium-c.disconnectMedium)*WEIGHTS.medium+(c.high-c.lossHigh-c.disconnectHigh)*WEIGHTS.high;
    draft.textContent=(Math.round(score*10)/10).toFixed(1)+' net CZ pts';
    if(failureBadge)failureBadge.textContent=String(c.lossLow+c.lossMedium+c.lossHigh+c.disconnectLow+c.disconnectMedium+c.disconnectHigh);
  }

  async function submit(order,form,type){
    const block=form.closest('.mc-report-block'),status=block.querySelector('.mc-report-status'),button=form.querySelector('.mc-submit-report');
    button.disabled=true;status.textContent='Submitting report…';status.dataset.state='working';
    try{
      const body={orderId:order.id,...collect(form,type)};
      const response=await fetch('/api/operations/order-reports',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'daily-order-report'},body:JSON.stringify(body)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'report_failed');
      status.textContent='Report added to squad progress.';status.dataset.state='success';
      setTimeout(load,250);
    }catch(error){console.error(error);status.textContent=error.message==='empty_report'?'Add a result before submitting.':'Could not submit report. Please try again.';status.dataset.state='error';button.disabled=false;}
  }

  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(load,80);}
  window.addEventListener('mongrels:orders-loaded',event=>{if(event.detail?.authenticated)schedule();});
  if(!list.children.length)schedule();
})();