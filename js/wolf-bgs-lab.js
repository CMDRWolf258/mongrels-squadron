(() => {
  const KEY = 'wolf-bgs-lab-mandalore-v1';
  const CONFLICT_KEY = 'wolf-bgs-lab-mandalore-conflicts-v1';
  const MONGREL = 'Regiment of Imperial Mongrels';
  const card = document.querySelector('[data-bgs-lab="true"]');
  if (!card) return;

  const norm = value => String(value || '').trim().toLowerCase();
  const factionRows = () => [...card.querySelectorAll('[data-faction-row]')];

  const presets = {
    balanced:{ influence:[45,20,12,9,6,5,3], state:['','','','','','',''], priority:'normal', min:40, max:55, controller:MONGREL },
    dual:{ influence:[40,40,8,8,2,1,1], state:['War','War','Election','Election','','',''], priority:'high', min:35, max:50, controller:MONGREL },
    fourway:{ influence:[30,28.5,18,16.5,3,2,2], state:['War','War','War','War','','',''], priority:'high', min:20, max:40, controller:MONGREL },
    ambiguous:{ influence:[24,24,24,24,2,1,1], state:['War','War','War','War','','',''], priority:'high', min:20, max:40, controller:MONGREL },
    pressure:{ influence:[54.5,18,10,7,5,3,2.5], state:['','','','','','',''], priority:'normal', min:40, max:55, controller:MONGREL },
  };

  function readSaved(){
    try { return JSON.parse(localStorage.getItem(KEY)||'null') || null; }
    catch { return null; }
  }

  function snapshot(){
    return {
      settings:{
        priority:card.querySelector('[data-setting="priority"]')?.value||'normal',
        targetMin:card.querySelector('[data-setting="targetMin"]')?.value||'',
        targetMax:card.querySelector('[data-setting="targetMax"]')?.value||'',
        controller:card.querySelector('[data-status="controller"]')?.value||'',
      },
      board:factionRows().map(row=>({
        id:row.dataset.labId||'',
        influence:row.querySelector('[data-faction="influence"]')?.value||'',
        state:row.querySelector('[data-faction="state"]')?.value||'',
        pending:row.querySelector('[data-faction="pending"]')?.value||'',
        recovering:row.querySelector('[data-faction="recovering"]')?.value||'',
      })),
      strategy:[...card.querySelectorAll('[data-faction-strategy-row]')].map(row=>({
        faction:row.dataset.factionName||'',
        intent:row.querySelector('[data-faction-strategy="intent"]')?.value||'flexible',
        targetMin:row.querySelector('[data-faction-strategy="targetMin"]')?.value||'',
        targetMax:row.querySelector('[data-faction-strategy="targetMax"]')?.value||'',
        controlObjective:row.querySelector('[data-faction-strategy="controlObjective"]')?.value||'none',
      })),
      sliders:[...card.querySelectorAll('[data-slider-objective-row]')].map(row=>({
        faction:row.dataset.factionName||'',
        economy:row.querySelector('[data-slider-objective="economyObjective"]')?.value||'ignore',
        security:row.querySelector('[data-slider-objective="securityObjective"]')?.value||'ignore',
      })),
      calibration:Object.fromEntries(['bountyPercentAdjustment','bountyFlatInfAdjustment','tradePercentAdjustment','tradeFlatInfAdjustment'].map(key=>[key,card.querySelector(`[data-calibration="${key}"]`)?.value||'0'])),
    };
  }

  function save(){
    localStorage.setItem(KEY,JSON.stringify(snapshot()));
    const status=document.querySelector('[data-lab-save-status]');
    if(status)status.textContent=`Sandbox saved locally · ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
  }

  function setValue(el,value,fire=false){
    if(!el||value===undefined||value===null)return;
    el.value=String(value);
    if(fire)el.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function applySaved(saved,{fire=false}={}){
    if(!saved)return;
    setValue(card.querySelector('[data-setting="priority"]'),saved.settings?.priority,fire);
    setValue(card.querySelector('[data-setting="targetMin"]'),saved.settings?.targetMin,fire);
    setValue(card.querySelector('[data-setting="targetMax"]'),saved.settings?.targetMax,fire);
    setValue(card.querySelector('[data-status="controller"]'),saved.settings?.controller,fire);
    for(const item of saved.board||[]){
      const row=factionRows().find(candidate=>candidate.dataset.labId===item.id);if(!row)continue;
      setValue(row.querySelector('[data-faction="influence"]'),item.influence,fire);
      setValue(row.querySelector('[data-faction="state"]'),item.state,fire);
      setValue(row.querySelector('[data-faction="pending"]'),item.pending,fire);
      setValue(row.querySelector('[data-faction="recovering"]'),item.recovering,fire);
    }
    for(const item of saved.strategy||[]){
      const row=[...card.querySelectorAll('[data-faction-strategy-row]')].find(candidate=>norm(candidate.dataset.factionName)===norm(item.faction));if(!row)continue;
      setValue(row.querySelector('[data-faction-strategy="intent"]'),item.intent,fire);
      const min=row.querySelector('[data-faction-strategy="targetMin"]'),max=row.querySelector('[data-faction-strategy="targetMax"]');
      if(min&&!min.disabled)setValue(min,item.targetMin,fire); if(max&&!max.disabled)setValue(max,item.targetMax,fire);
      setValue(row.querySelector('[data-faction-strategy="controlObjective"]'),item.controlObjective,fire);
    }
    for(const item of saved.sliders||[]){
      const row=[...card.querySelectorAll('[data-slider-objective-row]')].find(candidate=>norm(candidate.dataset.factionName)===norm(item.faction));if(!row)continue;
      setValue(row.querySelector('[data-slider-objective="economyObjective"]'),item.economy,fire);
      setValue(row.querySelector('[data-slider-objective="securityObjective"]'),item.security,fire);
    }
    for(const [key,value] of Object.entries(saved.calibration||{}))setValue(card.querySelector(`[data-calibration="${key}"]`),value,fire);
  }

  function resetGeneratedControls({fire=true}={}){
    card.querySelectorAll('[data-faction-strategy-row]').forEach(row=>{
      setValue(row.querySelector('[data-faction-strategy="intent"]'),'flexible',fire);
      const min=row.querySelector('[data-faction-strategy="targetMin"]'),max=row.querySelector('[data-faction-strategy="targetMax"]');
      if(min&&!min.disabled)setValue(min,'',fire);if(max&&!max.disabled)setValue(max,'',fire);
      setValue(row.querySelector('[data-faction-strategy="controlObjective"]'),'none',fire);
    });
    card.querySelectorAll('[data-slider-objective-row]').forEach(row=>{setValue(row.querySelector('[data-slider-objective="economyObjective"]'),'ignore',fire);setValue(row.querySelector('[data-slider-objective="securityObjective"]'),'ignore',fire);});
    for(const key of ['bountyPercentAdjustment','bountyFlatInfAdjustment','tradePercentAdjustment','tradeFlatInfAdjustment'])setValue(card.querySelector(`[data-calibration="${key}"]`),'0',fire);
  }

  function resetConflictPairing(){
    localStorage.removeItem(CONFLICT_KEY);
    card.querySelectorAll('[data-conflict-pair-row]').forEach(row=>{
      delete row.dataset.autoPair;
      setValue(row.querySelector('[data-conflict="factionA"]'),'',false);
      setValue(row.querySelector('[data-conflict="factionB"]'),'',false);
      setValue(row.querySelector('[data-conflict="objective"]'),'monitor',false);
    });
  }

  function applyPreset(name){
    const preset=presets[name]||presets.balanced;
    factionRows().forEach((row,index)=>{
      setValue(row.querySelector('[data-faction="influence"]'),preset.influence[index]??0,true);
      setValue(row.querySelector('[data-faction="state"]'),preset.state[index]||'',true);
      setValue(row.querySelector('[data-faction="pending"]'),'',true);
      setValue(row.querySelector('[data-faction="recovering"]'),'',true);
    });
    setValue(card.querySelector('[data-setting="priority"]'),preset.priority,true);
    setValue(card.querySelector('[data-setting="targetMin"]'),preset.min,true);
    setValue(card.querySelector('[data-setting="targetMax"]'),preset.max,true);
    setValue(card.querySelector('[data-status="controller"]'),preset.controller,true);
    resetGeneratedControls({fire:true});
    resetConflictPairing();
    if(name==='pressure'){
      const mongrelSlider=[...card.querySelectorAll('[data-slider-objective-row]')].find(row=>norm(row.dataset.factionName)===norm(MONGREL));
      if(mongrelSlider){setValue(mongrelSlider.querySelector('[data-slider-objective="economyObjective"]'),'raise',true);setValue(mongrelSlider.querySelector('[data-slider-objective="securityObjective"]'),'raise',true);}
      const alpha=[...card.querySelectorAll('[data-faction-strategy-row]')].find(row=>norm(row.dataset.factionName)===norm('Mandalore Alpha'));
      if(alpha){setValue(alpha.querySelector('[data-faction-strategy="intent"]'),'support',true);setValue(alpha.querySelector('[data-faction-strategy="targetMin"]'),'15',true);setValue(alpha.querySelector('[data-faction-strategy="targetMax"]'),'25',true);}
    }
    save();
    setTimeout(()=>card.querySelector('[data-faction="influence"]')?.dispatchEvent(new Event('change',{bubbles:true})),0);
  }

  function intercept(event){
    const control=event.target.closest('[data-save-faction-strategy],[data-reset-faction-strategy],[data-save-slider-objectives],[data-reset-slider-objectives],[data-save-calibration],[data-reset-calibration]');
    if(!control)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(control.matches('[data-reset-faction-strategy]'))resetGeneratedControls({fire:true});
    else if(control.matches('[data-reset-slider-objectives]'))card.querySelectorAll('[data-slider-objective-row]').forEach(row=>{setValue(row.querySelector('[data-slider-objective="economyObjective"]'),'ignore',true);setValue(row.querySelector('[data-slider-objective="securityObjective"]'),'ignore',true);});
    else if(control.matches('[data-reset-calibration]'))for(const key of ['bountyPercentAdjustment','bountyFlatInfAdjustment','tradePercentAdjustment','tradeFlatInfAdjustment'])setValue(card.querySelector(`[data-calibration="${key}"]`),'0',true);
    save();
    const message=control.closest('.wolf-section')?.querySelector('[data-faction-strategy-message],[data-slider-objectives-message],[data-calibration-message]');
    if(message)message.textContent='Mandalore sandbox values saved locally only.';
  }

  function decorate(){
    card.querySelectorAll('[data-save-faction-strategy],[data-save-slider-objectives],[data-save-calibration]').forEach(button=>{button.textContent=button.matches('[data-save-calibration]')?'Save Lab Calibration':'Save Lab Settings';});
    card.querySelectorAll('[data-faction-strategy-message],[data-slider-objectives-message],[data-calibration-message]').forEach(message=>{if(!/locally/i.test(message.textContent||''))message.textContent='Mandalore sandbox · changes auto-save locally and never update live BGS settings.';});
    card.querySelectorAll('.wolf-screenshot-import,[data-screenshot-import],[data-wolf-screenshot]').forEach(el=>el.remove());
    const ambiguousButton=document.querySelector('[data-lab-scenario="ambiguous"]');
    if(ambiguousButton){
      ambiguousButton.textContent='4-Way Ambiguous';
      if(!document.querySelector('[data-lab-scenario="fourway"]'))ambiguousButton.insertAdjacentHTML('beforebegin','<button type="button" class="btn btn-secondary btn-compact" data-lab-scenario="fourway">4-Way Auto Pair</button>');
    }
  }

  card.addEventListener('click',intercept,true);
  card.addEventListener('change',()=>setTimeout(save,0));
  document.querySelector('[data-lab-reset]')?.addEventListener('click',()=>{localStorage.removeItem(KEY);localStorage.removeItem(CONFLICT_KEY);applyPreset('balanced');});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-lab-scenario]');if(button)applyPreset(button.dataset.labScenario);});

  const saved=readSaved();
  if(saved)applySaved(saved,{fire:false});
  else applyPreset('balanced');

  let applying=false;
  const observer=new MutationObserver(()=>{
    if(applying)return;applying=true;
    setTimeout(()=>{applySaved(readSaved(),{fire:false});decorate();applying=false;},0);
  });
  observer.observe(card,{childList:true,subtree:true});
  decorate();
  setTimeout(()=>{applySaved(readSaved(),{fire:true});decorate();},250);
  setTimeout(()=>{applySaved(readSaved(),{fire:true});decorate();},700);
})();