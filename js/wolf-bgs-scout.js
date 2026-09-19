(() => {
  const API='/api/operations/scout-tokens';
  const host=document.querySelector('[data-scout-network]');
  if(!host)return;

  const list=host.querySelector('[data-scout-token-list]');
  const form=host.querySelector('[data-scout-token-form]');
  const labelInput=host.querySelector('[data-scout-token-label]');
  const message=host.querySelector('[data-scout-token-message]');
  const count=host.querySelector('[data-scout-token-count]');
  const reveal=host.querySelector('[data-scout-token-reveal]');
  const revealValue=host.querySelector('[data-scout-token-value]');
  const copyButton=host.querySelector('[data-copy-scout-token]');

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=value=>{
    if(!value)return 'Never';
    const date=new Date(value);
    return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date):'Unknown';
  };
  const age=value=>{
    if(!value)return 'Never';
    const time=new Date(value).getTime();
    if(!Number.isFinite(time))return 'Unknown';
    const mins=Math.max(0,Math.round((Date.now()-time)/60000));
    if(mins<60)return `${mins}m ago`;
    const hours=Math.round(mins/60);
    if(hours<48)return `${hours}h ago`;
    return `${Math.round(hours/24)}d ago`;
  };
  function setMessage(text,state=''){
    if(!message)return;
    message.textContent=text;
    message.dataset.state=state;
  }
  async function request(method,body){
    const response=await fetch(API,{
      method,
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-bgs-control'},
      body:body?JSON.stringify(body):undefined,
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
    return data;
  }
  function render(data){
    const rows=Array.isArray(data?.tokens)?data.tokens:[];
    if(count)count.textContent=String(rows.length);
    if(!list)return;
    if(!rows.length){
      list.innerHTML='<div class="wolf-scout-empty"><strong>No scout tokens issued.</strong><span>Create one for a trusted CMDR, then give them the token once.</span></div>';
      return;
    }
    list.innerHTML=rows.map(row=>`
      <article class="wolf-scout-token-row" data-scout-token-id="${esc(row.id)}">
        <div class="wolf-scout-token-identity"><span>SCOUT</span><strong>${esc(row.label)}</strong><small>Created ${esc(fmt(row.createdAt))}</small></div>
        <div><span>LAST UPLINK</span><strong>${esc(row.lastSeenAt?age(row.lastSeenAt):'Never')}</strong><small>${esc(row.lastSystem||'No system received yet')}</small></div>
        <div><span>GAME DATA</span><strong>${esc(row.lastEventAt?age(row.lastEventAt):'—')}</strong><small>${esc(row.lastEventAt?fmt(row.lastEventAt):'No event yet')}</small></div>
        <button type="button" class="wolf-scout-revoke" data-revoke-scout-token>REVOKE</button>
      </article>`).join('');
  }
  async function load(){
    try{
      const response=await fetch(`${API}?_=${Date.now()}`,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'load_failed');
      render(data);
    }catch(error){
      console.error(error);
      setMessage('Could not load Scout Network.','error');
    }
  }
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const label=labelInput?.value?.trim()||'';
    if(!label){setMessage('Enter a scout label first.','error');return;}
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    setMessage('Generating one-time scout token…','working');
    try{
      const data=await request('POST',{label});
      if(reveal&&revealValue){
        reveal.hidden=false;
        revealValue.textContent=data.token||'';
      }
      if(labelInput)labelInput.value='';
      setMessage('Token created. Copy it now — the site will not show it again.','success');
      await load();
    }catch(error){
      console.error(error);
      setMessage('Could not create scout token.','error');
    }finally{if(button)button.disabled=false;}
  });
  copyButton?.addEventListener('click',async()=>{
    const token=revealValue?.textContent||'';
    if(!token)return;
    try{
      await navigator.clipboard.writeText(token);
      setMessage('Scout token copied.','success');
    }catch{
      setMessage('Copy failed. Select the token text manually.','error');
    }
  });
  list?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-revoke-scout-token]');
    if(!button)return;
    const row=button.closest('[data-scout-token-id]');
    const id=row?.dataset.scoutTokenId||'';
    const label=row?.querySelector('.wolf-scout-token-identity strong')?.textContent||'this scout';
    if(!id||!window.confirm(`Revoke direct BGS access for ${label}? Their existing plugin token will stop working immediately.`))return;
    button.disabled=true;
    try{
      await request('DELETE',{id});
      setMessage(`${label} revoked.`,'success');
      await load();
    }catch(error){
      console.error(error);
      setMessage('Could not revoke scout token.','error');
      button.disabled=false;
    }
  });
  load();
  window.setInterval(load,60000);
})();
