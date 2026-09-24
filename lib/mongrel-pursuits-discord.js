import { discordRequest } from './discord-onboarding.js';
import {
  MONGREL_PURSUITS,
  normalizePursuitIds,
  readPursuitsState,
  writePursuitsState,
} from './mongrel-pursuits.js';

export const PURSUITS_SELECT_CUSTOM_ID='mongrels_pursuits_select';

export function mongrelPursuitsDiscordConfig(env){
  const channelId=clean(env?.DISCORD_MONGREL_PURSUITS_CHANNEL_ID);
  const guildId=clean(env?.GUILD_ID);
  return {channelId,guildId,configured:Boolean(env?.DISCORD_BOT_TOKEN&&(channelId||guildId))};
}

export async function resolveMongrelPursuitsChannelId(env){
  const config=mongrelPursuitsDiscordConfig(env);
  if(config.channelId)return config.channelId;
  if(!config.guildId||!env?.DISCORD_BOT_TOKEN)return'';
  const channels=await discordRequest(env,'/guilds/'+encodeURIComponent(config.guildId)+'/channels',{method:'GET'});
  const eligible=(Array.isArray(channels)?channels:[]).filter(channel=>[0,5].includes(Number(channel?.type)));
  const decorated=eligible.find(channel=>pursuitsChannelName(channel?.name)==='decorated');
  const plain=eligible.find(channel=>pursuitsChannelName(channel?.name)==='plain');
  return clean((decorated||plain)?.id);
}

export async function ensureMongrelPursuitRoles(env,{createMissing=true}={}){
  const guildId=clean(env?.GUILD_ID);
  if(!guildId||!env?.DISCORD_BOT_TOKEN)return{ok:false,error:'Discord guild/bot is not configured.',roleIds:{}};
  let roles;
  try{roles=await discordRequest(env,'/guilds/'+encodeURIComponent(guildId)+'/roles',{method:'GET'});}
  catch(error){return{ok:false,error:friendlyError(error),roleIds:{}};}

  const roleIds={};
  const existing=Array.isArray(roles)?roles:[];
  try{
    for(const pursuit of MONGREL_PURSUITS){
      const name=discordRoleName(pursuit);
      let role=existing.find(item=>clean(item?.name).toLowerCase()===name.toLowerCase());
      if(!role&&createMissing){
        role=await discordRequest(env,'/guilds/'+encodeURIComponent(guildId)+'/roles',{
          method:'POST',
          body:JSON.stringify({name,hoist:false,mentionable:false}),
        });
        existing.push(role);
      }
      if(role?.id)roleIds[pursuit.id]=clean(role.id);
    }
  }catch(error){
    return{ok:false,error:friendlyError(error),roleIds};
  }
  return{ok:true,roleIds};
}

export async function syncMongrelPursuitsDiscord(env,{origin=''}={}){
  const config=mongrelPursuitsDiscordConfig(env);
  if(!config.configured)return result(false,'not_configured',{configured:false,error:'Discord bot/channel discovery is not configured.'});

  let channelId='';
  try{channelId=await resolveMongrelPursuitsChannelId(env);}
  catch(error){return result(false,'channel_lookup_failed',{configured:true,attempted:true,error:friendlyError(error)});}
  if(!channelId){
    return result(false,'mongrel_pursuits_channel_not_found',{
      configured:true,attempted:false,
      error:'Could not find Discord channel 🐺〡mongrel-pursuits (plain mongrel-pursuits is also accepted).',
    });
  }

  const state=await readPursuitsState(env);
  const ensured=await ensureMongrelPursuitRoles(env,{createMissing:true});
  if(!ensured.ok){
    state.discord.lastError=ensured.error;
    state.updatedAt=new Date().toISOString();
    await writePursuitsState(env,state);
    return result(false,'role_sync_failed',{configured:true,attempted:true,error:ensured.error});
  }

  const payload=buildMongrelPursuitsDiscordPayload({origin});
  const trackedId=clean(state.discord.messageId);
  const trackedChannelId=clean(state.discord.channelId);
  try{
    let message;
    let mode;
    if(trackedId&&trackedChannelId===channelId){
      try{
        message=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(trackedId),{
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
      if(trackedId&&trackedChannelId&&trackedChannelId!==channelId){
        await deleteMessage(env,trackedChannelId,trackedId).catch(()=>{});
      }
    }
    state.discord={
      ...state.discord,
      messageId:clean(message?.id),
      channelId,
      roleIds:ensured.roleIds,
      lastSyncedAt:new Date().toISOString(),
      lastError:'',
    };
    state.updatedAt=new Date().toISOString();
    await writePursuitsState(env,state);
    return{ok:true,configured:true,attempted:true,mode,messageId:state.discord.messageId,channelId,roleIds:ensured.roleIds,syncedAt:state.discord.lastSyncedAt};
  }catch(error){
    const friendly=friendlyError(error);
    state.discord.lastError=friendly;
    state.updatedAt=new Date().toISOString();
    await writePursuitsState(env,state).catch(()=>{});
    return{ok:false,configured:true,attempted:true,mode:'failed',error:friendly};
  }
}

export async function syncMemberPursuitRoles(env,{userId,pursuits,state=null}={}){
  const guildId=clean(env?.GUILD_ID);
  const id=clean(userId);
  if(!guildId||!id||!env?.DISCORD_BOT_TOKEN)return{ok:false,attempted:false,error:'Discord role sync is not configured.'};
  const current=state||await readPursuitsState(env);
  const roleIds=current.discord?.roleIds||{};
  const mapped=MONGREL_PURSUITS.filter(p=>roleIds[p.id]);
  if(!mapped.length)return{ok:false,attempted:false,error:'Mongrel Pursuit Discord roles have not been initialized yet.'};

  const selected=new Set(normalizePursuitIds(pursuits));
  const errors=[];
  for(const pursuit of mapped){
    const roleId=roleIds[pursuit.id];
    const method=selected.has(pursuit.id)?'PUT':'DELETE';
    try{
      await discordRequest(env,'/guilds/'+encodeURIComponent(guildId)+'/members/'+encodeURIComponent(id)+'/roles/'+encodeURIComponent(roleId),{method});
    }catch(error){
      if(method==='DELETE'&&String(error?.message||'').includes('(404)'))continue;
      errors.push(pursuit.label+': '+friendlyError(error));
    }
  }
  return errors.length
    ?{ok:false,attempted:true,error:errors.join(' | ').slice(0,500)}
    :{ok:true,attempted:true};
}

export function buildMongrelPursuitsDiscordPayload({origin=''}={}){
  const groups=[...new Set(MONGREL_PURSUITS.map(item=>item.group))];
  const fields=groups.map(group=>({
    name:group,
    value:MONGREL_PURSUITS.filter(item=>item.group===group).map(item=>item.emoji+' **'+item.label+'**').join(' · '),
    inline:false,
  }));
  const url=pursuitsUrl(origin);
  const embed={
    title:'🐺 Mongrel Pursuits',
    description:'Choose the Elite activities you enjoy, specialize in, or want to participate in with other Mongrels. These are **interests, not obligations or squad rank**.\n\nUse the selector below to choose **every pursuit you want active**. Submitting replaces your current Pursuit selection.',
    color:0x22d3ee,
    fields,
    footer:{text:'Regiment of Imperial Mongrels · Pursuits sync with the member website'},
  };
  if(url)embed.url=url;

  return{
    embeds:[embed],
    components:[
      {
        type:1,
        components:[{
          type:3,
          custom_id:PURSUITS_SELECT_CUSTOM_ID,
          placeholder:'Choose your Mongrel Pursuits…',
          min_values:0,
          max_values:MONGREL_PURSUITS.length,
          options:MONGREL_PURSUITS.map(item=>({
            label:item.label.slice(0,100),
            value:item.id,
            description:item.description.slice(0,100),
            emoji:{name:item.emoji},
          })),
        }],
      },
      ...(url?[{type:1,components:[{type:2,style:5,label:'Manage on Website',url,emoji:{name:'🐺'}}]}]:[]),
    ],
    allowed_mentions:{parse:[]},
  };
}

function pursuitsChannelName(value){
  const name=clean(value).toLowerCase().replace(/\ufe0f/g,'');
  if(name==='🐺〡mongrel-pursuits')return'decorated';
  if(name==='mongrel-pursuits')return'plain';
  return'';
}
function discordRoleName(pursuit){return 'Pursuit · '+pursuit.label;}
function pursuitsUrl(origin){const base=clean(origin).replace(/\/$/,'');return base?base+'/pursuits/':'';}
function friendlyError(error){
  const message=clean(error?.message||'discord_pursuits_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message))return'The Imperial Mongrels Website bot cannot access 🐺〡mongrel-pursuits.';
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message))return'The Imperial Mongrels Website bot needs View Channel, Send Messages, Embed Links, Read Message History, and Manage Roles for Mongrel Pursuits.';
  return message.slice(0,500);
}
async function createMessage(env,channelId,payload){return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{method:'POST',body:JSON.stringify(payload)});}
async function deleteMessage(env,channelId,messageId){return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(messageId),{method:'DELETE'});}
function result(ok,mode,extra={}){return{ok,mode,...extra}}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
