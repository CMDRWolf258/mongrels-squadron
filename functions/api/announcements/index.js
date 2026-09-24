import { json, readSession } from '../../../lib/auth.js';
import { discordAnnouncementsConfigured } from '../../../lib/discord-webhook.js';
import { syncAnnouncementDiscord } from '../../../lib/announcements-discord.js';
import {
  announcementImagePreviewUrl,
  announcementImagePublicUrl,
  announcementImagesConfigured,
  deleteManagedAnnouncementImage,
  isManagedAnnouncementImageKey,
} from '../../../lib/announcement-images.js';

const KV_KEY='announcements-v1';
const MEMBER_ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}){
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  const storageError=requireStorage(env);
  if(storageError)return storageError;
  const document=await readDocument(env);
  const canManage=auth.session.access==='site_admin';
  const visible=document.items
    .filter(item=>canManage||item.status==='published'||item.status==='archived')
    .sort(compareAnnouncements)
    .map(item=>present(item,{canManage,request}));
  return reply({
    ok:true,
    viewer:viewer(auth.session),
    canManage,
    discordConfigured:discordAnnouncementsConfigured(env),
    mongrelsRoleConfigured:isDiscordRoleId(env?.MEMBER_ROLE_ID),
    imageStorageConfigured:canManage?announcementImagesConfigured(env):false,
    items:visible,
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  const storageError=requireStorage(env);
  if(storageError)return storageError;
  const body=await readBody(request);
  if(body.response)return body.response;

  const now=new Date().toISOString();
  const title=clean(body.value?.title).slice(0,180);
  const content=clean(body.value?.body).slice(0,3500);
  if(!title||!content)return reply({ok:false,error:'title_and_body_required'},400);

  const item={
    id:crypto.randomUUID(),
    title,
    body:content,
    priority:normalizePriority(body.value?.priority),
    imageKey:normalizeImageKey(body.value?.imageKey),
    status:'draft',
    authorId:String(auth.session.sub||''),
    authorName:clean(auth.session.displayName||auth.session.username||'Site Admin').slice(0,120),
    createdAt:now,
    updatedAt:now,
    updatedBy:clean(auth.session.displayName||auth.session.username||'Site Admin').slice(0,120),
    publishedAt:'',
    archivedAt:'',
    discordMessageId:'',
    discordWebhookId:'',
    discordLastSyncedAt:'',
    discordLastError:'',
  };
  const document=await readDocument(env);
  document.items.unshift(item);
  document.updatedAt=now;
  await writeDocument(env,document);
  return reply({ok:true,item:present(item,{canManage:true,request}),discordConfigured:discordAnnouncementsConfigured(env),imageStorageConfigured:announcementImagesConfigured(env)},201);
}

export async function onRequestPut({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  const storageError=requireStorage(env);
  if(storageError)return storageError;
  const body=await readBody(request);
  if(body.response)return body.response;

  const id=clean(body.value?.id).slice(0,100);
  if(!id)return reply({ok:false,error:'announcement_id_required'},400);
  const document=await readDocument(env);
  const index=document.items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'announcement_not_found'},404);

  const now=new Date().toISOString();
  const existing=document.items[index];
  const action=clean(body.value?.action||'save').toLowerCase();
  const notifyMongrels=action==='publish'&&existing.status==='draft'&&body.value?.notifyMongrels===true;
  const item={...existing};

  if(action==='save'&&item.status==='archived'){
    return reply({ok:false,error:'archived_announcements_are_read_only'},409);
  }

  if(action==='save'||action==='publish'){
    const title=clean(body.value?.title??item.title).slice(0,180);
    const content=clean(body.value?.body??item.body).slice(0,3500);
    if(!title||!content)return reply({ok:false,error:'title_and_body_required'},400);
    item.title=title;
    item.body=content;
    item.priority=normalizePriority(body.value?.priority??item.priority);
    if(Object.hasOwn(body.value||{},'imageKey'))item.imageKey=normalizeImageKey(body.value?.imageKey);
  }

  if(action==='publish'){
    item.status='published';
    if(!item.publishedAt)item.publishedAt=now;
    item.archivedAt='';
  }else if(action==='archive'){
    if(item.status!=='published')return reply({ok:false,error:'only_published_announcements_can_be_archived'},409);
    item.status='archived';
    item.archivedAt=now;
  }else if(action==='restore'){
    if(item.status!=='archived')return reply({ok:false,error:'only_archived_announcements_can_be_restored'},409);
    item.status='published';
    item.archivedAt='';
    if(!item.publishedAt)item.publishedAt=now;
  }else if(action!=='save'){
    return reply({ok:false,error:'invalid_action'},400);
  }

  const replacedImageKey=existing.imageKey&&existing.imageKey!==item.imageKey?existing.imageKey:'';
  item.updatedAt=now;
  item.updatedBy=clean(auth.session.displayName||auth.session.username||'Site Admin').slice(0,120);
  document.items[index]=item;
  document.updatedAt=now;
  await writeDocument(env,document);
  if(replacedImageKey){
    try{await deleteManagedAnnouncementImage(env,replacedImageKey);}
    catch(error){console.error('Could not clean up replaced announcement image',error);}
  }

  let discord=null;
  if(item.status==='published'){
    discord=await syncAnnouncementDiscord(env,{
      announcement:{
        ...item,
        imageUrl:item.imageKey?announcementImagePublicUrl(request,item.imageKey):'',
      },
      siteUrl:announcementUrl(request,item.id),
      notifyMongrels,
    });
    if(discord.ok){
      item.discordMessageId=discord.messageId||item.discordMessageId||'';
      item.discordWebhookId=discord.webhookId||item.discordWebhookId||'';
      item.discordLastSyncedAt=discord.syncedAt||new Date().toISOString();
      item.discordLastError='';
    }else{
      item.discordLastError=clean(discord.error||discord.mode||'discord_sync_failed').slice(0,180);
    }
    item.updatedAt=now;
    document.items[index]=item;
    document.updatedAt=now;
    await writeDocument(env,document);
  }

  return reply({
    ok:true,
    item:present(item,{canManage:true,request}),
    discord,
    discordConfigured:discordAnnouncementsConfigured(env),
    imageStorageConfigured:announcementImagesConfigured(env),
  });
}

export async function onRequestDelete({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  const storageError=requireStorage(env);
  if(storageError)return storageError;
  const body=await readBody(request);
  if(body.response)return body.response;
  const id=clean(body.value?.id).slice(0,100);
  if(!id)return reply({ok:false,error:'announcement_id_required'},400);

  const document=await readDocument(env);
  const index=document.items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'announcement_not_found'},404);
  if(document.items[index].status!=='draft'){
    return reply({ok:false,error:'published_announcements_must_be_archived'},409);
  }
  const imageKey=document.items[index].imageKey||'';
  document.items.splice(index,1);
  document.updatedAt=new Date().toISOString();
  await writeDocument(env,document);
  if(imageKey){
    try{await deleteManagedAnnouncementImage(env,imageKey);}
    catch(error){console.error('Could not clean up deleted announcement image',error);}
  }
  return reply({ok:true,deletedId:id});
}

async function readDocument(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return emptyDocument();
  try{
    const value=await env.PROJECTS.get(KV_KEY,{type:'json'});
    if(!value||!Array.isArray(value.items))return emptyDocument();
    return {version:1,updatedAt:clean(value.updatedAt),items:value.items.map(normalizeStoredItem).filter(Boolean)};
  }catch(error){
    console.error('Could not read announcements',error);
    return emptyDocument();
  }
}

async function writeDocument(env,document){
  await env.PROJECTS.put(KV_KEY,JSON.stringify({
    version:1,
    updatedAt:document.updatedAt||new Date().toISOString(),
    items:document.items,
  }));
}

function normalizeStoredItem(value){
  if(!value||typeof value!=='object'||!clean(value.id))return null;
  return {
    id:clean(value.id).slice(0,100),
    title:clean(value.title).slice(0,180),
    body:clean(value.body).slice(0,3500),
    priority:normalizePriority(value.priority),
    imageKey:normalizeImageKey(value.imageKey),
    status:['draft','published','archived'].includes(clean(value.status))?clean(value.status):'draft',
    authorId:clean(value.authorId).slice(0,100),
    authorName:clean(value.authorName).slice(0,120),
    createdAt:iso(value.createdAt),
    updatedAt:iso(value.updatedAt),
    updatedBy:clean(value.updatedBy).slice(0,120),
    publishedAt:iso(value.publishedAt),
    archivedAt:iso(value.archivedAt),
    discordMessageId:clean(value.discordMessageId).slice(0,40),
    discordWebhookId:clean(value.discordWebhookId).slice(0,40),
    discordLastSyncedAt:iso(value.discordLastSyncedAt),
    discordLastError:clean(value.discordLastError).slice(0,180),
  };
}

function present(item,{canManage=false,request=null}={}){
  const base={
    id:item.id,
    title:item.title,
    body:item.body,
    priority:item.priority,
    status:item.status,
    authorName:item.authorName,
    createdAt:item.createdAt,
    updatedAt:item.updatedAt,
    updatedBy:item.updatedBy,
    publishedAt:item.publishedAt,
    archivedAt:item.archivedAt,
    imageUrl:item.imageKey&&request
      ?(item.status==='draft'?announcementImagePreviewUrl(request,item.imageKey):announcementImagePublicUrl(request,item.imageKey))
      :'',
  };
  if(canManage){
    base.imageKey=item.imageKey||'';
    base.discordSynced=Boolean(item.discordMessageId&&item.discordLastSyncedAt&&!item.discordLastError);
    base.discordLastSyncedAt=item.discordLastSyncedAt;
    base.discordLastError=item.discordLastError;
  }
  return base;
}

function compareAnnouncements(a,b){
  const aTime=Date.parse(a.publishedAt||a.updatedAt||a.createdAt)||0;
  const bTime=Date.parse(b.publishedAt||b.updatedAt||b.createdAt)||0;
  return bTime-aTime;
}
function emptyDocument(){return{version:1,updatedAt:'',items:[]}}
function normalizePriority(value){return clean(value)==='important'?'important':'standard'}
function isDiscordRoleId(value){return /^\d{5,30}$/.test(clean(value))}
function normalizeImageKey(value){
  const key=clean(value);
  return isManagedAnnouncementImageKey(key)?key:'';
}
function viewer(session){return{id:String(session.sub||''),displayName:clean(session.displayName||session.username||'Member'),access:session.access}}
function announcementUrl(request,id){
  const url=new URL('/announcements/',request.url);
  url.hash='announcement-'+encodeURIComponent(String(id||''));
  return url.toString();
}
function requireStorage(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function'||typeof env.PROJECTS.put!=='function'){
    return reply({ok:false,error:'announcement_storage_not_configured'},503);
  }
  return null;
}
async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!MEMBER_ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}
async function requireSiteAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_required'},403)};
  return{session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='mongrels-announcements')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
async function readBody(request){
  try{return{value:await request.json()};}
  catch{return{response:reply({ok:false,error:'invalid_json'},400)};}
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
