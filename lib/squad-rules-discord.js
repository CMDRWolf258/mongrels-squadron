import { discordRequest } from './discord-onboarding.js';

const STORAGE_KEY='squad-rules-discord-v1';

export async function readSquadRulesDiscordState(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return emptyState();
  try{
    const value=await env.PROJECTS.get(STORAGE_KEY,{type:'json'});
    return normalizeState(value);
  }catch(error){
    console.error('Could not read Squad Rules Discord state',error);
    return emptyState();
  }
}

export async function writeSquadRulesDiscordState(env,state){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')throw new Error('squad_rules_storage_not_configured');
  await env.PROJECTS.put(STORAGE_KEY,JSON.stringify(normalizeState(state)));
}

export function squadRulesDiscordConfig(env){
  const channelId=clean(env?.DISCORD_SQUAD_RULES_CHANNEL_ID);
  const guildId=clean(env?.GUILD_ID);
  return{
    channelId,
    guildId,
    configured:Boolean(env?.DISCORD_BOT_TOKEN&&(channelId||guildId)),
  };
}

export async function resolveSquadRulesChannelId(env){
  const config=squadRulesDiscordConfig(env);
  if(config.channelId)return config.channelId;
  if(!config.guildId||!env?.DISCORD_BOT_TOKEN)return'';

  const channels=await discordRequest(env,'/guilds/'+encodeURIComponent(config.guildId)+'/channels',{method:'GET'});
  const eligible=(Array.isArray(channels)?channels:[]).filter(channel=>[0,5].includes(Number(channel?.type)));
  const decorated=eligible.find(channel=>squadRulesChannelName(channel?.name)==='decorated');
  const plain=eligible.find(channel=>squadRulesChannelName(channel?.name)==='plain');
  return clean((decorated||plain)?.id);
}

export async function syncSquadRulesDiscord(env,{origin=''}={}){
  const config=squadRulesDiscordConfig(env);
  if(!config.configured)return{ok:false,configured:false,attempted:false,error:'Discord bot/channel discovery is not configured.'};

  let channelId='';
  try{channelId=await resolveSquadRulesChannelId(env);}
  catch(error){return{ok:false,configured:true,attempted:true,error:friendlyError(error)};}

  if(!channelId){
    return{
      ok:false,
      configured:true,
      attempted:false,
      error:'Could not find Discord channel 📕〡squad-rules (plain squad-rules is also accepted).',
    };
  }

  const state=await readSquadRulesDiscordState(env);
  const payload=buildSquadRulesDiscordPayload({origin});

  try{
    let message;
    let mode;
    if(state.messageId&&state.channelId===channelId){
      try{
        message=await discordRequest(env,'/channels/'+encodeURIComponent(channelId)+'/messages/'+encodeURIComponent(state.messageId),{
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
      if(state.messageId&&state.channelId&&state.channelId!==channelId){
        await deleteMessage(env,state.channelId,state.messageId).catch(()=>{});
      }
    }

    const next={
      messageId:clean(message?.id),
      channelId,
      lastSyncedAt:new Date().toISOString(),
      lastError:'',
    };
    await writeSquadRulesDiscordState(env,next);
    return{ok:true,configured:true,attempted:true,mode,...next};
  }catch(error){
    const friendly=friendlyError(error);
    const next={...state,lastError:friendly};
    await writeSquadRulesDiscordState(env,next).catch(()=>{});
    return{ok:false,configured:true,attempted:true,error:friendly};
  }
}

export function buildSquadRulesDiscordPayload({origin=''}={}){
  const url=rulesUrl(origin);
  const fields=[
    {
      name:'01 · Open Play Is the Standard',
      value:'Mongrel operations are conducted in **Open Play**. Solo or Private Group may be practical for limited access problems such as prolonged landing-pad congestion, but they must never be used to avoid combat or player opposition.',
      inline:false,
    },
    {
      name:'02 · BGS Is Open Only',
      value:'Any action intended to influence a faction or system through the Background Simulation must be performed in **Open Play**. BGS work in Solo or Private Group may result in removal from the squadron.',
      inline:false,
    },
    {
      name:'03 · No Combat Logging',
      value:'Do not intentionally close the game, kill the process, disconnect the network, or otherwise force a disconnect to avoid destruction. Legitimate connection failures happen; document them when practical.',
      inline:false,
    },
    {
      name:'⚔️ Combat & ROE',
      value:'Fight hard and fight clean. The squad currently maintains no standing No-Fire List, though diplomacy and operations may change that. Ship-Launched Fighters are acceptable generally but strongly discouraged in PvP because of synchronization and latency issues.',
      inline:false,
    },
    {
      name:'🐺 The Mongrel Standard',
      value:'Work with your squadmates, honor commitments, follow operational instructions when participating in organized activity, and represent the Regiment well. When BGS, diplomacy, PvP, Powerplay, or squad interests are unclear, ask leadership before acting.',
      inline:false,
    },
  ];

  const embed={
    title:'📕 Regiment of Imperial Mongrels · Squad Rules & ROE',
    description:'The standards below are the operational summary. **The website is the authoritative source for the complete rules and context.**',
    color:0x22d3ee,
    fields,
    footer:{text:'Regiment of Imperial Mongrels · Represent the pack well'},
  };
  if(url)embed.url=url;

  const components=url?[{
    type:1,
    components:[{
      type:2,
      style:5,
      label:'View Full Rules & ROE',
      url,
      emoji:{name:'📕'},
    }],
  }]:[];

  return{embeds:[embed],components,allowed_mentions:{parse:[]}};
}

export function squadRulesDiscordStatus(state,env){
  const current=normalizeState(state);
  const config=squadRulesDiscordConfig(env);
  return{
    configured:config.configured,
    cardLinked:Boolean(current.messageId&&current.channelId),
    channelId:current.channelId,
    lastSyncedAt:current.lastSyncedAt,
    lastError:current.lastError,
    target:'📕〡squad-rules',
  };
}

function squadRulesChannelName(value){
  const name=clean(value).toLowerCase().replace(/\ufe0f/g,'');
  if(name==='📕〡squad-rules')return'decorated';
  if(name==='squad-rules')return'plain';
  return'';
}
function rulesUrl(origin){
  const base=clean(origin).replace(/\/$/,'');
  return base?base+'/about/#squad-rules':'';
}
function friendlyError(error){
  const message=clean(error?.message||'discord_squad_rules_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message)){
    return'The Imperial Mongrels Website bot cannot access 📕〡squad-rules.';
  }
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message)){
    return'The Imperial Mongrels Website bot needs View Channel, Send Messages, Embed Links, and Read Message History in 📕〡squad-rules.';
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
function emptyState(){return{messageId:'',channelId:'',lastSyncedAt:'',lastError:''};}
function normalizeState(value){
  const src=value&&typeof value==='object'?value:{};
  return{
    messageId:clean(src.messageId).slice(0,40),
    channelId:clean(src.channelId).slice(0,40),
    lastSyncedAt:iso(src.lastSyncedAt),
    lastError:clean(src.lastError).slice(0,500),
  };
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){if(!value)return'';const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():'';}
