(() => {
  const panel=document.querySelector('[data-colony-architects]');
  if(!panel)return;

  const API='/api/operations/colony-architects';
  const form=panel.querySelector('[data-architect-form]');
  const pairsList=panel.querySelector('[data-architect-pairs]');
  const claimsList=panel.querySelector('[data-architect-claims]');
  const status=panel.querySelector('[data-architect-message]');
  const refresh=panel.querySelector('[data-architect-refresh]');
  const systemInput=panel.querySelector('[data-architect-system]');
  const commanderInput=panel.querySelector('[data-architect-commander]');
  const noteInput=panel.querySelector('[data-architect-note]');
  const claimEventInput=panel.querySelector('[data-architect-claim-event]');
  const systemOptions=panel.querySelector('[data-architect-system-options]');
  const commanderOptions=panel.querySelector('[data-architect-commander-options]');
  let loadedAt=0;
  let loading=false;
  let dataCache=null;
  const FRESH_MS=5000;

  const date=value=>{
    if(!value)return'—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleString();
  };
  const norm=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  const setText=(sel,value)=>{const el=panel.querySelector(sel);if(el)el.textContent=String(value);};
  function message(text,state=''){
    if(!status)return;
    status.textContent=text;
    status.className=`wolf-status-message ${state}`.trim();
  }

  async function mutate(body){
    const response=await fetch(API,{
      method:'PUT',
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'wolf-colony-architects'},
      body:JSON.stringify(body),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Request failed (${response.status})`);
    return payload;
  }

  function chip(text,kind=''){
    const el=document.createElement('span');
    el.className=`wolf-architect-chip ${kind}`.trim();
    el.textContent=text;
    return el;
  }

  function renderOptions(data){
    if(systemOptions){
      systemOptions.replaceChildren();
      (data.systems||[]).forEach(value=>{
        const option=document.createElement('option');
        option.value=value;
        systemOptions.append(option);
      });
    }
    if(commanderOptions){
      commanderOptions.replaceChildren();
      (data.commanders||[]).forEach(value=>{
        const option=document.createElement('option');
        option.value=value;
        commanderOptions.append(option);
      });
    }
  }

  function claimLabel(alignment){
    if(alignment==='match')return chip('CLAIM MATCH','is-match');
    if(alignment==='conflict')return chip('CLAIM CONFLICT','is-conflict');
    if(alignment==='released')return chip('CLAIM RELEASED','is-released');
    return chip('MANUAL RECORD','is-manual');
  }

  function renderPairs(pairs){
    pairsList.replaceChildren();
    if(!pairs.length){
      const empty=document.createElement('div');
      empty.className='wolf-architect-empty';
      empty.innerHTML='<strong>No architect pairings yet.</strong><span>Use the form above to pair an existing colony system with its architect.</span>';
      pairsList.append(empty);
      return;
    }

    pairs.forEach(pair=>{
      const row=document.createElement('article');
      row.className=`wolf-architect-pair ${pair.claimAlignment==='conflict'?'is-conflict':''}`;
      row.dataset.architectSystem=pair.system||'';

      const main=document.createElement('div');
      main.className='wolf-architect-pair-main';
      const system=document.createElement('strong');
      system.textContent=pair.system||'Unknown system';
      const commander=document.createElement('span');
      commander.textContent=pair.commander||'Unknown CMDR';
      const meta=document.createElement('small');
      const source=pair.source==='claim_confirmed'?'Claim-confirmed pairing':'Manual pairing';
      const linked=pair.linkedFrontier?'Frontier linked':'No Frontier account link';
      meta.textContent=`${source} · ${linked} · updated ${date(pair.updatedAt||pair.pairedAt)}`;
      main.append(system,commander,meta);
      if(pair.note){
        const note=document.createElement('small');
        note.className='wolf-architect-note';
        note.textContent=pair.note;
        main.append(note);
      }

      const state=document.createElement('div');
      state.className='wolf-architect-state';
      state.append(claimLabel(pair.claimAlignment));
      if(pair.latestClaim){
        const evidence=document.createElement('small');
        evidence.textContent=pair.latestClaim.claimed
          ? `Latest captured claim: ${pair.latestClaim.commander} · ${date(pair.latestClaim.timestamp)}`
          : `Latest captured event: claim released by ${pair.latestClaim.commander} · ${date(pair.latestClaim.timestamp)}`;
        state.append(evidence);
      }else{
        const evidence=document.createElement('small');
        evidence.textContent='No Frontier claim event captured for this system.';
        state.append(evidence);
      }

      const actions=document.createElement('div');
      actions.className='wolf-architect-actions';
      const edit=document.createElement('button');
      edit.type='button';edit.className='btn btn-secondary btn-compact';
      edit.dataset.architectEdit=pair.system||'';
      edit.textContent='Edit';
      const remove=document.createElement('button');
      remove.type='button';remove.className='btn btn-compact wolf-architect-remove';
      remove.dataset.architectUnpair=pair.system||'';
      remove.textContent='Unpair';
      actions.append(edit,remove);

      row.append(main,state,actions);
      pairsList.append(row);
    });
  }

  function renderClaims(claims){
    claimsList.replaceChildren();
    if(!claims.length){
      const empty=document.createElement('div');
      empty.className='wolf-architect-empty';
      empty.innerHTML='<strong>No system-claim events captured yet.</strong><span>Connected CMDRs can use Sync Activity after claiming or releasing a colonization system.</span>';
      claimsList.append(empty);
      return;
    }

    claims.forEach(claim=>{
      const row=document.createElement('div');
      row.className=`wolf-architect-claim ${claim.claimed?'is-claimed':'is-released'}`;

      const state=document.createElement('div');
      state.append(chip(claim.claimed?'CLAIMED':'RELEASED',claim.claimed?'is-match':'is-released'));

      const main=document.createElement('div');
      const strong=document.createElement('strong');
      strong.textContent=claim.system||'Unknown system';
      const small=document.createElement('small');
      small.textContent=`${claim.commander||'Elite CMDR'} · ${date(claim.timestamp)}${claim.systemAddress?` · address ${claim.systemAddress}`:''}`;
      main.append(strong,small);

      const paired=document.createElement('div');
      paired.className='wolf-architect-claim-pair';
      if(claim.paired){
        const label=document.createElement('span');
        const same=norm(claim.pairedCommander)===norm(claim.commander);
        label.textContent=same?`Paired: ${claim.pairedCommander}`:`Registry: ${claim.pairedCommander}`;
        label.className=same?'is-ok':'is-warning';
        paired.append(label);
      }else if(claim.claimed){
        const use=document.createElement('button');
        use.type='button';use.className='btn btn-secondary btn-compact';
        use.dataset.architectUseClaim=claim.eventId||'';
        use.textContent='Use Claimant';
        paired.append(use);
      }else{
        const label=document.createElement('span');
        label.textContent='No active claim pairing suggested';
        paired.append(label);
      }

      row.append(state,main,paired);
      claimsList.append(row);
    });
  }

  function render(data){
    dataCache=data;
    const summary=data.summary||{};
    setText('[data-architect-paired-count]',Number(summary.pairedSystems||0).toLocaleString());
    setText('[data-architect-claim-count]',Number(summary.activeObservedClaims||0).toLocaleString());
    setText('[data-architect-unpaired-count]',Number(summary.unpairedActiveClaims||0).toLocaleString());
    setText('[data-architect-conflict-count]',Number(summary.claimConflicts||0).toLocaleString());
    renderOptions(data);
    renderPairs(Array.isArray(data.pairs)?data.pairs:[]);
    renderClaims(Array.isArray(data.observedClaims)?data.observedClaims:[]);
  }

  async function load(force=false){
    if(loading)return;
    if(!force&&loadedAt&&Date.now()-loadedAt<FRESH_MS)return;
    loading=true;
    if(refresh)refresh.disabled=true;
    message('Refreshing architect registry…','working');
    try{
      const response=await fetch(API+'?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
      render(data);
      loadedAt=Date.now();
      message(`Checked ${new Date(loadedAt).toLocaleString()} · architect data is informational only`,'success');
    }catch(error){
      console.error('Could not load architect registry',error);
      message('Could not load architect registry. Nothing was changed.','error');
    }finally{
      loading=false;
      if(refresh)refresh.disabled=false;
    }
  }

  function clearForm(){
    if(systemInput)systemInput.value='';
    if(commanderInput)commanderInput.value='';
    if(noteInput)noteInput.value='';
    if(claimEventInput)claimEventInput.value='';
    const submit=form?.querySelector('button[type="submit"]');
    if(submit)submit.textContent='Pair / Update Architect';
  }

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const system=systemInput?.value?.trim()||'';
    const commander=commanderInput?.value?.trim()||'';
    if(!system||!commander){
      message('System and CMDR are required.','error');
      return;
    }
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    message('Saving architect pairing…','working');
    try{
      await mutate({
        action:'pair',
        system,
        commander,
        note:noteInput?.value?.trim()||'',
        claimEventId:claimEventInput?.value||'',
      });
      clearForm();
      loadedAt=0;
      await load(true);
      message('Architect pairing saved. Colonization Job permissions were not changed.','success');
    }catch(error){
      console.error(error);
      message(error.message||'Could not save architect pairing.','error');
    }finally{button.disabled=false;}
  });

  pairsList?.addEventListener('click',async event=>{
    const edit=event.target.closest('[data-architect-edit]');
    if(edit){
      const pair=(dataCache?.pairs||[]).find(item=>norm(item.system)===norm(edit.dataset.architectEdit));
      if(!pair)return;
      systemInput.value=pair.system||'';
      commanderInput.value=pair.commander||'';
      noteInput.value=pair.note||'';
      claimEventInput.value=pair.claimEventId||'';
      const submit=form.querySelector('button[type="submit"]');
      submit.textContent='Update Architect Pairing';
      form.scrollIntoView({behavior:'smooth',block:'nearest'});
      return;
    }

    const remove=event.target.closest('[data-architect-unpair]');
    if(!remove)return;
    const system=remove.dataset.architectUnpair||'';
    if(!system||!window.confirm(`Remove the architect pairing for ${system}? Claim evidence will remain available.`))return;
    remove.disabled=true;
    try{
      await mutate({action:'unpair',system});
      loadedAt=0;
      await load(true);
      message('Architect pairing removed. Claim evidence was preserved.','success');
    }catch(error){
      console.error(error);
      message('Could not remove architect pairing.','error');
      remove.disabled=false;
    }
  });

  claimsList?.addEventListener('click',event=>{
    const button=event.target.closest('[data-architect-use-claim]');
    if(!button)return;
    const claim=(dataCache?.observedClaims||[]).find(item=>String(item.eventId||'')===String(button.dataset.architectUseClaim||''));
    if(!claim||!claim.claimed)return;
    systemInput.value=claim.system||'';
    commanderInput.value=claim.commander||'';
    claimEventInput.value=claim.eventId||'';
    noteInput.value=noteInput.value||'Paired from captured Frontier system-claim evidence.';
    const submit=form.querySelector('button[type="submit"]');
    submit.textContent='Confirm Claimant as Architect';
    message('Claimant loaded into the pairing form. Review it, then save to confirm the architect manually.','success');
    form.scrollIntoView({behavior:'smooth',block:'nearest'});
  });

  panel.querySelector('[data-architect-clear]')?.addEventListener('click',()=>{
    clearForm();
    message('Pairing form cleared.','');
  });
  refresh?.addEventListener('click',()=>load(true));

  panel.addEventListener('toggle',()=>{
    if(!panel.open)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(panel.open)load();}));
  },{passive:true});
})();
