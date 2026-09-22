(() => {
  const panel=document.querySelector('[data-mc-reward-preview]');
  if(!panel)return;
  const balance=panel.querySelector('[data-mc-reward-balance]');
  const summary=panel.querySelector('[data-mc-reward-summary]');
  const status=panel.querySelector('[data-mc-reward-status]');
  const fmt=value=>Math.round(Number(value)||0).toLocaleString()+' Cr';

  async function load(){
    try{
      const response=await fetch('/api/rewards/status?_='+Date.now(),{
        credentials:'same-origin',
        cache:'no-store',
        headers:{Accept:'application/json'},
      });
      if(response.status===401||response.status===403)return;
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Reward account unavailable');
      const entries=Array.isArray(payload.entries)?payload.entries:[];
      const owed=entries.filter(entry=>entry?.status==='owed').length;
      const request=payload.payoutRequest||{};
      if(balance)balance.textContent=fmt(payload?.summary?.unsettledCredits||payload?.summary?.owedCredits);
      if(summary)summary.textContent=owed+' unpaid reward'+(owed===1?'':'s')+' · '+fmt(payload?.summary?.paidCredits)+' paid historically';
      if(status){
        status.textContent=request.active
          ? 'PAYOUT REQUESTED · '+fmt(request.requestedRemainingCredits||request.requestedCredits)+' · '+new Date(request.requestedAt).toLocaleString()
          : Number(payload?.summary?.squadOwedCredits)>0
            ? 'Squad payout available · open your Reward Account when you are ready to collect.'
            : (Number(payload?.summary?.memberOwedCredits)||0)+(Number(payload?.summary?.memberPaymentSentCredits)||0)>0
              ? 'Member-funded reward settlement is waiting in your Reward Account.'
              : 'No outstanding balance right now.';
        status.classList.toggle('mc-reward-preview-status',Boolean(request.active));
      }
      panel.classList.toggle('is-requested',Boolean(request.active));
    }catch(error){
      console.error('Could not load Mission Control reward preview',error);
      if(summary)summary.textContent='Reward account temporarily unavailable';
      if(status)status.textContent='Open the Reward Account to try again.';
    }
  }

  window.addEventListener('mongrels:mission-control-loaded',load,{once:true});
})();
