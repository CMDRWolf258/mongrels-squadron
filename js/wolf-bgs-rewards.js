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

  load();
  loadLedgerPreview();
})();
