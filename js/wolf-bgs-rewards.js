(() => {
  const panel=document.querySelector('[data-reward-admin]');
  const form=panel?.querySelector('[data-reward-form]');
  const meta=panel?.querySelector('[data-reward-meta]');
  if(!panel||!form)return;

  const API='/api/operations/reward-settings';

  function getPath(obj,path){
    return String(path||'').split('.').reduce((value,key)=>value&&typeof value==='object'?value[key]:undefined,obj);
  }

  function setPath(obj,path,value){
    const parts=String(path||'').split('.');
    let cursor=obj;
    parts.forEach((part,index)=>{
      if(index===parts.length-1){cursor[part]=value;return;}
      if(!cursor[part]||typeof cursor[part]!=='object')cursor[part]={};
      cursor=cursor[part];
    });
  }

  function stamp(value){
    if(!value)return'Using default reward rules.';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?'Reward defaults saved.':`Saved ${d.toLocaleString()}`;
  }

  function fill(payload){
    const settings=payload?.settings||{};
    form.querySelectorAll('[data-reward]').forEach(input=>{
      const value=getPath(settings,input.dataset.reward);
      if(value!==undefined&&value!==null)input.value=String(value);
    });
    if(meta){
      const who=payload?.updatedBy?` by ${payload.updatedBy}`:'';
      meta.textContent=payload?.updatedAt?`${stamp(payload.updatedAt)}${who}.`:'Using default reward rules.';
    }
  }

  function collect(){
    const settings={trade:{},inf:{},bounties:{}};
    form.querySelectorAll('[data-reward]').forEach(input=>{
      const value=Number(input.value);
      setPath(settings,input.dataset.reward,Number.isFinite(value)?value:0);
    });
    return settings;
  }

  async function load(){
    if(meta)meta.textContent='Loading reward defaults…';
    try{
      const response=await fetch(API+'?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Reward settings request failed ('+response.status+')');
      fill(await response.json());
    }catch(error){
      console.error('Could not load reward settings',error);
      if(meta)meta.textContent='Could not load reward defaults.';
    }
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    if(meta)meta.textContent='Saving reward defaults…';
    try{
      const response=await fetch(API,{
        method:'PUT',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          'Content-Type':'application/json',
          'X-Mongrels-Request':'wolf-rewards',
        },
        body:JSON.stringify({settings:collect()}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Save failed ('+response.status+')');
      fill(payload);
    }catch(error){
      console.error('Could not save reward settings',error);
      if(meta)meta.textContent='Could not save reward defaults.';
    }finally{
      if(button)button.disabled=false;
    }
  });

  async function loadLedgerPreview(){
    const consolePanel=document.querySelector('[data-reward-ledger-admin]');
    if(!consolePanel)return;
    const list=consolePanel.querySelector('[data-reward-member-list]');
    try{
      const response=await fetch('/api/rewards/admin?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Reward ledger request failed');
      const s=payload.summary||{};
      const fmt=value=>Math.round(Number(value)||0).toLocaleString()+' Cr';
      const owed=consolePanel.querySelector('[data-reward-total-owed]');
      const paid=consolePanel.querySelector('[data-reward-total-paid]');
      const count=consolePanel.querySelector('[data-reward-member-count]');
      if(owed)owed.textContent=fmt(s.totalOwedCredits);
      if(paid)paid.textContent=fmt(s.totalPaidCredits);
      if(count)count.textContent=String(Number(s.memberCount)||0);
      if(list){
        list.replaceChildren();
        const members=Array.isArray(payload.members)?payload.members:[];
        if(!members.length){
          const empty=document.createElement('div');empty.className='wolf-scout-empty';
          const strong=document.createElement('strong');strong.textContent='No reward ledger entries yet.';
          const small=document.createElement('small');small.textContent='This is expected while automatic issuance remains disabled.';
          empty.append(strong,small);list.appendChild(empty);
        }else{
          members.forEach(member=>{
            const row=document.createElement('div');row.className='wolf-scout-token-row';
            const main=document.createElement('div');
            const strong=document.createElement('strong');strong.textContent=member.displayName||'Mongrel CMDR';
            const small=document.createElement('small');small.textContent=`${fmt(member.owedCredits)} owed · ${fmt(member.paidCredits)} paid · ${Number(member.entryCount)||0} ledger entr${Number(member.entryCount)===1?'y':'ies'}`;
            main.append(strong,small);row.append(main);list.appendChild(row);
          });
        }
      }
    }catch(error){
      console.error('Could not load reward payout preview',error);
      if(list)list.innerHTML='<div class="wolf-scout-empty"><strong>Reward ledger unavailable.</strong><small>Nothing was changed.</small></div>';
    }
  }

  async function loadVerificationReview(){
    const review=document.querySelector('[data-verification-review]');
    if(!review)return;
    const list=review.querySelector('[data-verification-list]');
    const flags=review.querySelector('[data-verification-flags]');
    const number=(sel,value)=>{const el=review.querySelector(sel);if(el)el.textContent=Number(value||0).toLocaleString();};
    const round=value=>Math.round((Number(value)||0)*10)/10;
    const signed=value=>{const n=round(value);return (n>0?'+':'')+n.toLocaleString();};

    try{
      const [verificationResponse,reportsResponse]=await Promise.all([
        fetch('/api/rewards/verification?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
        fetch('/api/operations/order-reports?admin=1&_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
      ]);
      const verification=await verificationResponse.json().catch(()=>({}));
      const reportsPayload=await reportsResponse.json().catch(()=>({}));
      if(!verificationResponse.ok)throw new Error(verification.error||'Verification review failed');
      if(!reportsResponse.ok)throw new Error(reportsPayload.error||'Manual report review failed');

      const s=verification.summary||{};
      number('[data-verification-members]',s.connectedMembers);
      number('[data-verification-matches]',s.verifiedOrderMatches);
      number('[data-verification-ambiguous]',s.ambiguousComponents);
      number('[data-verification-unmatched]',s.unmatchedComponents);

      const reports=Array.isArray(reportsPayload.reports)?reportsPayload.reports:[];
      const manual=new Map();
      for(const report of reports){
        const key=String(report.ownerId||'')+'|'+String(report.orderId||'');
        const bucket=manual.get(key)||{
          ownerId:String(report.ownerId||''),
          orderId:String(report.orderId||''),
          displayName:report.displayName||'Mongrel CMDR',
          system:report.system||'',
          faction:report.faction||'',
          reportType:report.reportType||'',
          score:0,
          reportCount:0,
        };
        bucket.score+=Number(report.score)||0;
        bucket.reportCount+=Math.max(1,Number(report.submissions)||1);
        manual.set(key,bucket);
      }

      const seen=new Set();
      if(list){
        list.replaceChildren();
        const members=Array.isArray(verification.members)?verification.members:[];
        let rows=0;

        for(const member of members){
          for(const item of Array.isArray(member.verifiedOrders)?member.verifiedOrders:[]){
            rows+=1;
            const key=String(member.ownerId||'')+'|'+String(item.orderId||'');
            seen.add(key);
            const reported=manual.get(key);
            const verified=Number(item.contribution)||0;
            const manualScore=Number(reported?.score)||0;
            const diff=verified-manualScore;

            const row=document.createElement('div');row.className='wolf-scout-token-row';
            const main=document.createElement('div');
            const strong=document.createElement('strong');
            strong.textContent=(member.commander||reported?.displayName||'Elite CMDR')+' · '+(item.task||'Daily Order');
            const small=document.createElement('small');
            const reward=item.rewardEligible
              ? ` · Reward preview ${round(item.entitlementMillions)}M / ${round(item.capMillions)}M Cr`
              : '';
            small.textContent=[
              `Verified ${round(verified)} ${item.unit||''}`,
              `Reported ${round(manualScore)} ${item.unit||''}`,
              `Difference ${signed(diff)} ${item.unit||''}`,
              item.faction,
              item.system,
            ].filter(Boolean).join(' · ')+reward;
            main.append(strong,small);
            row.append(main);
            list.appendChild(row);
          }
        }

        for(const [key,reported] of manual){
          if(seen.has(key)||!(Number(reported.score)>0))continue;
          rows+=1;
          const row=document.createElement('div');row.className='wolf-scout-token-row';
          const main=document.createElement('div');
          const strong=document.createElement('strong');
          strong.textContent=(reported.displayName||'Mongrel CMDR')+' · Manual-only '+String(reported.reportType||'report').toUpperCase();
          const small=document.createElement('small');
          small.textContent=[
            `Reported ${round(reported.score)} ${reported.reportType==='inf'?'INF':'M Cr'}`,
            'No current Scout match',
            reported.faction,
            reported.system,
          ].filter(Boolean).join(' · ');
          main.append(strong,small);row.append(main);list.appendChild(row);
        }

        if(!rows){
          const empty=document.createElement('div');empty.className='wolf-scout-empty';
          const strong=document.createElement('strong');strong.textContent='No verified/manual comparisons yet.';
          const small=document.createElement('small');small.textContent='Once a connected member has activity against an active order, the dry-run comparison will appear here.';
          empty.append(strong,small);list.appendChild(empty);
        }
      }

      if(flags){
        flags.replaceChildren();
        const members=Array.isArray(verification.members)?verification.members:[];
        const flagged=members.flatMap(member=>(member.flaggedEvents||[]).map(event=>({member,event})));
        if(flagged.length){
          const head=document.createElement('div');head.className='wolf-scout-empty';
          const strong=document.createElement('strong');strong.textContent='Verification flags';
          const small=document.createElement('small');small.textContent='These require review before automatic reward issuance is enabled.';
          head.append(strong,small);flags.appendChild(head);

          flagged.slice(0,50).forEach(({member,event})=>{
            const row=document.createElement('div');row.className='wolf-scout-token-row';
            const main=document.createElement('div');
            const strong=document.createElement('strong');
            strong.textContent=(member.commander||'Elite CMDR')+' · '+String(event.type||'event').replaceAll('_',' ');
            const small=document.createElement('small');
            const ambiguous=(event.ambiguous||[]).length;
            const unmatched=(event.unmatched||[]).length;
            small.textContent=[
              ambiguous?`${ambiguous} ambiguous`:'',
              unmatched?`${unmatched} unmatched`:'',
              event.system,
              event.station,
              event.timestamp?new Date(event.timestamp).toLocaleString():'',
            ].filter(Boolean).join(' · ');
            main.append(strong,small);row.append(main);flags.appendChild(row);
          });
        }
      }
    }catch(error){
      console.error('Could not load verification review',error);
      if(list)list.innerHTML='<div class="wolf-scout-empty"><strong>Verification review unavailable.</strong><small>No reward state was changed.</small></div>';
    }
  }

  load();
  loadLedgerPreview();
  loadVerificationReview();
})();
