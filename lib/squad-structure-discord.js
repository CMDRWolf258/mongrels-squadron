import { discordRequest } from './discord-onboarding.js';
import { squadStructureView } from './squad-structure.js';

export function squadStructureDiscordConfig(env){
  const channelId=clean(env?.DISCORD_SQUAD_STRUCTURE_CHANNEL_ID);
  const guildId=clean(env?.GUILD_ID);
  return {
    channelId,
    guildId,
    configured:Boolean(env?.DISCORD_BOT_TOKEN&&(channelId||guildId)),
  };
}

export async function resolveSquadStructureChannelId(env){
  const config=squadStructureDiscordConfig(env);
  if(config.channelId)return config.channelId;
  if(!config.guildId||!env?.DISCORD_BOT_TOKEN)return'';

  const channels=await discordRequest(env,'/guilds/'+encodeURIComponent(config.guildId)+'/channels',{method:'GET'});
  const match=(Array.isArray(channels)?channels:[]).find(channel=>{
    const type=Number(channel?.type);
    return clean(channel?.name).toLowerCase()==='squad-structure'&&(type===0||type===5);
  });
  return clean(match?.id);
}

export async function syncSquadStructureDiscord(env,state,{origin=''}={}){
  const config=squadStructureDiscordConfig(env);
  if(!config.configured)return result(false,'not_configured',{configured:false,error:'Discord bot/channel discovery is not configured.'});

  let channelId='';
  try{channelId=await resolveSquadStructureChannelId(env);}
  catch(error){
    return result(false,'channel_lookup_failed',{configured:true,attempted:true,error:friendlyError(error)});
  }
  if(!channelId){
    return result(false,'squad_structure_channel_not_found',{
      configured:true,
      attempted:false,
      error:'Could not find a Discord text channel named squad-structure.',
    });
  }

  const trackedId=clean(state?.discordMessageId);
  const trackedChannelId=clean(state?.discordChannelId);
  const payload=buildSquadStructureDiscordPayload(state,{origin});

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

    return {
      ok:true,
      configured:true,
      attempted:true,
      mode,
      messageId:clean(message?.id),
      channelId,
      syncedAt:new Date().toISOString(),
    };
  }catch(error){
    console.error('Could not sync Squad Structure to Discord',error);
    return {ok:false,configured:true,attempted:true,mode:'failed',error:friendlyError(error)};
  }
}

export function applySquadStructureDiscordState(state,discord){
  if(!state||!discord)return state;
  if(discord.ok&&discord.messageId){
    state.discordMessageId=clean(discord.messageId).slice(0,40);
    state.discordChannelId=clean(discord.channelId).slice(0,40);
    state.discordLastSyncedAt=iso(discord.syncedAt)||new Date().toISOString();
    state.discordLastError='';
  }else if(discord.attempted||discord.configured===false||discord.error){
    state.discordLastError=clean(discord.error||discord.mode||'discord_structure_sync_failed').slice(0,500);
  }
  return state;
}

export function buildSquadStructureDiscordPayload(state,{origin=''}={}){
  const structure=squadStructureView(state);
  const websiteUrl=structureUrl(origin);
  const logoUrl=originUrl(origin,'/assets/images/branding/mongrels-logo.png');

  const commandFields=structure.command.map(item=>({
    name:item.rank+' · '+item.role,
    value:item.holder?'**'+item.holder+'**':'*Position vacant*',
    inline:true,
  }));

  const captainFields=structure.captains.map(item=>({
    name:item.title,
    value:item.holder?'**'+item.holder+'**':'*Position Available*',
    inline:true,
  }));

  const fieldFields=structure.fieldLeadership.map(item=>({
    name:item.rank+' · '+item.title,
    value:item.assignments.length
      ?item.assignments.map(x=>'**'+x.name+'**'+(x.focus?' — '+x.focus:'')).join('\n').slice(0,1024)
      :'*No current assignment*',
    inline:false,
  }));

  const specialistFields=structure.specialists.map(item=>({
    name:item.rank+' · '+item.title,
    value:item.holder
      ?'**'+item.holder+'**'+(item.focus?'\n'+item.focus:'')
      :'*Position currently open*',
    inline:true,
  }));

  const rankFields=structure.pilotRanks.map(item=>({
    name:item.number+' · '+item.rank,
    value:'**'+item.title+'** · '+item.count+' current',
    inline:true,
  }));

  const embeds=[
    {
      title:'🐺 Regiment Command',
      description:'The command level responsible for squadron strategy, organization, and coordinated operations.',
      color:0x22d3ee,
      fields:commandFields,
      ...(logoUrl?{thumbnail:{url:logoUrl}}:{}),
    },
    {
      title:'⚔️ Operational Commands · Captain Corps',
      description:'Captains organize operations within their specialty and mentor other Mongrels.',
      color:0x22d3ee,
      fields:captainFields,
    },
    {
      title:'🎖️ Field Leadership & Specialist Corps',
      description:'Mission leadership and recognized operational specialists across the pack.',
      color:0x22d3ee,
      fields:[...fieldFields,...specialistFields],
    },
    {
      title:'📈 Pilot Rank Progression',
      description:'Regular squadron progression from Recruit through Veteran Pilot. Leadership and specialist appointments are separate from this progression.',
      color:0x22d3ee,
      fields:rankFields,
      footer:{text:'Regiment of Imperial Mongrels · Website is the authoritative squad structure'},
    },
  ];
  if(websiteUrl)embeds[0].url=websiteUrl;

  const components=websiteUrl?[{
    type:1,
    components:[{type:2,style:5,label:'View Full Squad Structure',url:websiteUrl,emoji:{name:'🐺'}}],
  }]:[];

  return {embeds,components,allowed_mentions:{parse:[]}};
}

function friendlyError(error){
  const message=clean(error?.message||'discord_structure_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message)){
    return 'The Imperial Mongrels Website bot cannot access #squad-structure. Grant View Channel, Send Messages, Embed Links, and Read Message History.';
  }
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message)){
    return 'The Imperial Mongrels Website bot can see #squad-structure but is missing Send Messages, Embed Links, or Read Message History.';
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
  return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(messageId),{method:'DELETE'});
}
function structureUrl(origin){
  const base=clean(origin).replace(/\/$/,'');
  return base?base+'/about/#structure':'';
}
function originUrl(origin,path){
  const base=clean(origin).replace(/\/$/,'');
  return base?base+path:'';
}
function result(ok,mode,extra={}){return {ok,mode,...extra}}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
