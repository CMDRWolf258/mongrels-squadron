(() => {
  const gate=document.querySelector('[data-reward-account-gate]');
  const privateView=document.querySelector('[data-reward-account-private]');
  const gateStatus=document.querySelector('[data-reward-gate-status]');
  const login=document.querySelector('[data-reward-login]');
  const viewer=document.querySelector('[data-reward-account-viewer]');
  const refresh=document.querySelector('[data-refresh-reward-account]');
  const owedEl=document.querySelector('[data-reward-account-owed]');
  const outstandingEl=document.querySelector('[data-reward-account-outstanding]');
  const paidEl=document.querySelector('[data-reward-account-paid]');
  const requestStateEl=document.querySelector('[data-reward-account-request-state]');
  const requestMetaEl=document.querySelector('[data-reward-account-request-meta]');
  const requestPanel=document.querySelector('[data-reward-request-panel]');
  const requestTitle=document.querySelector('[data-reward-request-title]');
  const requestCopy=document.querySelector('[data-reward-request-copy]');
  const requestDetail=document.querySelector('[data-reward-request-detail]');
  const requestButton=document.querySelector('[data-request-reward-payout]');
  const cancelButton=document.querySelector('[data-cancel-reward-payout]');
  const requestStatus=document.querySelector('[data-reward-request-status]');
  const outstandingList=document.querySelector('[data-reward-outstanding-list]');
  const paidList=document.querySelector('[data-reward-paid-list]');

  let account=null;
  let loading=false;
  const fmt=value=>Math.round(Number(value)||0).toLocaleString()+' Cr';
  const dateTime=value=>{
    if(!value)return'—';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?String(value):date.toLocaleString();
  };
  const source=entry=>{
    if(entry?.kind==='colonization_job'||entry?.rewardType==='colonization')return{key:'colonization',label:'COLONIZATION'};
    if(entry?.kind==='scouting_job'||entry?.rewardType==='scouting')return{key:'scouting',label:'SCOUTING'};
    if(entry?.kind==='verified_order')return{key:'bgs',label:'BGS'};
    if(entry?.kind==='manual_adjustment')return{key:'adjustment',label:'ADJUSTMENT'};
    if(entry?.kind==='special_job')return{key:'special',label:'SPECIAL'};
    return{key:'reward',label:'REWARD'};
  };
  const setAccess=ok=>{
    if(gate)gate.hidden=ok;
    if(privateView)privateView.hidden=!ok;
  };
  if(login)login.href='/api/auth/login?return='+encodeURIComponent('/rewards/');

  function entryDetail(entry){
    const parts=[source(entry).label];
    if(Number(entry?.verifiedContribution)>0)parts.push(Number(entry.verifiedContribution).toLocaleString()+' '+String(entry.verifiedUnit||''));
    if(entry?.createdAt)parts.push('approved '+dateTime(entry.createdAt));
    return parts.join(' · ');
  }

  function renderOutstanding(entries){
    if(!outstandingList)return;
    outstandingList.replaceChildren();
    const owed=entries.filter(entry=>entry?.status==='owed');
    if(!owed.length){
      const empty=document.createElement('div');empty.className='reward-empty';
      const strong=document.createElement('strong');strong.textContent='No outstanding rewards.';
      const small=document.createElement('small');small.textContent='New approved rewards from BGS, Colonization, scouting, and other programs will appear here.';
      empty.append(strong,small);outstandingList.append(empty);return;
    }
    const groups=new Map();
    owed.forEach(entry=>{
      const meta=source(entry);
      const group=groups.get(meta.key)||{...meta,entries:[]};
      group.entries.push(entry);groups.set(meta.key,group);
    });
    [...groups.values()].forEach(group=>{
      const section=document.createElement('section');section.className='reward-source-group';
      const head=document.createElement('div');head.className='reward-source-head';
      const main=document.createElement('div');
      const title=document.createElement('strong');title.textContent=group.label;
      const count=document.createElement('small');count.textContent=group.entries.length+' outstanding reward'+(group.entries.length===1?'':'s');
      main.append(title,count);
      const total=document.createElement('b');total.textContent=fmt(group.entries.reduce((sum,e)=>sum+(Number(e.amountCredits)||0),0));
      head.append(main,total);
      const list=document.createElement('div');list.className='reward-entry-list';
      group.entries.forEach(entry=>{
        const row=document.createElement('article');row.className='reward-entry';
        const info=document.createElement('div');info.className='reward-entry-main';
        const reason=document.createElement('strong');reason.textContent=entry.reason||'Approved reward';
        const detail=document.createElement('small');detail.textContent=entryDetail(entry);
        info.append(reason,detail);
        const amount=document.createElement('div');amount.className='reward-entry-amount';amount.textContent=fmt(entry.amountCredits);
        row.append(info,amount);list.append(row);
      });
      section.append(head,list);outstandingList.append(section);
    });
  }

  function renderPaid(entries){
    if(!paidList)return;
    paidList.replaceChildren();
    const paid=entries.filter(entry=>entry?.status==='paid');
    if(!paid.length){
      const empty=document.createElement('div');empty.className='reward-empty';
      const strong=document.createElement('strong');strong.textContent='No paid reward history yet.';
      const small=document.createElement('small');small.textContent='Completed payouts will remain here after leadership confirms the in-game transfer.';
      empty.append(strong,small);paidList.append(empty);return;
    }
    const groups=new Map();
    paid.forEach(entry=>{
      const key=entry.paymentBatchId||('legacy-'+String(entry.paidAt||entry.id||'paid'));
      const group=groups.get(key)||{key,entries:[],paidAt:entry.paidAt||null,paidBy:entry.paidBy||''};
      group.entries.push(entry);
      if(entry.paidAt&&(!group.paidAt||entry.paidAt>group.paidAt))group.paidAt=entry.paidAt;
      groups.set(key,group);
    });
    [...groups.values()]
      .sort((a,b)=>String(b.paidAt||'').localeCompare(String(a.paidAt||'')))
      .forEach((group,index)=>{
        const details=document.createElement('details');details.className='reward-history-batch';if(index===0)details.open=true;
        const summary=document.createElement('summary');
        const main=document.createElement('div');
        const title=document.createElement('strong');title.textContent='Payout · '+dateTime(group.paidAt);
        const meta=document.createElement('small');meta.textContent=group.entries.length+' reward entr'+(group.entries.length===1?'y':'ies')+(group.paidBy?' · recorded by '+group.paidBy:'');
        main.append(title,meta);
        const total=document.createElement('b');total.textContent=fmt(group.entries.reduce((sum,e)=>sum+(Number(e.amountCredits)||0),0));
        summary.append(main,total);
        const items=document.createElement('div');items.className='reward-history-items';
        group.entries.forEach(entry=>{
          const row=document.createElement('div');row.className='reward-paid-entry';
          const info=document.createElement('span');
          const reason=document.createElement('strong');reason.textContent=entry.reason||'Reward payment';
          const detail=document.createElement('small');detail.textContent=entryDetail(entry);
          info.append(reason,detail);
          const amount=document.createElement('b');amount.textContent=fmt(entry.amountCredits);
          row.append(info,amount);items.append(row);
        });
        details.append(summary,items);paidList.append(details);
      });
  }

  function renderRequest(request,summary){
    const owed=Number(summary?.owedCredits)||0;
    const active=Boolean(request?.active);
    requestPanel?.classList.toggle('is-requested',active);
    if(requestStateEl)requestStateEl.textContent=active?'REQUESTED':owed>0?'AVAILABLE':'CLEAR';
    if(requestMetaEl){
      requestMetaEl.textContent=active
        ? fmt(request.requestedRemainingCredits||request.requestedCredits)+' requested · '+dateTime(request.requestedAt)
        : owed>0?'Ready to request when you want to collect':'No outstanding balance';
    }
    if(requestTitle)requestTitle.textContent=active?'Payout requested':'Ready when you are';
    if(requestCopy){
      requestCopy.textContent=active
        ? 'Leadership can see that you are ready to collect. Your balance remains owed until the in-game transfer is completed and recorded.'
        : 'Your balance is already owed once it appears here. Requesting payout simply tells leadership that you are ready to collect.';
    }
    if(requestDetail){
      requestDetail.replaceChildren();
      const values=[];
      if(active)values.push('Requested '+fmt(request.requestedCredits),String(request.requestedEntryCount||0)+' reward entries');
      if(active&&Number(request.newSinceRequestCredits)>0)values.push(fmt(request.newSinceRequestCredits)+' earned since request');
      values.forEach(value=>{const chip=document.createElement('span');chip.textContent=value;requestDetail.append(chip);});
      requestDetail.hidden=!values.length;
    }
    if(requestButton){
      requestButton.disabled=owed<=0;
      requestButton.hidden=active&&!(Number(request?.newSinceRequestCredits)>0);
      requestButton.textContent=active?'Update Request':'Request Payout';
    }
    if(cancelButton)cancelButton.hidden=!active;
  }

  function render(payload){
    account=payload;
    const entries=Array.isArray(payload.entries)?payload.entries:[];
    const summary=payload.summary||{};
    const commander=entries.find(entry=>entry?.displayName)?.displayName||payload.viewer?.displayName||'Mongrel Member';
    if(viewer)viewer.textContent=commander;
    if(owedEl)owedEl.textContent=fmt(summary.owedCredits);
    if(paidEl)paidEl.textContent=fmt(summary.paidCredits);
    if(outstandingEl)outstandingEl.textContent=entries.filter(entry=>entry?.status==='owed').length.toLocaleString();
    renderRequest(payload.payoutRequest||{},summary);
    renderOutstanding(entries);
    renderPaid(entries);
  }

  async function load(){
    if(loading)return;
    loading=true;
    if(refresh)refresh.disabled=true;
    try{
      const response=await fetch('/api/rewards/status?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const payload=await response.json().catch(()=>({}));
      if(response.status===401||response.status===403){
        if(gateStatus)gateStatus.textContent=response.status===401?'Member sign-in required':'This Discord account does not have Rewards access';
        setAccess(false);return;
      }
      if(!response.ok)throw new Error(payload.error||('Rewards request failed ('+response.status+')'));
      render(payload);setAccess(true);
    }catch(error){
      console.error('Could not load reward account',error);
      if(gateStatus)gateStatus.textContent='Reward account service unavailable. Please try again.';
      setAccess(false);
    }finally{
      loading=false;if(refresh)refresh.disabled=false;
    }
  }

  async function mutateRequest(action){
    if(!account||loading)return;
    const expected=Math.round(Number(account?.summary?.owedCredits)||0);
    if(action==='request'&&expected<=0)return;
    const button=action==='cancel'?cancelButton:requestButton;
    if(button)button.disabled=true;
    if(requestStatus)requestStatus.textContent=action==='cancel'?'Cancelling request…':'Sending payout request…';
    try{
      const response=await fetch('/api/rewards/request',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'mongrels-reward-request'},
        body:JSON.stringify({action,expectedAvailableCredits:expected}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||payload.error||('Request failed ('+response.status+')'));
      if(requestStatus)requestStatus.textContent=payload.message||'Reward account updated.';
      await load();
    }catch(error){
      console.error('Could not update payout request',error);
      if(requestStatus)requestStatus.textContent=String(error.message||error);
      if(button)button.disabled=false;
    }
  }

  refresh?.addEventListener('click',load);
  requestButton?.addEventListener('click',()=>mutateRequest('request'));
  cancelButton?.addEventListener('click',()=>mutateRequest('cancel'));
  setAccess(false);
  load();
})();
