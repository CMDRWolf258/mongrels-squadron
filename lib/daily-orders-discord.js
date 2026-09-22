import {
  createOperationsDiscordMessage,
  discordOperationsConfigured,
  discordOperationsWebhookId,
  editOperationsDiscordMessage,
} from './discord-webhook.js';

const STATE_KEY='discord-daily-orders-v1';
const DEFAULT_COLOR=0x22d3ee;
const CLEARED_COLOR=0x64748b;

export async function syncDailyOrdersDiscord(env,{
  document,
  actor='Mongrel Officer',
  missionControlUrl='',
  publicationId='',
}={}){
  if(!discordOperationsConfigured(env)){
    return result({configured:false,attempted:false,ok:false,mode:'not_configured'});
  }
  if(!storageReady(env)){
    return result({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});
  }

  const cycleId=clean(document?.cycleId);
  if(!document?.configured||!cycleId){
    return result({configured:true,attempted:false,ok:false,mode:'invalid_document',error:'daily_orders_cycle_missing'});
  }

  const state=await readState(env);
  const webhookId=discordOperationsWebhookId(env);
  const current=state.current;
  const payload=buildDailyOrdersDiscordPayload(document,{actor,missionControlUrl});

  try{
    let sent;
    let mode;
    if(current?.messageId&&current?.webhookId===webhookId){
      try{
        sent=await editOperationsDiscordMessage(env,current.messageId,payload);
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
    state.current={
      cycleId,
      messageId:clean(sent.messageId),
      webhookId,
      publicationId:clean(publicationId),
      lastSyncedAt:syncedAt,
      lastMode:mode,
      cleared:false,
    };
    await writeState(env,state);
    return result({
      configured:true,
      attempted:true,
      ok:true,
      mode,
      messageId:state.current.messageId,
      syncedAt,
    });
  }catch(error){
    console.error('Could not sync Daily Orders to Discord',error);
    return result({
      configured:true,
      attempted:true,
      ok:false,
      mode:'failed',
      error:clean(error?.message)||'discord_daily_orders_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export async function clearDailyOrdersDiscord(env,{
  previous,
  actor='Mongrel Officer',
  missionControlUrl='',
  publicationId='',
}={}){
  if(!discordOperationsConfigured(env)){
    return result({configured:false,attempted:false,ok:false,mode:'not_configured'});
  }
  if(!storageReady(env)){
    return result({configured:true,attempted:false,ok:false,mode:'tracking_unavailable',error:'discord_state_storage_not_configured'});
  }

  const state=await readState(env);
  const current=state.current;
  const previousCycleId=clean(previous?.cycleId);
  const webhookId=discordOperationsWebhookId(env);
  if(!current?.messageId||current.webhookId!==webhookId){
    return result({configured:true,attempted:false,ok:true,mode:'no_tracked_message'});
  }

  try{
    const sent=await editOperationsDiscordMessage(
      env,
      current.messageId,
      buildDailyOrdersClearedPayload(previous,{actor,missionControlUrl}),
    );
    const syncedAt=new Date().toISOString();
    state.current={
      ...current,
      cycleId:previousCycleId||current.cycleId,
      messageId:clean(sent.messageId)||current.messageId,
      publicationId:clean(publicationId),
      lastSyncedAt:syncedAt,
      lastMode:'cleared',
      cleared:true,
    };
    await writeState(env,state);
    return result({
      configured:true,
      attempted:true,
      ok:true,
      mode:'cleared',
      messageId:state.current.messageId,
      syncedAt,
    });
  }catch(error){
    if(Number(error?.status)===404){
      state.current=null;
      await writeState(env,state);
      return result({configured:true,attempted:true,ok:true,mode:'message_missing'});
    }
    console.error('Could not clear Daily Orders Discord message',error);
    return result({
      configured:true,
      attempted:true,
      ok:false,
      mode:'failed',
      error:clean(error?.message)||'discord_daily_orders_clear_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    });
  }
}

export function buildDailyOrdersDiscordPayload(document,{actor='Mongrel Officer',missionControlUrl=''}={}){
  const orders=Array.isArray(document?.orders)?document.orders.slice(0,24):[];
  const groups=new Map();
  for(const order of orders){
    const system=truncate(clean(order?.system)||'Squad-wide',52);
    if(!groups.has(system))groups.set(system,[]);
    groups.get(system).push(order);
  }

  const fields=[];
  for(const [system,systemOrders] of groups){
    const lines=systemOrders.map(order=>orderDiscordLine(order));
    fields.push({
      name:system,
      value:truncate(lines.join('\n'),1024),
      inline:false,
    });
  }

  const link=clean(missionControlUrl);
  const briefing=truncate(clean(document?.briefing)||'Current squadron operational assignments are live in Mission Control.',480);
  const description=[
    briefing,
    link?'[Open Mission Control →]('+link+')':'',
  ].filter(Boolean).join('\n\n');

  const systems=groups.size;
  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:truncate(clean(document?.title)||'Squadron Daily Orders',120),
      ...(link?{url:link}:{}),
      description:truncate(description,700),
      color:DEFAULT_COLOR,
      fields,
      footer:{
        text:truncate(
          'Regiment of Imperial Mongrels · '+orders.length+' task'+(orders.length===1?'':'s')
          +' · '+systems+' system'+(systems===1?'':'s')
          +' · Published by '+clean(actor),
          180,
        ),
      },
      timestamp:iso(document?.updatedAt)||new Date().toISOString(),
    }],
  };
}

export function buildDailyOrdersClearedPayload(previous,{actor='Mongrel Officer',missionControlUrl=''}={}){
  const link=clean(missionControlUrl);
  const oldCount=Array.isArray(previous?.orders)?previous.orders.length:0;
  return {
    username:'Mongrel Mission Control',
    embeds:[{
      title:'Daily Orders Cleared',
      ...(link?{url:link}:{}),
      description:[
        'The current Mission Control Daily Orders have been cleared. The previous assignments are no longer active.',
        link?'[Open Mission Control →]('+link+')':'',
      ].filter(Boolean).join('\n\n'),
      color:CLEARED_COLOR,
      fields:[
        {name:'Previous task count',value:String(oldCount),inline:true},
        {name:'Cleared by',value:truncate(clean(actor)||'Mongrel Officer',100),inline:true},
      ],
      footer:{text:'Regiment of Imperial Mongrels · Mission Control'},
      timestamp:new Date().toISOString(),
    }],
  };
}

function orderDiscordLine(order){
  const priority=truncate(clean(order?.priority).toUpperCase(),18);
  const kind=truncate(clean(order?.kind||order?.reporting?.type).replaceAll('_',' ').toUpperCase(),24);
  const label=[priority,kind].filter(Boolean).join(' · ');
  const task=truncate(clean(order?.task)||'Operational task',110);
  const prefix=label?'**'+escapeMarkdown(label)+'** ':'';
  return truncate('• '+prefix+escapeMarkdown(task),140);
}

async function readState(env){
  try{
    const stored=await env.DAILY_ORDERS.get(STATE_KEY,{type:'json'});
    if(!stored||typeof stored!=='object')return{version:1,current:null};
    const current=stored.current&&typeof stored.current==='object'?{
      cycleId:clean(stored.current.cycleId),
      messageId:clean(stored.current.messageId),
      webhookId:clean(stored.current.webhookId),
      publicationId:clean(stored.current.publicationId),
      lastSyncedAt:iso(stored.current.lastSyncedAt),
      lastMode:clean(stored.current.lastMode),
      cleared:Boolean(stored.current.cleared),
    }:null;
    return{version:1,current};
  }catch(error){
    console.error('Could not read Daily Orders Discord state',error);
    return{version:1,current:null};
  }
}
async function writeState(env,state){
  await env.DAILY_ORDERS.put(STATE_KEY,JSON.stringify({version:1,current:state.current||null}));
}

function result(value){return{feature:'daily_orders',...value}}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function truncate(value,max){
  const text=clean(value);
  if(text.length<=max)return text;
  return text.slice(0,Math.max(1,max-1)).trimEnd()+'…';
}
function escapeMarkdown(value){return clean(value).replace(/([\\*_{}\[\]()<>#+\-.!|~])/g,'\\$1')}
function iso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null}
