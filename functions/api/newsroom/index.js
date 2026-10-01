import { json, readSession } from '../../../lib/auth.js';
import {
  deleteManagedNewsroomImage,
  isManagedNewsroomImageKey,
  newsroomImagePreviewUrl,
  newsroomImagePublicUrl,
} from '../../../lib/newsroom-images.js';

const KV_KEY='newsroom-v1';
const CATEGORIES=new Set(['squadron-news','field-report','command-briefing','colonial-dispatch','lore']);
const STATUSES=new Set(['draft','published','archived']);
const MAX_ITEMS=250;

export async function onRequestGet({request,env}){
  const storage=requireStorage(env); if(storage)return storage;
  const session=await readSession(request,env);
  const canManage=session?.access==='site_admin';
  const document=await readDocument(env);
  const items=document.items
    .filter(item=>canManage||item.status==='published')
    .sort(compareStories)
    .map(item=>present(item,{canManage,request}));
  return reply({
    ok:true,
    publication:{name:'The Morning Walk',tagline:'Dispatches from the Regiment of Imperial Mongrels'},
    categories:categoryOptions(),
    viewer:session?{displayName:session.displayName||session.username||'Member',access:session.access}:null,
    canManage,
    items,
    updatedAt:document.updatedAt||'',
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireSiteAdmin(request,env); if(auth.response)return auth.response;
  const validation=validateSameOrigin(request); if(validation)return validation;
  const storage=requireStorage(env); if(storage)return storage;
  const body=await readBody(request); if(body.response)return body.response;

  const now=new Date().toISOString();
  const item=normalizeInput(body.value,{
    id:crypto.randomUUID(),
    status:'draft',
    authorId:String(auth.session.sub||''),
    authorName:clean(auth.session.displayName||auth.session.username||'Site Admin',120),
    createdAt:now,
    updatedAt:now,
    updatedBy:clean(auth.session.displayName||auth.session.username||'Site Admin',120),
    publishedAt:'',
    archivedAt:'',
  });
  if(!item.title||!item.body)return reply({ok:false,error:'title_and_body_required'},400);

  const document=await readDocument(env);
  document.items.unshift(item);
  document.items=document.items.slice(0,MAX_ITEMS);
  document.updatedAt=now;
  await writeDocument(env,document);
  return reply({ok:true,item:present(item,{canManage:true,request})},201);
}

export async function onRequestPut({request,env}){
  const auth=await requireSiteAdmin(request,env); if(auth.response)return auth.response;
  const validation=validateSameOrigin(request); if(validation)return validation;
  const storage=requireStorage(env); if(storage)return storage;
  const body=await readBody(request); if(body.response)return body.response;

  const id=clean(body.value?.id,100);
  if(!id)return reply({ok:false,error:'story_id_required'},400);
  const document=await readDocument(env);
  const index=document.items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'story_not_found'},404);

  const existing=document.items[index];
  const previousImageKey=existing.imageKey||'';
  const now=new Date().toISOString();
  const action=clean(body.value?.action,24).toLowerCase()||'save';
  if(!['save','publish','archive','restore'].includes(action))return reply({ok:false,error:'unsupported_action'},400);

  let next=normalizeInput(body.value,{
    ...existing,
    id:existing.id,
    authorId:existing.authorId,
    authorName:existing.authorName,
    createdAt:existing.createdAt,
    updatedAt:now,
    updatedBy:clean(auth.session.displayName||auth.session.username||'Site Admin',120),
  });
  if(!next.title||!next.body)return reply({ok:false,error:'title_and_body_required'},400);

  if(action==='publish'){
    next={...next,status:'published',publishedAt:existing.publishedAt||now,archivedAt:''};
  }else if(action==='archive'){
    if(existing.status!=='published')return reply({ok:false,error:'only_published_stories_can_be_archived'},409);
    next={...next,status:'archived',archivedAt:now};
  }else if(action==='restore'){
    if(existing.status!=='archived')return reply({ok:false,error:'only_archived_stories_can_be_restored'},409);
    next={...next,status:'draft',archivedAt:''};
  }else{
    next={...next,status:existing.status,publishedAt:existing.publishedAt,archivedAt:existing.archivedAt};
  }

  document.items[index]=next;
  document.updatedAt=now;
  await writeDocument(env,document);
  if(previousImageKey&&previousImageKey!==next.imageKey){
    try{await deleteManagedNewsroomImage(env,previousImageKey);}
    catch(error){console.error('Could not clean up replaced Newsroom image',error);}
  }
  return reply({ok:true,item:present(next,{canManage:true,request})});
}

export async function onRequestDelete({request,env}){
  const auth=await requireSiteAdmin(request,env); if(auth.response)return auth.response;
  const validation=validateSameOrigin(request); if(validation)return validation;
  const storage=requireStorage(env); if(storage)return storage;
  const id=clean(new URL(request.url).searchParams.get('id'),100);
  if(!id)return reply({ok:false,error:'story_id_required'},400);

  const document=await readDocument(env);
  const index=document.items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'story_not_found'},404);
  if(document.items[index].status!=='draft')return reply({ok:false,error:'only_drafts_can_be_deleted'},409);
  const imageKey=document.items[index].imageKey||'';
  document.items.splice(index,1);
  document.updatedAt=new Date().toISOString();
  await writeDocument(env,document);
  if(imageKey){
    try{await deleteManagedNewsroomImage(env,imageKey);}
    catch(error){console.error('Could not clean up deleted Newsroom draft image',error);}
  }
  return reply({ok:true,deletedId:id});
}

async function readDocument(env){
  try{
    const value=await env.PROJECTS.get(KV_KEY,{type:'json'});
    if(!value||!Array.isArray(value.items))return emptyDocument();
    return{
      version:1,
      updatedAt:iso(value.updatedAt),
      items:value.items.map(normalizeStoredItem).filter(Boolean).slice(0,MAX_ITEMS),
    };
  }catch(error){
    console.error('Could not read Newsroom document',error);
    return emptyDocument();
  }
}

async function writeDocument(env,document){
  await env.PROJECTS.put(KV_KEY,JSON.stringify({
    version:1,
    updatedAt:document.updatedAt||new Date().toISOString(),
    items:document.items.slice(0,MAX_ITEMS),
  }));
}

function normalizeInput(value,fixed){
  const src=value&&typeof value==='object'?value:{};
  return{
    ...fixed,
    title:clean(src.title ?? fixed.title,180),
    deck:clean(src.deck ?? fixed.deck,360),
    body:clean(src.body ?? fixed.body,12000),
    category:normalizeCategory(src.category ?? fixed.category),
    byline:clean(src.byline ?? fixed.byline ?? fixed.authorName,120),
    imageKey:normalizeImageKey(src.imageKey ?? fixed.imageKey),
    imagePlacement:normalizeImagePlacement(src.imagePlacement ?? fixed.imagePlacement),
    imageCaption:clean(src.imageCaption ?? fixed.imageCaption,300),
    imageCredit:clean(src.imageCredit ?? fixed.imageCredit,120),
  };
}

function normalizeStoredItem(value){
  if(!value||typeof value!=='object')return null;
  const id=clean(value.id,100);
  if(!id)return null;
  return{
    id,
    title:clean(value.title,180),
    deck:clean(value.deck,360),
    body:clean(value.body,12000),
    category:normalizeCategory(value.category),
    byline:clean(value.byline||value.authorName,120),
    imageKey:normalizeImageKey(value.imageKey),
    imagePlacement:normalizeImagePlacement(value.imagePlacement),
    imageCaption:clean(value.imageCaption,300),
    imageCredit:clean(value.imageCredit,120),
    status:STATUSES.has(clean(value.status,24))?clean(value.status,24):'draft',
    authorId:clean(value.authorId,100),
    authorName:clean(value.authorName,120),
    createdAt:iso(value.createdAt),
    updatedAt:iso(value.updatedAt),
    updatedBy:clean(value.updatedBy,120),
    publishedAt:iso(value.publishedAt),
    archivedAt:iso(value.archivedAt),
  };
}

function present(item,{canManage=false,request=null}={}){
  const base={
    id:item.id,title:item.title,deck:item.deck,body:item.body,category:item.category,
    categoryLabel:categoryLabel(item.category),byline:item.byline,status:item.status,
    publishedAt:item.publishedAt,createdAt:item.createdAt,updatedAt:item.updatedAt,
    imagePlacement:item.imagePlacement,imageCaption:item.imageCaption,imageCredit:item.imageCredit,
    imageUrl:item.imageKey&&request
      ?(item.status==='published'?newsroomImagePublicUrl(request,item.imageKey):canManage?newsroomImagePreviewUrl(request,item.imageKey):'')
      :'',
  };
  if(canManage){
    base.authorName=item.authorName;
    base.updatedBy=item.updatedBy;
    base.archivedAt=item.archivedAt;
    base.imageKey=item.imageKey||'';
  }
  return base;
}

function compareStories(a,b){
  const at=Date.parse(a.publishedAt||a.updatedAt||a.createdAt)||0;
  const bt=Date.parse(b.publishedAt||b.updatedAt||b.createdAt)||0;
  return bt-at;
}
function normalizeCategory(value){const key=clean(value,40);return CATEGORIES.has(key)?key:'squadron-news'}
function normalizeImageKey(value){const key=clean(value,180);return isManagedNewsroomImageKey(key)?key:''}
function normalizeImagePlacement(value){const key=clean(value,32);return['upper-left','upper-right','lower-left','lower-right'].includes(key)?key:'upper-right'}
function categoryLabel(value){return({
  'squadron-news':'Squadron News',
  'field-report':'Field Report',
  'command-briefing':'Command Briefing',
  'colonial-dispatch':'Colonial Dispatch',
  'lore':'Lore',
})[normalizeCategory(value)]}
function categoryOptions(){return[...CATEGORIES].map(id=>({id,label:categoryLabel(id)}))}
function emptyDocument(){return{version:1,updatedAt:'',items:[]}}
function clean(value,max=1000){return typeof value==='string'?value.trim().slice(0,max):String(value??'').trim().slice(0,max)}
function iso(value){if(!value)return'';const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():''}
function requireStorage(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function'||typeof env.PROJECTS.put!=='function'){
    return reply({ok:false,error:'newsroom_storage_not_configured'},503);
  }
  return null;
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
  if(origin!==expected||marker!=='mongrels-newsroom')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
async function readBody(request){try{return{value:await request.json()}}catch{return{response:reply({ok:false,error:'invalid_json'},400)}}}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff',
  }});
}
