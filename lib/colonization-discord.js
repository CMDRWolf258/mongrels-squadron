import {
  createColonizationArchiveDiscordMessage,
  editColonizationArchiveDiscordMessage,
  createColonizationJobsDiscordMessage,
  deleteColonizationJobsDiscordMessage,
  deleteOperationsDiscordMessage,
  discordColonizationArchiveConfigured,
  discordColonizationArchiveWebhookId,
  discordColonizationJobsConfigured,
  discordColonizationJobsWebhookId,
  discordOperationsWebhookId,
  editColonizationJobsDiscordMessage,
} from './discord-webhook.js';
import { getEvents, listFrontierAccounts } from './frontier.js';
import {
  arbitrateColonizationContributions,
  colonizationJobPreview,
  readColonizationJobs,
} from './colonization-jobs.js';

const STATE_KEY='discord-colonization-jobs-v1';
const ARCHIVE_STATE_KEY='discord-colonization-archive-v1';
const OPERATIONAL_STATUSES=new Set(['active','paused']);
const COLORS={
  active:0x22d3ee,
  paused:0xf59e0b,
  completed:0x22c55e,
  removed:0x64748b,
  summary:0x22d3ee,
};

export async function syncColonizationMutationDiscord(env,{
  action='update',
  job=null,
  removedJob=null,
  actor='Mongrel Mission Control',
  controlUrl='',
}={}){
  if(!discordColonizationJobsConfigured(env))return mutationResult({configured:false});
  if(!storageReady(env))return mutationResult({configured:true,error:'discord_state_storage_not_configured'});

  const migrationState=await readState(env);
  await migrateLegacyOperationsTracking(env,migrationState,discordColonizationJobsWebhookId(env));

  const store=await readColonizationJobs(env);
  const jobs=Array.isArray(store?.jobs)?store.jobs:[];
  const views=await buildColonizationJobViews(env,jobs);
  const byId=new Map(views.map(view=>[String(view.id),view]));

  let jobResult=null;
  let archiveResult=null;
  if(action==='delete'&&removedJob){
    jobResult=await archiveColonizationJobDiscord(env,{job:removedJob,actor,controlUrl});
  }else if(job){
    const rendered=byId.get(String(job.id))||job;
    jobResult=await syncColonizationJobDiscord(env,{
      job,
      view:rendered,
      actor,
      controlUrl,
      createMissing:action==='create',
    });
    if(clean(job.status)==='completed'){
      archiveResult=await syncColonizationArchiveJobDiscord(env,{
        job,
        view:rendered,
        controlUrl,
      });
    }
  }

  const summaryResult=await syncColonizationSummaryDiscord(env,{
    views,
    controlUrl,
    createMissing:true,
  });
  return mutationResult({
    configured:true,
    job:jobResult,
    archive:archiveResult,
    summary:summaryResult,
  });
}

export async function syncColonizationJobDiscord(env,{
  job,
  actor='Mongrel Mission Control',
  controlUrl='',
  createMissing=false,
  view=null,
}={}){
  if(!discordColonizationJobsConfigured(env))return result({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return result({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});
  if(!job?.id)return result({configured:true,attempted:false,ok:false,mode:'invalid_job',error:'colonization_job_missing'});

  const state=await readState(env);
  const webhookId=discordColonizationJobsWebhookId(env);
  const tracked=state.jobs[job.id]||null;
  const status=clean(job.status)||'active';

  if(status==='completed'&&!tracked?.messageId){
    return result({configured:true,attempted:false,ok:true,mode:'completed_untracked',jobId:job.id,status});
  }
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return result({configured:true,attempted:false,ok:true,mode:'not_tracked',jobId:job.id,status});
  }
  if(!OPERATIONAL_STATUSES.has(status)&&status!=='completed'){
    return result({configured:true,attempted:false,ok:true,mode:'not_operational',jobId:job.id,status});
  }

  const renderedJob=view||await buildColonizationJobView(env,job);
  const payload=buildColonizationJobDiscordPayload(renderedJob,{actor,controlUrl});
  const fingerprint=payloadFingerprint(payload);

  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint){
    return result({configured:true,attempted:false,ok:true,mode:'unchanged',jobId:job.id,status,messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editColonizationJobsDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createColonizationJobsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createColonizationJobsDiscordMessage(env,payload);
      mode='created';
    }

    const syncedAt=new Date().toISOString();
    state.jobs[job.id]={
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      status,
      title:clean(job.title||job.buildName||job.system),
      system:clean(job.system),
      lastSyncedAt:syncedAt,
      lastMode:mode,
      removed:false,
    };
    await writeState(env,state);
    return result({
      configured:true,attempted:true,ok:true,mode,
      jobId:job.id,status,messageId:state.jobs[job.id].messageId,syncedAt,
    });
  }catch(error){
    console.error('Could not sync Colonization Job to Discord',job?.id,error);
    return result({
      configured:true,attempted:true,ok:false,mode:'failed',jobId:job.id,
      status,
      error:clean(error?.message)||'discord_colonization_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export async function archiveColonizationJobDiscord(env,{job}={}){
  if(!discordColonizationJobsConfigured(env))return result({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return result({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});
  if(!job?.id)return result({configured:true,attempted:false,ok:false,mode:'invalid_job',error:'colonization_job_missing'});

  const state=await readState(env);
  const tracked=state.jobs[job.id];
  const webhookId=discordColonizationJobsWebhookId(env);
  if(!tracked?.messageId||tracked.webhookId!==webhookId){
    return result({configured:true,attempted:false,ok:true,mode:'not_tracked',jobId:job.id});
  }

  try{
    await deleteColonizationJobsDiscordMessage(env,tracked.messageId);
    delete state.jobs[job.id];
    await writeState(env,state);
    return result({configured:true,attempted:true,ok:true,mode:'deleted',jobId:job.id,messageId:tracked.messageId});
  }catch(error){
    if(Number(error?.status)===404){
      delete state.jobs[job.id];
      await writeState(env,state);
      return result({configured:true,attempted:true,ok:true,mode:'message_missing',jobId:job.id});
    }
    console.error('Could not remove Colonization Job Discord message',job?.id,error);
    return result({
      configured:true,attempted:true,ok:false,mode:'failed',jobId:job.id,
      error:clean(error?.message)||'discord_colonization_delete_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}


export async function syncColonizationArchiveJobDiscord(env,{
  job,
  view=null,
  controlUrl='',
}={}){
  if(!discordColonizationArchiveConfigured(env))return archiveResult({configured:false,attempted:false,ok:true,mode:'not_configured'});
  if(!storageReady(env))return archiveResult({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});
  if(!job?.id)return archiveResult({configured:true,attempted:false,ok:false,mode:'invalid_job',error:'colonization_job_missing'});
  if(clean(job.status)!=='completed')return archiveResult({configured:true,attempted:false,ok:true,mode:'not_completed',jobId:job.id});

  const state=await readArchiveState(env);
  const existing=state.jobs[job.id]||null;
  const rendered=view||await buildColonizationJobView(env,job);
  const payload=buildColonizationArchiveDiscordPayload(rendered,{controlUrl});
  const fingerprint=payloadFingerprint(payload);
  const webhookId=discordColonizationArchiveWebhookId(env);
  const link=clean(controlUrl);

  if(existing?.messageId){
    if(existing.webhookId===webhookId&&link&&existing.link!==link){
      try{
        const sent=await editColonizationArchiveDiscordMessage(env,existing.messageId,payload);
        const syncedAt=new Date().toISOString();
        state.jobs[job.id]={
          ...existing,
          messageId:clean(sent.messageId)||existing.messageId,
          fingerprint,
          link,
          title:clean(job.title||job.buildName||job.system),
          system:clean(job.system),
          completedAt:iso(job.endsAt)||iso(job.updatedAt)||existing.completedAt,
        };
        state.updatedAt=syncedAt;
        await writeArchiveState(env,state);
        return archiveResult({
          configured:true,attempted:true,ok:true,mode:'updated',
          jobId:job.id,messageId:state.jobs[job.id].messageId,archivedAt:existing.archivedAt,
        });
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        const sent=await createColonizationArchiveDiscordMessage(env,payload);
        const syncedAt=new Date().toISOString();
        state.jobs[job.id]={
          ...existing,
          messageId:clean(sent.messageId),
          webhookId,
          fingerprint,
          title:clean(job.title||job.buildName||job.system),
          system:clean(job.system),
          completedAt:iso(job.endsAt)||iso(job.updatedAt)||existing.completedAt,
        };
        state.updatedAt=syncedAt;
        await writeArchiveState(env,state);
        return archiveResult({
          configured:true,attempted:true,ok:true,mode:'recreated',
          jobId:job.id,messageId:state.jobs[job.id].messageId,archivedAt:existing.archivedAt,
        });
      }
    }
    return archiveResult({
      configured:true,attempted:false,ok:true,mode:'already_archived',
      jobId:job.id,messageId:existing.messageId,archivedAt:existing.archivedAt,
    });
  }

  try{
    const sent=await createColonizationArchiveDiscordMessage(env,payload);
    const archivedAt=new Date().toISOString();
    state.jobs[job.id]={
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      link,
      title:clean(job.title||job.buildName||job.system),
      system:clean(job.system),
      completedAt:iso(job.endsAt)||iso(job.updatedAt)||archivedAt,
      archivedAt,
    };
    state.updatedAt=archivedAt;
    await writeArchiveState(env,state);
    return archiveResult({
      configured:true,attempted:true,ok:true,mode:'archived',
      jobId:job.id,messageId:state.jobs[job.id].messageId,archivedAt,
    });
  }catch(error){
    console.error('Could not archive completed Colonization Job to Discord',job?.id,error);
    return archiveResult({
      configured:true,attempted:true,ok:false,mode:'failed',jobId:job.id,
      error:clean(error?.message)||'discord_colonization_archive_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export async function syncAllCompletedColonizationArchiveDiscord(env,{
  controlUrl='',
}={}){
  if(!discordColonizationArchiveConfigured(env))return archiveSummary({configured:false});
  if(!storageReady(env))return archiveSummary({configured:true,error:'discord_state_storage_not_configured'});

  const store=await readColonizationJobs(env);
  const allJobs=Array.isArray(store?.jobs)?store.jobs:[];
  const jobs=allJobs.filter(job=>clean(job?.status)==='completed');
  const views=await buildColonizationJobViews(env,allJobs);
  const byId=new Map(views.map(view=>[String(view.id),view]));
  const results=[];
  for(const job of jobs){
    results.push(await syncColonizationArchiveJobDiscord(env,{
      job,
      view:byId.get(String(job.id))||job,
      controlUrl,
    }));
  }
  return archiveSummary({configured:true,results});
}

export function buildColonizationArchiveDiscordPayload(job,{controlUrl=''}={}){
  const title=truncate(clean(job?.title||job?.buildName||job?.system)||'Colonization Job',180);
  const target=Math.max(0,Number(job?.targetTons)||0);
  const hauled=Math.max(0,Number(job?.squadTons)||0);
  const pct=target>0?Math.max(0,(hauled/target)*100):null;
  const link=clean(controlUrl);
  const completion=iso(job?.endsAt)||iso(job?.updatedAt)||iso(job?.lastContributionAt);
  const funding=job?.fundingMode==='member'
    ? 'Member-funded'+(clean(job?.postingCommander||job?.fundingPayerName)?' · '+clean(job.postingCommander||job.fundingPayerName):'')
    : job?.fundingMode==='none'
      ? 'No funded reward'
      : 'Squad-funded';
  const reward=Number(job?.rewardBlockMillions)>0
    ? fmtMillions(job.rewardBlockMillions)+' / '+fmtTons(job.rewardBlockTons)+' block'
      +(job?.personalCapMillions===null||job?.personalCapMillions===undefined?' · no personal cap':' · cap '+fmtMillions(job.personalCapMillions))
    : 'No hauling reward configured';
  const contributorLines=(Array.isArray(job?.members)?job.members:[])
    .filter(row=>Number(row.tons)>0)
    .sort((a,b)=>(Number(b.tons)||0)-(Number(a.tons)||0))
    .slice(0,15)
    .map(row=>'• '+escapeMarkdown(clean(row.commander)||'Elite CMDR')+' — '+fmtTons(row.tons));
  const scope=job?.scope==='market'
    ? (clean(job?.buildName)||'Specific construction site')
    : 'Any construction depot in system';
  const fields=[
    {name:'System',value:truncate(clean(job?.system)||'Unknown system',100),inline:true},
    {name:'Final Status',value:'COMPLETED',inline:true},
    {name:'Completed',value:completion?discordTime(completion):'Completion time unavailable',inline:true},
    {name:'Verified Hauling',value:target>0
      ? fmtTons(hauled)+' / '+fmtTons(target)+' · '+pct.toFixed(1)+'%'
      : fmtTons(hauled)+' · open-ended',inline:false},
    {name:'Contributors',value:String(Number(job?.contributorCount||0)),inline:true},
    {name:'Funding',value:truncate(funding,120),inline:true},
    {name:'Reward Terms',value:reward,inline:false},
    {name:'Build Scope',value:truncate(scope+(job?.commodity?' · '+clean(job.commodity)+' only':''),220),inline:false},
  ];
  if(contributorLines.length)fields.push({name:'Verified Contributors',value:truncate(contributorLines.join('\n'),1000),inline:false});
  if(Number(job?.ambiguousEvents)>0)fields.push({
    name:'Verification Note',
    value:String(job.ambiguousEvents)+' ambiguous contribution event'+(Number(job.ambiguousEvents)===1?' was':'s were')+' excluded from verified hauling.',
    inline:false,
  });
  const notes=truncate(clean(job?.notes),500);
  if(notes)fields.push({name:'Job Notes',value:notes,inline:false});

  return{
    username:'Mongrel Mission Control',
    embeds:[{
      title:'✓ COLONIZATION COMPLETE · '+title,
      ...(link?{url:link}:{}),
      description:[
        'Permanent completion record for a Regiment of Imperial Mongrels Colonization Job.',
        link?'[Open Colonization Jobs →]('+link+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS.completed,
      fields:fields.slice(0,25),
      footer:{text:truncate('Regiment of Imperial Mongrels · Colonization Archive · Job '+clean(job?.id)+' · Rev '+Math.max(1,Number(job?.revision)||1),220)},
      ...(completion?{timestamp:completion}:{}),
    }],
  };
}

export async function syncColonizationSummaryDiscord(env,{
  views=null,
  controlUrl='',
  createMissing=false,
}={}){
  if(!discordColonizationJobsConfigured(env))return summaryMessageResult({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return summaryMessageResult({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});

  let rows=Array.isArray(views)?views:null;
  if(!rows){
    const store=await readColonizationJobs(env);
    rows=await buildColonizationJobViews(env,Array.isArray(store?.jobs)?store.jobs:[]);
  }

  const state=await readState(env);
  const webhookId=discordColonizationJobsWebhookId(env);
  const tracked=state.summary;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return summaryMessageResult({configured:true,attempted:false,ok:true,mode:'not_tracked'});
  }

  const payload=buildColonizationSummaryDiscordPayload(rows,{controlUrl});
  const fingerprint=payloadFingerprint(payload);
  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint){
    return summaryMessageResult({configured:true,attempted:false,ok:true,mode:'unchanged',messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editColonizationJobsDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createColonizationJobsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createColonizationJobsDiscordMessage(env,payload);
      mode='created';
    }

    const syncedAt=new Date().toISOString();
    state.summary={
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      lastSyncedAt:syncedAt,
      lastMode:mode,
    };
    await writeState(env,state);
    return summaryMessageResult({configured:true,attempted:true,ok:true,mode,messageId:state.summary.messageId,syncedAt});
  }catch(error){
    console.error('Could not sync Colonization Jobs summary to Discord',error);
    return summaryMessageResult({
      configured:true,attempted:true,ok:false,mode:'failed',
      error:clean(error?.message)||'discord_colonization_summary_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export async function syncAllColonizationJobsDiscord(env,{
  actor='Mongrel Mission Control',
  controlUrl='',
  createMissing=false,
}={}){
  if(!discordColonizationJobsConfigured(env))return syncSummary({configured:false});
  if(!storageReady(env))return syncSummary({configured:true,error:'discord_state_storage_not_configured'});

  const migrationState=await readState(env);
  if(createMissing){
    await migrateLegacyOperationsTracking(env,migrationState,discordColonizationJobsWebhookId(env));
  }

  const store=await readColonizationJobs(env);
  const jobs=Array.isArray(store?.jobs)?store.jobs:[];
  const views=await buildColonizationJobViews(env,jobs);
  const byId=new Map(views.map(view=>[String(view.id),view]));
  const state=await readState(env);
  const webhookId=discordColonizationJobsWebhookId(env);

  const summaryResult=await syncColonizationSummaryDiscord(env,{
    views,
    controlUrl,
    createMissing,
  });

  const results=[];
  for(const job of jobs){
    const status=clean(job.status)||'active';
    const tracked=state.jobs?.[job.id];
    const trackedHere=Boolean(tracked?.messageId&&tracked.webhookId===webhookId);

    if(OPERATIONAL_STATUSES.has(status)){
      if(createMissing||trackedHere){
        results.push(await syncColonizationJobDiscord(env,{
          job,
          view:byId.get(String(job.id))||job,
          actor,
          controlUrl,
          createMissing,
        }));
      }
      continue;
    }

    if(status==='completed'&&trackedHere){
      if(tracked.status==='completed'){
        results.push(await archiveColonizationJobDiscord(env,{job}));
      }else{
        results.push(await syncColonizationJobDiscord(env,{
          job,
          view:byId.get(String(job.id))||job,
          actor,
          controlUrl,
          createMissing:false,
        }));
      }
    }
  }

  return syncSummary({configured:true,results,summary:summaryResult});
}

export async function buildColonizationJobView(env,job){
  const store=await readColonizationJobs(env);
  const jobs=Array.isArray(store?.jobs)&&store.jobs.length?store.jobs:[job];
  const views=await buildColonizationJobViews(env,jobs);
  return views.find(view=>String(view.id)===String(job?.id))||{
    ...job,squadTons:0,payableTons:0,squadEvents:0,contributorCount:0,
    ambiguousEvents:0,suppressedEvents:0,lastContributionAt:null,members:[],
  };
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
      lastContributionAt:members.map(row=>row.lastContributionAt).filter(Boolean).sort().at(-1)||null,
      members,
    };
  });
}

export function buildColonizationJobDiscordPayload(job,{controlUrl=''}={}){
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
          ? 'Colonization hauling job completed. This card will leave this channel on the next Colonization sync.'
          : status==='paused'
            ? 'Colonization hauling job paused.'
            : 'Colonization hauling job active.',
        link?'[Open Colonization Jobs →]('+link+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS[status]||COLORS.active,
      fields,
      footer:{text:truncate('Regiment of Imperial Mongrels · '+Number(job?.contributorCount||0)+' contributor'+(Number(job?.contributorCount||0)===1?'':'s')+' · Rev '+Math.max(1,Number(job?.revision)||1),220)},
      timestamp:latestIso(job?.updatedAt,job?.lastContributionAt)||new Date().toISOString(),
    }],
  };
}

export function buildColonizationSummaryDiscordPayload(views,{controlUrl=''}={}){
  const operational=(Array.isArray(views)?views:[])
    .filter(job=>OPERATIONAL_STATUSES.has(clean(job?.status)||'active'))
    .sort((a,b)=>{
      const statusOrder={active:0,paused:1};
      const statusDiff=(statusOrder[clean(a?.status)]??9)-(statusOrder[clean(b?.status)]??9);
      if(statusDiff)return statusDiff;
      return clean(a?.title||a?.buildName||a?.system).localeCompare(clean(b?.title||b?.buildName||b?.system));
    });
  const activeCount=operational.filter(job=>clean(job.status)==='active').length;
  const pausedCount=operational.filter(job=>clean(job.status)==='paused').length;
  const verifiedTons=operational.reduce((sum,job)=>sum+(Number(job?.squadTons)||0),0);
  const link=clean(controlUrl);

  const lines=operational.map(job=>{
    const title=escapeMarkdown(truncate(clean(job?.title||job?.buildName||job?.system)||'Colonization Job',80));
    const status=(clean(job?.status)||'active').toUpperCase();
    const hauled=Math.max(0,Number(job?.squadTons)||0);
    const target=Math.max(0,Number(job?.targetTons)||0);
    const progress=target>0
      ? fmtTons(hauled)+' / '+fmtTons(target)+' · '+Math.max(0,Math.min(100,(hauled/target)*100)).toFixed(1)+'%'
      : fmtTons(hauled)+' · OPEN-ENDED';
    return '• **'+title+'** — '+status+' · '+progress;
  });

  const fields=[
    {
      name:'Current Operations',
      value:activeCount+' active · '+pausedCount+' paused · '+fmtTons(verifiedTons)+' verified hauling',
      inline:false,
    },
  ];
  if(lines.length){
    for(const [index,chunk] of chunkLines(lines,900).entries()){
      fields.push({
        name:index===0?'Active / Paused Jobs':'Active / Paused Jobs · continued',
        value:chunk.join('\n'),
        inline:false,
      });
    }
  }else{
    fields.push({
      name:'Active / Paused Jobs',
      value:'No active Colonization Jobs. Completed work remains available in Colonization Job history.',
      inline:false,
    });
  }

  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:'Colonization Jobs',
      ...(link?{url:link}:{}),
      description:[
        'Live squad colonization work. Individual active-job cards carry full details; completed jobs leave this channel after their completion state has been shown.',
        link?'[Open Colonization Jobs →]('+link+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS.summary,
      fields:fields.slice(0,25),
      footer:{text:'Regiment of Imperial Mongrels · persistent Colonization Jobs summary'},
      ...(latestOperationalTimestamp(operational)?{timestamp:latestOperationalTimestamp(operational)}:{}),
    }],
  };
}

export function buildColonizationJobRemovedPayload(job,{controlUrl=''}={}){
  const link=clean(controlUrl);
  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:'Colonization Job Removed · '+truncate(clean(job?.title||job?.buildName||job?.system)||'Job',150),
      ...(link?{url:link}:{}),
      description:'This job has left the operational Discord channel. Its historical revisions and verified activity remain archived in Mission Control.',
      color:COLORS.removed,
      fields:[{name:'System',value:truncate(clean(job?.system)||'Unknown system',100),inline:true}],
      footer:{text:'Regiment of Imperial Mongrels · Colonization Job history retained'},
    }],
  };
}

async function migrateLegacyOperationsTracking(env,state,newWebhookId){
  const oldOperationsWebhookId=discordOperationsWebhookId(env);
  if(!oldOperationsWebhookId||oldOperationsWebhookId===newWebhookId)return;

  let changed=false;
  if(state.summary?.messageId&&state.summary.webhookId===oldOperationsWebhookId){
    try{await deleteOperationsDiscordMessage(env,state.summary.messageId);}
    catch(error){
      if(Number(error?.status)!==404){
        console.error('Could not remove legacy Colonization Jobs summary from System Testing Discord',error);
        throw error;
      }
    }
    state.summary=null;
    changed=true;
  }

  for(const [jobId,row] of Object.entries(state.jobs||{})){
    if(!row?.messageId||row.webhookId!==oldOperationsWebhookId)continue;
    try{await deleteOperationsDiscordMessage(env,row.messageId);}
    catch(error){
      if(Number(error?.status)!==404){
        console.error('Could not remove legacy Colonization Job card from System Testing Discord',row?.title,error);
        throw error;
      }
    }
    delete state.jobs[jobId];
    changed=true;
  }

  if(changed)await writeState(env,state);
}

async function readArchiveState(env){
  try{
    const stored=await env.DAILY_ORDERS.get(ARCHIVE_STATE_KEY,{type:'json'});
    const source=stored&&typeof stored==='object'&&stored.jobs&&typeof stored.jobs==='object'?stored.jobs:{};
    const jobs={};
    for(const [jobId,row] of Object.entries(source)){
      if(!row||typeof row!=='object')continue;
      jobs[jobId]={
        messageId:clean(row.messageId),
        webhookId:clean(row.webhookId),
        fingerprint:clean(row.fingerprint),
        link:clean(row.link),
        title:clean(row.title),
        system:clean(row.system),
        completedAt:iso(row.completedAt),
        archivedAt:iso(row.archivedAt),
      };
    }
    return{version:1,jobs,updatedAt:iso(stored?.updatedAt)};
  }catch(error){
    console.error('Could not read Colonization Archive Discord state',error);
    return{version:1,jobs:{},updatedAt:null};
  }
}
async function writeArchiveState(env,state){
  await env.DAILY_ORDERS.put(ARCHIVE_STATE_KEY,JSON.stringify({
    version:1,
    jobs:state?.jobs&&typeof state.jobs==='object'?state.jobs:{},
    updatedAt:iso(state?.updatedAt)||new Date().toISOString(),
  }));
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
    const rawSummary=stored?.summary&&typeof stored.summary==='object'?stored.summary:null;
    const summary=rawSummary?{
      messageId:clean(rawSummary.messageId),
      webhookId:clean(rawSummary.webhookId),
      fingerprint:clean(rawSummary.fingerprint),
      lastSyncedAt:iso(rawSummary.lastSyncedAt),
      lastMode:clean(rawSummary.lastMode),
    }:null;
    return{version:2,jobs,summary};
  }catch(error){
    console.error('Could not read Colonization Discord state',error);
    return{version:2,jobs:{},summary:null};
  }
}
async function writeState(env,state){
  await env.DAILY_ORDERS.put(STATE_KEY,JSON.stringify({version:2,jobs:state.jobs||{},summary:state.summary||null}));
}

function syncSummary({configured,error='',results=[],summary=null}={}){
  const rows=Array.isArray(results)?results:[];
  return{
    feature:'colonization_jobs',
    configured:Boolean(configured),
    error:error||null,
    results:rows,
    summary:summary||null,
    created:rows.filter(row=>row.mode==='created'||row.mode==='recreated').length,
    edited:rows.filter(row=>row.mode==='edited').length,
    deleted:rows.filter(row=>row.mode==='deleted'||row.mode==='message_missing').length,
    unchanged:rows.filter(row=>row.mode==='unchanged').length,
    completionShown:rows.filter(row=>row.mode==='edited'&&row.status==='completed').length,
    failed:rows.filter(row=>row.ok===false&&row.attempted).length,
    tracked:rows.length,
  };
}
function mutationResult({configured,error='',job=null,archive=null,summary=null}={}){
  return{
    feature:'colonization_job_mutation',
    configured:Boolean(configured),
    error:error||null,
    job,
    archive,
    summary,
    ok:Boolean((job?.ok??true)&&(archive?.ok??true)&&(summary?.ok??true)&&!error),
    attempted:Boolean(job?.attempted||archive?.attempted||summary?.attempted),
    mode:archive?.mode||job?.mode||summary?.mode||'unchanged',
  };
}
function summaryMessageResult(value){return{feature:'colonization_summary',...value}}
function archiveResult(value){return{feature:'colonization_archive',...value}}
function archiveSummary({configured,error='',results=[]}={}){
  const rows=Array.isArray(results)?results:[];
  return{
    feature:'colonization_archive',
    configured:Boolean(configured),
    error:error||null,
    results:rows,
    archived:rows.filter(row=>row.mode==='archived'||row.mode==='recreated').length,
    updated:rows.filter(row=>row.mode==='updated').length,
    alreadyArchived:rows.filter(row=>row.mode==='already_archived').length,
    failed:rows.filter(row=>row.ok===false&&row.attempted).length,
    completedJobs:rows.length,
  };
}
function discordTime(value){
  const time=Date.parse(value||'');
  return Number.isFinite(time)?'<t:'+Math.floor(time/1000)+':F>':clean(value);
}
function result(value){return{feature:'colonization_job',status:value?.status||null,...value}}
function payloadFingerprint(payload){return hashText(JSON.stringify(payload?.embeds||[]))}
function hashText(value){
  let hash=2166136261;
  const text=String(value||'');
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function chunkLines(lines,maxChars){
  const chunks=[];
  let current=[];
  let size=0;
  for(const raw of lines){
    const line=truncate(raw,260);
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
function latestOperationalTimestamp(jobs){
  const values=(Array.isArray(jobs)?jobs:[]).flatMap(job=>[job?.updatedAt,job?.lastContributionAt]);
  return latestIso(...values);
}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function truncate(value,max){const text=clean(value);return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…'}
function escapeMarkdown(value){return clean(value).replace(/([\\*_{}\[\]()<>#+\-.!|~])/g,'\\$1')}
function fmtTons(value){return Math.max(0,Math.round(Number(value)||0)).toLocaleString()+' t'}
function fmtMillions(value){return (Math.round((Number(value)||0)*10)/10).toLocaleString()+'M Cr'}
function iso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null}
function latestIso(...values){
  const times=values.map(value=>Date.parse(value||'')).filter(Number.isFinite);
  return times.length?new Date(Math.max(...times)).toISOString():null;
}
