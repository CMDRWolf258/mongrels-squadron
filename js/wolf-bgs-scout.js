(() => {
  const API='/api/operations/scout-tokens';
  const host=document.querySelector('[data-scout-network]');
  if(!host)return;

  const list=host.querySelector('[data-scout-token-list]');
  const form=host.querySelector('[data-scout-token-form]');
  const labelInput=host.querySelector('[data-scout-token-label]');
  const scopeInput=host.querySelector('[data-scout-token-scope]');
  const createSystems=host.querySelector('[data-scout-create-systems]');
  const message=host.querySelector('[data-scout-token-message]');
  const count=host.querySelector('[data-scout-token-count]');
  const reveal=host.querySelector('[data-scout-token-reveal]');
  const revealValue=host.querySelector('[data-scout-token-value]');
  const copyButton=host.querySelector('[data-copy-scout-token]');
  let networkFingerprint='';
  let systemNames=[];
  let tokens=[];

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
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

  function mergedSystemNames(extra=[]){
    const byKey=new Map();
    for(const name of [...systemNames,...extra]){
      const clean=String(name||'').trim();
      if(clean&&!byKey.has(norm(clean)))byKey.set(norm(clean),clean);
    }
    return [...byKey.values()].sort((a,b)=>a.localeCompare(b));
  }
  function selectorMarkup(selected=[],context='create'){
    const chosen=new Set(selected.map(norm));
    const names=mergedSystemNames(selected);
    if(!names.length)return '<div class="wolf-scout-system-empty">System list is still loading. Open the System Control Deck once if this remains empty.</div>';
    return `
      <div class="wolf-scout-system-filter"><input type="search" data-scout-system-filter placeholder="Filter systems…" autocomplete="off"><span><b data-scout-selected-count>${chosen.size}</b> selected</span></div>
      <div class="wolf-scout-system-checks" data-scout-system-checks data-context="${esc(context)}">
        ${names.map(name=>`<label data-system-name="${esc(norm(name))}"><input type="checkbox" value="${esc(name)}" ${chosen.has(norm(name))?'checked':''}> <span>${esc(name)}</span></label>`).join('')}
      </div>`;
  }
  function selectedSystems(container){
    return [...(container?.querySelectorAll('[data-scout-system-checks] input[type="checkbox"]:checked')||[])].map(input=>input.value);
  }
  function updateSelectedCount(container){
    const counter=container?.querySelector('[data-scout-selected-count]');
    if(counter)counter.textContent=String(selectedSystems(container).length);
  }
  function refreshCreateSelector(preserve=true){
    if(!createSystems)return;
    const selected=preserve?selectedSystems(createSystems):[];
    createSystems.innerHTML=selectorMarkup(selected,'create');
    createSystems.hidden=(scopeInput?.value||'restricted')==='trusted';
  }
  function captureSystems(rows){
    const names=(rows||[]).map(row=>String(row?.name||'').trim()).filter(Boolean);
    if(!names.length)return;
    const next=mergedSystemNames(names);
    if(next.join('\n')===systemNames.join('\n'))return;
    systemNames=next;
    refreshCreateSelector(true);
  }
  window.addEventListener('wolf-bgs-payload-updated',event=>captureSystems(event.detail?.systems||[]));
  try{captureSystems(window.WolfBgsGetSystems?.()||[]);}catch{}

  function accessSummary(row){
    if(row.scope==='trusted')return '<strong class="wolf-scout-access-badge trusted">TRUSTED</strong><small>All Mongrel systems</small>';
    const n=Array.isArray(row.allowedSystems)?row.allowedSystems.length:0;
    return `<strong class="wolf-scout-access-badge restricted">RESTRICTED</strong><small>${n} assigned system${n===1?'':'s'}</small>`;
  }
  function accessEditorMarkup(row){
    const allowed=Array.isArray(row.allowedSystems)?row.allowedSystems:[];
    return `
      <div class="wolf-scout-access-editor" data-scout-access-editor hidden>
        <div class="wolf-scout-access-editor-head">
          <div><span>ACCESS CONTROL</span><strong>${esc(row.label)}</strong><small>Changing this does not change the scout's token.</small></div>
          <label><span>Scout level</span><select data-edit-scout-scope><option value="restricted" ${row.scope==='restricted'?'selected':''}>Restricted Scout</option><option value="trusted" ${row.scope==='trusted'?'selected':''}>Trusted Scout</option></select></label>
        </div>
        <div class="wolf-scout-edit-systems" data-edit-scout-systems ${row.scope==='trusted'?'hidden':''}>${selectorMarkup(allowed,`edit-${row.id}`)}</div>
        <div class="wolf-scout-access-help" data-scout-access-help>${row.scope==='trusted'?'Trusted Scouts may update any Mongrel system.':'Restricted Scouts may update only checked systems. You can change these at any time without issuing a new token.'}</div>
        <div class="wolf-scout-access-actions">
          <button type="button" class="btn btn-primary btn-compact" data-save-scout-access>SAVE ACCESS</button>
          <button type="button" class="btn btn-secondary btn-compact" data-cancel-scout-access>CANCEL</button>
        </div>
      </div>`;
  }
  function render(data){
    tokens=Array.isArray(data?.tokens)?data.tokens:[];
    if(count)count.textContent=String(tokens.length);
    if(!list)return;
    if(!tokens.length){
      list.innerHTML='<div class="wolf-scout-empty"><strong>No scout tokens issued.</strong><span>New tokens default to Restricted Scout access.</span></div>';
      return;
    }
    list.innerHTML=tokens.map(row=>`
      <article class="wolf-scout-token-card" data-scout-token-id="${esc(row.id)}">
        <div class="wolf-scout-token-row">
          <div class="wolf-scout-token-identity"><span>SCOUT</span><strong>${esc(row.label)}</strong><small>Created ${esc(fmt(row.createdAt))}</small></div>
          <div class="wolf-scout-token-access"><span>ACCESS</span>${accessSummary(row)}</div>
          <div><span>LAST UPLINK</span><strong>${esc(row.lastSeenAt?age(row.lastSeenAt):'Never')}</strong><small>${esc(row.lastSystem||'No system received yet')}</small></div>
          <div><span>GAME DATA</span><strong>${esc(row.lastEventAt?age(row.lastEventAt):'—')}</strong><small>${esc(row.lastEventAt?fmt(row.lastEventAt):'No event yet')}</small></div>
          <div class="wolf-scout-token-actions"><button type="button" class="wolf-scout-edit" data-edit-scout-access>EDIT ACCESS</button><button type="button" class="wolf-scout-revoke" data-revoke-scout-token>REVOKE</button></div>
        </div>
        ${accessEditorMarkup(row)}
      </article>`).join('');
  }
  async function load({forceRender=false}={}){
    try{
      const response=await fetch(`${API}?_=${Date.now()}`,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'load_failed');
      const rows=Array.isArray(data?.tokens)?data.tokens:[];
      const nextFingerprint=rows.map(row=>`${row.id}:${row.lastSeenAt||''}:${row.lastEventAt||''}:${row.lastSystem||''}`).sort().join('|');
      const changed=Boolean(networkFingerprint)&&nextFingerprint!==networkFingerprint;
      networkFingerprint=nextFingerprint;
      const editing=Boolean(list?.querySelector('[data-scout-access-editor]:not([hidden])'));
      if(forceRender||!editing)render(data);
      else tokens=rows;
      if(changed&&typeof window.WolfBgsRefresh==='function')window.WolfBgsRefresh();
    }catch(error){
      console.error(error);
      setMessage('Could not load Scout Network.','error');
    }
  }

  scopeInput?.addEventListener('change',()=>{
    refreshCreateSelector(true);
    const trusted=scopeInput.value==='trusted';
    setMessage(trusted?'Trusted Scout can update every Mongrel system.':'Restricted Scout requires at least one assigned system.','');
  });
  createSystems?.addEventListener('input',event=>{
    const filter=event.target.closest('[data-scout-system-filter]');
    if(filter){
      const q=norm(filter.value);
      createSystems.querySelectorAll('[data-system-name]').forEach(label=>label.hidden=Boolean(q)&&!label.dataset.systemName.includes(q));
    }
    updateSelectedCount(createSystems);
  });
  createSystems?.addEventListener('change',()=>updateSelectedCount(createSystems));

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const label=labelInput?.value?.trim()||'';
    const scope=scopeInput?.value==='trusted'?'trusted':'restricted';
    const allowedSystems=scope==='restricted'?selectedSystems(createSystems):[];
    if(!label){setMessage('Enter a scout label first.','error');return;}
    if(scope==='restricted'&&!allowedSystems.length){setMessage('Choose at least one system for a Restricted Scout.','error');return;}
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    setMessage('Generating one-time scout token…','working');
    try{
      const data=await request('POST',{label,scope,allowedSystems});
      if(reveal&&revealValue){
        reveal.hidden=false;
        revealValue.textContent=data.token||'';
      }
      if(labelInput)labelInput.value='';
      if(scopeInput)scopeInput.value='restricted';
      refreshCreateSelector(false);
      setMessage('Token created. Copy it now — the site will not show it again.','success');
      await load({forceRender:true});
    }catch(error){
      console.error(error);
      setMessage(error.message==='restricted_systems_required'?'Choose at least one system for this Restricted Scout.':'Could not create scout token.','error');
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

  list?.addEventListener('input',event=>{
    const editor=event.target.closest('[data-scout-access-editor]');
    if(!editor)return;
    const filter=event.target.closest('[data-scout-system-filter]');
    if(filter){
      const q=norm(filter.value);
      editor.querySelectorAll('[data-system-name]').forEach(label=>label.hidden=Boolean(q)&&!label.dataset.systemName.includes(q));
    }
    updateSelectedCount(editor);
  });
  list?.addEventListener('change',event=>{
    const editor=event.target.closest('[data-scout-access-editor]');
    if(!editor)return;
    if(event.target.matches('[data-edit-scout-scope]')){
      const trusted=event.target.value==='trusted';
      const systems=editor.querySelector('[data-edit-scout-systems]');
      const help=editor.querySelector('[data-scout-access-help]');
      if(systems)systems.hidden=trusted;
      if(help)help.textContent=trusted?'Trusted Scouts may update any Mongrel system.':'Restricted Scouts may update only checked systems. You can change these at any time without issuing a new token.';
    }
    updateSelectedCount(editor);
  });

  list?.addEventListener('click',async event=>{
    const card=event.target.closest('[data-scout-token-id]');
    if(!card)return;
    const id=card.dataset.scoutTokenId||'';
    const row=tokens.find(item=>item.id===id);
    if(!row)return;

    const editButton=event.target.closest('[data-edit-scout-access]');
    if(editButton){
      const editor=card.querySelector('[data-scout-access-editor]');
      if(editor){
        editor.hidden=!editor.hidden;
        if(!editor.hidden){
          const systemHost=editor.querySelector('[data-edit-scout-systems]');
          if(systemHost)systemHost.innerHTML=selectorMarkup(row.allowedSystems||[],`edit-${row.id}`);
          updateSelectedCount(editor);
        }
      }
      return;
    }

    if(event.target.closest('[data-cancel-scout-access]')){
      const editor=card.querySelector('[data-scout-access-editor]');
      if(editor)editor.hidden=true;
      return;
    }

    const saveButton=event.target.closest('[data-save-scout-access]');
    if(saveButton){
      const editor=card.querySelector('[data-scout-access-editor]');
      const scope=editor?.querySelector('[data-edit-scout-scope]')?.value==='trusted'?'trusted':'restricted';
      const allowedSystems=scope==='restricted'?selectedSystems(editor):[];
      if(scope==='restricted'&&!allowedSystems.length){
        setMessage(`${row.label} needs at least one assigned system.`,'error');
        return;
      }
      saveButton.disabled=true;
      try{
        await request('PATCH',{id,scope,allowedSystems});
        setMessage(`${row.label} access updated. Their existing token still works.`,'success');
        await load({forceRender:true});
      }catch(error){
        console.error(error);
        setMessage('Could not update Scout access.','error');
        saveButton.disabled=false;
      }
      return;
    }

    const revokeButton=event.target.closest('[data-revoke-scout-token]');
    if(!revokeButton)return;
    if(!window.confirm(`Revoke direct BGS access for ${row.label}? Their existing plugin token will stop working immediately.`))return;
    revokeButton.disabled=true;
    try{
      await request('DELETE',{id});
      setMessage(`${row.label} revoked.`,'success');
      await load({forceRender:true});
    }catch(error){
      console.error(error);
      setMessage('Could not revoke scout token.','error');
      revokeButton.disabled=false;
    }
  });

  refreshCreateSelector(false);
  load({forceRender:true});
  window.setInterval(()=>load(),30000);
})();
