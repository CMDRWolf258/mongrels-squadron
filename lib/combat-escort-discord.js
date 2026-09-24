import { discordRequest } from './discord-onboarding.js';
import {
  escortResponseSummary,
  escortUrgencyLabel,
  normalizeRequest,
} from './combat-escort.js';

const LAUNCHER_KEY='combat-escort-discord-launcher-v1';

export function combatEscortDiscordConfig(env){
  const channelId=clean(env?.DISCORD_COMBAT_ESCORT_CHANNEL_ID);
  const guildId=clean(env?.GUILD_ID);
  return {channelId,guildId,configured:Boolean(env?.DISCORD_BOT_TOKEN&&(channelId||guildId))};
}

export async function resolveCombatEscortChannelId(env){
  const config=combatEscortDiscordConfig(env);
  if(config.channelId)return config.channelId;
  if(!config.guildId||!env?.DISCORD_BOT_TOKEN)return'';
  const channels=await discordRequest(env,'/guilds/'+encodeURIComponent(config.guildId)+'/channels',{method:'GET'});
  const eligible=(Array.isArray(channels)?channels:[]).filter(channel=>[0,5].includes(Number(channel?.type)));
  const names=[
    '🛡️〡combat-escort-requests',
    '🛡〡combat-escort-requests',
    'combat-escort-requests',
    'combat-escort-request',
  ];
  const match=eligible.find(channel=>names.includes(clean(channel?.name).toLowerCase().replace(/\ufe0f/g,'')));
  return clean(match?.id);
}

export function escortInteractionCustomId(id,action){
  const safeAction=['available','on_my_way','withdraw'].includes(action)?action:'available';
  return 'mongrels_escort:'+String(id||'').slice(0,60)+':'+safeAction;
}

export function parseEscortInteractionCustomId(value){
  const match=String(value||'').match(/^mongrels_escort:([0-9a-f-]{20,60}):(available|on_my_way|withdraw)$/i);
  if(!match)return null;
  return {id:match[1],action:match[2].toLowerCase()};
}

export async function syncCombatEscortDiscord(env,{request,origin=''}={}){
  const item=normalizeRequest(request);
  if(!item)return{ok:false,configured:false,error:'Invalid escort request.'};
  const config=combatEscortDiscordConfig(env);
  if(!config.configured)return{ok:false,configured:false,attempted:false,error:'Discord escort integration is not configured.'};

  let channelId='';
  try{channelId=await resolveCombatEscortChannelId(env);}
  catch(error){return{ok:false,configured:true,attempted:true,error:friendlyError(error)};}
  if(!channelId){
    return{ok:false,configured:true,attempted:false,error:'Could not find Discord channel combat-escort-requests.'};
  }

  let launcher=null;
  try{
    launcher=await ensureCombatEscortLauncher(env,{channelId,origin});
  }catch(error){
    launcher={ok:false,error:friendlyError(error)};
  }

  const payload=buildCombatEscortDiscordPayload(item,{origin});
  try{
    let message;
    let mode;
    if(item.discord?.messageId&&item.discord?.channelId===channelId){
      try{
        message=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(item.discord.messageId),{
          method:'PATCH',body:JSON.stringify(payload),
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
      if(item.discord?.messageId&&item.discord?.channelId&&item.discord.channelId!==channelId){
        await deleteMessage(env,item.discord.channelId,item.discord.messageId).catch(()=>{});
      }
    }
    return{
      ok:true,configured:true,attempted:true,mode,
      messageId:clean(message?.id),
      channelId,
      lastSyncedAt:new Date().toISOString(),
      error:'',
      launcher,
    };
  }catch(error){
    return{ok:false,configured:true,attempted:true,error:friendlyError(error)};
  }
}

export function buildCombatEscortDiscordPayload(request,{origin=''}={}){
  const item=normalizeRequest(request);
  const response=escortResponseSummary(item);
  const statusLabel=item.status==='open'?'OPEN':item.status==='complete'?'COMPLETE':'CANCELLED';
  const color=item.status==='complete'?0x5ee6a8:item.status==='cancelled'?0x7d8790:item.urgency==='immediate'?0xef4444:item.urgency==='priority'?0xf5b942:0x22d3ee;
  const fields=[
    {name:'System',value:item.system||'Not specified',inline:true},
    {name:'Urgency',value:escortUrgencyLabel(item.urgency),inline:true},
    {name:'Timing',value:item.timing||'As soon as available',inline:true},
    {name:'Objective',value:item.objective||'Escort support',inline:false},
  ];
  if(item.destination)fields.push({name:'Destination / Area',value:item.destination,inline:false});
  if(item.notes)fields.push({name:'Notes',value:item.notes,inline:false});
  fields.push({
    name:'Responders',
    value:response.total
      ?[
          response.onMyWay.length?'🚀 **On My Way:** '+response.onMyWay.join(', '):'',
          response.available.length?'🛡️ **Can Help:** '+response.available.join(', '):'',
        ].filter(Boolean).join('\n')
      :'No escorts have checked in yet.',
    inline:false,
  });

  const url=origin?origin.replace(/\/$/,'')+'/escort/#request-'+encodeURIComponent(item.id):'';
  const embed={
    title:'🛡️ '+item.title,
    description:'**'+statusLabel+'** · Requested by **'+item.ownerName+'**',
    color,
    fields,
    footer:{text:'Regiment of Imperial Mongrels · Combat Escort Network'},
    timestamp:item.updatedAt||item.createdAt,
  };
  if(url)embed.url=url;

  const base=clean(origin).replace(/\/$/,'');
  const linkButtons=base
    ?[
        {type:2,style:5,label:'New Escort Request',url:base+'/escort/#request-form',emoji:{name:'➕'}},
        {type:2,style:5,label:'Open Escort Network',url:base+'/escort/',emoji:{name:'🌐'}},
      ]
    :[];
  const components=item.status==='open'
    ?[{
        type:1,
        components:[
          {type:2,style:2,custom_id:escortInteractionCustomId(item.id,'available'),label:'I Can Help',emoji:{name:'🛡️'}},
          {type:2,style:1,custom_id:escortInteractionCustomId(item.id,'on_my_way'),label:'On My Way',emoji:{name:'🚀'}},
          {type:2,style:2,custom_id:escortInteractionCustomId(item.id,'withdraw'),label:'Stand Down',emoji:{name:'↩️'}},
          ...linkButtons,
        ],
      }]
    :linkButtons.length?[{type:1,components:linkButtons}]:[];

  return{embeds:[embed],components,allowed_mentions:{parse:[]}};
}

export function buildCombatEscortLauncherPayload({origin=''}={}){
  const base=clean(origin).replace(/\/$/,'');
  const embed={
    title:'🛡️ Combat Escort Network',
    description:'Need another Mongrel watching your six? Create a new escort request from the website, or open the live network to see current calls for support.\n\nEscort request cards remain in this channel as operational history after they are completed or cancelled.',
    color:0x22d3ee,
    footer:{text:'Regiment of Imperial Mongrels · Member Support Network'},
  };
  const components=base?[{
    type:1,
    components:[
      {type:2,style:5,label:'New Escort Request',url:base+'/escort/#request-form',emoji:{name:'➕'}},
      {type:2,style:5,label:'Open Escort Network',url:base+'/escort/',emoji:{name:'🌐'}},
    ],
  }]:[];
  return{embeds:[embed],components,allowed_mentions:{parse:[]}};
}

export async function ensureCombatEscortLauncher(env,{channelId,origin=''}={}){
  const id=clean(channelId);
  if(!id)return{ok:false,error:'Combat Escort channel is unavailable.'};
  const previous=await readLauncherState(env);
  const payload=buildCombatEscortLauncherPayload({origin});
  let message;
  let mode;

  if(previous.messageId&&previous.channelId===id){
    try{
      message=await discordRequest(env,'/channels/'+encodeURIComponent(id)+'/messages/'+encodeURIComponent(previous.messageId),{
        method:'PATCH',body:JSON.stringify(payload),
      });
      mode='edited';
    }catch(error){
      if(!String(error?.message||'').includes('(404)'))throw error;
      message=await createMessage(env,id,payload);
      mode='recreated';
    }
  }else{
    message=await createMessage(env,id,payload);
    mode='created';
    if(previous.messageId&&previous.channelId&&previous.channelId!==id){
      await deleteMessage(env,previous.channelId,previous.messageId).catch(()=>{});
    }
  }

  let pinned=false;
  let pinWarning='';
  try{
    await discordRequest(env,'/channels/'+encodeURIComponent(id)+'/pins/'+encodeURIComponent(message.id),{method:'PUT'});
    pinned=true;
  }catch(error){
    pinWarning='Launcher card is live but could not be pinned automatically. Give the bot Pin Messages permission, or pin the launcher manually.';
  }

  const state={
    messageId:clean(message?.id),
    channelId:id,
    pinned,
    pinWarning,
    updatedAt:new Date().toISOString(),
  };
  await writeLauncherState(env,state);
  return{ok:true,mode,...state};
}

async function readLauncherState(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return{};
  try{
    const value=await env.PROJECTS.get(LAUNCHER_KEY,{type:'json'});
    return value&&typeof value==='object'?value:{};
  }catch{return{};}
}

async function writeLauncherState(env,state){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return;
  await env.PROJECTS.put(LAUNCHER_KEY,JSON.stringify(state));
}

function friendlyError(error){
  const message=clean(error?.message||'discord_escort_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message))return'The Imperial Mongrels Website bot cannot access the Combat Escort Requests channel.';
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message))return'The Imperial Mongrels Website bot needs View Channel, Send Messages, Embed Links, and Read Message History for Combat Escort Requests.';
  return message.slice(0,500);
}
async function createMessage(env,channelId,payload){return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{method:'POST',body:JSON.stringify(payload)});}
async function deleteMessage(env,channelId,messageId){return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(messageId),{method:'DELETE'});}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
