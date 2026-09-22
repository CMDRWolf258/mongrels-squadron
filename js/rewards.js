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
  const paidHistoryMore=document.querySelector('[data-reward-paid-more]');
  const paidHistoryStatus=document.querySelector('[data-reward-paid-status]');
  const memberPaymentList=document.querySelector('[data-member-payment-list]');
  const memberPaymentOwed=document.querySelector('[data-member-payment-owed]');
  const memberPaymentSent=document.querySelector('[data-member-payment-sent]');
  const memberPaymentStatus=document.querySelector('[data-member-payment-status]');

  let account=null;
  let loading=false;
  let paidHistoryLoading=false;
  let paidHistoryNextOffset=null;
  let paidHistoryShown=0;
  let paidHistoryTotal=0;
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
    if(entry?.fundingMode==='member')parts.push('member funded · payer '+String(entry.payerDisplayName||'posting CMDR'));
    else parts.push('squad funded');
    if(entry?.status==='payment_sent')parts.push('payment sent '+dateTime(entry.paymentSentAt));
    if(entry?.createdAt)parts.push('approved '+dateTime(entry.createdAt));
    return parts.join(' · ');
  }

  function renderOutstanding(entries){
    if(!outstandingList)return;
    outstandingList.replaceChildren();
    const unsettled=entries.filter(entry=>entry?.status==='owed'||entry?.status==='payment_sent');
    if(!unsettled.length){
      const empty=document.createElement('div');empty.className='reward-empty';
      const strong=document.createElement('strong');strong.textContent='No outstanding rewards.';
      const small=document.createElement('small');small.textContent='New approved rewards from BGS, Colonization, scouting, and other programs will appear here.';
      empty.append(strong,small);outstandingList.append(empty);return;
    }
    const groups=new Map();
    unsettled.forEach(entry=>{
      const meta=source(entry);
      const groupKey=meta.key+(entry.fundingMode==='member'?'-member':'-squad');
      const group=groups.get(groupKey)||{...meta,key:groupKey,label:meta.label+(entry.fundingMode==='member'?' · MEMBER FUNDED':''),entries:[]};
      group.entries.push(entry);groups.set(groupKey,group);
    });
    [...groups.values()].forEach(group=>{
      const section=document.createElement('section');section.className='reward-source-group';
      const head=document.createElement('div');head.className='reward-source-head';
      const main=document.createElement('div');
      const title=document.createElement('strong');title.textContent=group.label;
      const count=document.createElement('small');count.textContent=group.entries.length+' unsettled reward'+(group.entries.length===1?'':'s');
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
        if(entry.status==='payment_sent'){
          const state=document.createElement('span');state.className='reward-entry-status';state.textContent='PAYMENT SENT · CONFIRM RECEIPT';
          info.append(state);
        }
        const side=document.createElement('div');side.className='reward-entry-actions';
        const amount=document.createElement('div');amount.className='reward-entry-amount';amount.textContent=fmt(entry.amountCredits);side.append(amount);
        if(entry.fundingMode==='member'&&entry.status==='payment_sent'){
          const confirm=document.createElement('button');confirm.type='button';confirm.className='btn btn-primary btn-compact';confirm.textContent='Confirm Received';
          confirm.addEventListener('click',()=>mutateMemberPayment('confirm-received',entry,confirm));
          side.append(confirm);
        }
        row.append(info,side);list.append(row);
      });
      section.append(head,list);outstandingList.append(section);
    });
  }

  function renderPaidBatches(batches,{append=false}={}){
    if(!paidList)return;
    const rows=Array.isArray(batches)?batches:[];
    if(!append)paidList.replaceChildren();
    if(!rows.length&&!append){
      const empty=document.createElement('div');empty.className='reward-empty';
      const strong=document.createElement('strong');strong.textContent='No paid reward history yet.';
      const small=document.createElement('small');small.textContent='Completed payouts will remain here after leadership confirms the in-game transfer.';
      empty.append(strong,small);paidList.append(empty);return;
    }

    rows.forEach((group,index)=>{
      const details=document.createElement('details');
      details.className='reward-history-batch';
      details.dataset.rewardHistoryBatch=group.batchId||('legacy-'+String(group.paidAt||index));
      if(!append&&index===0)details.open=true;

      const summary=document.createElement('summary');
      const main=document.createElement('div');
      const title=document.createElement('strong');title.textContent='Payout · '+dateTime(group.paidAt);
      const meta=document.createElement('small');
      meta.textContent=Number(group.entryCount||group.entries?.length||0)+' reward entr'+(Number(group.entryCount||group.entries?.length||0)===1?'y':'ies')+(group.paidBy?' · recorded by '+group.paidBy:'');
      main.append(title,meta);
      const total=document.createElement('b');total.textContent=fmt(group.totalCredits);
      summary.append(main,total);

      const items=document.createElement('div');items.className='reward-history-items';
      (Array.isArray(group.entries)?group.entries:[]).forEach(entry=>{
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

  function syncPaidHistoryControls(page={}){
    paidHistoryNextOffset=page.hasMore?Number(page.nextOffset):null;
    paidHistoryShown=Number(page.offset||0)+Number(page.returnedBatchCount||0);
    paidHistoryTotal=Number(page.totalBatchCount||0);
    if(paidHistoryStatus){
      paidHistoryStatus.textContent=paidHistoryTotal
        ? 'Showing '+Math.min(paidHistoryShown,paidHistoryTotal).toLocaleString()+' of '+paidHistoryTotal.toLocaleString()+' payout batches'
        : 'No completed payouts yet';
    }
    if(paidHistoryMore){
      paidHistoryMore.hidden=!page.hasMore;
      paidHistoryMore.disabled=false;
      paidHistoryMore.textContent='LOAD OLDER PAYOUTS';
    }
  }

  async function loadOlderPaidHistory(){
    if(paidHistoryLoading||paidHistoryNextOffset===null)return;
    paidHistoryLoading=true;
    if(paidHistoryMore){paidHistoryMore.disabled=true;paidHistoryMore.textContent='LOADING…';}
    try{
      const response=await fetch('/api/rewards/history?offset='+encodeURIComponent(paidHistoryNextOffset)+'&limit=12&_='+Date.now(),{
        credentials:'same-origin',
        cache:'no-store',
        headers:{Accept:'application/json'},
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||('Reward history request failed ('+response.status+')'));
      renderPaidBatches(payload.batches,{append:true});
      syncPaidHistoryControls(payload);
    }catch(error){
      console.error('Could not load older reward payouts',error);
      if(paidHistoryStatus)paidHistoryStatus.textContent='Older payout history could not be loaded. Try again.';
      if(paidHistoryMore){paidHistoryMore.disabled=false;paidHistoryMore.textContent='TRY AGAIN';}
    }finally{
      paidHistoryLoading=false;
    }
  }

  function renderMemberPayments(payload={}){
    if(memberPaymentOwed)memberPaymentOwed.textContent=fmt(payload.summary?.owedCredits||0);
    if(memberPaymentSent)memberPaymentSent.textContent=fmt(payload.summary?.paymentSentCredits||0);
    if(!memberPaymentList)return;
    memberPaymentList.replaceChildren();
    const rows=Array.isArray(payload.entries)?payload.entries:[];
    if(!rows.length){
      const empty=document.createElement('div');empty.className='reward-empty';
      const strong=document.createElement('strong');strong.textContent='You do not currently owe any member-funded rewards.';
      const small=document.createElement('small');small.textContent='Verified Colonization Job rewards you pledge will appear here when another CMDR earns them.';
      empty.append(strong,small);memberPaymentList.append(empty);return;
    }
    rows.forEach(entry=>{
      const row=document.createElement('article');row.className='member-payment-row';
      const main=document.createElement('div');main.className='member-payment-main';
      const title=document.createElement('strong');title.textContent=entry.displayName||'Mongrel CMDR';
      const detail=document.createElement('small');
      detail.textContent=(entry.reason||'Member-funded Colonization reward')+' · '+(Number(entry.verifiedContribution)||0).toLocaleString()+' '+String(entry.verifiedUnit||'')+(entry.status==='payment_sent'?' · sent '+dateTime(entry.paymentSentAt):'');
      main.append(title,detail);
      const side=document.createElement('div');side.className='member-payment-side';
      const amount=document.createElement('b');amount.textContent=fmt(entry.amountCredits);side.append(amount);
      if(entry.status==='owed'){
        const button=document.createElement('button');button.type='button';button.className='btn btn-primary btn-compact';button.textContent='Mark Payment Sent';
        button.addEventListener('click',()=>mutateMemberPayment('mark-sent',entry,button));side.append(button);
      }else{
        const waiting=document.createElement('small');waiting.textContent='Awaiting recipient confirmation';side.append(waiting);
      }
      row.append(main,side);memberPaymentList.append(row);
    });
  }

  async function loadMemberPayments(){
    if(!memberPaymentList)return;
    try{
      const response=await fetch('/api/rewards/member-payments?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||payload.error||'Member-funded payments unavailable');
      renderMemberPayments(payload);
      if(memberPaymentStatus)memberPaymentStatus.textContent=payload.summary?.unsettledCredits>0?'Member-funded obligations are tracked separately from squad payouts.':'No member-funded payments currently require action.';
    }catch(error){
      console.error('Could not load member-funded payments',error);
      if(memberPaymentStatus)memberPaymentStatus.textContent=String(error.message||error);
    }
  }

  async function mutateMemberPayment(action,entry,button){
    if(button)button.disabled=true;
    const message=action==='mark-sent'
      ? 'Mark '+fmt(entry.amountCredits)+' to '+String(entry.displayName||'this CMDR')+' as sent? Only do this after the in-game transfer is complete.'
      : 'Confirm that you received '+fmt(entry.amountCredits)+' from '+String(entry.payerDisplayName||'the posting CMDR')+'?';
    if(!window.confirm(message)){if(button)button.disabled=false;return;}
    try{
      const response=await fetch('/api/rewards/member-payments',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'member-reward-payment'},
        body:JSON.stringify({action,entryId:entry.id,ownerId:entry.ownerId}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||payload.error||'Payment update failed');
      if(memberPaymentStatus)memberPaymentStatus.textContent=payload.message||'Payment state updated.';
      await loadMemberPayments();
      loading=false;
      await load();
    }catch(error){
      console.error('Could not update member-funded payment',error);
      if(memberPaymentStatus)memberPaymentStatus.textContent=String(error.message||error);
      if(button)button.disabled=false;
    }
  }

  function renderRequest(request,summary){
    const owed=Number(summary?.squadOwedCredits)||0;
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
    const commander=payload.viewer?.commander||entries.find(entry=>entry?.displayName)?.displayName||payload.viewer?.displayName||'Mongrel Member';
    if(viewer)viewer.textContent=commander;
    if(owedEl)owedEl.textContent=fmt(summary.unsettledCredits||summary.owedCredits);
    if(paidEl)paidEl.textContent=fmt(summary.paidCredits);
    if(outstandingEl)outstandingEl.textContent=entries.filter(entry=>entry?.status==='owed'||entry?.status==='payment_sent').length.toLocaleString();
    renderRequest(payload.payoutRequest||{},summary);
    renderOutstanding(entries);
    renderPaidBatches(payload.paidHistory?.batches||[],{append:false});
    syncPaidHistoryControls(payload.paidHistory||{});
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
      render(payload);setAccess(true);await loadMemberPayments();
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
    const expected=Math.round(Number(account?.summary?.squadOwedCredits)||0);
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
  paidHistoryMore?.addEventListener('click',loadOlderPaidHistory);
  requestButton?.addEventListener('click',()=>mutateRequest('request'));
  cancelButton?.addEventListener('click',()=>mutateRequest('cancel'));
  setAccess(false);
  load();
})();
