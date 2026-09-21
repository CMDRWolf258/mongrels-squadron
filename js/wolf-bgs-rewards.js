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

  load();
})();
