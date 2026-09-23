import { discordRequest } from './discord-onboarding.js';

const BOARD_KEY='board-v1';
const RSVP_STATUSES=new Set(['going','maybe','cant']);
const CLOSED_STATUSES=new Set(['cancelled','complete']);

export function squadEventsConfig(env){
  const channelId=clean(env?.DISCORD_SQUAD_EVENTS_CHANNEL_ID);
  const guildId=clean(env?.GUILD_ID);
  return {
    channelId,
    guildId,
    configured:Boolean(env?.DISCORD_BOT_TOKEN&&(channelId||guildId)),
  };
}

export async function resolveSquadEventsChannelId(env){
  const config=squadEventsConfig(env);
  if(config.channelId)return config.channelId;
  if(!config.guildId||!env?.DISCORD_BOT_TOKEN)return'';

  const channels=await discordRequest(env,`/guilds/${encodeURIComponent(config.guildId)}/channels`,{method:'GET'});
  const match=(Array.isArray(channels)?channels:[]).find(channel=>{
    const type=Number(channel?.type);
    return clean(channel?.name).toLowerCase()==='squad-events'&&(type===0||type===5);
  });
  return clean(match?.id);
}

export function parseEventRsvpCustomId(customId){
  const match=String(customId||'').match(/^mongrels_event_rsvp:([0-9a-f-]{20,60}):(going|maybe|cant)$/i);
  if(!match)return null;
  return {eventId:match[1],status:match[2].toLowerCase()};
}

export function eventRsvpCustomId(eventId,status){
  const safeStatus=RSVP_STATUSES.has(status)?status:'maybe';
  return `mongrels_event_rsvp:${String(eventId||'').slice(0,60)}:${safeStatus}`;
}

export function isSquadEventInteractionMember(interaction,env){
  const userId=clean(interaction?.member?.user?.id||interaction?.user?.id);
  if(!userId)return false;
  if(env?.ADMIN_USER_ID&&userId===String(env.ADMIN_USER_ID))return true;
  const roles=Array.isArray(interaction?.member?.roles)?interaction.member.roles.map(String):[];
  if(env?.MEMBER_ROLE_ID&&roles.includes(String(env.MEMBER_ROLE_ID)))return true;
  const officers=String(env?.OFFICER_ROLE_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  return officers.some(role=>roles.includes(role));
}

export function normalizeEventRsvps(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const out={};
  for(const [userId,raw] of Object.entries(source)){
    const id=clean(userId).slice(0,40);
    const status=clean(raw?.status);
    if(!id||!RSVP_STATUSES.has(status))continue;
    out[id]={
      status,
      displayName:clean(raw?.displayName||'Commander').slice(0,80),
      updatedAt:iso(raw?.updatedAt),
    };
  }
  return out;
}

export function eventRsvpView(event,viewerId=''){
  const rsvps=normalizeEventRsvps(event?.rsvps);
  const groups={going:[],maybe:[],cant:[]};
  for(const entry of Object.values(rsvps)){
    groups[entry.status].push(entry.displayName||'Commander');
  }
  for(const list of Object.values(groups))list.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
  return {
    current:rsvps[String(viewerId||'')]?.status||'',
    counts:{
      going:groups.going.length,
      maybe:groups.maybe.length,
      cant:groups.cant.length,
      total:Object.keys(rsvps).length,
    },
    roster:groups,
    open:clean(event?.status)==='active',
  };
}

export async function applyEventRsvp(env,{eventId,userId,displayName,status,origin=''}={}){
  const choice=clean(status);
  if(!RSVP_STATUSES.has(choice))return result(false,'invalid_rsvp_status');
  if(!eventId||!userId)return result(false,'invalid_rsvp_request');
  const items=await readProjectsBoard(env);
  const index=items.findIndex(item=>String(item?.id)===String(eventId));
  if(index<0)return result(false,'event_not_found');
  const event=items[index];
  if(event.kind!=='event')return result(false,'event_not_found');
  if(clean(event.status)!=='active')return result(false,'event_rsvp_closed');

  const now=new Date().toISOString();
  event.rsvps=normalizeEventRsvps(event.rsvps);
  event.rsvps[String(userId)]={
    status:choice,
    displayName:clean(displayName||'Commander').slice(0,80),
    updatedAt:now,
  };
  event.updatedAt=event.updatedAt||now;
  items[index]=event;
  await writeProjectsBoard(env,items);

  const discord=await syncSquadEventDiscord(env,event,{origin,createIfMissing:true});
  applyDiscordState(event,discord);
  items[index]=event;
  await writeProjectsBoard(env,items);

  return {
    ok:true,
    eventId:event.id,
    status:choice,
    rsvp:eventRsvpView(event,userId),
    discord,
  };
}

export async function syncSquadEventDiscord(env,event,{origin='',createIfMissing=false}={}){
  const config=squadEventsConfig(env);
  if(!config.configured)return result(false,'not_configured',{configured:false});
  if(!event?.id||event.kind!=='event')return result(false,'invalid_event',{configured:true});

  let channelId='';
  try{channelId=await resolveSquadEventsChannelId(env);}
  catch(error){
    return result(false,'channel_lookup_failed',{
      configured:true,
      attempted:true,
      error:clean(error?.message||'discord_event_channel_lookup_failed').slice(0,500),
    });
  }
  if(!channelId){
    return result(false,'squad_events_channel_not_found',{
      configured:true,
      attempted:false,
      error:'Could not find a Discord text channel named squad-events',
    });
  }

  const status=clean(event.status)||'active';
  const trackedId=clean(event.discordEventMessageId);
  const trackedChannelId=clean(event.discordEventChannelId);
  const shouldCreate=createIfMissing||status==='active';

  if(status==='planning'&&!trackedId){
    return {ok:true,configured:true,attempted:false,mode:'planning_unpublished'};
  }
  if(!trackedId&&!shouldCreate){
    return {ok:true,configured:true,attempted:false,mode:'untracked_closed'};
  }

  const payload=buildSquadEventDiscordPayload(event,{origin});
  try{
    let message;
    let mode;
    if(trackedId&&trackedChannelId===channelId){
      try{
        message=await discordRequest(env,`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(trackedId)}`,{
          method:'PATCH',
          body:JSON.stringify(payload),
        });
        mode='edited';
      }catch(error){
        if(!String(error?.message||'').includes('(404)'))throw error;
        message=await createEventMessage(env,channelId,payload);
        mode='recreated';
      }
    }else{
      message=await createEventMessage(env,channelId,payload);
      mode='created';
      if(trackedId&&trackedChannelId&&trackedChannelId!==channelId){
        await deleteEventMessage(env,trackedChannelId,trackedId).catch(()=>{});
      }
    }

    return {
      ok:true,
      configured:true,
      attempted:true,
      mode,
      messageId:clean(message?.id),
      channelId:channelId,
      syncedAt:new Date().toISOString(),
    };
  }catch(error){
    console.error('Could not sync Squad Event to Discord',event?.id,error);
    return {
      ok:false,
      configured:true,
      attempted:true,
      mode:'failed',
      error:friendlyDiscordEventError(error),
    };
  }
}

function friendlyDiscordEventError(error){
  const message=clean(error?.message||'discord_event_sync_failed');
  if(/Missing Access/i.test(message)||/"code"\s*:\s*50001/.test(message)){
    return 'The Imperial Mongrels Website bot cannot access #squad-events. Grant it View Channel, Send Messages, Embed Links, and Read Message History, then save the event again to retry.';
  }
  if(/Missing Permissions/i.test(message)||/"code"\s*:\s*50013/.test(message)){
    return 'The Imperial Mongrels Website bot can see #squad-events but is missing a required channel permission. Grant Send Messages, Embed Links, and Read Message History, then save the event again to retry.';
  }
  return message.slice(0,500);
}

export function applyDiscordState(event,discord){
  if(!event||!discord)return event;
  if(discord.ok&&discord.messageId){
    event.discordEventMessageId=clean(discord.messageId).slice(0,40);
    event.discordEventChannelId=clean(discord.channelId).slice(0,40);
    event.discordEventLastSyncedAt=iso(discord.syncedAt)||new Date().toISOString();
    event.discordEventLastError='';
  }else if(discord.attempted||discord.configured===false){
    event.discordEventLastError=clean(discord.error||discord.mode||'discord_event_sync_failed').slice(0,300);
  }
  return event;
}

export function buildSquadEventDiscordPayload(event,{origin=''}={}){
  const rsvp=eventRsvpView(event);
  const closed=CLOSED_STATUSES.has(clean(event.status))||clean(event.status)!=='active';
  const statusLabel=eventStatusLabel(event.status);
  const websiteUrl=eventUrl(origin,event.id);
  const fields=[];

  const when=formatDiscordEventTime(event.deadline,event.eventTime);
  if(when)fields.push({name:'When',value:when,inline:false});
  if(clean(event.eventType))fields.push({name:'Event Type',value:clean(event.eventType).slice(0,100),inline:true});
  if(clean(event.system))fields.push({name:'System / Location',value:clean(event.system).slice(0,100),inline:true});
  fields.push({name:'Organizer',value:clean(event.ownerName||'Squadron Command').slice(0,100),inline:true});
  fields.push({
    name:'RSVP',
    value:`✅ Going **${rsvp.counts.going}** · 🤔 Maybe **${rsvp.counts.maybe}** · ❌ Can’t Make It **${rsvp.counts.cant}**`,
    inline:false,
  });

  const rosterLines=[
    rosterLine('✅ Going',rsvp.roster.going),
    rosterLine('🤔 Maybe',rsvp.roster.maybe),
    rosterLine('❌ Can’t Make It',rsvp.roster.cant),
  ].filter(Boolean);
  if(rosterLines.length)fields.push({name:'Current Roster',value:rosterLines.join('\n').slice(0,1024),inline:false});

  const description=clean(event.description).slice(0,3500)||'Squad event details are available on the Mongrels website.';
  const titlePrefix=clean(event.status)==='cancelled'?'CANCELLED · ':clean(event.status)==='complete'?'COMPLETE · ':'';
  const embed={
    title:(titlePrefix+clean(event.title||'Squad Event')).slice(0,256),
    description,
    color:clean(event.status)==='cancelled'?0xff7b7b:clean(event.status)==='complete'?0x5ee6a8:0x22d3ee,
    fields,
    footer:{text:`Regiment of Imperial Mongrels · ${statusLabel}`},
  };
  if(websiteUrl)embed.url=websiteUrl;

  const buttons=[
    {type:2,style:3,custom_id:eventRsvpCustomId(event.id,'going'),label:`Going (${rsvp.counts.going})`,emoji:{name:'✅'},disabled:closed},
    {type:2,style:1,custom_id:eventRsvpCustomId(event.id,'maybe'),label:`Maybe (${rsvp.counts.maybe})`,emoji:{name:'🤔'},disabled:closed},
    {type:2,style:4,custom_id:eventRsvpCustomId(event.id,'cant'),label:`Can’t Make It (${rsvp.counts.cant})`,emoji:{name:'❌'},disabled:closed},
  ];
  if(websiteUrl)buttons.push({type:2,style:5,label:'View Event',url:websiteUrl,emoji:{name:'🐺'}});

  return {
    embeds:[embed],
    components:[{type:1,components:buttons}],
    allowed_mentions:{parse:[]},
  };
}

export async function readProjectsBoard(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return[];
  try{
    const stored=await env.PROJECTS.get(BOARD_KEY,{type:'json',cacheTtl:30});
    return Array.isArray(stored)?stored:[];
  }catch(error){
    console.error('Could not read Projects board',error);
    return[];
  }
}

export async function writeProjectsBoard(env,items){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')throw new Error('projects_storage_not_configured');
  await env.PROJECTS.put(BOARD_KEY,JSON.stringify((Array.isArray(items)?items:[]).slice(0,250)));
}

async function createEventMessage(env,channelId,payload){
  return discordRequest(env,`/channels/${encodeURIComponent(channelId)}/messages`,{
    method:'POST',
    body:JSON.stringify(payload),
  });
}

async function deleteEventMessage(env,channelId,messageId){
  return discordRequest(env,`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,{method:'DELETE'});
}

function eventUrl(origin,id){
  const base=clean(origin).replace(/\/$/,'');
  if(!base)return'';
  return `${base}/projects/?view=events#event-${encodeURIComponent(String(id||''))}`;
}

function formatDiscordEventTime(date,time){
  if(!date)return'';
  const normalizedTime=/^\d{2}:\d{2}$/.test(String(time||''))?time:'12:00';
  const parsed=Date.parse(`${date}T${normalizedTime}:00Z`);
  if(!Number.isFinite(parsed))return String(date);
  const unix=Math.floor(parsed/1000);
  return `<t:${unix}:F> · <t:${unix}:R>`;
}

function rosterLine(label,names){
  if(!Array.isArray(names)||!names.length)return'';
  const visible=names.slice(0,12);
  const extra=names.length-visible.length;
  return `${label}: ${visible.join(', ')}${extra>0?` +${extra} more`:''}`;
}

function eventStatusLabel(status){
  return ({planning:'Planning',active:'RSVP Open',paused:'Paused',cancelled:'Cancelled',complete:'Complete'})[clean(status)]||'Squad Event';
}

function result(ok,mode,extra={}){
  return {ok,mode,...extra};
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
