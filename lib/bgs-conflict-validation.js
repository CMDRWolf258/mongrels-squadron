const CONFLICT_TYPES=new Map([
  ['war','War'],
  ['civilwar','Civil War'],
  ['civil war','Civil War'],
  ['election','Election'],
]);

export function conflictTypeName(value){
  const key=norm(value).replaceAll('_',' ');
  return CONFLICT_TYPES.get(key)||'';
}

export function validatedConflictRows({factions=[],conflicts=[],phase='active'}={}){
  const wanted=phase==='pending'?'pending':'active';
  const rows=[
    ...explicitConflictRows(conflicts,wanted),
    ...pairedFactionStateRows(factions,wanted),
  ];
  const seen=new Set();
  return rows.filter(row=>{
    const key=norm(row?.name)+'::'+norm(row?.detail);
    if(!row?.name||!row?.detail||seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

export function validatedConflictObservation(snapshot){
  const factions=Array.isArray(snapshot?.factions)?snapshot.factions:[];
  const conflicts=Array.isArray(snapshot?.conflicts)?snapshot.conflicts:[];
  const pending=validatedConflictRows({factions,conflicts,phase:'pending'});
  if(pending.length>=2)return{phase:'pending',detail:pending[0].detail};
  const active=validatedConflictRows({factions,conflicts,phase:'active'});
  if(active.length>=2)return{phase:'active',detail:active[0].detail};
  return null;
}

function pairedFactionStateRows(factions,phase){
  const groups=new Map();
  for(const faction of Array.isArray(factions)?factions:[]){
    const name=clean(faction?.name);
    if(!name)continue;
    const states=stateValues(faction,phase);
    const types=[...new Set(states.map(conflictTypeName).filter(Boolean))];
    for(const detail of types){
      if(!groups.has(detail))groups.set(detail,new Map());
      groups.get(detail).set(norm(name),{name,detail,source:'paired-faction-state'});
    }
  }
  const rows=[];
  for(const group of groups.values()){
    if(group.size<2)continue;
    rows.push(...group.values());
  }
  return rows;
}

function explicitConflictRows(conflicts,phase){
  const rows=[];
  for(const conflict of Array.isArray(conflicts)?conflicts:[]){
    const detail=conflictTypeName(conflict?.type||conflict?.warType);
    if(!detail)continue;
    const recordPhase=explicitPhase(conflict?.status);
    if(recordPhase!==phase)continue;
    const one=conflictPartyName(conflict?.faction1)||clean(conflict?.faction);
    const two=conflictPartyName(conflict?.faction2)||clean(conflict?.opponentFaction);
    if(!one||!two||norm(one)===norm(two))continue;
    rows.push(
      {name:one,detail,source:'explicit-conflict'},
      {name:two,detail,source:'explicit-conflict'},
    );
  }
  return rows;
}

function explicitPhase(status){
  const value=norm(status).replaceAll('_',' ');
  if(value.includes('pending'))return'pending';
  if(
    value.includes('complete')
    ||value.includes('concluded')
    ||value.includes('resolved')
    ||value.includes('finished')
    ||value.includes('ended')
  )return'none';
  return'active';
}

function conflictPartyName(value){
  if(!value)return'';
  if(typeof value==='string')return clean(value);
  return clean(value?.name||value?.Name);
}

function stateValues(faction,phase){
  const arrayKey=phase==='pending'?'pendingStates':'activeStates';
  const textKey=phase==='pending'?'pending':'state';
  const direct=Array.isArray(faction?.[arrayKey])?faction[arrayKey].map(clean).filter(Boolean):[];
  if(direct.length)return direct;
  return clean(faction?.[textKey])
    .split(',')
    .map(clean)
    .filter(Boolean)
    .filter(value=>norm(value)!=='none');
}

function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
