import {
  createFactionAlertsDiscordMessage,
  deleteFactionAlertsDiscordMessage,
  deleteOperationsDiscordMessage,
  discordFactionAlertsConfigured,
  discordFactionAlertsWebhookId,
  discordOperationsWebhookId,
  editFactionAlertsDiscordMessage,
} from './discord-webhook.js';
import { readDailyOrderTimingControl, resolveSystemWorkCycle } from './daily-order-cycle.js';

const MONGREL='Regiment of Imperial Mongrels';
const STATE_KEY='discord-bgs-alerts-v1';
const SCOUT_SNAPSHOTS_KEY='wolf-bgs-scout-snapshots-v1';
const CONFLICT_STATES=new Set(['war','civil war','election']);
const OPPORTUNITY_STATES=new Map([
  ['boom',{label:'Boom',category:'TRADE'}],
  ['bust',{label:'Bust',category:'TRADE'}],
  ['civil liberty',{label:'Civil Liberty',category:'SPECIAL'}],
  ['civil unrest',{label:'Civil Unrest',category:'COMBAT'}],
  ['pirate attack',{label:'Pirate Attack',category:'COMBAT'}],
  ['terrorist attack',{label:'Terrorist Attack',category:'COMBAT'}],
  ['lockdown',{label:'Lockdown',category:'COMBAT'}],
  ['public holiday',{label:'Public Holiday',category:'TRADE'}],
  ['investment',{label:'Investment',category:'TRADE'}],
  ['famine',{label:'Famine',category:'TRADE'}],
  ['outbreak',{label:'Outbreak',category:'TRADE'}],
  ['infrastructure failure',{label:'Infrastructure Failure',category:'TRADE'}],
  ['natural disaster',{label:'Natural Disaster',category:'TRADE'}],
  ['drought',{label:'Drought',category:'TRADE'}],
  ['blight',{label:'Blight',category:'TRADE'}],
]);
const COLORS={
  summary:0x22d3ee,
  retreat:0xef4444,
  conflict:0xf59e0b,
  resolved:0x22c55e,
};

export async function loadBgsDiscordView(request,env){
  const [live,boards,scouts,timingControl]=await Promise.all([
    fetchJson(new URL('/data/live-bgs.json',request.url)),
    fetchJson(new URL('/data/live-bgs-boards.json',request.url)),
    readScoutSnapshots(env),
    readDailyOrderTimingControl(env),
  ]);
  return buildBgsDiscordView({live,boards,scouts,timingControl,now:new Date()});
}

export function buildBgsDiscordView({live={},boards={},scouts={},timingControl={},now=new Date()}={}){
  const activeSystems=systemRows(live?.systems)
    .filter(row=>row?.name&&row.present!==false&&row.formerPresence!==true);
  const boardMap=new Map(systemRows(boards?.systems).map(row=>[norm(row?.name),row]));
  const scoutMap=new Map(Object.values(scouts?.systems&&typeof scouts.systems==='object'?scouts.systems:{})
    .filter(row=>row?.system)
    .map(row=>[norm(row.system),row]));

  const systems=activeSystems.map(presence=>{
    const board=boardMap.get(norm(presence.name))||null;
    const scout=scoutMap.get(norm(presence.name))||null;
    const externalMongrel=(Array.isArray(board?.factions)?board.factions:[]).find(row=>norm(row?.name)===norm(MONGREL))||null;
    const scoutMongrel=(Array.isArray(scout?.factions)?scout.factions:[]).find(row=>norm(row?.name)===norm(MONGREL))||null;
    const externalAt=iso(externalMongrel?.updatedAt||board?.updatedAt||presence?.sourceUpdated);
    const scoutAt=iso(scout?.updatedAt);
    const useScout=Boolean(scoutMongrel&&scoutAt&&(!externalAt||Date.parse(scoutAt)>=Date.parse(externalAt)));
    const source=useScout?scoutMongrel:(externalMongrel||presence);
    const sourceAt=useScout?scoutAt:externalAt;
    const active=stateList(source?.activeStates,source?.state);
    const pending=stateList(source?.pendingStates);
    const conflict=selectConflictDetail({board,scout,useScout,sourceAt});
    const cycle=resolveSystemWorkCycle(clean(presence.name),timingControl||{},{now});
    const dataFresh=isCurrentCycleSnapshot(sourceAt,cycle);
    return{
      system:clean(presence.name),
      activeStates:active,
      pendingStates:pending,
      source:useScout?'Live Scout':'BGS snapshot',
      sourceAt,
      dataFresh,
      dataCondition:dataFresh?'current':'stale',
      freshnessCycle:cycle,
      conflict,
    };
  }).filter(row=>row.system);

  const actions=[];
  const opportunities=[];
  for(const row of systems){
    const retreat=conditionForRetreat(row);
    if(retreat)actions.push(retreat);
    const conflict=conditionForConflict(row);
    if(conflict)actions.push(conflict);

    const states=opportunityStates(row);
    if(states.length)opportunities.push({
      system:row.system,
      states,
      source:row.source,
      sourceAt:row.sourceAt,
      dataFresh:row.dataFresh,
      dataCondition:row.dataCondition,
      freshnessCycle:row.freshnessCycle,
    });
  }

  actions.sort(actionSort);
  opportunities.sort((a,b)=>opportunityRank(a)-opportunityRank(b)||a.system.localeCompare(b.system));
  return{
    generatedAt:new Date().toISOString(),
    actions,
    opportunities,
    systems:systems.length,
  };
}

export async function syncBgsDiscordBoard(env,{
  view,
  missionControlUrl='',
  createMissing=false,
}={}){
  if(!discordFactionAlertsConfigured(env))return boardResult({configured:false});
  if(!storageReady(env))return boardResult({configured:true,error:'discord_state_storage_not_configured'});
  if(!view||!Array.isArray(view.actions)||!Array.isArray(view.opportunities)){
    return boardResult({configured:true,error:'bgs_discord_view_missing'});
  }

  const state=await readState(env);
  const webhookId=discordFactionAlertsWebhookId(env);
  if(createMissing){
    await migrateLegacyOperationsTracking(env,state,webhookId);
  }
  const summary=await syncBgsSummaryDiscord(env,{
    state,view,missionControlUrl,createMissing,
  });

  const boardSeededHere=Boolean(state.summary?.messageId&&state.summary.webhookId===webhookId);
  const allowCreate=createMissing||boardSeededHere;
  const currentKeys=new Set();
  const results=[];

  for(const action of view.actions){
    const key=actionKey(action);
    currentKeys.add(key);
    results.push(await syncActionCard(env,{
      state,
      action,
      missionControlUrl,
      createMissing:allowCreate,
    }));
  }

  for(const [key,tracked] of Object.entries(state.actionCards||{})){
    if(!tracked?.messageId||tracked.webhookId!==webhookId||currentKeys.has(key))continue;
    if(tracked.phase==='resolved'){
      results.push(await deleteActionCard(env,state,key,tracked,'resolved_cleanup'));
    }else{
      results.push(await showActionResolved(env,{state,key,tracked,missionControlUrl}));
    }
  }

  return boardResult({configured:true,summary,results,view});
}

export async function syncBgsSummaryDiscord(env,{
  state=null,
  view,
  missionControlUrl='',
  createMissing=false,
}={}){
  if(!discordFactionAlertsConfigured(env))return summaryResult({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return summaryResult({configured:true,attempted:false,ok:false,mode:'tracking_unavailable'});
  const working=state||await readState(env);
  const webhookId=discordFactionAlertsWebhookId(env);
  const tracked=working.summary;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return summaryResult({configured:true,attempted:false,ok:true,mode:'not_tracked'});
  }

  const payload=buildBgsSummaryDiscordPayload(view,{missionControlUrl});
  const fingerprint=payloadFingerprint(payload);
  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint){
    return summaryResult({configured:true,attempted:false,ok:true,mode:'unchanged',messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editFactionAlertsDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createFactionAlertsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createFactionAlertsDiscordMessage(env,payload);
      mode='created';
    }
    working.summary={
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      lastSyncedAt:new Date().toISOString(),
      lastMode:mode,
    };
    await writeState(env,working);
    return summaryResult({configured:true,attempted:true,ok:true,mode,messageId:working.summary.messageId});
  }catch(error){
    console.error('Could not sync BGS Alerts summary to Discord',error);
    return summaryResult({
      configured:true,attempted:true,ok:false,mode:'failed',
      error:clean(error?.message)||'discord_bgs_summary_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export function buildBgsSummaryDiscordPayload(view,{missionControlUrl=''}={}){
  const link=clean(missionControlUrl);
  const actions=Array.isArray(view?.actions)?view.actions:[];
  const opportunities=Array.isArray(view?.opportunities)?view.opportunities:[];
  const fields=[
    {
      name:'Action Required',
      value:actions.length
        ? actions.map(action=>actionSummaryLine(action)).join('\n').slice(0,1000)
        : 'No current Retreat or conflict alerts.',
      inline:false,
    },
  ];

  const opportunityLines=opportunities.map(row=>opportunitySummaryLine(row));
  if(opportunityLines.length){
    const shown=opportunityLines.slice(0,40);
    const chunks=chunkLines(shown,900);
    for(const [index,chunk] of chunks.entries()){
      fields.push({
        name:index===0?'Trade / Combat Opportunities':'Trade / Combat Opportunities · continued',
        value:chunk.join('\n'),
        inline:false,
      });
    }
    if(opportunityLines.length>shown.length){
      fields.push({
        name:'More Opportunities',
        value:'+'+(opportunityLines.length-shown.length)+' additional systems are currently in tracked opportunity states. Open Mission Control for the full BGS picture.',
        inline:false,
      });
    }
  }else{
    fields.push({
      name:'Trade / Combat Opportunities',
      value:'No tracked opportunity states are currently active or pending.',
      inline:false,
    });
  }

  return{
    username:'Mongrel Mission Control',
    embeds:[{
      title:'Faction Alerts & Opportunities',
      ...(link?{url:link}:{}),
      description:[
        'Retreats and conflicts are operational alerts. Interesting economic/security states are collected here as a silent opportunity board rather than posted as individual alerts.',
        link?'[Open Mission Control →]('+link+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS.summary,
      fields:fields.slice(0,25),
      footer:{text:'Regiment of Imperial Mongrels · persistent faction-state summary · mentions disabled'},
    }],
  };
}

export function buildBgsActionDiscordPayload(action,{missionControlUrl='',resolved=false,tracked=null}={}){
  const family=clean(action?.family||tracked?.family);
  const system=clean(action?.system||tracked?.system)||'Unknown system';
  const link=systemMissionControlUrl(missionControlUrl,system);
  const detail=clean(action?.detail||tracked?.detail)||(family==='retreat'?'Retreat':'Conflict');
  const phase=resolved?'RESOLVED':clean(action?.phase).toUpperCase();
  const fields=[
    {name:'System',value:truncate(system,120),inline:true},
    {name:'Status',value:phase||'ACTIVE',inline:true},
    {name:'Condition',value:truncate(detail,120),inline:true},
  ];
  const stale=!resolved&&action?.dataFresh===false;
  if(stale){
    fields.push({
      name:'⚠️ DATA FRESHNESS',
      value:'**STALE DATA · SCOUTING NEEDED**\nThis state was observed outside the system’s current BGS cycle and should be verified with Live Scout before acting on it.'
        +(action?.sourceAt?'\nLast state observation: '+discordTime(action.sourceAt):''),
      inline:false,
    });
  }
  const opponent=clean(action?.opponent||tracked?.opponent);
  if(opponent)fields.push({name:'Opponent',value:truncate(opponent,120),inline:false});
  if(action?.score&&!resolved){
    fields.push({
      name:'Conflict Score',
      value:String(Number(action.score.ours)||0)+' – '+String(Number(action.score.theirs)||0)
        +(action.score.status?' · '+truncate(action.score.status,80):''),
      inline:false,
    });
  }

  const titlePrefix=resolved?'✓ RESOLVED · ':(family==='retreat'?'RETREAT · ':'CONFLICT · ');
  const description=resolved
    ? 'This faction alert has cleared. The card will leave this channel on the next Faction Alerts refresh.'
    : (stale
      ? '**⚠️ STALE STATE DATA — LIVE SCOUT VERIFICATION NEEDED.**\n\n'
      : '')
      +(family==='retreat'
        ? 'Mongrel Retreat condition detected. Open Mission Control to review the current system state before applying BGS work.'
        : 'Mongrel conflict detected. Open Mission Control to review the affected system, current state data, and squad orders.');

  return{
    username:'Mongrel Mission Control',
    embeds:[{
      title:titlePrefix+truncate(system,160),
      ...(link?{url:link}:{}),
      description:[description,link?'[Open Mission Control →]('+link+')':''].filter(Boolean).join('\n\n'),
      color:resolved?COLORS.resolved:(COLORS[family]||COLORS.conflict),
      fields,
      footer:{text:'Regiment of Imperial Mongrels · faction operational alert'},
    }],
  };
}

async function syncActionCard(env,{
  state,
  action,
  missionControlUrl='',
  createMissing=false,
}={}){
  const key=actionKey(action);
  const webhookId=discordFactionAlertsWebhookId(env);
  const tracked=state.actionCards[key]||null;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return cardResult({configured:true,attempted:false,ok:true,mode:'not_tracked',system:action.system,family:action.family});
  }

  const payload=buildBgsActionDiscordPayload(action,{missionControlUrl,tracked});
  const fingerprint=payloadFingerprint(payload);
  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint&&tracked.phase==='operational'){
    return cardResult({configured:true,attempted:false,ok:true,mode:'unchanged',system:action.system,family:action.family,messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editFactionAlertsDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createFactionAlertsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createFactionAlertsDiscordMessage(env,payload);
      mode='created';
    }
    state.actionCards[key]={
      system:clean(action.system),
      family:clean(action.family),
      detail:clean(action.detail),
      opponent:clean(action.opponent),
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      phase:'operational',
      lastConditionPhase:clean(action.phase),
      lastSyncedAt:new Date().toISOString(),
      lastMode:mode,
    };
    await writeState(env,state);
    return cardResult({configured:true,attempted:true,ok:true,mode,system:action.system,family:action.family,messageId:state.actionCards[key].messageId});
  }catch(error){
    console.error('Could not sync BGS action card to Discord',action?.system,action?.family,error);
    return cardResult({
      configured:true,attempted:true,ok:false,mode:'failed',system:action?.system,family:action?.family,
      error:clean(error?.message)||'discord_bgs_action_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

async function showActionResolved(env,{state,key,tracked,missionControlUrl=''}={}){
  const payload=buildBgsActionDiscordPayload(null,{missionControlUrl,resolved:true,tracked});
  const fingerprint=payloadFingerprint(payload);
  try{
    const sent=await editFactionAlertsDiscordMessage(env,tracked.messageId,payload);
    state.actionCards[key]={
      ...tracked,
      messageId:clean(sent.messageId)||tracked.messageId,
      fingerprint,
      phase:'resolved',
      lastSyncedAt:new Date().toISOString(),
      lastMode:'resolved_shown',
    };
    await writeState(env,state);
    return cardResult({configured:true,attempted:true,ok:true,mode:'resolved_shown',system:tracked.system,family:tracked.family,messageId:tracked.messageId});
  }catch(error){
    if(Number(error?.status)===404){
      delete state.actionCards[key];
      await writeState(env,state);
      return cardResult({configured:true,attempted:true,ok:true,mode:'message_missing',system:tracked.system,family:tracked.family});
    }
    console.error('Could not show BGS alert resolution in Discord',tracked?.system,tracked?.family,error);
    return cardResult({configured:true,attempted:true,ok:false,mode:'failed',system:tracked?.system,family:tracked?.family,error:clean(error?.message)||'discord_bgs_resolution_failed'});
  }
}

async function deleteActionCard(env,state,key,tracked,reason){
  try{
    await deleteFactionAlertsDiscordMessage(env,tracked.messageId);
    delete state.actionCards[key];
    await writeState(env,state);
    return cardResult({configured:true,attempted:true,ok:true,mode:'deleted',system:tracked.system,family:tracked.family,reason});
  }catch(error){
    if(Number(error?.status)===404){
      delete state.actionCards[key];
      await writeState(env,state);
      return cardResult({configured:true,attempted:true,ok:true,mode:'message_missing',system:tracked.system,family:tracked.family,reason});
    }
    console.error('Could not delete resolved BGS alert card from Discord',tracked?.system,tracked?.family,error);
    return cardResult({configured:true,attempted:true,ok:false,mode:'failed',system:tracked?.system,family:tracked?.family,reason,error:clean(error?.message)||'discord_bgs_delete_failed'});
  }
}

function conditionForRetreat(row){
  const pending=findState(row.pendingStates,'retreat');
  const active=findState(row.activeStates,'retreat');
  const detail=pending||active;
  if(!detail)return null;
  return{
    system:row.system,
    family:'retreat',
    detail:'Retreat',
    phase:pending?'pending':'active',
    source:row.source,
    sourceAt:row.sourceAt,
    dataFresh:row.dataFresh,
    dataCondition:row.dataCondition,
    freshnessCycle:row.freshnessCycle,
  };
}
function conditionForConflict(row){
  const pending=findConflict(row.pendingStates);
  const active=findConflict(row.activeStates);
  const detail=pending||active;
  if(!detail)return null;
  const conflict=row.conflict||null;
  return{
    system:row.system,
    family:'conflict',
    detail:prettyState(detail),
    phase:pending?'pending':'active',
    opponent:clean(conflict?.opponent),
    score:conflict?.score||null,
    source:row.source,
    sourceAt:row.sourceAt,
    dataFresh:row.dataFresh,
    dataCondition:row.dataCondition,
    freshnessCycle:row.freshnessCycle,
  };
}
function opportunityStates(row){
  const seen=new Set();
  const out=[];
  const add=(state,phase)=>{
    const key=norm(state);
    const meta=OPPORTUNITY_STATES.get(key);
    if(!meta||seen.has(key))return;
    seen.add(key);
    out.push({state:meta.label,category:meta.category,phase});
  };
  for(const state of row.activeStates||[])add(state,'active');
  for(const state of row.pendingStates||[])add(state,'pending');
  return out.sort((a,b)=>categoryRank(a.category)-categoryRank(b.category)||a.state.localeCompare(b.state));
}

function selectConflictDetail({board,scout,useScout,sourceAt}={}){
  const scoutConflict=extractScoutConflict(scout);
  const externalConflict=extractExternalConflict(board?.conflict);
  if(useScout&&scoutConflict)return scoutConflict;
  const scoutAt=iso(scout?.updatedAt);
  const externalAt=iso(board?.conflict?.updatedAt||board?.updatedAt);
  if(scoutConflict&&(!externalConflict||!externalAt||(scoutAt&&Date.parse(scoutAt)>=Date.parse(externalAt))))return scoutConflict;
  return externalConflict||scoutConflict||null;
}
function extractScoutConflict(scout){
  for(const conflict of Array.isArray(scout?.conflicts)?scout.conflicts:[]){
    const one=conflict?.faction1||{};
    const two=conflict?.faction2||{};
    const oneOurs=norm(one.name)===norm(MONGREL);
    const twoOurs=norm(two.name)===norm(MONGREL);
    if(!oneOurs&&!twoOurs)continue;
    const ours=oneOurs?one:two;
    const theirs=oneOurs?two:one;
    return{
      opponent:clean(theirs?.name),
      type:prettyState(conflict?.type),
      score:{ours:Number(ours?.wonDays)||0,theirs:Number(theirs?.wonDays)||0,status:prettyState(conflict?.status)},
    };
  }
  return null;
}
function extractExternalConflict(conflict){
  if(!conflict||typeof conflict!=='object')return null;
  const one=conflict?.faction1||conflict?.one||{};
  const two=conflict?.faction2||conflict?.two||{};
  const oneOurs=norm(one?.name)===norm(MONGREL);
  const twoOurs=norm(two?.name)===norm(MONGREL);
  if(!oneOurs&&!twoOurs){
    const opponent=clean(conflict?.opponentFaction||conflict?.opponent);
    if(!opponent)return null;
    return{
      opponent,
      type:prettyState(conflict?.type),
      score:{
        ours:Number(conflict?.factionWonDays)||0,
        theirs:Number(conflict?.opponentWonDays)||0,
        status:prettyState(conflict?.status),
      },
    };
  }
  const ours=oneOurs?one:two;
  const theirs=oneOurs?two:one;
  return{
    opponent:clean(theirs?.name),
    type:prettyState(conflict?.type),
    score:{ours:Number(ours?.wonDays)||0,theirs:Number(theirs?.wonDays)||0,status:prettyState(conflict?.status)},
  };
}

async function fetchJson(url){
  const response=await fetch(url.toString(),{headers:{Accept:'application/json'},cf:{cacheTtl:0}});
  if(!response.ok)throw new Error('bgs_discord_source_'+response.status);
  return await response.json();
}
async function readScoutSnapshots(env){
  try{
    const stored=await env.DAILY_ORDERS.get(SCOUT_SNAPSHOTS_KEY,{type:'json'});
    return stored&&typeof stored==='object'?stored:{version:1,systems:{}};
  }catch(error){
    console.error('Could not read Scout snapshots for BGS Discord',error);
    return{version:1,systems:{}};
  }
}
async function migrateLegacyOperationsTracking(env,state,newWebhookId){
  const oldOperationsWebhookId=discordOperationsWebhookId(env);
  if(!oldOperationsWebhookId||oldOperationsWebhookId===newWebhookId)return;

  let changed=false;
  const summary=state.summary;
  if(summary?.messageId&&summary.webhookId===oldOperationsWebhookId){
    try{await deleteOperationsDiscordMessage(env,summary.messageId);}
    catch(error){
      if(Number(error?.status)!==404){
        console.error('Could not remove legacy Faction Alerts summary from Operations Discord',error);
        throw error;
      }
    }
    state.summary=null;
    changed=true;
  }

  for(const [key,row] of Object.entries(state.actionCards||{})){
    if(!row?.messageId||row.webhookId!==oldOperationsWebhookId)continue;
    try{await deleteOperationsDiscordMessage(env,row.messageId);}
    catch(error){
      if(Number(error?.status)!==404){
        console.error('Could not remove legacy Faction Alert card from Operations Discord',row?.system,error);
        throw error;
      }
    }
    delete state.actionCards[key];
    changed=true;
  }

  if(changed)await writeState(env,state);
}

async function readState(env){
  try{
    const stored=await env.DAILY_ORDERS.get(STATE_KEY,{type:'json'});
    const cards={};
    for(const [key,row] of Object.entries(stored?.actionCards&&typeof stored.actionCards==='object'?stored.actionCards:{})){
      if(!row||typeof row!=='object')continue;
      cards[key]={
        system:clean(row.system),
        family:clean(row.family),
        detail:clean(row.detail),
        opponent:clean(row.opponent),
        messageId:clean(row.messageId),
        webhookId:clean(row.webhookId),
        fingerprint:clean(row.fingerprint),
        phase:row.phase==='resolved'?'resolved':'operational',
        lastConditionPhase:clean(row.lastConditionPhase),
        lastSyncedAt:iso(row.lastSyncedAt),
        lastMode:clean(row.lastMode),
      };
    }
    const rawSummary=stored?.summary&&typeof stored.summary==='object'?stored.summary:null;
    const summary=rawSummary?{
      messageId:clean(rawSummary.messageId),
      webhookId:clean(rawSummary.webhookId),
      fingerprint:clean(rawSummary.fingerprint),
      lastSyncedAt:iso(rawSummary.lastSyncedAt),
      lastMode:clean(rawSummary.lastMode),
    }:null;
    return{version:1,summary,actionCards:cards};
  }catch(error){
    console.error('Could not read BGS Discord state',error);
    return{version:1,summary:null,actionCards:{}};
  }
}
async function writeState(env,state){
  await env.DAILY_ORDERS.put(STATE_KEY,JSON.stringify({
    version:1,
    summary:state.summary||null,
    actionCards:state.actionCards||{},
  }));
}

function actionKey(action){return norm(action?.system)+'::'+norm(action?.family)}
function actionSort(a,b){
  const rank={retreat:0,conflict:1};
  return (rank[a.family]??9)-(rank[b.family]??9)||a.system.localeCompare(b.system);
}
function opportunityRank(row){
  return Math.min(...(row.states||[]).map(state=>categoryRank(state.category)),9);
}
function categoryRank(category){return category==='COMBAT'?0:category==='TRADE'?1:2}
function actionSummaryLine(action){
  const phase=clean(action.phase).toUpperCase();
  const opponent=action.opponent?' vs '+escapeMarkdown(action.opponent):'';
  const score=action.score&&action.phase==='active'?' · '+Number(action.score.ours||0)+'–'+Number(action.score.theirs||0):'';
  const stale=action?.dataFresh===false?' · **⚠ STALE · SCOUT NEEDED**':'';
  return '• **'+escapeMarkdown(action.system)+'** — '+phase+' '+escapeMarkdown(action.detail)+opponent+score+stale;
}
function opportunitySummaryLine(row){
  const states=(row.states||[]).map(item=>escapeMarkdown(item.state)+(item.phase==='pending'?' _(pending)_':''));
  const stale=row?.dataFresh===false?' · **⚠ STALE · SCOUT NEEDED**':'';
  return '• **'+escapeMarkdown(row.system)+'** — '+states.join(' · ')+stale;
}
function isCurrentCycleSnapshot(timestamp,cycle){
  const snapshotMs=Date.parse(timestamp||'');
  const startMs=Date.parse(cycle?.cycleStartedAt||'');
  const endMs=Date.parse(cycle?.cycleEndsAt||'');
  return Number.isFinite(snapshotMs)&&Number.isFinite(startMs)&&Number.isFinite(endMs)
    && snapshotMs>=startMs&&snapshotMs<endMs;
}
function systemRows(value){
  if(Array.isArray(value))return value.filter(row=>row&&typeof row==='object');
  if(!value||typeof value!=='object')return[];
  return Object.entries(value).map(([name,row])=>{
    if(!row||typeof row!=='object')return null;
    return row.name?row:{...row,name};
  }).filter(Boolean);
}
function systemMissionControlUrl(value,system){
  const base=clean(value);
  if(!base)return'';
  try{
    const url=new URL(base);
    if(system&&system!=='Unknown system')url.searchParams.set('system',system);
    url.hash='all-systems';
    return url.toString();
  }catch{return base;}
}

function discordTime(value){
  const time=Date.parse(value||'');
  return Number.isFinite(time)?'<t:'+Math.floor(time/1000)+':R>':clean(value);
}
function stateList(value,fallback=''){
  const out=[];
  const seen=new Set();
  const add=raw=>{
    const state=prettyState(raw);
    const key=norm(state);
    if(!state||key==='none'||seen.has(key))return;
    seen.add(key);
    out.push(state);
  };
  if(Array.isArray(value))for(const item of value)add(item);
  if(!out.length&&fallback)add(fallback);
  return out;
}
function findState(list,wanted){return (list||[]).find(state=>norm(state)===wanted)||''}
function findConflict(list){return (list||[]).find(state=>CONFLICT_STATES.has(norm(state)))||''}
function prettyState(value){
  const raw=clean(value).replaceAll('_',' ');
  if(!raw)return'';
  return raw.split(/\s+/).map(word=>word?word[0].toUpperCase()+word.slice(1).toLowerCase():'').join(' ')
    .replace(/\bCivil War\b/i,'Civil War')
    .replace(/\bCivil Liberty\b/i,'Civil Liberty');
}
function chunkLines(lines,maxChars){
  const chunks=[];
  let current=[];
  let size=0;
  for(const raw of lines){
    const line=truncate(raw,300);
    const extra=(current.length?1:0)+line.length;
    if(current.length&&size+extra>maxChars){chunks.push(current);current=[];size=0;}
    current.push(line);
    size+=(current.length>1?1:0)+line.length;
  }
  if(current.length)chunks.push(current);
  return chunks;
}
function boardResult({configured,error='',summary=null,results=[],view=null}={}){
  const rows=Array.isArray(results)?results:[];
  return{
    feature:'bgs_alerts',
    configured:Boolean(configured),
    error:error||null,
    summary,
    results:rows,
    created:rows.filter(row=>['created','recreated'].includes(row.mode)).length,
    edited:rows.filter(row=>row.mode==='edited').length,
    resolvedShown:rows.filter(row=>row.mode==='resolved_shown').length,
    deleted:rows.filter(row=>['deleted','message_missing'].includes(row.mode)).length,
    unchanged:rows.filter(row=>row.mode==='unchanged').length,
    failed:rows.filter(row=>row.ok===false&&row.attempted).length,
    actionCount:Number(view?.actions?.length)||0,
    opportunityCount:Number(view?.opportunities?.length)||0,
  };
}
function summaryResult(value){return{feature:'bgs_summary',...value}}
function cardResult(value){return{feature:'bgs_action_alert',...value}}
function payloadFingerprint(payload){return hashText(JSON.stringify(payload?.embeds||[]))}
function hashText(value){
  let hash=2166136261;
  const text=String(value||'');
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return(hash>>>0).toString(36);
}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
function truncate(value,max){const text=clean(value);return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…'}
function escapeMarkdown(value){return clean(value).replace(/([\\*_{}\[\]()<>#+\-.!|~])/g,'\\$1')}
function iso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null}
