import { discordRequest } from './discord-onboarding.js';

const STATUS_LABELS={
  active:'ACTIVE',
  claimed:'CLAIMED',
  complete:'COMPLETE',
};

export function bountyDiscordConfig(env){
  const channelId=clean(env?.DISCORD_BOUNTY_BOARD_CHANNEL_ID);
  const guildId=clean(env?.GUILD_ID);
  return{
    channelId,
    guildId,
    configured:Boolean(env?.DISCORD_BOT_TOKEN&&(channelId||guildId)),
  };
}

export async function resolveBountyBoardChannelId(env){
  const config=bountyDiscordConfig(env);
  if(config.channelId)return config.channelId;
  if(!config.guildId||!env?.DISCORD_BOT_TOKEN)return'';

  const channels=await discordRequest(env,'/guilds/'+encodeURIComponent(config.guildId)+'/channels',{method:'GET'});
  const eligible=(Array.isArray(channels)?channels:[]).filter(channel=>[0,5].includes(Number(channel?.type)));
  const decorated=eligible.find(channel=>bountyChannelName(channel?.name)==='decorated');
  const plain=eligible.find(channel=>bountyChannelName(channel?.name)==='plain');
  return clean((decorated||plain)?.id);
}

export async function syncBountyDiscord(env,{bounty,origin=''}={}){
  const item=normalizeBountyForDiscord(bounty);
  if(!item)return result(false,'invalid_bounty',{configured:false});
  const config=bountyDiscordConfig(env);
  if(!config.configured)return result(false,'not_configured',{configured:false,attempted:false,error:'Discord Bounty Board integration is not configured.'});

  let channelId='';
  try{channelId=await resolveBountyBoardChannelId(env);}
  catch(error){
    return result(false,'channel_lookup_failed',{
      configured:true,
      attempted:true,
      error:friendlyError(error),
    });
  }
  if(!channelId){
    return result(false,'bounty_board_channel_not_found',{
      configured:true,
      attempted:false,
      error:'Could not find Discord channel 💀〡bounty-board (plain bounty-board is also accepted).',
    });
  }

  const payload=buildBountyDiscordPayload(item,{origin});
  const trackedId=clean(item.discordMessageId);
  const trackedChannelId=clean(item.discordChannelId);

  try{
    let message;
    let mode;
    if(trackedId&&trackedChannelId===channelId){
      try{
        message=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(trackedId),{
          method:'PATCH',
          body:JSON.stringify(payload),
        });
        mode='edited';
      }catch(error){
        if(!String(error?.message||'').includes('(404)'))throw error;
        message=await createMessage(env,channelId,payload);
        mode='recreated';
      }
    }else{
      message=await createMessage(env,channelId,payload);
      mode='created';
      if(trackedId&&trackedChannelId&&trackedChannelId!==channelId){
        await deleteMessage(env,trackedChannelId,trackedId).catch(()=>{});
      }
    }

    return result(true,mode,{
      configured:true,
      attempted:true,
      mode,
      messageId:clean(message?.id),
      channelId,
      syncedAt:new Date().toISOString(),
      error:'',
    });
  }catch(error){
    return result(false,'failed',{
      configured:true,
      attempted:true,
      mode:'failed',
      channelId,
      error:friendlyError(error)+' · attempted channel ID '+channelId,
    });
  }
}

export async function deleteBountyDiscord(env,{bounty}={}){
  const item=normalizeBountyForDiscord(bounty);
  const messageId=clean(item?.discordMessageId);
  const channelId=clean(item?.discordChannelId);
  if(!messageId||!channelId)return result(true,'not_tracked',{configured:bountyDiscordConfig(env).configured,attempted:false});
  if(!env?.DISCORD_BOT_TOKEN)return result(false,'not_configured',{configured:false,attempted:false,error:'Discord Bounty Board integration is not configured.'});

  try{
    await deleteMessage(env,channelId,messageId);
    return result(true,'deleted',{configured:true,attempted:true,messageId,channelId});
  }catch(error){
    if(String(error?.message||'').includes('(404)')){
      return result(true,'message_missing',{configured:true,attempted:true,messageId,channelId});
    }
    return result(false,'failed',{
      configured:true,
      attempted:true,
      error:friendlyError(error),
      messageId,
      channelId,
    });
  }
}

export function applyBountyDiscordState(item,discord){
  if(!item||!discord)return item;
  if(discord.ok&&discord.messageId){
    item.discordMessageId=clean(discord.messageId).slice(0,40);
    item.discordChannelId=clean(discord.channelId).slice(0,40);
    item.discordLastSyncedAt=iso(discord.syncedAt)||new Date().toISOString();
    item.discordLastError='';
  }else if(discord.attempted||discord.configured===false){
    item.discordLastError=clean(discord.error||discord.mode||'discord_bounty_sync_failed').slice(0,300);
  }
  return item;
}

export function buildBountyDiscordPayload(bounty,{origin=''}={}){
  const item=normalizeBountyForDiscord(bounty);
  if(!item)return{embeds:[],components:[],allowed_mentions:{parse:[]}};

  const status=clean(item.status)||'active';
  const statusLabel=STATUS_LABELS[status]||status.toUpperCase();
  const color=status==='complete'?0x22c55e:status==='claimed'?0xf59e0b:0xef4444;
  const fields=[
    {name:'💰 Reward',value:truncate(item.reward||'Bragging rights',1024),inline:false},
  ];
  if(item.system)fields.push({name:'📍 System / Location',value:truncate(item.system,1024),inline:false});
  fields.push({name:'📜 Contract Terms',value:truncate(item.reason||'See the Bounty Board for contract details.',1024),inline:false});
  fields.push({name:'📸 Proof Required',value:truncate(item.proof||'Screenshot or combat report',1024),inline:false});
  fields.push({name:'👤 Posted By',value:truncate(item.ownerName||'Mongrel Member',1024),inline:true});
  fields.push({name:'⏳ Expires',value:formatExpiry(item.expires),inline:true});

  const boardUrl=bountyBoardUrl(origin);
  const titlePrefix=status==='complete'?'✓ COMPLETE · ':status==='claimed'?'⚔️ CLAIMED · ':'💀 WANTED · ';
  const embed={
    title:titlePrefix+truncate(item.target||'Unknown CMDR',180),
    description:'**'+statusLabel+'** · Elite Dangerous in-game PvP contract',
    color,
    fields,
    footer:{text:'Regiment of Imperial Mongrels · in-game Bounty Board only'},
    timestamp:item.updatedAt||item.createdAt||new Date().toISOString(),
  };
  if(boardUrl)embed.url=boardUrl;

  const components=boardUrl?[{
    type:1,
    components:[{
      type:2,
      style:5,
      label:'View Bounty Board',
      url:boardUrl,
      emoji:{name:'💀'},
    }],
  }]:[];

  return{
    embeds:[embed],
    components,
    allowed_mentions:{parse:[]},
  };
}

function normalizeBountyForDiscord(value){
  if(!value||typeof value!=='object')return null;
  const id=clean(value.id);
  if(!id)return null;
  return{
    id,
    ownerName:clean(value.ownerName),
    target:clean(value.target),
    system:clean(value.system),
    reward:clean(value.reward),
    reason:clean(value.reason),
    proof:clean(value.proof),
    expires:clean(value.expires),
    status:['active','claimed','complete'].includes(clean(value.status))?clean(value.status):'active',
    createdAt:iso(value.createdAt),
    updatedAt:iso(value.updatedAt),
    discordMessageId:clean(value.discordMessageId),
    discordChannelId:clean(value.discordChannelId),
  };
}
function bountyChannelName(value){
  const name=clean(value).toLowerCase().replace(/\ufe0f/g,'');
  if(name==='💀〡bounty-board'||name.endsWith('〡bounty-board'))return'decorated';
  if(name==='bounty-board')return'plain';
  return'';
}
function bountyBoardUrl(origin){
  const base=clean(origin).replace(/\/$/,'');
  return base?base+'/pvp/#bounty-board':'';
}
function formatExpiry(value){
  const raw=clean(value);
  if(!raw)return'Open contract';
  const time=Date.parse(raw+'T12:00:00Z');
  if(!Number.isFinite(time))return truncate(raw,100);
  return '<t:'+Math.floor(time/1000)+':D>';
}
function friendlyError(error){
  const message=clean(error?.message||'discord_bounty_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message)){
    return'The Imperial Mongrels Website bot cannot access 💀〡bounty-board.';
  }
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message)){
    return'The Imperial Mongrels Website bot needs View Channel, Send Messages, Embed Links, and Read Message History in 💀〡bounty-board.';
  }
  return message.slice(0,500);
}
async function createMessage(env,channelId,payload){
  return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{
    method:'POST',
    body:JSON.stringify(payload),
  });
}
async function deleteMessage(env,channelId,messageId){
  return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(messageId),{
    method:'DELETE',
  });
}
function result(ok,mode,extra={}){return{ok:Boolean(ok),mode,...extra};}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
function truncate(value,max){const text=clean(value);return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…';}
function iso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():'';}
