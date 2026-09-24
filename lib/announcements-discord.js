import {
  createAnnouncementsDiscordMessage,
  discordAnnouncementsConfigured,
  discordAnnouncementsWebhookId,
  editAnnouncementsDiscordMessage,
} from './discord-webhook.js';

export function buildAnnouncementDiscordPayload(announcement,{siteUrl='',notifyRoleId=''}={}){
  const title=clean(announcement?.title).slice(0,256)||'Squadron Announcement';
  const body=clean(announcement?.body).slice(0,4000);
  const important=clean(announcement?.priority)==='important';
  const author=clean(announcement?.authorName||announcement?.updatedBy||'Squadron Command').slice(0,120);
  const publishedAt=iso(announcement?.publishedAt)||iso(announcement?.updatedAt)||new Date().toISOString();
  const url=clean(siteUrl);
  const roleId=discordRoleId(notifyRoleId);
  const embed={
    title,
    description:body,
    color:important?0xffd166:0x22d3ee,
    fields:[
      {name:'Posted by',value:author||'Squadron Command',inline:true},
      ...(important?[{name:'Priority',value:'Important',inline:true}]:[]),
    ],
    footer:{text:'Regiment of Imperial Mongrels · Official Announcement'},
    timestamp:publishedAt,
  };
  if(url)embed.url=url;
  const imageUrl=clean(announcement?.imageUrl);
  if(/^https:\/\//i.test(imageUrl))embed.image={url:imageUrl};
  return {
    username:'Imperial Mongrels Website',
    content:roleId?`<@&${roleId}>`:'',
    allowedRoleMentions:roleId?[roleId]:[],
    embeds:[embed],
  };
}

export async function syncAnnouncementDiscord(env,{announcement,siteUrl='',notifyMongrels=false}={}){
  if(!discordAnnouncementsConfigured(env)){
    return {configured:false,attempted:false,ok:false,mode:'not_configured',error:'discord_announcements_webhook_not_configured'};
  }
  if(!announcement?.id){
    return {configured:true,attempted:false,ok:false,mode:'invalid_announcement',error:'announcement_missing'};
  }

  const webhookId=discordAnnouncementsWebhookId(env);
  const trackedId=clean(announcement.discordMessageId);
  const trackedWebhookId=clean(announcement.discordWebhookId);
  const notifyRoleId=notifyMongrels?discordRoleId(env?.MEMBER_ROLE_ID):'';
  const payload=buildAnnouncementDiscordPayload(announcement,{siteUrl,notifyRoleId});

  try{
    let sent;
    let mode;
    if(trackedId&&trackedWebhookId===webhookId){
      try{
        sent=await editAnnouncementsDiscordMessage(env,trackedId,payload);
        mode='edited';
      }catch(error){
        if(Number(error?.status)!==404)throw error;
        sent=await createAnnouncementsDiscordMessage(env,payload);
        mode='recreated';
      }
    }else{
      sent=await createAnnouncementsDiscordMessage(env,payload);
      mode='created';
    }
    return {
      configured:true,
      attempted:true,
      ok:true,
      mode,
      messageId:clean(sent.messageId),
      webhookId,
      syncedAt:new Date().toISOString(),
    };
  }catch(error){
    console.error('Could not sync announcement to Discord',announcement?.id,error);
    return {
      configured:true,
      attempted:true,
      ok:false,
      mode:'failed',
      error:clean(error?.message)||'discord_announcement_sync_failed',
      discordStatus:Number.isFinite(Number(error?.status))?Number(error.status):null,
    };
  }
}

function discordRoleId(value){const id=clean(value);return /^\d{5,30}$/.test(id)?id:''}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
