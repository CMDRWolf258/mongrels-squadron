(() => {
  const host=document.querySelector('[data-scout-job-admin]');
  if(!host)return;
  const API='/api/operations/scout-jobs';
  const list=host.querySelector('[data-scout-job-admin-list]');
  const defaultInput=host.querySelector('[data-scout-job-default]');
  const saveDefault=host.querySelector('[data-save-scout-job-default]');
  const refresh=host.querySelector('[data-refresh-scout-job-admin]');
  const status=host.querySelector('[data-scout-job-admin-status]');
  let payload=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtCredits=millions=>Math.round((Number(millions)||0)*1_000_000).toLocaleString()+' Cr';
  const norm=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');

  async function request(method='GET',body=null){
    const response=await fetch(API+(method==='GET'?'?admin=1&_='+Date.now():''),{
      method,
      credentials:'same-origin',
      cache:'no-store',
      headers:{
        Accept:'application/json',
        ...(body?{'Content-Type':'application/json','X-Mongrels-Request':'scout-jobs'}:{}),
      },
      body:body?JSON.stringify(body):undefined,
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Scout Job admin request failed ('+response.status+')');
    return data;
  }

  function ruleFor(system){
    const wanted=norm(system);
    for(const [name,row] of Object.entries(payload?.settings?.systems||{}))if(norm(name)===wanted)return row;
    return {enabled:true,bonusMillions:0,reason:'',bonusOnce:true};
  }

  function render(){
    if(!payload||!list)return;
    if(defaultInput)defaultInput.value=String(Number(payload.defaultRewardMillions)||0);
    const jobs=Array.isArray(payload.jobs)?payload.jobs:[];
    if(!jobs.length){
      list.innerHTML='<div class="scout-job-empty">No active Mongrel systems are available from the BGS presence feed.</div>';
      return;
    }
    list.innerHTML=jobs.map(job=>{
      const rule=ruleFor(job.system);
      return '<div class="scout-job-admin-row" data-scout-job-system="'+esc(job.system)+'">'
        +'<strong>'+esc(job.system)+'<small style="display:block;color:#7f969c;font-weight:500;margin-top:3px">'+esc(job.status.replaceAll('_',' ').toUpperCase())+' · tick '+esc(job.cycle?.tickConfiguredTime||'19:00')+' CT</small></strong>'
        +'<label><span>Bonus M Cr</span><input type="number" min="0" max="100000" step="1" data-scout-job-bonus value="'+esc(rule.bonusMillions||0)+'"></label>'
        +'<label><span>Priority reason</span><input type="text" maxlength="240" data-scout-job-reason value="'+esc(rule.reason||'')+'" placeholder="e.g. Conflict / expansion watch"></label>'
        +'<label><span>Bonus behavior</span><select data-scout-job-once><option value="once" '+(rule.bonusOnce!==false?'selected':'')+'>Next rewarded scout only</option><option value="persistent" '+(rule.bonusOnce===false?'selected':'')+'>Every cycle until cleared</option></select></label>'
        +'<div class="scout-job-actions"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-scout-job-enabled '+(rule.enabled!==false?'checked':'')+'> Enabled</label><button type="button" class="btn btn-secondary btn-compact" data-save-scout-job-system>SAVE</button></div>'
        +'</div>';
    }).join('');
  }

  async function load(){
    if(refresh)refresh.disabled=true;
    if(status)status.textContent='Refreshing Scout Job controls…';
    try{
      payload=await request();
      render();
      if(status)status.textContent='Loaded '+Number(payload?.summary?.systems||0).toLocaleString()+' active systems · default '+fmtCredits(payload.defaultRewardMillions||0);
    }catch(error){
      console.error('Could not load Scout Job admin',error);
      if(status)status.textContent='Scout Job controls unavailable · '+String(error.message||error);
    }finally{if(refresh)refresh.disabled=false;}
  }

  saveDefault?.addEventListener('click',async()=>{
    saveDefault.disabled=true;
    if(status)status.textContent='Saving default Scout reward…';
    try{
      await request('POST',{action:'save-global',defaultRewardMillions:Number(defaultInput?.value)||0});
      await load();
    }catch(error){
      if(status)status.textContent='Default reward not saved · '+String(error.message||error);
      saveDefault.disabled=false;
    }
  });

  list?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-save-scout-job-system]');
    if(!button)return;
    const row=button.closest('[data-scout-job-system]');
    const system=row?.dataset.scoutJobSystem||'';
    if(!system)return;
    button.disabled=true;
    if(status)status.textContent='Saving '+system+' Scout reward…';
    try{
      await request('POST',{
        action:'save-system',
        system,
        enabled:Boolean(row.querySelector('[data-scout-job-enabled]')?.checked),
        bonusMillions:Number(row.querySelector('[data-scout-job-bonus]')?.value)||0,
        reason:row.querySelector('[data-scout-job-reason]')?.value||'',
        bonusOnce:row.querySelector('[data-scout-job-once]')?.value!=='persistent',
      });
      await load();
    }catch(error){
      console.error(error);
      if(status)status.textContent=system+' not saved · '+String(error.message||error);
      button.disabled=false;
    }
  });

  refresh?.addEventListener('click',load);
  load();
})();
