import {
  readTradeControl,
  tradeDiscordChannelId,
} from './trade-intelligence.js';

const DISCORD_API='https://discord.com/api/v10';
const DISCORD_SUPPRESS_NOTIFICATIONS=4096;

export async function syncTradeCgDiscord(env,{campaign,origin='',transition=''}={}){
  if(!campaign?.id)return result(false,'invalid_campaign',{attempted:false});
  const control=await readTradeControl(env);
  const channelId=tradeDiscordChannelId(control);
  if(!channelId||!env?.DISCORD_BOT_TOKEN)return result(false,'not_configured',{attempted:false,configured:false});

  const payload=buildTradeCgDiscordPayload(campaign,{origin,control});
  const currentChannel=String(campaign?.discord?.channelId||'');
  const currentMessage=String(campaign?.discord?.messageId||'');
  try{
    let message;
    if(currentMessage&&currentChannel===channelId){
      message=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(currentMessage),{
        method:'PATCH',
        body:JSON.stringify(payload),
      });
    }else{
      message=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
        method:'POST',
        body:JSON.stringify({...payload,flags:DISCORD_SUPPRESS_NOTIFICATIONS}),
      });
    }

    if(transition==='primary_promoted'){
      await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
        method:'POST',
        body:JSON.stringify(buildTradeCgPromotionPayload(campaign,{origin})),
      }).catch(()=>{});
    }

    return result(true,'synced',{
      attempted:true,
      configured:true,
      messageId:String(message?.id||currentMessage||''),
      channelId,
      mode:control.discord?.mode||'testing',
    });
  }catch(error){
    return result(false,'failed',{attempted:true,configured:true,error:friendly(error),channelId});
  }
}

export function buildTradeCgDiscordPayload(campaign,{origin='',control=null}={}){
  const primary=campaign?.primary||null;
  const pending=campaign?.pendingPrimary||null;
  const fields=[
    {
      name:'🎯 Destination',
      value:'**'+clean(campaign.destinationStation||'Unknown station').slice(0,120)+'**\n'+clean(campaign.destinationSystem||'Unknown system').slice(0,120),
      inline:true,
    },
    {
      name:'📦 Accepted Cargo',
      value:(campaign.commodities||[]).map(item=>'• '+clean(item).slice(0,80)).join('\n').slice(0,1000)||'Not listed',
      inline:true,
    },
  ];

  if(primary){
    fields.push({
      name:'🚚 Primary Squad Route',
      value:'**'+clean(primary.commodity||'Cargo')+'**\n'
        +'**'+clean(primary.sourceStation||'Unknown')+'** · '+clean(primary.sourceSystem||'')
        +'\n→ **'+clean(campaign.destinationStation||'CG destination')+'**'
        +'\nBuy '+number(primary.buyPrice)+' · Sell '+number(primary.sellPrice)+' Cr/t · **'+signed(primary.profitPerTon)+' Cr/t**'
        +'\n'+number(primary.sourceSupply)+' t source supply · '+number(primary.quantity)+' t modeled load'
        +'\n**'+signed(primary.tripProfit)+' Cr / trip** · '+distance(primary.distanceLy),
      inline:false,
    });
    fields.push({
      name:'Primary Health',
      value:primaryState(primary)+' · market '+age(primary.observedAt),
      inline:true,
    });
  }else{
    fields.push({name:'🚚 Primary Squad Route',value:'No primary route has been established yet.',inline:false});
  }

  if(pending?.route){
    fields.push({
      name:'⏳ Pending Primary',
      value:'**'+clean(pending.route.commodity)+'** · '+clean(pending.route.sourceStation)+' · '+clean(pending.route.sourceSystem)
        +'\n'+signed(pending.route.tripProfit)+' Cr/trip · '+number(pending.route.sourceSupply)+' t supply'
        +'\nAuto-promotes '+relativeTime(pending.promoteAfter)+' if it remains #1 and healthy.',
      inline:false,
    });
  }

  if(campaign.endsAt){
    fields.push({name:'CG Ends',value:relativeTime(campaign.endsAt),inline:true});
  }
  if(campaign.notes){
    fields.push({name:'Notes',value:clean(campaign.notes).slice(0,900),inline:false});
  }

  const testing=control?.discord?.mode!=='live';
  const description=[
    '**Community Goal Operations**',
    'Routes are solved automatically from current market data.',
    'Primary replacements must remain the best healthy candidate for **1 hour** before auto-promotion.',
    testing?'🧪 **TEST FEED** — CG automation is being validated in system-testing.':'',
  ].filter(Boolean).join('\n');

  const embed={
    title:'🚚 '+clean(campaign.title||'Community Goal').slice(0,220),
    description,
    color:primary?.healthy?0x5ee6a8:0xf5b942,
    fields,
    footer:{text:'Regiment of Imperial Mongrels · CG Route Solver · 15 min checks'},
    timestamp:campaign.evaluation?.lastEvaluatedAt||campaign.updatedAt||new Date().toISOString(),
  };
  const url=tradeUrl(origin,campaign.id);
  if(url)embed.url=url;
  return{
    embeds:[embed],
    components:url?[{type:1,components:[{type:2,style:5,label:'View CG Operations',url,emoji:{name:'🌐'}}]}]:[],
    allowed_mentions:{parse:[]},
  };
}

function buildTradeCgPromotionPayload(campaign,{origin='' }={}){
  const primary=campaign?.primary||{};
  const embed={
    title:'🔄 CG Primary Route Updated',
    description:'**'+clean(campaign.title||'Community Goal')+'** has automatically promoted a new primary source after remaining the best healthy candidate for one hour.',
    color:0x5ee6a8,
    fields:[{
      name:'New Primary',
      value:'**'+clean(primary.commodity||'Cargo')+'**\n'
        +clean(primary.sourceStation||'Unknown')+' · '+clean(primary.sourceSystem||'')
        +'\n→ '+clean(campaign.destinationStation||'CG destination')+' · '+clean(campaign.destinationSystem||'')
        +'\n'+signed(primary.tripProfit)+' Cr/trip · '+number(primary.sourceSupply)+' t supply',
      inline:false,
    }],
    footer:{text:'Regiment of Imperial Mongrels · automatic CG route promotion'},
    timestamp:new Date().toISOString(),
  };
  const url=tradeUrl(origin,campaign.id);
  if(url)embed.url=url;
  return{
    embeds:[embed],
    components:url?[{type:1,components:[{type:2,style:5,label:'View Updated Route',url}]}]:[],
    allowed_mentions:{parse:[]},
  };
}

async function discordRequest(env,path,options={}){
  const response=await fetch(DISCORD_API+path,{
    ...options,
    headers:{
      Authorization:'Bot '+String(env.DISCORD_BOT_TOKEN||''),
      'Content-Type':'application/json',
      ...(options.headers||{}),
    },
  });
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{}
  if(!response.ok)throw new Error('discord_http_'+response.status+(body?.message?':'+body.message:''));
  return body;
}

function tradeUrl(origin,id){
  const base=String(origin||'').trim().replace(/\/$/,'');
  if(!base||!id)return'';
  return base+'/trading/#cg-'+encodeURIComponent(id);
}
function primaryState(route){
  if(route?.state==='healthy')return'✅ Healthy';
  if(route?.state==='depleted')return'⚠ Depleted';
  if(route?.state==='stale')return'⚠ Stale data';
  if(route?.state==='low_supply')return'⚠ Low supply';
  return'⚠ Needs refresh';
}
function distance(value){
  const n=Number(value);
  return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:2})+' ly':'Distance unknown';
}
function age(value){
  const time=Date.parse(value||'');
  if(!Number.isFinite(time))return'age unknown';
  const minutes=Math.max(0,Math.floor((Date.now()-time)/60000));
  if(minutes<60)return minutes+'m old';
  if(minutes<1440)return (minutes/60).toFixed(minutes<600?1:0)+'h old';
  return (minutes/1440).toFixed(1)+'d old';
}
function relativeTime(value){
  const time=Date.parse(value||'');
  if(!Number.isFinite(time))return'not set';
  return '<t:'+Math.floor(time/1000)+':R>';
}
function number(value){return Math.max(0,Math.round(Number(value)||0)).toLocaleString();}
function signed(value){
  const n=Math.round(Number(value)||0);
  return(n>=0?'+':'')+n.toLocaleString();
}
function clean(value){return String(value??'').trim();}
function friendly(error){return String(error?.message||error||'discord_error').slice(0,300);}
function result(ok,mode,extra={}){return{ok,mode,...extra};}
