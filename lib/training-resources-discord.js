import { discordRequest } from './discord-onboarding.js';

const STORAGE_KEY='training-resources-discord-v1';

export async function readTrainingResourcesDiscordState(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return emptyState();
  try{
    const value=await env.PROJECTS.get(STORAGE_KEY,{type:'json'});
    return normalizeState(value);
  }catch(error){
    console.error('Could not read training resources Discord state',error);
    return emptyState();
  }
}

export async function writeTrainingResourcesDiscordState(env,state){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')throw new Error('training_resources_storage_not_configured');
  await env.PROJECTS.put(STORAGE_KEY,JSON.stringify(normalizeState(state)));
}

export function trainingResourcesDiscordConfig(env){
  const channelId=clean(env?.DISCORD_TRAINING_RESOURCES_CHANNEL_ID);
  const chatChannelId=clean(env?.DISCORD_TRAINING_CHAT_CHANNEL_ID);
  const guildId=clean(env?.GUILD_ID);
  return{
    channelId,
    chatChannelId,
    guildId,
    configured:Boolean(env?.DISCORD_BOT_TOKEN&&(channelId||guildId)),
  };
}

export async function resolveTrainingChannels(env){
  const config=trainingResourcesDiscordConfig(env);
  let resourcesChannelId=config.channelId;
  let chatChannelId=config.chatChannelId;
  if((resourcesChannelId&&chatChannelId)||!config.guildId||!env?.DISCORD_BOT_TOKEN){
    return{resourcesChannelId,chatChannelId,guildId:config.guildId};
  }

  const channels=await discordRequest(env,'/guilds/'+encodeURIComponent(config.guildId)+'/channels',{method:'GET'});
  const eligible=(Array.isArray(channels)?channels:[]).filter(channel=>[0,5].includes(Number(channel?.type)));
  if(!resourcesChannelId){
    const match=eligible.find(channel=>channelKind(channel?.name)==='resources');
    resourcesChannelId=clean(match?.id);
  }
  if(!chatChannelId){
    const match=eligible.find(channel=>channelKind(channel?.name)==='chat');
    chatChannelId=clean(match?.id);
  }
  return{resourcesChannelId,chatChannelId,guildId:config.guildId};
}

export async function syncTrainingResourcesDiscord(env,{origin=''}={}){
  const config=trainingResourcesDiscordConfig(env);
  if(!config.configured)return{ok:false,configured:false,attempted:false,error:'Discord bot/channel discovery is not configured.'};

  let resolved;
  try{resolved=await resolveTrainingChannels(env);}
  catch(error){return{ok:false,configured:true,attempted:true,error:friendlyError(error)};}

  if(!resolved.resourcesChannelId){
    return{
      ok:false,configured:true,attempted:false,
      error:'Could not find Discord channel training-resources. Decorated channel names ending in 〡training-resources are also accepted.',
    };
  }

  const state=await readTrainingResourcesDiscordState(env);
  const payload=buildTrainingResourcesDiscordPayload({
    origin,
    guildId:resolved.guildId,
    chatChannelId:resolved.chatChannelId,
  });

  try{
    let message;
    let mode;
    if(state.messageId&&state.channelId===resolved.resourcesChannelId){
      try{
        message=await discordRequest(env,'/channels/'+encodeURIComponent(resolved.resourcesChannelId)+'/messages/'+encodeURIComponent(state.messageId),{
          method:'PATCH',body:JSON.stringify(payload),
        });
        mode='edited';
      }catch(error){
        if(!String(error?.message||'').includes('(404)'))throw error;
        message=await createMessage(env,resolved.resourcesChannelId,payload);
        mode='recreated';
      }
    }else{
      message=await createMessage(env,resolved.resourcesChannelId,payload);
      mode='created';
      if(state.messageId&&state.channelId&&state.channelId!==resolved.resourcesChannelId){
        await deleteMessage(env,state.channelId,state.messageId).catch(()=>{});
      }
    }

    const next={
      messageId:clean(message?.id),
      channelId:resolved.resourcesChannelId,
      chatChannelId:resolved.chatChannelId,
      lastSyncedAt:new Date().toISOString(),
      lastError:'',
    };
    await writeTrainingResourcesDiscordState(env,next);
    return{ok:true,configured:true,attempted:true,mode,...next};
  }catch(error){
    const friendly=friendlyError(error);
    const next={...state,lastError:friendly};
    await writeTrainingResourcesDiscordState(env,next).catch(()=>{});
    return{ok:false,configured:true,attempted:true,error:friendly};
  }
}

export function buildTrainingResourcesDiscordPayload({origin='',guildId='',chatChannelId=''}={}){
  const base=clean(origin).replace(/\/$/,'');
  const manual=base?base+'/guides/':'';
  const pathway=base?base+'/pathway/':'';
  const reference=base?base+'/guides/reference/':'';
  const glossary=base?base+'/guides/glossary/':'';
  const toolbox=base?base+'/guides/resources/':'';
  const ships=base?base+'/ships/':'';
  const assistant=base?base+'/assistant/':'';
  const chatUrl=clean(guildId)&&clean(chatChannelId)
    ?'https://discord.com/channels/'+encodeURIComponent(guildId)+'/'+encodeURIComponent(chatChannelId)
    :'';

  const fields=[
    {
      name:'📘 Learn',
      value:'**Mongrel Field Manual** — practical guides and training by activity.\n**My Pathway** — personalized progression and what to practice next.',
      inline:false,
    },
    {
      name:'🔎 Look Up',
      value:'**Reference Database** — exact mechanics and dense lookups.\n**Glossary** — acronyms and Elite terminology.',
      inline:false,
    },
    {
      name:'🧰 Build & Tools',
      value:'**Mongrel Toolbox** — trusted websites, companion apps and specialist databases.\n**Ship Catalogue** — published Mongrel builds and EDSY links.',
      inline:false,
    },
    {
      name:'💬 Need Help?',
      value:chatUrl
        ?'Use **training-chat** for questions, mentoring, builds, screenshots and troubleshooting. Use **Ask the Mongrels** when you want the site to route you to the right knowledge.'
        :'Use the squad training chat for questions, mentoring, builds, screenshots and troubleshooting. Use **Ask the Mongrels** when you want the site to route you to the right knowledge.',
      inline:false,
    },
  ];

  const rows=[];
  const row1=[
    linkButton('Mongrel Field Manual',manual,'📘'),
    linkButton('My Pathway',pathway,'🧭'),
    linkButton('Reference Database',reference,'🔎'),
    linkButton('Mongrel Toolbox',toolbox,'🧰'),
    linkButton('Ship Catalogue',ships,'🚀'),
  ].filter(Boolean);
  if(row1.length)rows.push({type:1,components:row1});

  const row2=[
    linkButton('Glossary',glossary,'📖'),
    linkButton('Ask the Mongrels',assistant,'🐺'),
    linkButton('Training Chat',chatUrl,'💬'),
  ].filter(Boolean);
  if(row2.length)rows.push({type:1,components:row2});

  return{
    embeds:[{
      title:'📚 Mongrel Training & Resources',
      description:'One learning system, different jobs. **Browse an activity, progress through My Pathway, learn in the Field Manual, look up exact mechanics, or open the right specialist tool.**\n\nDiscord stays the conversation layer; the website remains the organized source of truth.',
      color:0x22d3ee,
      fields,
      ...(manual?{url:manual}:{}),
      footer:{text:'Regiment of Imperial Mongrels · Training resources index'},
    }],
    components:rows,
    allowed_mentions:{parse:[]},
  };
}

export function trainingResourcesDiscordStatus(state,env){
  const current=normalizeState(state);
  const config=trainingResourcesDiscordConfig(env);
  return{
    configured:config.configured,
    cardLinked:Boolean(current.messageId&&current.channelId),
    channelId:current.channelId,
    chatLinked:Boolean(current.chatChannelId),
    lastSyncedAt:current.lastSyncedAt,
    lastError:current.lastError,
    target:'training-resources',
  };
}

function linkButton(label,url,emoji){
  if(!clean(url))return null;
  return{type:2,style:5,label,url,emoji:{name:emoji}};
}
function channelKind(value){
  const name=clean(value).toLowerCase().replace(/\ufe0f/g,'');
  if(name==='training-resources'||name.endsWith('〡training-resources'))return'resources';
  if(name==='training-chat'||name.endsWith('〡training-chat'))return'chat';
  return'';
}
function friendlyError(error){
  const message=clean(error?.message||'discord_training_resources_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message))return'The Imperial Mongrels Website bot cannot access the training-resources channel.';
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message))return'The Imperial Mongrels Website bot needs View Channel, Send Messages, Embed Links, and Read Message History in training-resources.';
  return message.slice(0,500);
}
async function createMessage(env,channelId,payload){return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages',{method:'POST',body:JSON.stringify(payload)});}
async function deleteMessage(env,channelId,messageId){return discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(messageId),{method:'DELETE'});}
function emptyState(){return{messageId:'',channelId:'',chatChannelId:'',lastSyncedAt:'',lastError:''};}
function normalizeState(value){
  const src=value&&typeof value==='object'?value:{};
  return{
    messageId:clean(src.messageId).slice(0,40),
    channelId:clean(src.channelId).slice(0,40),
    chatChannelId:clean(src.chatChannelId).slice(0,40),
    lastSyncedAt:iso(src.lastSyncedAt),
    lastError:clean(src.lastError).slice(0,500),
  };
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){if(!value)return'';const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():'';}
