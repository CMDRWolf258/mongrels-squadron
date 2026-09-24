import {
  createSquadPayoutsDiscordMessage,
  deleteOperationsDiscordMessage,
  deleteSquadPayoutsDiscordMessage,
  discordOperationsWebhookId,
  discordSquadPayoutsConfigured,
  discordSquadPayoutsWebhookId,
  editSquadPayoutsDiscordMessage,
} from './discord-webhook.js';
import { listAllRewardEntries } from './reward-ledger.js';
import { readRewardPayoutRequest, rewardPayoutRequestView } from './reward-payout-requests.js';

const STATE_KEY='discord-rewards-v1';
const COLORS={
  summary:0x22d3ee,
  requested:0xf59e0b,
  paid:0x22c55e,
  cancelled:0x94a3b8,
};

export async function loadRewardDiscordView(env){
  const allEntries=await listAllRewardEntries(env);
  const entries=allEntries.filter(entry=>entry?.fundingMode!=='member');
  const personalEntries=allEntries.filter(entry=>
    entry?.fundingMode==='member'
    && ['owed','payment_sent'].includes(entry?.status)
    && Number(entry?.amountCredits)>0
  );
  const grouped=new Map();

  for(const entry of entries){
    const ownerId=clean(entry?.ownerId);
    if(!ownerId)continue;
    const member=grouped.get(ownerId)||{
      ownerId,
      displayName:clean(entry?.displayName)||'Mongrel CMDR',
      entries:[],
      owedCredits:0,
      owedEntryCount:0,
      paidCredits:0,
      latestAt:null,
    };
    member.entries.push(entry);
    const amount=Math.max(0,Math.round(Number(entry?.amountCredits)||0));
    if(entry?.status==='owed'){
      member.owedCredits+=amount;
      member.owedEntryCount+=1;
    }else if(entry?.status==='paid'){
      member.paidCredits+=amount;
    }
    if(entry?.createdAt&&(!member.latestAt||String(entry.createdAt)>String(member.latestAt)))member.latestAt=entry.createdAt;
    if(entry?.displayName)member.displayName=clean(entry.displayName)||member.displayName;
    grouped.set(ownerId,member);
  }

  const members=await Promise.all([...grouped.values()].map(async member=>{
    let requestRecord=null;
    try{requestRecord=await readRewardPayoutRequest(env,member.ownerId);}
    catch(error){console.error('Could not read payout request for Rewards Discord',member.displayName,error);}
    const payoutRequest=rewardPayoutRequestView(requestRecord,member.entries);
    return{
      ownerId:member.ownerId,
      displayName:member.displayName,
      owedCredits:Math.round(member.owedCredits),
      owedEntryCount:member.owedEntryCount,
      paidCredits:Math.round(member.paidCredits),
      latestAt:member.latestAt,
      payoutRequest,
    };
  }));

  members.sort((a,b)=>
    Number(Boolean(b.payoutRequest?.active))-Number(Boolean(a.payoutRequest?.active))
    || b.owedCredits-a.owedCredits
    || a.displayName.localeCompare(b.displayName)
  );

  const outstanding=members.filter(member=>member.owedCredits>0);
  const activeRequests=members.filter(member=>member.payoutRequest?.active);
  const personalOutstanding=groupPersonalRewards(personalEntries);
  const personalRecipients=new Set(personalOutstanding.map(row=>row.ownerId).filter(Boolean));
  const personalPayers=new Set(personalOutstanding.map(row=>row.payerOwnerId||row.payerDisplayName).filter(Boolean));
  return{
    generatedAt:new Date().toISOString(),
    members,
    outstanding,
    activeRequests,
    personalOutstanding,
    summary:{
      totalOwedCredits:outstanding.reduce((sum,row)=>sum+row.owedCredits,0),
      memberCount:outstanding.length,
      activeRequestCount:activeRequests.length,
      requestedRemainingCredits:activeRequests.reduce((sum,row)=>sum+(Number(row.payoutRequest?.requestedRemainingCredits)||0),0),
      personalOutstandingCredits:personalOutstanding.reduce((sum,row)=>sum+row.unsettledCredits,0),
      personalOwedCredits:personalOutstanding.reduce((sum,row)=>sum+row.owedCredits,0),
      personalPaymentSentCredits:personalOutstanding.reduce((sum,row)=>sum+row.paymentSentCredits,0),
      personalRecipientCount:personalRecipients.size,
      personalPayerCount:personalPayers.size,
      personalRewardCount:personalOutstanding.reduce((sum,row)=>sum+row.entryCount,0),
    },
  };
}

export async function syncRewardDiscordBoard(env,{
  view,
  adminUrl='',
  rewardsUrl='',
  createMissing=false,
}={}){
  if(!discordSquadPayoutsConfigured(env))return boardResult({configured:false});
  if(!storageReady(env))return boardResult({configured:true,error:'discord_state_storage_not_configured'});
  if(!view||!Array.isArray(view.members))return boardResult({configured:true,error:'reward_discord_view_missing'});

  const state=await readState(env);
  const webhookId=discordSquadPayoutsWebhookId(env);
  if(createMissing){
    await migrateLegacyOperationsTracking(env,state,webhookId);
  }
  const summary=await syncRewardSummaryDiscord(env,{
    state,view,adminUrl,rewardsUrl,createMissing,
  });

  const boardSeededHere=Boolean(state.summary?.messageId&&state.summary.webhookId===webhookId);
  const allowCreate=createMissing||boardSeededHere;
  const activeKeys=new Set();
  const results=[];

  for(const member of view.activeRequests||[]){
    const key=ownerKey(member.ownerId);
    activeKeys.add(key);
    results.push(await syncPayoutRequestCard(env,{
      state,
      member,
      adminUrl,
      rewardsUrl,
      createMissing:allowCreate,
    }));
  }

  const memberMap=new Map((view.members||[]).map(member=>[ownerKey(member.ownerId),member]));
  for(const [key,tracked] of Object.entries(state.requestCards||{})){
    if(!tracked?.messageId||tracked.webhookId!==webhookId||activeKeys.has(key))continue;
    if(tracked.phase==='resolved'){
      results.push(await deletePayoutRequestCard(env,state,key,tracked,'resolved_cleanup'));
      continue;
    }
    const member=memberMap.get(key)||null;
    const outcome=member?.payoutRequest?.state==='cancelled'
      ? 'cancelled'
      : member?.payoutRequest?.state==='fulfilled'
        ? 'paid'
        : 'closed';
    results.push(await showPayoutRequestResolved(env,{
      state,key,tracked,member,adminUrl,rewardsUrl,outcome,
    }));
  }

  return boardResult({configured:true,summary,results,view});
}

export async function syncRewardSummaryDiscord(env,{
  state=null,
  view,
  adminUrl='',
  rewardsUrl='',
  createMissing=false,
}={}){
  if(!discordSquadPayoutsConfigured(env))return summaryResult({configured:false,attempted:false,ok:false,mode:'not_configured'});
  if(!storageReady(env))return summaryResult({configured:true,attempted:false,ok:false,mode:'tracking_unavailable'});
  const working=state||await readState(env);
  const webhookId=discordSquadPayoutsWebhookId(env);
  const tracked=working.summary;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return summaryResult({configured:true,attempted:false,ok:true,mode:'not_tracked'});
  }

  const payload=buildRewardSummaryDiscordPayload(view,{adminUrl,rewardsUrl});
  const fingerprint=payloadFingerprint(payload);
  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint){
    return summaryResult({configured:true,attempted:false,ok:true,mode:'unchanged',messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editSquadPayoutsDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createSquadPayoutsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createSquadPayoutsDiscordMessage(env,payload);
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
    console.error('Could not sync Rewards summary to Discord',error);
    return summaryResult({
      configured:true,attempted:true,ok:false,mode:'failed',
      error:clean(error?.message)||'discord_rewards_summary_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export function buildRewardSummaryDiscordPayload(view,{adminUrl='',rewardsUrl=''}={}){
  const summary=view?.summary||{};
  const active=Array.isArray(view?.activeRequests)?view.activeRequests:[];
  const outstanding=Array.isArray(view?.outstanding)?view.outstanding:[];
  const fields=[{
    name:'Squad Treasury',
    value:[
      '**'+formatCredits(summary.totalOwedCredits)+'** outstanding',
      Number(summary.memberCount||0)+' CMDR'+(Number(summary.memberCount||0)===1?'':'s')+' owed',
      Number(summary.activeRequestCount||0)+' active payout request'+(Number(summary.activeRequestCount||0)===1?'':'s'),
      Number(summary.activeRequestCount||0)>0?formatCredits(summary.requestedRemainingCredits)+' currently requested':'',
    ].filter(Boolean).join(' · '),
    inline:false,
  }];

  const personal=Array.isArray(view?.personalOutstanding)?view.personalOutstanding:[];
  const personalLines=personal.map(row=>personalRewardSummaryLine(row));
  if(personalLines.length){
    const chunks=chunkLines(personalLines.slice(0,40),820);
    for(const [index,chunk] of chunks.entries()){
      const overview=index===0
        ?'**'+formatCredits(summary.personalOutstandingCredits)+'** unsettled · '
          +Number(summary.personalRecipientCount||0)+' recipient'+(Number(summary.personalRecipientCount||0)===1?'':'s')
          +' · '+Number(summary.personalPayerCount||0)+' payer'+(Number(summary.personalPayerCount||0)===1?'':'s')
        :'';
      fields.push({
        name:index===0?'Personal Job Rewards':'Personal Job Rewards · continued',
        value:[overview,...chunk].filter(Boolean).join('\n'),
        inline:false,
      });
    }
    if(personalLines.length>40){
      fields.push({
        name:'More Personal Job Rewards',
        value:'+'+(personalLines.length-40)+' additional outstanding personal-job reward groups are tracked in the Rewards ledger.',
        inline:false,
      });
    }
  }else{
    fields.push({
      name:'Personal Job Rewards',
      value:'No personally funded job rewards are currently awaiting payment or confirmation.',
      inline:false,
    });
  }

  const requestLines=active.map(member=>requestSummaryLine(member));
  if(requestLines.length){
    for(const [index,chunk] of chunkLines(requestLines,900).entries()){
      fields.push({
        name:index===0?'Payout Requests':'Payout Requests · continued',
        value:chunk.join('\n'),
        inline:false,
      });
    }
  }else{
    fields.push({name:'Payout Requests',value:'No members are currently waiting to collect a squad payout.',inline:false});
  }

  const owedLines=outstanding.map(member=>outstandingSummaryLine(member));
  if(owedLines.length){
    for(const [index,chunk] of chunkLines(owedLines.slice(0,40),900).entries()){
      fields.push({
        name:index===0?'Outstanding Balances':'Outstanding Balances · continued',
        value:chunk.join('\n'),
        inline:false,
      });
    }
    if(owedLines.length>40){
      fields.push({
        name:'More Outstanding Rewards',
        value:'+'+(owedLines.length-40)+' additional CMDR balances are available in Reward Administration.',
        inline:false,
      });
    }
  }else{
    fields.push({name:'Outstanding Balances',value:'No squad-funded reward balance is currently outstanding.',inline:false});
  }

  const rewards=clean(rewardsUrl);
  return{
    username:'Mongrel Mission Control',
    embeds:[{
      title:'Rewards & Payouts',
      ...(rewards?{url:rewards}:{}),
      description:[
        'Verified squad-funded rewards and personally funded job rewards are tracked here. Payers are shown on personal jobs so the squad can see who earned what without mixing those obligations into the Squad Treasury.',
        rewards?'[Open Rewards account →]('+rewards+')':'',
      ].filter(Boolean).join('\n\n'),
      color:COLORS.summary,
      fields:fields.slice(0,25),
      footer:{text:'Regiment of Imperial Mongrels · squad + personal job rewards · mentions disabled'},
    }],
  };
}

export function buildPayoutRequestDiscordPayload(member,{
  adminUrl='',
  rewardsUrl='',
  resolved=false,
  outcome='',
  tracked=null,
}={}){
  const request=member?.payoutRequest||tracked?.request||{};
  const displayName=clean(member?.displayName||tracked?.displayName)||'Mongrel CMDR';
  const state=resolved?(outcome||'closed'):'requested';
  const requested=Number(request?.requestedCredits??tracked?.request?.requestedCredits)||0;
  const remaining=Number(request?.requestedRemainingCredits??tracked?.request?.requestedRemainingCredits)||0;
  const current=Number(request?.currentAvailableCredits??member?.owedCredits??tracked?.currentAvailableCredits)||0;
  const newer=Number(request?.newSinceRequestCredits)||0;
  const fields=[
    {name:'CMDR',value:truncate(displayName,120),inline:true},
    {name:'Status',value:state==='paid'?'PAID':state==='cancelled'?'CANCELLED':state==='closed'?'CLOSED':'PAYOUT REQUESTED',inline:true},
    {name:'Original Request',value:formatCredits(requested),inline:true},
  ];

  if(!resolved){
    fields.push({name:'Requested Remaining',value:formatCredits(remaining),inline:true});
    fields.push({name:'Current Squad Balance',value:formatCredits(current),inline:true});
    fields.push({name:'Requested Entries',value:String(Number(request?.requestedEntryCount)||0),inline:true});
    if(newer>0){
      fields.push({
        name:'New Rewards Since Request',
        value:'**'+formatCredits(newer)+'** · not included in this payout request.',
        inline:false,
      });
    }
    if(request?.requestedAt){
      fields.push({name:'Requested',value:discordTime(request.requestedAt),inline:false});
    }
  }else if(state==='paid'){
    fields.push({name:'Settlement',value:'The requested reward entries have been marked PAID. This card will leave this channel on the next Rewards sync.',inline:false});
  }else if(state==='cancelled'){
    fields.push({name:'Request',value:'The member cancelled this payout request. Their unpaid reward balance remains in the ledger.',inline:false});
  }else{
    fields.push({name:'Request',value:'This payout request is no longer active. The card will leave this channel on the next Rewards sync.',inline:false});
  }

  const rewards=clean(rewardsUrl);
  return{
    username:'Mongrel Mission Control',
    embeds:[{
      title:(state==='paid'?'✓ PAID · ':state==='cancelled'?'PAYOUT CANCELLED · ':state==='closed'?'PAYOUT CLOSED · ':'PAYOUT REQUESTED · ')+truncate(displayName,140),
      ...(rewards?{url:rewards}:{}),
      description:[
        state==='requested'
          ? 'A Mongrel member is ready to collect squad-funded rewards.'
          : state==='paid'
            ? 'Squad reward payout completed.'
            : state==='cancelled'
              ? 'The member withdrew this collection request.'
              : 'This collection request closed.',
        rewards?'[Open Rewards account →]('+rewards+')':'',
      ].filter(Boolean).join('\n\n'),
      color:state==='paid'?COLORS.paid:state==='cancelled'||state==='closed'?COLORS.cancelled:COLORS.requested,
      fields,
      footer:{text:'Regiment of Imperial Mongrels · squad reward payout'},
    }],
  };
}

async function syncPayoutRequestCard(env,{
  state,
  member,
  adminUrl='',
  rewardsUrl='',
  createMissing=false,
}={}){
  const key=ownerKey(member?.ownerId);
  if(!key)return cardResult({configured:true,attempted:false,ok:false,mode:'invalid_member'});
  const webhookId=discordSquadPayoutsWebhookId(env);
  const tracked=state.requestCards[key]||null;
  if((!tracked?.messageId||tracked.webhookId!==webhookId)&&!createMissing){
    return cardResult({configured:true,attempted:false,ok:true,mode:'not_tracked',displayName:member.displayName});
  }

  const payload=buildPayoutRequestDiscordPayload(member,{adminUrl,rewardsUrl,tracked});
  const fingerprint=payloadFingerprint(payload);
  if(tracked?.messageId&&tracked.webhookId===webhookId&&tracked.fingerprint===fingerprint&&tracked.phase==='operational'){
    return cardResult({configured:true,attempted:false,ok:true,mode:'unchanged',displayName:member.displayName,messageId:tracked.messageId});
  }

  try{
    let sent;
    let mode;
    if(tracked?.messageId&&tracked.webhookId===webhookId){
      try{
        sent=await editSquadPayoutsDiscordMessage(env,tracked.messageId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createSquadPayoutsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createSquadPayoutsDiscordMessage(env,payload);
      mode='created';
    }
    state.requestCards[key]={
      ownerId:clean(member.ownerId),
      displayName:clean(member.displayName),
      messageId:clean(sent.messageId),
      webhookId,
      fingerprint,
      phase:'operational',
      request:snapshotRequest(member.payoutRequest),
      currentAvailableCredits:Math.max(0,Math.round(Number(member.owedCredits)||0)),
      lastSyncedAt:new Date().toISOString(),
      lastMode:mode,
    };
    await writeState(env,state);
    return cardResult({configured:true,attempted:true,ok:true,mode,displayName:member.displayName,messageId:state.requestCards[key].messageId});
  }catch(error){
    console.error('Could not sync payout request card to Discord',member?.displayName,error);
    return cardResult({
      configured:true,attempted:true,ok:false,mode:'failed',displayName:member?.displayName,
      error:clean(error?.message)||'discord_payout_request_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

async function showPayoutRequestResolved(env,{
  state,key,tracked,member=null,adminUrl='',rewardsUrl='',outcome='closed',
}={}){
  const payload=buildPayoutRequestDiscordPayload(member,{adminUrl,rewardsUrl,resolved:true,outcome,tracked});
  const fingerprint=payloadFingerprint(payload);
  try{
    const sent=await editSquadPayoutsDiscordMessage(env,tracked.messageId,payload);
    state.requestCards[key]={
      ...tracked,
      messageId:clean(sent.messageId)||tracked.messageId,
      fingerprint,
      phase:'resolved',
      outcome,
      lastSyncedAt:new Date().toISOString(),
      lastMode:outcome==='paid'?'paid_shown':outcome==='cancelled'?'cancelled_shown':'resolved_shown',
    };
    await writeState(env,state);
    return cardResult({
      configured:true,attempted:true,ok:true,
      mode:outcome==='paid'?'paid_shown':outcome==='cancelled'?'cancelled_shown':'resolved_shown',
      displayName:tracked.displayName,messageId:tracked.messageId,
    });
  }catch(error){
    if(Number(error?.status)===404){
      delete state.requestCards[key];
      await writeState(env,state);
      return cardResult({configured:true,attempted:true,ok:true,mode:'message_missing',displayName:tracked.displayName});
    }
    console.error('Could not show payout request resolution in Discord',tracked?.displayName,error);
    return cardResult({configured:true,attempted:true,ok:false,mode:'failed',displayName:tracked?.displayName,error:clean(error?.message)||'discord_payout_resolution_failed'});
  }
}

async function deletePayoutRequestCard(env,state,key,tracked,reason){
  try{
    await deleteSquadPayoutsDiscordMessage(env,tracked.messageId);
    delete state.requestCards[key];
    await writeState(env,state);
    return cardResult({configured:true,attempted:true,ok:true,mode:'deleted',displayName:tracked.displayName,reason});
  }catch(error){
    if(Number(error?.status)===404){
      delete state.requestCards[key];
      await writeState(env,state);
      return cardResult({configured:true,attempted:true,ok:true,mode:'message_missing',displayName:tracked.displayName,reason});
    }
    console.error('Could not delete resolved payout request card from Discord',tracked?.displayName,error);
    return cardResult({configured:true,attempted:true,ok:false,mode:'failed',displayName:tracked?.displayName,reason,error:clean(error?.message)||'discord_payout_delete_failed'});
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
        console.error('Could not remove legacy Squad Payouts summary from Operations Discord',error);
        throw error;
      }
    }
    state.summary=null;
    changed=true;
  }

  for(const [key,row] of Object.entries(state.requestCards||{})){
    if(!row?.messageId||row.webhookId!==oldOperationsWebhookId)continue;
    try{await deleteOperationsDiscordMessage(env,row.messageId);}
    catch(error){
      if(Number(error?.status)!==404){
        console.error('Could not remove legacy Squad Payouts request card from Operations Discord',row?.displayName,error);
        throw error;
      }
    }
    delete state.requestCards[key];
    changed=true;
  }

  if(changed)await writeState(env,state);
}

async function readState(env){
  try{
    const stored=await env.DAILY_ORDERS.get(STATE_KEY,{type:'json'});
    const cards={};
    for(const [key,row] of Object.entries(stored?.requestCards&&typeof stored.requestCards==='object'?stored.requestCards:{})){
      if(!row||typeof row!=='object')continue;
      cards[key]={
        ownerId:clean(row.ownerId),
        displayName:clean(row.displayName),
        messageId:clean(row.messageId),
        webhookId:clean(row.webhookId),
        fingerprint:clean(row.fingerprint),
        phase:row.phase==='resolved'?'resolved':'operational',
        outcome:clean(row.outcome),
        request:snapshotRequest(row.request),
        currentAvailableCredits:Math.max(0,Math.round(Number(row.currentAvailableCredits)||0)),
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
    return{version:1,summary,requestCards:cards};
  }catch(error){
    console.error('Could not read Rewards Discord state',error);
    return{version:1,summary:null,requestCards:{}};
  }
}
async function writeState(env,state){
  await env.DAILY_ORDERS.put(STATE_KEY,JSON.stringify({
    version:1,
    summary:state.summary||null,
    requestCards:state.requestCards||{},
  }));
}

function snapshotRequest(value={}){
  return{
    state:clean(value?.state),
    active:Boolean(value?.active),
    requestId:clean(value?.requestId),
    requestedAt:iso(value?.requestedAt),
    requestedCredits:Math.max(0,Math.round(Number(value?.requestedCredits)||0)),
    requestedRemainingCredits:Math.max(0,Math.round(Number(value?.requestedRemainingCredits)||0)),
    requestedEntryCount:Math.max(0,Math.round(Number(value?.requestedEntryCount)||0)),
    currentAvailableCredits:Math.max(0,Math.round(Number(value?.currentAvailableCredits)||0)),
    newSinceRequestCredits:Math.max(0,Math.round(Number(value?.newSinceRequestCredits)||0)),
  };
}
function groupPersonalRewards(entries=[]){
  const grouped=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
    const ownerId=clean(entry?.ownerId);
    const payerOwnerId=clean(entry?.payerOwnerId);
    const payerDisplayName=clean(entry?.payerDisplayName)||'Posting CMDR';
    const sourceJobId=clean(entry?.sourceJobId);
    if(!ownerId)continue;
    const key=[payerOwnerId||payerDisplayName,ownerId,sourceJobId||clean(entry?.id)].join('|');
    const row=grouped.get(key)||{
      ownerId,
      displayName:clean(entry?.displayName)||'Mongrel CMDR',
      payerOwnerId,
      payerDisplayName,
      sourceJobId,
      reason:'',
      owedCredits:0,
      paymentSentCredits:0,
      unsettledCredits:0,
      entryCount:0,
      latestAt:null,
    };
    const amount=Math.max(0,Math.round(Number(entry?.amountCredits)||0));
    if(entry?.status==='payment_sent')row.paymentSentCredits+=amount;
    else row.owedCredits+=amount;
    row.unsettledCredits+=amount;
    row.entryCount+=1;
    if(entry?.reason)row.reason=clean(entry.reason);
    if(entry?.displayName)row.displayName=clean(entry.displayName)||row.displayName;
    if(entry?.payerDisplayName)row.payerDisplayName=clean(entry.payerDisplayName)||row.payerDisplayName;
    if(entry?.createdAt&&(!row.latestAt||String(entry.createdAt)>String(row.latestAt)))row.latestAt=entry.createdAt;
    grouped.set(key,row);
  }
  return [...grouped.values()].sort((a,b)=>
    b.unsettledCredits-a.unsettledCredits
    || a.payerDisplayName.localeCompare(b.payerDisplayName)
    || a.displayName.localeCompare(b.displayName)
  );
}

function personalRewardSummaryLine(row){
  const owed=Math.max(0,Number(row?.owedCredits)||0);
  const sent=Math.max(0,Number(row?.paymentSentCredits)||0);
  const status=owed>0&&sent>0
    ?formatCredits(owed)+' OWED + '+formatCredits(sent)+' SENT'
    :sent>0
      ?'**SENT · awaiting confirmation**'
      :'**OWED**';
  const reason=personalRewardReason(row?.reason);
  return '• **'+escapeMarkdown(row?.displayName||'Mongrel CMDR')+'** — **'+formatCredits(row?.unsettledCredits)+'**'
    +' · payer **'+escapeMarkdown(row?.payerDisplayName||'Posting CMDR')+'**'
    +' · '+status
    +(reason?'\n  ↳ '+escapeMarkdown(reason):'');
}

function personalRewardReason(value){
  const text=clean(value)
    .replace(/^Verified\s+/i,'')
    .replace(/\s+reward\s+·\s+/i,' · ');
  return truncate(text,150);
}

function requestSummaryLine(member){
  const request=member?.payoutRequest||{};
  const newer=Number(request.newSinceRequestCredits)||0;
  return '• **'+escapeMarkdown(member.displayName)+'** — '+formatCredits(request.requestedRemainingCredits)
    +(newer>0?' requested · +'+formatCredits(newer)+' new':'');
}
function outstandingSummaryLine(member){
  return '• **'+escapeMarkdown(member.displayName)+'** — '+formatCredits(member.owedCredits)
    +' · '+Number(member.owedEntryCount||0)+' entr'+(Number(member.owedEntryCount||0)===1?'y':'ies')
    +(member.payoutRequest?.active?' · **PAYOUT REQUESTED**':'');
}
function ownerKey(value){return clean(value)}
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
    feature:'rewards',
    configured:Boolean(configured),
    error:error||null,
    summary,
    results:rows,
    created:rows.filter(row=>['created','recreated'].includes(row.mode)).length,
    edited:rows.filter(row=>row.mode==='edited').length,
    paidShown:rows.filter(row=>row.mode==='paid_shown').length,
    cancelledShown:rows.filter(row=>row.mode==='cancelled_shown').length,
    resolvedShown:rows.filter(row=>row.mode==='resolved_shown').length,
    deleted:rows.filter(row=>['deleted','message_missing'].includes(row.mode)).length,
    unchanged:rows.filter(row=>row.mode==='unchanged').length,
    failed:rows.filter(row=>row.ok===false&&row.attempted).length,
    totalOwedCredits:Number(view?.summary?.totalOwedCredits)||0,
    outstandingMembers:Number(view?.summary?.memberCount)||0,
    activeRequests:Number(view?.summary?.activeRequestCount)||0,
  };
}
function summaryResult(value){return{feature:'rewards_summary',...value}}
function cardResult(value){return{feature:'reward_payout_request',...value}}
function payloadFingerprint(payload){return hashText(JSON.stringify(payload?.embeds||[]))}
function hashText(value){
  let hash=2166136261;
  const text=String(value||'');
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return(hash>>>0).toString(36);
}
function discordTime(value){
  const time=Date.parse(value||'');
  return Number.isFinite(time)?'<t:'+Math.floor(time/1000)+':R>':clean(value);
}
function formatCredits(value){
  const amount=Math.max(0,Math.round(Number(value)||0));
  if(amount>=1_000_000_000)return(amount/1_000_000_000).toLocaleString(undefined,{maximumFractionDigits:2})+'B Cr';
  if(amount>=1_000_000)return(amount/1_000_000).toLocaleString(undefined,{maximumFractionDigits:2})+'M Cr';
  return amount.toLocaleString()+' Cr';
}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function truncate(value,max){const text=clean(value);return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…'}
function escapeMarkdown(value){return clean(value).replace(/([\\*_{}\[\]()<>#+\-.!|~])/g,'\\$1')}
function iso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null}
