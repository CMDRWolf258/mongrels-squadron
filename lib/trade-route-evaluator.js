import {
  readTradeControl,
  readTradeRoutes,
  tradePriorityProfile,
  writeTradeRoutes,
} from './trade-intelligence.js';
import {
  evaluateSpecificLoop,
  fetchTradeLoopSnapshot,
  normalizeLoopSearch,
  optimizeTradeLoops,
} from './trade-loop-finder.js';
import {
  applyTradeDiscordState,
  sendTradeThresholdAlert,
  syncTradeDiscord,
} from './trade-discord.js';

export const TRADE_ROUTE_EVALUATION_BATCH_SIZE=4;

export async function evaluateManagedTradeRoutes(env,{
  maxRoutes=TRADE_ROUTE_EVALUATION_BATCH_SIZE,
  origin='',
  fetchImpl=fetch,
  now=Date.now(),
}={}) {
  const [control,routes]=await Promise.all([readTradeControl(env),readTradeRoutes(env)]);
  const active=(Array.isArray(routes)?routes:[])
    .filter(route=>route?.status==='active'&&route?.optimizer?.managed&&Array.isArray(route?.legs)&&route.legs.length>=2)
    .map(route=>({route,dueAt:managedRouteDueAt(route,control)}))
    .sort((a,b)=>a.dueAt-b.dueAt);
  const due=active.filter(row=>row.dueAt<=now);
  const selected=due.slice(0,Math.max(1,Math.min(10,Number(maxRoutes)||TRADE_ROUTE_EVALUATION_BATCH_SIZE)));
  if(!selected.length){
    return summary({active:active.length,due:due.length,selected:0,evaluated:[]});
  }

  const snapshots=new Map();
  const evaluated=[];
  for(const row of selected){
    evaluated.push(await evaluateOne(env,row.route,control,{origin,fetchImpl,now,snapshots}));
  }

  let changed=false;
  for(const result of evaluated){
    if(!result.route)continue;
    const index=routes.findIndex(route=>route.id===result.route.id);
    if(index<0)continue;
    routes[index]=result.route;
    changed=true;
  }
  if(changed)await writeTradeRoutes(env,routes);

  return summary({active:active.length,due:due.length,selected:selected.length,evaluated});
}

export function managedRouteDueAt(route,control) {
  const profile=tradePriorityProfile(control,route?.optimizer?.priority||route?.intelligence?.priority);
  const last=Date.parse(route?.optimizer?.lastEvaluatedAt||'');
  if(!Number.isFinite(last))return 0;
  return last+Math.max(5,Number(profile.refreshMinutes)||5)*60000;
}

async function evaluateOne(env,route,control,{origin,fetchImpl,now,snapshots}) {
  const attemptedAt=new Date(now).toISOString();
  let query;
  try{
    query=normalizeLoopSearch({
      ...route.optimizer,
      startSystem:route.optimizer.startSystem||route.originSystem,
      legCount:route.optimizer.legCount||route.legs.length,
      priority:route.optimizer.priority||route.intelligence?.priority,
      limit:10,
    },control);
  }catch(error){
    return{ok:false,id:route.id,error:String(error?.message||error),route};
  }

  const key=JSON.stringify({
    startSystem:query.startSystem.toLowerCase(),
    legCount:query.legCount,
    scope:query.scope,
    radiusLy:query.radiusLy,
    minPad:query.minPad,
    carrierMode:query.carrierMode,
    maxAgeMinutes:query.maxAgeMinutes,
  });
  try{
    if(!snapshots.has(key)){
      snapshots.set(key,fetchTradeLoopSnapshot(query,{fetchImpl,timeoutMs:20000}));
    }
    const snapshot=await snapshots.get(key);
    const current=evaluateSpecificLoop(snapshot.stations,route.legs,query);
    const ranked=optimizeTradeLoops(snapshot.stations,{...query,limit:10});
    const alternative=ranked.find(candidate=>!sameLoop(candidate.legs,route.legs))||null;
    const baseline=Math.max(0,Number(route.optimizer.baselineProfit)||Number(route.estimatedLoopProfit)||0);
    const thresholdDrop=Math.max(5,Math.min(90,Number(route.optimizer.thresholdDropPercent)||25));
    const floor=Math.round(baseline*(1-thresholdDrop/100));
    const previousState=String(route.optimizer.state||'healthy');
    const currentProfit=current.valid?Math.max(0,Math.round(Number(current.loopProfit)||0)):0;
    const state=!current.valid?'unavailable':currentProfit<floor?'degraded':'healthy';

    const updated={
      ...route,
      legs:current.valid?current.legs:route.legs,
      estimatedLoopProfit:currentProfit,
      distanceLy:current.valid?String(current.totalDistanceLy??route.distanceLy??''):route.distanceLy,
      optimizer:{
        ...route.optimizer,
        priority:query.priority,
        currentProfit,
        state,
        lastEvaluatedAt:attemptedAt,
        alternative:alternative&&Number(alternative.loopProfit)>currentProfit?compactAlternative(alternative):null,
      },
      updatedAt:attemptedAt,
      updatedBy:'Trade Loop Finder',
    };
    applyLegacyLegFields(updated);

    const discord=await syncTradeDiscord(env,{route:updated,origin,control});
    applyTradeDiscordState(updated,discord);

    let alert=null;
    const newlyDegraded=previousState==='healthy'&&(state==='degraded'||state==='unavailable');
    if(newlyDegraded){
      const alt=updated.optimizer.alternative;
      const title=state==='unavailable'?'Managed Trade Loop No Longer Complete':'Managed Trade Loop Profit Degraded';
      const message=[
        '**'+String(updated.title||'Managed Trade Loop')+'**',
        'Current loop profit: **'+number(currentProfit)+' Cr**',
        'Alert floor: **'+number(floor)+' Cr** · baseline '+number(baseline)+' Cr',
        state==='unavailable'?'One or more legs no longer have a current profitable supply/demand match.':'The loop has fallen below its configured '+thresholdDrop+'% drop threshold.',
        alt?'\n**Better matching loop available:** '+number(alt.loopProfit)+' Cr / loop\n'+alternativeSummary(alt):'',
      ].filter(Boolean).join('\n');
      alert=await sendTradeThresholdAlert(env,{route:updated,title,message,origin,control});
      if(alert?.ok&&alert?.attempted){
        updated.optimizer.lastAlertAt=new Date(now).toISOString();
      }
    }

    return{
      ok:true,
      id:route.id,
      currentProfit,
      state,
      floor,
      alternativeProfit:Number(updated.optimizer.alternative?.loopProfit)||0,
      discord:discord?.mode||'',
      alert:alert?.mode||'',
      route:updated,
    };
  }catch(error){
    const failed={
      ...route,
      optimizer:{...route.optimizer,lastEvaluatedAt:attemptedAt},
    };
    return{ok:false,id:route.id,error:friendly(error),route:failed};
  }
}

function compactAlternative(route) {
  return{
    loopProfit:Math.max(0,Math.round(Number(route.loopProfit)||0)),
    totalDistanceLy:finite(route.totalDistanceLy),
    observedAt:String(route.observedAt||''),
    legs:(route.legs||[]).slice(0,3).map(leg=>({...leg})),
  };
}

function applyLegacyLegFields(route) {
  const legs=Array.isArray(route.legs)?route.legs:[];
  const first=legs[0];
  if(!first)return route;
  route.commodity=[...new Set(legs.map(leg=>leg.commodity).filter(Boolean))].join(' / ').slice(0,100);
  route.originSystem=first.sourceSystem||route.originSystem||'';
  route.originStation=first.sourceStation||route.originStation||'';
  route.destinationSystem=first.destinationSystem||route.destinationSystem||'';
  route.destinationStation=first.destinationStation||route.destinationStation||'';
  route.profitPerTon=Number(first.profitPerTon)||0;
  route.quantity=String(first.quantity||'');
  if(legs.length===2){
    route.returnCommodity=legs[1].commodity||'';
    route.returnProfitPerTon=Number(legs[1].profitPerTon)||0;
    route.returnQuantity=String(legs[1].quantity||'');
  }else{
    route.returnCommodity='';
    route.returnProfitPerTon=0;
    route.returnQuantity='';
  }
  return route;
}

function sameLoop(a,b) {
  const left=Array.isArray(a)?a:[];
  const right=Array.isArray(b)?b:[];
  if(left.length!==right.length)return false;
  return left.every((leg,index)=>{
    const other=right[index]||{};
    return String(leg.sourceMarketId||'')===String(other.sourceMarketId||'')
      &&String(leg.destinationMarketId||'')===String(other.destinationMarketId||'')
      &&normalize(leg.commodity)===normalize(other.commodity);
  });
}

function alternativeSummary(route) {
  return(route.legs||[]).map((leg,index)=>
    'Leg '+(index+1)+': '+String(leg.commodity||'Cargo')+' · '+String(leg.sourceStation||'?')+' → '+String(leg.destinationStation||'?')
  ).join('\n');
}

function summary({active,due,selected,evaluated}) {
  return{
    ok:true,
    active,
    due,
    selected,
    succeeded:evaluated.filter(row=>row.ok).length,
    failed:evaluated.filter(row=>!row.ok).length,
    results:evaluated.map(row=>({
      id:row.id,
      ok:row.ok,
      currentProfit:row.currentProfit??null,
      state:row.state||'',
      floor:row.floor??null,
      alternativeProfit:row.alternativeProfit??0,
      discord:row.discord||'',
      alert:row.alert||'',
      error:row.error||'',
    })),
  };
}

function friendly(error){
  const code=String(error?.message||error||'managed_route_evaluation_failed').split(':')[0];
  if(code==='loop_source_timeout')return'Live route market source timed out.';
  if(code.startsWith('loop_source_http_')||code==='loop_source_invalid_response')return'Live route market source was unavailable.';
  return code;
}
function number(value){return Math.max(0,Math.round(Number(value)||0)).toLocaleString();}
function normalize(value){return String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function finite(value){const n=Number(value);return Number.isFinite(n)?Math.round(n*100)/100:null;}
