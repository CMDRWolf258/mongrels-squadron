import { discordRequest } from './discord-onboarding.js';
import { isRareTradeCommodity } from './trade-rares.js';
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
  return ALERT_CUSTOM_ID_PREFIX + String(routeId || '').slice(0,80) + ':settings';
}

export function tradeAlertActionCustomId(routeId,action='settings') {
  const safeAction=['settings','enable','disable'].includes(action)?action:'settings';
  return ALERT_CUSTOM_ID_PREFIX + String(routeId || '').slice(0,80) + ':' + safeAction;
}

export function parseTradeAlertCustomId(value) {
  const match=String(value||'').match(/^mongrels_trade_alert:([A-Za-z0-9_-]{8,80})(?::(settings|enable|disable))?$/);
  return match?{routeId:match[1],action:match[2]||'settings'}:null;
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


export async function syncTradeWatchDiscord(env,{watch,origin='',control=null}={}) {
  if(!watch?.id)return result(false,'invalid_watch',{configured:false});
  const config=normalizeTradeControl(control||await readTradeControl(env));
  if(!env?.DISCORD_BOT_TOKEN)return result(false,'bot_not_configured',{configured:false,attempted:false,error:'DISCORD_BOT_TOKEN is not configured.'});

  const channelId=tradeDiscordChannelId(config);
  if(!channelId)return result(false,'channel_not_configured',{configured:false,attempted:false,error:'Trade Discord channel is not configured.'});

  const tracked=normalizeWatchDiscordState(watch.discord);
  const subscriberIds=await listTradeAlertSubscriberIds(env,watch.id,{limit:100}).catch(()=>[]);
  const shouldPublish=watch?.discord?.publish!==false&&config.discord.autoPublish!==false;
  const active=watch.status==='active';

  if(!shouldPublish){
    if(!tracked.messageId)return result(true,'watch_publish_disabled',{configured:true,attempted:false,subscriberCount:subscriberIds.length});
    try{
      const payload=buildCompactTradeWatchDiscordPayload(watch,{control:config,reason:'Website-only watch'});
      await editMessage(env,tracked.channelId||channelId,tracked.messageId,payload);
      return result(true,'compacted',{
        configured:true,attempted:true,messageId:tracked.messageId,channelId:tracked.channelId||channelId,
        lastSyncedAt:new Date().toISOString(),lifecycle:'closed',subscriberCount:subscriberIds.length,
      });
    }catch(error){
      return result(false,'failed',{configured:true,attempted:true,messageId:tracked.messageId,channelId:tracked.channelId||channelId,error:friendlyError(error)});
    }
  }

  const payload=active
    ?buildTradeWatchDiscordPayload(watch,{origin,control:config,subscriberCount:subscriberIds.length})
    :buildCompactTradeWatchDiscordPayload(watch,{control:config,reason:'Paused'});

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
        const prior=buildCompactTradeWatchDiscordPayload(watch,{control:config,reason:'Moved to current Trader\'s Outpost feed'});
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
      lifecycle:active?'active':'paused',
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

export async function closeTradeWatchDiscord(env,{watch,reason='Removed',control=null}={}) {
  if(!watch?.id)return result(false,'invalid_watch',{attempted:false});
  const tracked=normalizeWatchDiscordState(watch.discord);
  if(!tracked.messageId||!tracked.channelId)return result(true,'no_watch_message',{attempted:false});
  if(!env?.DISCORD_BOT_TOKEN)return result(false,'bot_not_configured',{attempted:false});
  const config=normalizeTradeControl(control||await readTradeControl(env));
  try{
    await editMessage(env,tracked.channelId,tracked.messageId,buildCompactTradeWatchDiscordPayload(watch,{control:config,reason}));
    return result(true,'compacted',{
      attempted:true,
      messageId:tracked.messageId,
      channelId:tracked.channelId,
      lifecycle:'closed',
      lastSyncedAt:new Date().toISOString(),
    });
  }catch(error){
    return result(false,'failed',{attempted:true,error:friendlyError(error),messageId:tracked.messageId,channelId:tracked.channelId});
  }
}

export function applyTradeWatchDiscordState(watch,discord) {
  if(!watch||!discord)return watch;
  const previous=normalizeWatchDiscordState(watch.discord);
  watch.discord={
    ...watch.discord,
    publish:watch?.discord?.publish!==false,
    routeId:clean(watch?.discord?.routeId).slice(0,80),
    messageId:discord.ok&&discord.messageId?clean(discord.messageId).slice(0,40):previous.messageId,
    channelId:discord.ok&&discord.channelId?clean(discord.channelId).slice(0,40):previous.channelId,
    lastSyncedAt:discord.ok&&discord.lastSyncedAt?clean(discord.lastSyncedAt):previous.lastSyncedAt,
    lastError:discord.ok?'':clean(discord.error||discord.mode||'trade_watch_discord_sync_failed').slice(0,300),
    lifecycle:['active','paused','closed'].includes(discord.lifecycle)?discord.lifecycle:previous.lifecycle,
    lastAlertAt:previous.lastAlertAt,
    lastAlertType:previous.lastAlertType,
  };
  return watch;
}

export function buildTradeWatchDiscordPayload(watch,{origin='',control=null,subscriberCount=0}={}) {
  const config=normalizeTradeControl(control);
  const q=watch?.query||{};
  const evaluation=watch?.evaluation||{};
  const profile=tradePriorityProfile(config,q.priority);
  const buying=q.direction==='buy';
  const volumeLabel=buying?'Supply':'Demand';
  const priceLabel=buying?'Max buy price':'Min sell price';
  const best=evaluation.currentBest&&typeof evaluation.currentBest==='object'?evaluation.currentBest:null;
  const ranked=Array.isArray(evaluation.rankedMarkets)?evaluation.rankedMarkets.filter(Boolean).slice(0,5):[];
  const rareSource=isRareTradeCommodity(q.commodity)&&q.direction==='buy';
  const fields=[
    {
      name:'🔎 Watch Criteria',
      value:(buying?'Buy ':'Sell ')+clean(q.commodity||'Commodity').slice(0,100)+'\nNear **'+clean(q.referenceSystem||'Unknown system').slice(0,120)+'** · '+(rareSource?'all distances (rare source) · distance measured from reference':number(q.radiusLy)+' ly'),
      inline:false,
    },
    {
      name:priceLabel,
      value:Number(q.price)>0?number(q.price)+' Cr/t':'Any',
      inline:true,
    },
    {
      name:'Min '+volumeLabel,
      value:number(q.minVolume)+' t',
      inline:true,
    },
    {
      name:'Matches',
      value:evaluation.matchCount===null||evaluation.matchCount===undefined?'—':number(evaluation.matchCount),
      inline:true,
    },
  ];

  if(best){
    fields.push({
      name:'🏆 Current Best',
      value:'**'+clean(best.stationName||'Unknown station').slice(0,120)+'**\n'+clean(best.systemName||'Unknown system').slice(0,120),
      inline:false,
    });
    fields.push({name:'Price',value:number(best.price)+' Cr/t',inline:true});
    fields.push({name:volumeLabel,value:number(best.volume)+' t',inline:true});
    fields.push({name:'Distance',value:best.distanceLy===null||best.distanceLy===undefined?'—':formatDistance(best.distanceLy)+' ly',inline:true});
    if(best.observedAt)fields.push({name:'Market Data',value:discordRelativeTime(best.observedAt),inline:true});
    const bestBgs=best?.bgs&&typeof best.bgs==='object'?best.bgs:{};
    if(bestBgs.infrastructureFailureMetalOpportunity){
      fields.push({
        name:'⚠ Infrastructure Failure Metal Source',
        value:'**'+clean(bestBgs.controllingFaction||'Unknown controller').slice(0,140)+'** · '+clean(bestBgs.factionState||'Infrastructure Failure').slice(0,100)
          +'\nOwnership/BGS data: **'+clean(bestBgs.metadataFreshness||'unknown')+'**'+(Number.isFinite(Number(bestBgs.metadataAgeMinutes))?' · '+minutesAgeLabel(bestBgs.metadataAgeMinutes):'')
          +(bestBgs.ownershipNeedsConfirmation?'\n⚠ **Ownership needs confirmation** — station-control metadata may lag the market observation.':''),
        inline:false,
      });
    }else if(bestBgs.controllingFaction||bestBgs.factionState){
      fields.push({
        name:'BGS Context',
        value:'**'+clean(bestBgs.controllingFaction||'Unknown controller').slice(0,140)+'** · '+clean(bestBgs.factionState||'No active state').slice(0,100),
        inline:false,
      });
    }
    if(ranked.length>1){
      fields.push({
        name:'↪️ Next Best Markets',
        value:ranked.slice(1,5).map((market,index)=>{
          const distance=market.distanceLy===null||market.distanceLy===undefined?'—':formatDistance(market.distanceLy)+' ly';
          const bgsSuffix=market?.bgs?.infrastructureFailureMetalOpportunity?' · ⚠ Infrastructure Failure':'';
          return '**#'+(index+2)+' '+clean(market.stationName||'Unknown station').slice(0,80)+'** · '+clean(market.systemName||'Unknown system').slice(0,70)+'\n'+number(market.price)+' Cr/t · '+number(market.volume)+' t · '+distance+bgsSuffix;
        }).join('\n'),
        inline:false,
      });
    }
  }else{
    fields.push({
      name:'Current Result',
      value:'No qualifying market currently matches this watch.',
      inline:false,
    });
  }

  const testing=config.discord.mode==='testing';
  const state=watchEvaluationLabel(evaluation.state);
  const description=[
    '**Automated Market Watch**',
    'Status: **'+state+'** · '+profile.label+' · checks every '+number(profile.refreshMinutes)+' min',
    testing?'🧪 **TEST FEED** — automated Watch cards are being validated in system-testing.':'',
  ].filter(Boolean).join('\n');

  const embed={
    title:'📡 '+clean(watch.name||q.commodity||'Trade Watch').slice(0,240),
    description,
    color:Number(evaluation.matchCount)>0?0x5ee6a8:0x22d3ee,
    fields,
    footer:{text:'Regiment of Imperial Mongrels · '+subscriberCount+' watching · routine updates are silent'},
    timestamp:clean(evaluation.lastEvaluatedAt||watch.updatedAt||watch.createdAt)||new Date().toISOString(),
  };
  const url=watchUrl(origin,watch.id);
  if(url)embed.url=url;

  const buttons=[{
    type:2,
    style:2,
    custom_id:tradeAlertCustomId(watch.id),
    label:'Alert Me',
    emoji:{name:'🔔'},
  }];
  if(url)buttons.push({type:2,style:5,label:'View Trader\'s Outpost',url,emoji:{name:'🌐'}});

  return{
    content:'',
    embeds:[embed],
    components:[{type:1,components:buttons}],
    allowed_mentions:{parse:[]},
  };
}

export function buildCompactTradeWatchDiscordPayload(watch,{control=null,reason='Closed'}={}) {
  const config=normalizeTradeControl(control);
  const q=watch?.query||{};
  const testing=config.discord.mode==='testing'?' · TEST':'';
  return{
    content:'📡 **'+clean(reason).toUpperCase()+' — '+clean(watch.name||q.commodity||'Trade Watch').slice(0,160)+'** · '+clean(q.commodity||'Commodity').slice(0,80)+' near '+clean(q.referenceSystem||'Unknown system').slice(0,100)+testing,
    embeds:[],
    components:[],
    allowed_mentions:{parse:[]},
  };
}

export async function refreshTradeWatchDiscordSubscriberCount(env,{watch,origin='',control=null}={}) {
  return syncTradeWatchDiscord(env,{watch,origin,control});
}

export async function sendTradeWatchTestAlert(env,{watch,origin='',control=null}={}) {
  if(!watch?.id)return result(false,'invalid_watch',{attempted:false});
  const config=normalizeTradeControl(control||await readTradeControl(env));
  const channelId=tradeDiscordChannelId(config);
  if(!channelId||!env?.DISCORD_BOT_TOKEN)return result(false,'not_configured',{attempted:false});

  const subscribers=await listTradeAlertSubscriberIds(env,watch.id,{limit:70});
  const q=watch.query||{};
  const evaluation=watch.evaluation||{};
  const best=evaluation.currentBest&&typeof evaluation.currentBest==='object'?evaluation.currentBest:null;
  const fields=[{
    name:'Current Watch State',
    value:'Matches: **'+number(evaluation.matchCount)+'**\nPriority: **'+tradePriorityProfile(config,q.priority).label+'**',
    inline:true,
  },{
    name:'Watch Criteria',
    value:(q.direction==='buy'?'Buy ':'Sell ')+clean(q.commodity||'Commodity').slice(0,90)+'\nNear **'+clean(q.referenceSystem||'Unknown system').slice(0,100)+'** · '+(isRareTradeCommodity(q.commodity)&&q.direction==='buy'?'all distances (rare source)':number(q.radiusLy)+' ly'),
    inline:true,
  }];

  if(best){
    fields.push({
      name:'Current Best',
      value:'**'+clean(best.stationName||'Unknown station').slice(0,120)+'**\n'+clean(best.systemName||'Unknown system').slice(0,120)+'\n'+number(best.price)+' Cr/t · '+number(best.volume)+' t',
      inline:false,
    });
  }

  const embed={
    title:'🧪 TEST ALERT · '+clean(watch.name||q.commodity||'Trade Watch').slice(0,180),
    description:'**Officer test of the Trade Watch subscriber alert pipeline.**\nNo market transition occurred and this test does **not** change the Watch baseline, match state, current best, or alert history.',
    color:0x9b7cff,
    fields,
    footer:{text:'Regiment of Imperial Mongrels · TEST ONLY · '+subscribers.length+' watching'},
    timestamp:new Date().toISOString(),
  };
  const url=watchUrl(origin,watch.id);
  if(url)embed.url=url;

  try{
    const posted=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
      method:'POST',
      body:JSON.stringify({
        embeds:[embed],
        flags:DISCORD_SUPPRESS_NOTIFICATIONS,
        allowed_mentions:{parse:[]},
      }),
    });

    const delivery=await deliverTradeAlertDms(env,{
      subscriberIds:subscribers,
      route:watchRouteAdapter(watch),
      embed,
      url,
    });

    return result(true,'test_alert_posted',{
      attempted:true,
      messageId:clean(posted?.id),
      channelId,
      subscriberCount:subscribers.length,
      delivered:delivery.delivered,
      failed:delivery.failed,
      testedAt:new Date().toISOString(),
    });
  }catch(error){
    return result(false,'failed',{attempted:true,error:friendlyError(error)});
  }
}

export async function sendTradeWatchTransitionAlert(env,{watch,transition,origin='',control=null}={}) {
  if(!watch?.id||!transition?.type)return result(false,'invalid_watch_transition');
  if(!['condition_met','condition_cleared','best_market_changed'].includes(transition.type)){
    return result(true,'transition_not_alertable',{attempted:false});
  }
  const config=normalizeTradeControl(control||await readTradeControl(env));
  if(!config.discord.thresholdMessages)return result(true,'threshold_messages_disabled',{attempted:false});
  const channelId=tradeDiscordChannelId(config);
  if(!channelId||!env?.DISCORD_BOT_TOKEN)return result(false,'not_configured',{attempted:false});

  const subscribers=await listTradeAlertSubscriberIds(env,watch.id,{limit:70});
  const q=watch.query||{};
  const evaluation=watch.evaluation||{};
  const best=evaluation.currentBest||null;
  const titleMap={
    condition_met:'Trade Watch Triggered',
    condition_cleared:'Trade Watch No Longer Qualifies',
    best_market_changed:'Best Qualifying Market Changed',
  };
  const description=watchTransitionDescription(watch,transition);
  const embed={
    title:'🔔 '+titleMap[transition.type]+' · '+clean(watch.name||q.commodity||'Trade Watch').slice(0,180),
    description,
    color:transition.type==='condition_met'?0x5ee6a8:transition.type==='condition_cleared'?0xe06c75:0xf5b942,
    fields:best?[{
      name:'Current Best',
      value:'**'+clean(best.stationName||'Unknown station').slice(0,120)+'**\n'+clean(best.systemName||'Unknown system').slice(0,120),
      inline:true,
    },{
      name:'Price',
      value:number(best.price)+' Cr/t',
      inline:true,
    },{
      name:q.direction==='buy'?'Supply':'Demand',
      value:number(best.volume)+' t',
      inline:true,
    }]:[],
    footer:{text:'Regiment of Imperial Mongrels · '+subscribers.length+' watching'},
    timestamp:new Date().toISOString(),
  };
  const url=watchUrl(origin,watch.id);
  if(url)embed.url=url;

  try{
    const posted=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
      method:'POST',
      body:JSON.stringify({
        embeds:[embed],
        flags:DISCORD_SUPPRESS_NOTIFICATIONS,
        allowed_mentions:{parse:[]},
      }),
    });

    const delivery=await deliverTradeAlertDms(env,{
      subscriberIds:subscribers,
      route:watchRouteAdapter(watch),
      embed,
      url,
    });

    return result(true,'alert_posted',{
      attempted:true,
      messageId:clean(posted?.id),
      channelId,
      subscriberCount:subscribers.length,
      delivered:delivery.delivered,
      failed:delivery.failed,
      alertAt:new Date().toISOString(),
      alertType:transition.type,
    });
  }catch(error){
    return result(false,'failed',{attempted:true,error:friendlyError(error)});
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
  if(clean(route.returnCommodity)){
    fields.push({
      name:'↩ Return Load',
      value:clean(route.returnCommodity).slice(0,100)+'\n'+locationLine(route.destinationStation,route.destinationSystem)+' → '+locationLine(route.originStation,route.originSystem),
      inline:false,
    });
    if(Number(route.returnProfitPerTon)>0)fields.push({name:'Return Profit / t',value:number(route.returnProfitPerTon)+' Cr',inline:true});
    if(clean(route.returnQuantity))fields.push({name:'Return Supply / Demand',value:clean(route.returnQuantity).slice(0,100),inline:true});
  }
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
      label:'Alert Me',
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
  const embed={
    title:'⚠️ '+clean(alertTitle||('Trade Alert · '+(route.commodity||route.title||'Opportunity'))).slice(0,240),
    description:clean(message).slice(0,3500)||'A configured Trader\'s Outpost threshold was reached.',
    color:0xf5b942,
    footer:{text:'Regiment of Imperial Mongrels · '+subscribers.length+' watching'},
    timestamp:new Date().toISOString(),
  };
  const url=tradeUrl(origin,route.id);
  if(url)embed.url=url;

  try{
    const posted=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
      method:'POST',
      body:JSON.stringify({
        embeds:[embed],
        flags:DISCORD_SUPPRESS_NOTIFICATIONS,
        allowed_mentions:{parse:[]},
      }),
    });

    const delivery=await deliverTradeAlertDms(env,{
      subscriberIds:subscribers,
      route,
      embed,
      url,
    });

    return result(true,'alert_posted',{
      attempted:true,
      messageId:clean(posted?.id),
      channelId,
      subscriberCount:subscribers.length,
      delivered:delivery.delivered,
      failed:delivery.failed,
    });
  }catch(error){
    return result(false,'failed',{attempted:true,error:friendlyError(error)});
  }
}

async function deliverTradeAlertDms(env,{subscriberIds=[],route,embed,url=''}={}) {
  const ids=Array.isArray(subscriberIds)?subscriberIds:[];
  let delivered=0;
  let failed=0;
  for(let offset=0;offset<ids.length;offset+=5){
    const batch=ids.slice(offset,offset+5);
    const results=await Promise.allSettled(batch.map(async userId=>{
      const dm=await discordRequest(env,'/users/@me/channels',{
        method:'POST',
        body:JSON.stringify({recipient_id:userId}),
      });
      const components=url?[{type:1,components:[{type:2,style:5,label:'Open Trader\'s Outpost',url,emoji:{name:'🌐'}}]}]:[];
      await discordRequest(env,'/channels/'+encodeURIComponent(dm.id)+'/messages',{
        method:'POST',
        body:JSON.stringify({
          content:'🔔 **Trader\'s Outpost alert for '+clean(route.title||route.commodity||'your watched trade').slice(0,150)+'**',
          embeds:[embed],
          components,
          allowed_mentions:{parse:[]},
        }),
      });
    }));
    for(const item of results){
      if(item.status==='fulfilled')delivered+=1;
      else failed+=1;
    }
  }
  return {delivered,failed};
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

function normalizeWatchDiscordState(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return{
    messageId:discordId(source.messageId),
    channelId:discordId(source.channelId),
    lastSyncedAt:clean(source.lastSyncedAt),
    lastError:clean(source.lastError).slice(0,300),
    lifecycle:['active','paused','closed'].includes(clean(source.lifecycle))?clean(source.lifecycle):'active',
    lastAlertAt:clean(source.lastAlertAt),
    lastAlertType:clean(source.lastAlertType),
  };
}
function watchRouteAdapter(watch){
  return{
    id:watch.id,
    title:watch.name,
    commodity:watch?.query?.commodity,
  };
}
function watchUrl(origin,id){
  const base=clean(origin).replace(/\/$/,'');
  return base?base+'/trading/#watch-'+encodeURIComponent(String(id||'')):'';
}
function watchEvaluationLabel(value){
  const state=clean(value);
  if(state==='healthy')return'Healthy';
  if(state==='warning')return'Warning';
  if(state==='error')return'Error';
  if(state==='pending_scheduler')return'Pending';
  return state?'Active':'Pending';
}
function watchTransitionDescription(watch,transition){
  const q=watch?.query||{};
  const evaluation=watch?.evaluation||{};
  const best=evaluation.currentBest||null;
  if(transition.type==='condition_met'){
    return '**'+clean(q.commodity||'Commodity')+'** now has '+number(evaluation.matchCount)+' qualifying market'+(Number(evaluation.matchCount)===1?'':'s')+' within '+number(q.radiusLy)+' ly of **'+clean(q.referenceSystem||'the reference system')+'**.'
      +(best?'\n\nCurrent best: **'+clean(best.stationName)+'** in **'+clean(best.systemName)+'** at **'+number(best.price)+' Cr/t**.':'');
  }
  if(transition.type==='condition_cleared'){
    return 'No market currently satisfies the saved **'+clean(q.commodity||'commodity')+'** thresholds within '+number(q.radiusLy)+' ly of **'+clean(q.referenceSystem||'the reference system')+'**.';
  }
  if(transition.type==='best_market_changed'){
    return 'The preferred qualifying market for **'+clean(q.commodity||'commodity')+'** changed.'
      +(best?'\n\nNew best: **'+clean(best.stationName)+'** in **'+clean(best.systemName)+'** at **'+number(best.price)+' Cr/t** with **'+number(best.volume)+' t** '+(q.direction==='buy'?'supply':'demand')+'.':'');
  }
  return'A watched trade condition changed.';
}
function minutesAgeLabel(value){
  const minutes=Math.max(0,Number(value)||0);
  if(minutes<60)return Math.round(minutes)+' min old';
  const hours=minutes/60;
  if(hours<24)return (hours<10?hours.toFixed(1):Math.round(hours))+' hr old';
  const days=hours/24;
  return (days<10?days.toFixed(1):Math.round(days))+' d old';
}
function discordRelativeTime(value){
  const seconds=Math.floor(Date.parse(value||'')/1000);
  return Number.isFinite(seconds)&&seconds>0?'<t:'+seconds+':R>':'Unknown';
}
function formatDistance(value){
  const numberValue=Number(value);
  return Number.isFinite(numberValue)?numberValue.toLocaleString(undefined,{maximumFractionDigits:2}):'—';
}
function discordId(value){const text=clean(value);return /^\d{5,30}$/.test(text)?text:'';}
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
