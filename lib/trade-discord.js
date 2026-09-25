import { discordRequest } from './discord-onboarding.js';
import {
  isTradeRouteActive,
  listTradeAlertSubscriberIds,
  normalizeTradeControl,
  normalizeTradeDiscordState,
  readTradeControl,
  tradeDiscordChannelId,
  tradePriorityProfile,
} from './trade-intelligence.js';

export const DISCORD_SUPPRESS_NOTIFICATIONS = 1 << 12;
const ALERT_CUSTOM_ID_PREFIX = 'mongrels_trade_alert:';

export function tradeAlertCustomId(routeId) {
  return ALERT_CUSTOM_ID_PREFIX + String(routeId || '').slice(0,80);
}

export function parseTradeAlertCustomId(value) {
  const match=String(value||'').match(/^mongrels_trade_alert:([A-Za-z0-9_-]{8,80})$/);
  return match?{routeId:match[1]}:null;
}

export async function syncTradeDiscord(env,{route,origin='',control=null}={}) {
  if(!route?.id)return result(false,'invalid_route',{configured:false});
  const config=normalizeTradeControl(control||await readTradeControl(env));
  if(!config.discord.autoPublish)return result(true,'auto_publish_disabled',{configured:true,attempted:false});
  if(!env?.DISCORD_BOT_TOKEN)return result(false,'bot_not_configured',{configured:false,attempted:false,error:'DISCORD_BOT_TOKEN is not configured.'});

  const channelId=tradeDiscordChannelId(config);
  if(!channelId)return result(false,'channel_not_configured',{configured:false,attempted:false,error:'Trade Discord channel is not configured.'});

  const tracked=normalizeTradeDiscordState(route.discord);
  const subscriberIds=await listTradeAlertSubscriberIds(env,route.id,{limit:100}).catch(()=>[]);
  const active=isTradeRouteActive(route);
  const payload=active
    ?buildTradeDiscordPayload(route,{origin,control:config,subscriberCount:subscriberIds.length})
    :buildCompactTradeDiscordPayload(route,{control:config,reason:route.status==='complete'?'Complete':'Closed'});

  try{
    let message;
    let mode;
    if(tracked.messageId&&tracked.channelId===channelId){
      try{
        message=await editMessage(env,channelId,tracked.messageId,payload);
        mode=active?'edited':'compacted';
      }catch(error){
        if(!String(error?.message||'').includes('(404)'))throw error;
        message=await createMessage(env,channelId,payload,{silent:config.discord.routineSilent});
        mode='recreated';
      }
    }else{
      if(tracked.messageId&&tracked.channelId&&tracked.channelId!==channelId){
        const prior=buildCompactTradeDiscordPayload(route,{control:config,reason:'Moved to current Trader\'s Outpost feed'});
        await editMessage(env,tracked.channelId,tracked.messageId,prior).catch(()=>{});
      }
      message=await createMessage(env,channelId,payload,{silent:config.discord.routineSilent});
      mode='created';
    }

    return result(true,mode,{
      configured:true,
      attempted:true,
      messageId:clean(message?.id||tracked.messageId),
      channelId,
      lastSyncedAt:new Date().toISOString(),
      lifecycle:active?'active':'closed',
      subscriberCount:subscriberIds.length,
    });
  }catch(error){
    return result(false,'failed',{
      configured:true,
      attempted:true,
      messageId:tracked.messageId,
      channelId:tracked.channelId||channelId,
      lifecycle:tracked.lifecycle,
      error:friendlyError(error),
    });
  }
}

export function applyTradeDiscordState(route,discord) {
  if(!route||!discord)return route;
  const previous=normalizeTradeDiscordState(route.discord);
  if(discord.ok&&discord.messageId){
    route.discord={
      messageId:clean(discord.messageId).slice(0,40),
      channelId:clean(discord.channelId).slice(0,40),
      lastSyncedAt:clean(discord.lastSyncedAt)||new Date().toISOString(),
      lastError:'',
      lifecycle:['active','superseded','closed'].includes(discord.lifecycle)?discord.lifecycle:'active',
    };
  }else if(discord.attempted||discord.configured===false){
    route.discord={
      ...previous,
      lastError:clean(discord.error||discord.mode||'trade_discord_sync_failed').slice(0,300),
    };
  }
  return route;
}

export function buildTradeDiscordPayload(route,{origin='',control=null,subscriberCount=0}={}) {
  const config=normalizeTradeControl(control);
  const profile=tradePriorityProfile(config,route?.intelligence?.priority);
  const fields=[];

  if(clean(route.originSystem)||clean(route.originStation)){
    fields.push({
      name:'📦 Buy / Load',
      value:locationLine(route.originStation,route.originSystem),
      inline:true,
    });
  }
  if(clean(route.destinationSystem)||clean(route.destinationStation)){
    fields.push({
      name:'💰 Sell / Deliver',
      value:locationLine(route.destinationStation,route.destinationSystem),
      inline:true,
    });
  }
  if(Number(route.profitPerTon)>0){
    fields.push({name:'Profit / t',value:number(route.profitPerTon)+' Cr',inline:true});
  }
  if(clean(route.quantity))fields.push({name:'Supply / Demand',value:clean(route.quantity).slice(0,100),inline:true});
  if(clean(route.padSize))fields.push({name:'Pad',value:title(clean(route.padSize)),inline:true});
  if(clean(route.distanceLy))fields.push({name:'Distance',value:clean(route.distanceLy).slice(0,40)+' ly',inline:true});
  if(clean(route.objective))fields.push({name:'Objective',value:clean(route.objective).slice(0,900),inline:false});
  if(clean(route.notes))fields.push({name:'Notes',value:clean(route.notes).slice(0,900),inline:false});

  const testing=config.discord.mode==='testing';
  const description=[
    route.official?'**Official Squadron Route**':'**Member Trade Post**',
    clean(route.ownerName)?'Posted by **'+clean(route.ownerName).slice(0,80)+'**':'',
    testing?'🧪 **TEST FEED** — alerts are being developed in system-testing.':'',
  ].filter(Boolean).join('\n');

  const embed={
    title:'💰 '+clean(route.title||route.commodity||'Trade Opportunity').slice(0,240),
    description,
    color:route.category==='squad'?0x5ee6a8:0x22d3ee,
    fields,
    footer:{
      text:'Regiment of Imperial Mongrels · '+profile.label+' monitoring · '+subscriberCount+' watching',
    },
    timestamp:clean(route.updatedAt||route.createdAt)||new Date().toISOString(),
  };

  const url=tradeUrl(origin,route.id);
  if(url)embed.url=url;

  const buttons=[
    {
      type:2,
      style:2,
      custom_id:tradeAlertCustomId(route.id),
      label:subscriberCount?('Alert Me · '+subscriberCount+' watching'):'Alert Me',
      emoji:{name:'🔔'},
    },
  ];
  if(url)buttons.push({type:2,style:5,label:'View Trader\'s Outpost',url,emoji:{name:'🌐'}});

  return {
    embeds:[embed],
    components:[{type:1,components:buttons}],
    allowed_mentions:{parse:[]},
  };
}

export function buildCompactTradeDiscordPayload(route,{control=null,reason='Superseded'}={}) {
  const config=normalizeTradeControl(control);
  const icon=route.status==='complete'?'✅':'↪️';
  const titleText=clean(route.title||route.commodity||'Trade Opportunity').slice(0,160);
  const routeText=[clean(route.originSystem),clean(route.destinationSystem)].filter(Boolean).join(' → ');
  const suffix=routeText?' · '+routeText:'';
  const testing=config.discord.mode==='testing'?' · TEST':'';
  return {
    content:`${icon} **${reason.toUpperCase()} — ${titleText}**${suffix}${testing}`,
    embeds:[],
    components:[],
    allowed_mentions:{parse:[]},
  };
}

export async function refreshTradeDiscordSubscriberCount(env,{route,origin='',control=null}={}) {
  return syncTradeDiscord(env,{route,origin,control});
}

export async function sendTradeThresholdAlert(env,{route,title:alertTitle='',message='',origin='',control=null}={}) {
  if(!route?.id)return result(false,'invalid_route');
  const config=normalizeTradeControl(control||await readTradeControl(env));
  if(!config.discord.thresholdMessages)return result(true,'threshold_messages_disabled',{attempted:false});
  const channelId=tradeDiscordChannelId(config);
  if(!channelId||!env?.DISCORD_BOT_TOKEN)return result(false,'not_configured',{attempted:false});

  const subscribers=await listTradeAlertSubscriberIds(env,route.id,{limit:70});
  const mentions=subscribers.map(id=>'<@'+id+'>').join(' ');
  const embed={
    title:'⚠️ '+clean(alertTitle||('Trade Alert · '+(route.commodity||route.title||'Opportunity'))).slice(0,240),
    description:clean(message).slice(0,3500)||'A configured Trader\'s Outpost threshold was reached.',
    color:0xf5b942,
    footer:{text:'Regiment of Imperial Mongrels · '+subscribers.length+' subscribed'},
    timestamp:new Date().toISOString(),
  };
  const url=tradeUrl(origin,route.id);
  if(url)embed.url=url;

  try{
    const posted=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
      method:'POST',
      body:JSON.stringify({
        content:mentions,
        embeds:[embed],
        allowed_mentions:{parse:[],users:subscribers},
      }),
    });
    return result(true,'alert_posted',{
      attempted:true,
      messageId:clean(posted?.id),
      channelId,
      subscriberCount:subscribers.length,
    });
  }catch(error){
    return result(false,'failed',{attempted:true,error:friendlyError(error)});
  }
}

async function createMessage(env,channelId,payload,{silent=true}={}) {
  return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
    method:'POST',
    body:JSON.stringify({
      ...payload,
      ...(silent?{flags:DISCORD_SUPPRESS_NOTIFICATIONS}:{}),
    }),
  });
}

async function editMessage(env,channelId,messageId,payload) {
  return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(messageId),{
    method:'PATCH',
    body:JSON.stringify(payload),
  });
}

function tradeUrl(origin,id){
  const base=clean(origin).replace(/\/$/,'');
  return base?base+'/trading/#trade-'+encodeURIComponent(String(id||'')):'';
}
function locationLine(station,system){
  const first=clean(station)||'Station not specified';
  const second=clean(system);
  return second?first+'\n'+second:first;
}
function friendlyError(error){
  const message=clean(error?.message||'trade_discord_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message))return'The Imperial Mongrels Website bot cannot access the configured Trader\'s Outpost Discord channel.';
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message))return'The Imperial Mongrels Website bot needs View Channel, Send Messages, Embed Links, Use External Emoji, and Read Message History in the configured trade channel.';
  return message.slice(0,500);
}
function result(ok,mode,extra={}){return{ok,mode,...extra};}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
function number(value){return Math.max(0,Math.round(Number(value)||0)).toLocaleString();}
function title(value){const text=clean(value);return text?text.charAt(0).toUpperCase()+text.slice(1):'Unknown';}
