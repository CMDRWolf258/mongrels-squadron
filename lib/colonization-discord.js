import {
  createOperationsDiscordMessage,
  discordOperationsConfigured,
  discordOperationsWebhookId,
  editOperationsDiscordMessage,
} from './discord-webhook.js';
import { getEvents, listFrontierAccounts } from './frontier.js';
import {
  arbitrateColonizationContributions,
  colonizationJobPreview,
  readColonizationJobs,
} from './colonization-jobs.js';

const STATE_KEY='discord-colonization-jobs-v1';
const COLORS={
  active:0x22d3ee,
  paused:0xf59e0b,
  completed:0x22c55e,
  removed:0x64748b,
};

export async function syncColonizationJobDiscord(env,{
  job,
  actor='Mongrel Mission Control',
  controlUrl='',
  createMissing=false,
  view=null,
}={}){
  if(!discordOperationsConfigured(env))return result({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return result({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});
  if(!job?.id)return result({configured:true,attempted:false,ok:false,mode:'invalid_job',error:'colonization_job_missing'});

  const state=await readState(env);
  const webhookId=discordOperationsWebhookId(env);
  const tracked=state.jobs[job.id]||null;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return result({configured:true,attempted:false,ok:true,mode:'not_tracked',jobId:job.id});
  }

  const renderedJob=view||await buildColonizationJobView(env,job);
  const payload=buildColonizationJobDiscordPayload(renderedJob,{actor,controlUrl});
  const fingerprint=payloadFingerprint(payload);

  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint){
    return result({configured:true,attempted:false,ok:true,mode:'unchanged',jobId:job.id,messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editOperationsDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createOperationsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createOperationsDiscordMessage(env,payload);
      mode='created';
    }

    const syncedAt=new Date().toISOString();
    state.jobs[job.id]={
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      status:clean(job.status)||'active',
      title:clean(job.title||job.buildName||job.system),
      system:clean(job.system),
      lastSyncedAt:syncedAt,
      lastMode:mode,
      removed:false,
    };
    await writeState(env,state);
    return result({
      configured:true,attempted:true,ok:true,mode,
      jobId:job.id,messageId:state.jobs[job.id].messageId,syncedAt,
    });
  }catch(error){
    console.error('Could not sync Colonization Job to Discord',job?.id,error);
    return result({
      configured:true,attempted:true,ok:false,mode:'failed',jobId:job.id,
      error:clean(error?.message)||'discord_colonization_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export async function archiveColonizationJobDiscord(env,{
  job,
  actor='Mongrel Mission Control',
  controlUrl='',
}={}){
  if(!discordOperationsConfigured(env))return result({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return result({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});
  if(!job?.id)return result({configured:true,attempted:false,ok:false,mode:'invalid_job',error:'colonization_job_missing'});

  const state=await readState(env);
  const tracked=state.jobs[job.id];
  const webhookId=discordOperationsWebhookId(env);
  if(!tracked?.messageId||tracked.webhookId!==webhookId){
    return result({configured:true,attempted:false,ok:true,mode:'not_tracked',jobId:job.id});
  }

  const payload=buildColonizationJobRemovedPayload(job,{actor,controlUrl});
  const fingerprint=payloadFingerprint(payload);
  try{
    const sent=await editOperationsDiscordMessage(env,tracked.messageId,payload);
    const syncedAt=new Date().toISOString();
    state.jobs[job.id]={
      ...tracked,
      messageId:clean(sent.messageId)||tracked.messageId,
      fingerprint,
      status:'removed',
      lastSyncedAt:syncedAt,
      lastMode:'removed',
      removed:true,
    };
    await writeState(env,state);
    return result({configured:true,attempted:true,ok:true,mode:'removed',jobId:job.id,messageId:state.jobs[job.id].messageId,syncedAt});
  }catch(error){
    if(Number(error?.status)===404){
      delete state.jobs[job.id];
      await writeState(env,state);
      return result({configured:true,attempted:true,ok:true,mode:'message_missing',jobId:job.id});
    }
    console.error('Could not archive Colonization Job Discord message',job?.id,error);
    return result({
      configured:true,attempted:true,ok:false,mode:'failed',jobId:job.id,
      error:clean(error?.message)||'discord_colonization_archive_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export async function syncAllColonizationJobsDiscord(env,{
  actor='Mongrel Mission Control',
  controlUrl='',
  createMissing=false,
}={}){
  if(!discordOperationsConfigured(env))return summary({configured:false});
  if(!storageReady(env))return summary({configured:true,error:'discord_state_storage_not_configured'});

  const store=await readColonizationJobs(env);
  const state=await readState(env);
  const webhookId=discordOperationsWebhookId(env);
  const jobs=Array.isArray(store?.jobs)?store.jobs:[];
  const candidates=createMissing
    ? jobs
    : jobs.filter(job=>state.jobs?.[job.id]?.messageId&&state.jobs[job.id].webhookId===webhookId);
  if(!candidates.length)return summary({configured:true,results:[]});

  const views=await buildColonizationJobViews(env,jobs);
  const byId=new Map(views.map(view=>[String(view.id),view]));
  const results=[];
  for(const job of candidates){
    results.push(await syncColonizationJobDiscord(env,{
      job,
      view:byId.get(String(job.id))||job,
      actor,
      controlUrl,
      createMissing,
    }));
  }
  return summary({configured:true,results});
}

export async function buildColonizationJobView(env,job){
  const store=await readColonizationJobs(env);
  const jobs=Array.isArray(store?.jobs)&&store.jobs.length?store.jobs:[job];
  const views=await buildColonizationJobViews(env,jobs);
  return views.find(view=>String(view.id)===String(job?.id))||{...job,squadTons:0,payableTons:0,squadEvents:0,contributorCount:0,ambiguousEvents:0,suppressedEvents:0,members:[]};
}

export async function buildColonizationJobViews(env,jobs=[]){
  const allJobs=Array.isArray(jobs)?jobs:[];
  const accounts=await listFrontierAccounts(env);
  const memberRows=await Promise.all(accounts.map(async row=>({
    ownerId:row.userId,
    commander:row.account?.commander||'Elite CMDR',
    events:await getEvents(env,row.userId),
  })));
  const arbitrationByMember=memberRows.map(member=>({
    ...member,
    arbitration:arbitrateColonizationContributions(member.events,allJobs),
  }));
  return allJobs.map(job=>{
    const members=arbitrationByMember.map(member=>({
      ownerId:member.ownerId,
      commander:member.commander,
      ...colonizationJobPreview(job,member.events,member.arbitration),
    })).filter(row=>
      Number(row.tons)>0
      || Number(row.eventCount)>0
      || Number(row.ambiguousEventCount)>0
      || Number(row.suppressedEventCount)>0
    );
    const squadTons=members.reduce((sum,row)=>sum+(Number(row.tons)||0),0);
    return {
      ...job,
      squadTons,
      payableTons:squadTons,
      squadEvents:members.reduce((sum,row)=>sum+(Number(row.eventCount)||0),0),
      contributorCount:members.filter(row=>Number(row.tons)>0).length,
      ambiguousEvents:members.reduce((sum,row)=>sum+(Number(row.ambiguousEventCount)||0),0),
      suppressedEvents:members.reduce((sum,row)=>sum+(Number(row.suppressedEventCount)||0),0),
      members,
    };
  });
}

export function buildColonizationJobDiscordPayload(job,{actor='Mongrel Mission Control',controlUrl=''}={}){
  const status=clean(job?.status)||'active';
  const title=truncate(clean(job?.title||job?.buildName||job?.system)||'Colonization Job',180);
  const target=Math.max(0,Number(job?.targetTons)||0);
  const hauled=Math.max(0,Number(job?.squadTons)||0);
  const pct=target>0?Math.max(0,Math.min(100,(hauled/target)*100)):null;
  const remaining=target>0?Math.max(0,target-hauled):null;
  const link=clean(controlUrl);
  const scope=job?.scope==='market'
    ? (job?.marketId?(clean(job.buildName)||'Specific construction site'):'Specific build · awaiting site discovery')
    : 'Any construction depot in system';
  const progress=target>0
    ? fmtTons(hauled)+' / '+fmtTons(target)+' · '+pct.toFixed(1)+'% · '+fmtTons(remaining)+' remaining'
    : fmtTons(hauled)+' hauled · open-ended';
  const reward=Number(job?.rewardBlockMillions)>0
    ? fmtMillions(job.rewardBlockMillions)+' / '+fmtTons(job.rewardBlockTons)+' block'
      +(job?.personalCapMillions===null||job?.personalCapMillions===undefined?' · no personal cap':' · cap '+fmtMillions(job.personalCapMillions))
    : 'No hauling reward configured';
  const contributorLines=(Array.isArray(job?.members)?job.members:[])
    .filter(row=>Number(row.tons)>0)
    .sort((a,b)=>(Number(b.tons)||0)-(Number(a.tons)||0))
    .slice(0,8)
    .map(row=>'• '+escapeMarkdown(clean(row.commander)||'Elite CMDR')+' — '+fmtTons(row.tons));
  const notes=truncate(clean(job?.notes),500);

  const fields=[
    {name:'System',value:truncate(clean(job?.system)||'Unknown system',100),inline:true},
    {name:'Status',value:status.toUpperCase(),inline:true},
    {name:'Progress',value:progress,inline:false},
    {name:'Reward',value:reward,inline:false},
    {name:'Scope',value:truncate(scope+(job?.commodity?' · '+clean(job.commodity)+' only':''),220),inline:false},
  ];
  if(contributorLines.length)fields.push({name:'Verified Contributors',value:truncate(contributorLines.join('\n'),900),inline:false});
  if(Number(job?.ambiguousEvents)>0)fields.push({name:'Verification',value:String(job.ambiguousEvents)+' ambiguous contribution event'+(Number(job.ambiguousEvents)===1?' is':'s are')+' blocked pending arbitration.',inline:false});
  if(notes)fields.push({name:'Notes',value:notes,inline:false});

  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:(status==='completed'?'✓ ':'')+title,
      ...(link?{url:link}:{}),
      description:[
        status==='completed'
          ? 'Colonization hauling job completed.'
          : status==='paused'
            ? 'Colonization hauling job paused.'
            : 'Colonization hauling job active.',
        link?'[Open Colonization Control →]('+link+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS[status]||COLORS.active,
      fields,
      footer:{text:truncate('Regiment of Imperial Mongrels · '+Number(job?.contributorCount||0)+' contributor'+(Number(job?.contributorCount||0)===1?'':'s')+' · Rev '+Math.max(1,Number(job?.revision)||1)+' · Updated by '+clean(actor),220)},
      timestamp:iso(job?.updatedAt)||new Date().toISOString(),
    }],
  };
}

export function buildColonizationJobRemovedPayload(job,{actor='Mongrel Mission Control',controlUrl=''}={}){
  const link=clean(controlUrl);
  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:'Colonization Job Removed · '+truncate(clean(job?.title||job?.buildName||job?.system)||'Job',150),
      ...(link?{url:link}:{}),
      description:[
        'This Colonization Job has been removed from the active job registry. Its historical revisions and verified activity remain archived.',
        link?'[Open Colonization Control →]('+link+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS.removed,
      fields:[
        {name:'System',value:truncate(clean(job?.system)||'Unknown system',100),inline:true},
        {name:'Final Status',value:'REMOVED',inline:true},
      ],
      footer:{text:truncate('Regiment of Imperial Mongrels · Removed by '+clean(actor),220)},
      timestamp:new Date().toISOString(),
    }],
  };
}

async function readState(env){
  try{
    const stored=await env.DAILY_ORDERS.get(STATE_KEY,{type:'json'});
    const source=stored&&typeof stored==='object'&&stored.jobs&&typeof stored.jobs==='object'?stored.jobs:{};
    const jobs={};
    for(const [jobId,row] of Object.entries(source)){
      if(!row||typeof row!=='object')continue;
      jobs[jobId]={
        messageId:clean(row.messageId),
        webhookId:clean(row.webhookId),
        fingerprint:clean(row.fingerprint),
        status:clean(row.status),
        title:clean(row.title),
        system:clean(row.system),
        lastSyncedAt:iso(row.lastSyncedAt),
        lastMode:clean(row.lastMode),
        removed:Boolean(row.removed),
      };
    }
    return{version:1,jobs};
  }catch(error){
    console.error('Could not read Colonization Discord state',error);
    return{version:1,jobs:{}};
  }
}
async function writeState(env,state){
  await env.DAILY_ORDERS.put(STATE_KEY,JSON.stringify({version:1,jobs:state.jobs||{}}));
}
function payloadFingerprint(payload){return hashText(JSON.stringify(payload?.embeds||[]))}
function hashText(value){
  let hash=2166136261;
  const text=String(value||'');
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function summary({configured,error='',results=[]}={}){
  const rows=Array.isArray(results)?results:[];
  return{
    feature:'colonization_jobs',configured:Boolean(configured),error:error||null,results:rows,
    created:rows.filter(row=>row.mode==='created'||row.mode==='recreated').length,
    edited:rows.filter(row=>row.mode==='edited').length,
    unchanged:rows.filter(row=>row.mode==='unchanged').length,
    failed:rows.filter(row=>row.ok===false&&row.attempted).length,
    tracked:rows.length,
  };
}
function result(value){return{feature:'colonization_job',...value}}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function truncate(value,max){const text=clean(value);return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…'}
function escapeMarkdown(value){return clean(value).replace(/([\\*_{}\[\]()<>#+\-.!|~])/g,'\\$1')}
function fmtTons(value){return Math.max(0,Math.round(Number(value)||0)).toLocaleString()+' t'}
function fmtMillions(value){return (Math.round((Number(value)||0)*10)/10).toLocaleString()+'M Cr'}
function iso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null}
