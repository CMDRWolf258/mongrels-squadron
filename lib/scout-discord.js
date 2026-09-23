import {
  createScoutNetworkDiscordMessage,
  deleteOperationsDiscordMessage,
  deleteScoutNetworkDiscordMessage,
  discordOperationsWebhookId,
  discordScoutNetworkConfigured,
  discordScoutNetworkWebhookId,
  editScoutNetworkDiscordMessage,
} from './discord-webhook.js';

const STATE_KEY='discord-scout-jobs-v1';
const DEFAULT_ORIGIN='Diaba';
const DEFAULT_NEAREST_LIMIT=15;
const COLORS={
  summary:0x22d3ee,
  priority:0xf59e0b,
  claimed:0xf97316,
  fresh:0x22c55e,
};

export function selectScoutDiscordBoard(board,{originSystem=DEFAULT_ORIGIN,ordinaryLimit=DEFAULT_NEAREST_LIMIT}={}){
  const jobs=(Array.isArray(board?.jobs)?board.jobs:[]).filter(job=>job&&job.enabled!==false);
  const origin=jobs.find(job=>norm(job.system)===norm(originSystem))||null;
  const originCoords=coordinates(origin?.coords);
  const needs=jobs.filter(job=>needsScouting(job));
  const priority=needs
    .filter(job=>Number(job?.reward?.bonusMillions)>0)
    .sort(prioritySort(originCoords));
  const ordinary=needs
    .filter(job=>!(Number(job?.reward?.bonusMillions)>0))
    .map(job=>({...job,distanceFromOrigin:distanceLy(originCoords,coordinates(job.coords))}))
    .sort((a,b)=>{
      const ad=Number.isFinite(a.distanceFromOrigin)?a.distanceFromOrigin:Infinity;
      const bd=Number.isFinite(b.distanceFromOrigin)?b.distanceFromOrigin:Infinity;
      return ad-bd||statusRank(a.status)-statusRank(b.status)||clean(a.system).localeCompare(clean(b.system));
    })
    .slice(0,Math.max(0,Math.min(25,Math.floor(Number(ordinaryLimit)||DEFAULT_NEAREST_LIMIT))));

  return {
    originSystem:origin?.system||originSystem,
    originCoords,
    coordinateRouting:Boolean(originCoords),
    priority,
    ordinary,
    totalNeeds:needs.length,
    totalPriority:priority.length,
    ordinaryLimit:Math.max(0,Math.min(25,Math.floor(Number(ordinaryLimit)||DEFAULT_NEAREST_LIMIT))),
  };
}

export async function syncScoutDiscordBoard(env,{
  board,
  scoutBoardUrl='',
  setupUrl='',
  createMissing=false,
  originSystem=DEFAULT_ORIGIN,
  ordinaryLimit=DEFAULT_NEAREST_LIMIT,
}={}){
  if(!discordScoutNetworkConfigured(env))return boardResult({configured:false});
  if(!storageReady(env))return boardResult({configured:true,error:'discord_state_storage_not_configured'});
  if(!board||!Array.isArray(board.jobs))return boardResult({configured:true,error:'scout_board_missing'});

  const selection=selectScoutDiscordBoard(board,{originSystem,ordinaryLimit});
  const state=await readState(env);
  const webhookId=discordScoutNetworkWebhookId(env);
  if(createMissing){
    await migrateLegacyOperationsTracking(env,state,webhookId);
  }
  const summary=await syncScoutSummaryDiscord(env,{
    state,
    selection,
    scoutBoardUrl,
    setupUrl,
    createMissing,
  });

  const results=[];
  const activePriorityKeys=new Set();
  const boardSeededHere=Boolean(state.summary?.messageId&&state.summary.webhookId===webhookId);
  const allowPriorityCreate=createMissing||boardSeededHere;
  for(const job of selection.priority){
    const key=norm(job.system);
    activePriorityKeys.add(key);
    results.push(await syncPriorityScoutCard(env,{
      state,
      job,
      scoutBoardUrl,
      setupUrl,
      createMissing:allowPriorityCreate,
    }));
  }

  for(const [systemKey,tracked] of Object.entries(state.priorityCards||{})){
    if(!tracked?.messageId||tracked.webhookId!==webhookId||activePriorityKeys.has(systemKey))continue;
    const row=(board.jobs||[]).find(job=>norm(job?.system)===systemKey)||null;
    if(row?.dataFresh||String(row?.status||'').startsWith('fresh')){
      if(tracked.phase==='completed'){
        results.push(await deleteTrackedPriorityCard(env,state,systemKey,tracked,'completed_cleanup'));
      }else{
        results.push(await showPriorityCompletion(env,{
          state,
          systemKey,
          tracked,
          job:row,
          scoutBoardUrl,
          setupUrl,
        }));
      }
    }else{
      results.push(await deleteTrackedPriorityCard(env,state,systemKey,tracked,'no_longer_priority'));
    }
  }

  return boardResult({configured:true,summary,results,selection});
}

export async function syncScoutSummaryDiscord(env,{
  state=null,
  selection,
  scoutBoardUrl='',
  setupUrl='',
  createMissing=false,
}={}){
  if(!discordScoutNetworkConfigured(env))return summaryResult({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return summaryResult({configured:true,attempted:false,ok:false,mode:'tracking_unavailable'});
  const working=state||await readState(env);
  const webhookId=discordScoutNetworkWebhookId(env);
  const tracked=working.summary;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return summaryResult({configured:true,attempted:false,ok:true,mode:'not_tracked'});
  }

  const payload=buildScoutSummaryDiscordPayload(selection,{scoutBoardUrl,setupUrl});
  const fingerprint=payloadFingerprint(payload);
  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint){
    return summaryResult({configured:true,attempted:false,ok:true,mode:'unchanged',messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editScoutNetworkDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createScoutNetworkDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createScoutNetworkDiscordMessage(env,payload);
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
    console.error('Could not sync Scout Operations summary to Discord',error);
    return summaryResult({
      configured:true,attempted:true,ok:false,mode:'failed',
      error:clean(error?.message)||'discord_scout_summary_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export function buildScoutSummaryDiscordPayload(selection,{scoutBoardUrl='',setupUrl=''}={}){
  const priority=Array.isArray(selection?.priority)?selection.priority:[];
  const ordinary=Array.isArray(selection?.ordinary)?selection.ordinary:[];
  const boardLink=clean(scoutBoardUrl);
  const setupLink=clean(setupUrl);
  const currentOps=[
    'Priority: '+priority.length,
    'Nearest ordinary: '+ordinary.length,
    'Routed from: '+clean(selection?.originSystem||DEFAULT_ORIGIN),
  ];
  const fields=[
    {
      name:'Current Scout Operations',
      value:'```text\n'+currentOps.join('    ')+'\n```',
      inline:false,
    },
  ];

  const priorityNameWidth=priority.length
    ? Math.min(30,Math.max(6,...priority.map(job=>clean(job?.system||'Unknown system').length)))
    : 6;
  const priorityLines=priority.flatMap(job=>prioritySummaryLines(job,selection?.originCoords,priorityNameWidth));
  if(priorityLines.length){
    const header='SYSTEM'.padEnd(priorityNameWidth)+'  STATUS'.padEnd(12)+'  REWARD'.padStart(8)+'  DISTANCE'.padStart(9);
    for(const [index,chunk] of chunkLines(priorityLines,850).entries()){
      fields.push({
        name:index===0?'Priority Scout Jobs':'Priority Scout Jobs · continued',
        value:'```text\n'+(index===0?header+'\n':'')+chunk.join('\n')+'\n```',
        inline:false,
      });
    }
  }else{
    fields.push({name:'Priority Scout Jobs',value:'No priority Scout Jobs currently need a fresh board.',inline:false});
  }

  const ordinaryNameWidth=ordinary.length
    ? Math.min(36,Math.max(6,...ordinary.map(job=>clean(job?.system||'Unknown system').length)))
    : 6;
  const ordinaryLines=ordinary.map(job=>ordinarySummaryLine(job,ordinaryNameWidth));
  if(ordinaryLines.length){
    const header='SYSTEM'.padEnd(ordinaryNameWidth)+'  '+'DISTANCE'.padStart(8)+'  STATUS';
    for(const [index,chunk] of chunkLines(ordinaryLines,850).entries()){
      fields.push({
        name:index===0
          ? 'Nearest Needs Scouting · '+clean(selection?.originSystem||DEFAULT_ORIGIN)
          : 'Nearest Needs Scouting · continued',
        value:'```text\n'+(index===0?header+'\n':'')+chunk.join('\n')+'\n```',
        inline:false,
      });
    }
  }else{
    fields.push({
      name:'Nearest Needs Scouting · '+clean(selection?.originSystem||DEFAULT_ORIGIN),
      value:'No ordinary Scout Jobs currently need a fresh board.',
      inline:false,
    });
  }

  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:'Scout Network',
      ...(boardLink?{url:boardLink}:{}),
      description:[
        '```text\nSCOUT NETWORK\nPriority jobs plus up to '+Number(selection?.ordinaryLimit||DEFAULT_NEAREST_LIMIT)+' ordinary systems needing current data.\nOrdinary work is routed by straight-line distance from '+cleanCodeCell(clean(selection?.originSystem||DEFAULT_ORIGIN))+' when coordinates are available.\n\nLIVE SCOUT REQUIRED\nScout Job credit and rewards require Live Scout to be installed and linked.\n```',
        setupLink?'[Setup directions →]('+setupLink+')':'Setup directions are available on the website.',
        boardLink?'[Open Scout Board →]('+boardLink+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS.summary,
      fields:fields.slice(0,25),
      footer:{text:'Regiment of Imperial Mongrels · persistent Scout Network summary'},
    }],
  };
}

export function buildPriorityScoutDiscordPayload(job,{
  scoutBoardUrl='',
  setupUrl='',
  tracked=null,
  completed=false,
}={}){
  const boardLink=clean(scoutBoardUrl);
  const setupLink=clean(setupUrl);
  const reward=completed&&tracked?.rewardSnapshot?tracked.rewardSnapshot:(job?.reward||{});
  const status=completed?'SCOUTED':scoutStatusLabel(job?.status);
  const claim=job?.claim||null;
  const reason=clean(reward?.bonusReason||tracked?.rewardSnapshot?.bonusReason);
  const total=Number(reward?.totalMillions)||0;
  const bonus=Number(reward?.bonusMillions)||0;
  const fields=[
    {name:'System',value:truncate(clean(job?.system)||clean(tracked?.system)||'Unknown system',120),inline:true},
    {name:'Status',value:status,inline:true},
    {name:'Reward',value:fmtCredits(total)+(bonus>0?' · '+fmtCredits(bonus)+' priority bonus':''),inline:false},
  ];
  if(reason)fields.push({name:'Priority Reason',value:truncate(reason,500),inline:false});
  if(claim&&!completed){
    fields.push({
      name:'Claim',
      value:truncate((clean(claim.commander)||'Mongrel CMDR')+(claim.expiresAt?' · reserved until '+discordTime(claim.expiresAt):''),300),
      inline:false,
    });
  }
  if(job?.latestScoutAt){
    fields.push({name:'Last Live Scout Board',value:discordTime(job.latestScoutAt),inline:false});
  }

  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:(completed?'✓ ':'PRIORITY · ')+truncate(clean(job?.system)||clean(tracked?.system)||'Scout Job',160),
      ...(boardLink?{url:boardLink}:{}),
      description:[
        completed
          ? 'Priority scouting is complete for the current cycle. This card will leave this channel on the next Scout sync.'
          : 'Priority Scout Job · current faction-board data needed.',
        '**LIVE SCOUT REQUIRED:** Complete the job with Live Scout enabled and linked for attribution.'+(setupLink?' [Setup directions →]('+setupLink+')':''),
        boardLink?'[Open Scout Board →]('+boardLink+')':'',
      ].filter(Boolean).join('\n\n'),
      color:completed?COLORS.fresh:(job?.status==='claimed'?COLORS.claimed:COLORS.priority),
      fields,
      footer:{text:'Regiment of Imperial Mongrels · Scout Network'},
      ...(job?.latestScoutAt?{timestamp:iso(job.latestScoutAt)}:{}),
    }],
  };
}

async function syncPriorityScoutCard(env,{
  state,
  job,
  scoutBoardUrl='',
  setupUrl='',
  createMissing=false,
}={}){
  const key=norm(job?.system);
  if(!key)return cardResult({configured:true,attempted:false,ok:false,mode:'invalid_job'});
  const webhookId=discordScoutNetworkWebhookId(env);
  const tracked=state.priorityCards[key]||null;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return cardResult({configured:true,attempted:false,ok:true,mode:'not_tracked',system:job.system});
  }

  const payload=buildPriorityScoutDiscordPayload(job,{scoutBoardUrl,setupUrl,tracked});
  const fingerprint=payloadFingerprint(payload);
  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint&&tracked.phase==='operational'){
    return cardResult({configured:true,attempted:false,ok:true,mode:'unchanged',system:job.system,messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editScoutNetworkDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createScoutNetworkDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createScoutNetworkDiscordMessage(env,payload);
      mode='created';
    }
    state.priorityCards[key]={
      system:clean(job.system),
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      phase:'operational',
      lastStatus:clean(job.status),
      rewardSnapshot:normalizeReward(job.reward),
      lastSyncedAt:new Date().toISOString(),
      lastMode:mode,
    };
    await writeState(env,state);
    return cardResult({configured:true,attempted:true,ok:true,mode,system:job.system,messageId:state.priorityCards[key].messageId});
  }catch(error){
    console.error('Could not sync priority Scout Job to Discord',job?.system,error);
    return cardResult({
      configured:true,attempted:true,ok:false,mode:'failed',system:job?.system,
      error:clean(error?.message)||'discord_scout_priority_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

async function showPriorityCompletion(env,{
  state,
  systemKey,
  tracked,
  job,
  scoutBoardUrl='',
  setupUrl='',
}={}){
  const payload=buildPriorityScoutDiscordPayload(job||{system:tracked.system,status:'fresh'},{
    scoutBoardUrl,setupUrl,tracked,completed:true,
  });
  const fingerprint=payloadFingerprint(payload);
  try{
    const sent=await editScoutNetworkDiscordMessage(env,tracked.messageId,payload);
    state.priorityCards[systemKey]={
      ...tracked,
      messageId:clean(sent.messageId)||tracked.messageId,
      fingerprint,
      phase:'completed',
      lastStatus:'fresh',
      lastSyncedAt:new Date().toISOString(),
      lastMode:'completion_shown',
    };
    await writeState(env,state);
    return cardResult({
      configured:true,attempted:true,ok:true,mode:'completion_shown',
      system:tracked.system,messageId:state.priorityCards[systemKey].messageId,
    });
  }catch(error){
    if(Number(error?.status)===404){
      delete state.priorityCards[systemKey];
      await writeState(env,state);
      return cardResult({configured:true,attempted:true,ok:true,mode:'message_missing',system:tracked.system});
    }
    console.error('Could not show priority Scout completion in Discord',tracked?.system,error);
    return cardResult({configured:true,attempted:true,ok:false,mode:'failed',system:tracked?.system,error:clean(error?.message)||'discord_scout_completion_failed'});
  }
}

async function deleteTrackedPriorityCard(env,state,systemKey,tracked,reason){
  try{
    await deleteScoutNetworkDiscordMessage(env,tracked.messageId);
    delete state.priorityCards[systemKey];
    await writeState(env,state);
    return cardResult({configured:true,attempted:true,ok:true,mode:'deleted',system:tracked.system,reason});
  }catch(error){
    if(Number(error?.status)===404){
      delete state.priorityCards[systemKey];
      await writeState(env,state);
      return cardResult({configured:true,attempted:true,ok:true,mode:'message_missing',system:tracked.system,reason});
    }
    console.error('Could not delete priority Scout card from Discord',tracked?.system,error);
    return cardResult({configured:true,attempted:true,ok:false,mode:'failed',system:tracked?.system,reason,error:clean(error?.message)||'discord_scout_delete_failed'});
  }
}

async function migrateLegacyOperationsTracking(env,state,newWebhookId){
  const oldOperationsWebhookId=discordOperationsWebhookId(env);
  if(!oldOperationsWebhookId||oldOperationsWebhookId===newWebhookId)return;

  let changed=false;
  if(state.summary?.messageId&&state.summary.webhookId===oldOperationsWebhookId){
    try{await deleteOperationsDiscordMessage(env,state.summary.messageId);}
    catch(error){
      if(Number(error?.status)!==404){
        console.error('Could not remove legacy Scout Network summary from Operations Discord',error);
        throw error;
      }
    }
    state.summary=null;
    changed=true;
  }

  for(const [key,row] of Object.entries(state.priorityCards||{})){
    if(!row?.messageId||row.webhookId!==oldOperationsWebhookId)continue;
    try{await deleteOperationsDiscordMessage(env,row.messageId);}
    catch(error){
      if(Number(error?.status)!==404){
        console.error('Could not remove legacy Scout Network priority card from Operations Discord',row?.system,error);
        throw error;
      }
    }
    delete state.priorityCards[key];
    changed=true;
  }

  if(changed)await writeState(env,state);
}

async function readState(env){
  try{
    const stored=await env.DAILY_ORDERS.get(STATE_KEY,{type:'json'});
    const rawCards=stored?.priorityCards&&typeof stored.priorityCards==='object'?stored.priorityCards:{};
    const priorityCards={};
    for(const [key,row] of Object.entries(rawCards)){
      if(!row||typeof row!=='object')continue;
      priorityCards[norm(key)||norm(row.system)]={
        system:clean(row.system),
        messageId:clean(row.messageId),
        webhookId:clean(row.webhookId),
        fingerprint:clean(row.fingerprint),
        phase:row.phase==='completed'?'completed':'operational',
        lastStatus:clean(row.lastStatus),
        rewardSnapshot:normalizeReward(row.rewardSnapshot),
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
    return{version:1,summary,priorityCards};
  }catch(error){
    console.error('Could not read Scout Discord state',error);
    return{version:1,summary:null,priorityCards:{}};
  }
}
async function writeState(env,state){
  await env.DAILY_ORDERS.put(STATE_KEY,JSON.stringify({
    version:1,
    summary:state.summary||null,
    priorityCards:state.priorityCards||{},
  }));
}

function needsScouting(job){
  if(!job||job.enabled===false||job.dataFresh===true)return false;
  return ['available','claimed'].includes(clean(job.status));
}
function prioritySort(originCoords){
  return (a,b)=>{
    const bonus=(Number(b?.reward?.bonusMillions)||0)-(Number(a?.reward?.bonusMillions)||0);
    if(bonus)return bonus;
    const ad=distanceLy(originCoords,coordinates(a?.coords));
    const bd=distanceLy(originCoords,coordinates(b?.coords));
    return (Number.isFinite(ad)?ad:Infinity)-(Number.isFinite(bd)?bd:Infinity)
      ||clean(a?.system).localeCompare(clean(b?.system));
  };
}
function prioritySummaryLines(job,originCoords,nameWidth=20){
  const width=Math.max(6,Math.min(30,Math.floor(Number(nameWidth)||20)));
  const system=truncateCodeCell(clean(job?.system)||'Unknown system',width).padEnd(width);
  const distance=distanceLy(originCoords,coordinates(job?.coords));
  const dist=(Number.isFinite(distance)?distance.toFixed(1)+' LY':'—').padStart(9);
  const status=(job?.status==='claimed'?'CLAIMED':'AVAILABLE').padEnd(12);
  const reward=(Number(job?.reward?.totalMillions)>0?fmtCredits(job.reward.totalMillions):'—').padStart(8);
  const lines=[system+'  '+status+'  '+reward+'  '+dist];
  const detail=[];
  if(job?.status==='claimed'&&job?.claim?.commander)detail.push('claimed by '+cleanCodeCell(job.claim.commander));
  if(clean(job?.reward?.bonusReason))detail.push(cleanCodeCell(truncate(job.reward.bonusReason,110)));
  if(detail.length)lines.push('  ↳ '+detail.join(' · '));
  return lines;
}
function ordinarySummaryLine(job,nameWidth=24){
  const width=Math.max(6,Math.min(36,Math.floor(Number(nameWidth)||24)));
  const system=truncateCodeCell(clean(job?.system)||'Unknown system',width).padEnd(width);
  const distance=Number(job?.distanceFromOrigin);
  const dist=(Number.isFinite(distance)?distance.toFixed(1)+' LY':'—').padStart(8);
  const status=job?.status==='claimed'
    ? 'CLAIMED'+(job?.claim?.commander?' · '+cleanCodeCell(job.claim.commander):'')
    : 'AVAILABLE';
  return system+'  '+dist+'  '+status;
}
function cleanCodeCell(value){
  return clean(value).replaceAll('`','′').replace(/[\r\n\t]+/g,' ');
}
function truncateCodeCell(value,max){
  const text=cleanCodeCell(value);
  return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…';
}
function scoutStatusLabel(status){
  if(status==='claimed')return'CLAIMED';
  if(String(status||'').startsWith('fresh'))return'SCOUTED';
  return'NEEDS SCOUTING';
}
function statusRank(status){return status==='available'?0:status==='claimed'?1:9}
function coordinates(value){
  if(!value||typeof value!=='object')return null;
  const x=Number(value.x),y=Number(value.y),z=Number(value.z);
  return Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)?{x,y,z}:null;
}
function distanceLy(a,b){
  if(!a||!b)return NaN;
  return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2);
}
function normalizeReward(value={}){
  return{
    baseMillions:Math.max(0,Number(value?.baseMillions)||0),
    bonusMillions:Math.max(0,Number(value?.bonusMillions)||0),
    totalMillions:Math.max(0,Number(value?.totalMillions)||0),
    bonusReason:clean(value?.bonusReason).slice(0,240),
    bonusOnce:value?.bonusOnce!==false,
  };
}
function chunkLines(lines,maxChars){
  const chunks=[];
  let current=[];
  let size=0;
  for(const raw of lines){
    const line=truncate(raw,300);
    const extra=(current.length?1:0)+line.length;
    if(current.length&&size+extra>maxChars){
      chunks.push(current);
      current=[];
      size=0;
    }
    current.push(line);
    size+=(current.length>1?1:0)+line.length;
  }
  if(current.length)chunks.push(current);
  return chunks;
}
function discordTime(value){
  const time=Date.parse(value||'');
  if(!Number.isFinite(time))return clean(value)||'Unknown';
  return '<t:'+Math.floor(time/1000)+':R>';
}
function fmtCredits(millions){
  const value=Math.round((Number(millions)||0)*10)/10;
  return value.toLocaleString()+'M Cr';
}
function boardResult({configured,error='',summary=null,results=[],selection=null}={}){
  const rows=Array.isArray(results)?results:[];
  return{
    feature:'scout_jobs',
    configured:Boolean(configured),
    error:error||null,
    summary,
    results:rows,
    created:rows.filter(row=>['created','recreated'].includes(row.mode)).length,
    edited:rows.filter(row=>row.mode==='edited').length,
    completionShown:rows.filter(row=>row.mode==='completion_shown').length,
    deleted:rows.filter(row=>['deleted','message_missing'].includes(row.mode)).length,
    unchanged:rows.filter(row=>row.mode==='unchanged').length,
    failed:rows.filter(row=>row.ok===false&&row.attempted).length,
    displayedPriority:Number(selection?.priority?.length)||0,
    displayedOrdinary:Number(selection?.ordinary?.length)||0,
    routedFrom:clean(selection?.originSystem||DEFAULT_ORIGIN),
  };
}
function summaryResult(value){return{feature:'scout_summary',...value}}
function cardResult(value){return{feature:'scout_priority_job',...value}}
function payloadFingerprint(payload){return hashText(JSON.stringify(payload?.embeds||[]))}
function hashText(value){
  let hash=2166136261;
  const text=String(value||'');
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
function truncate(value,max){const text=clean(value);return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…'}
function escapeMarkdown(value){return clean(value).replace(/([\\*_{}\[\]()<>#+\-.!|~])/g,'\\$1')}
function iso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null}
