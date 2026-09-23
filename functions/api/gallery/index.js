import { json, readSession } from '../../../lib/auth.js';
import {
  GALLERY_DAILY_LIMIT,
  GALLERY_IMAGE_MAX_BYTES,
  GALLERY_TAGS,
  cleanGalleryText,
  createGalleryImageKey,
  deleteGalleryImage,
  galleryImageExtension,
  galleryImagesConfigured,
  galleryQuota,
  managerGallerySubmission,
  memberGallerySubmission,
  normalizeGalleryTags,
  publicGallerySubmission,
  readGallerySubmissions,
  writeGallerySubmissions,
} from '../../../lib/gallery-submissions.js';

const MEMBER_ACCESS=new Set(['member','officer','site_admin']);
const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}){
  const session=await readSession(request,env);
  const items=await readGallerySubmissions(env);
  const approved=items
    .filter(item=>item.status==='approved')
    .sort((a,b)=>Date.parse(b.reviewedAt||b.submittedAt)-Date.parse(a.reviewedAt||a.submittedAt))
    .map(item=>publicGallerySubmission(item,request))
    .filter(Boolean);

  const member=Boolean(session&&MEMBER_ACCESS.has(session.access));
  const manager=Boolean(session&&MANAGER_ACCESS.has(session.access));
  return reply({
    ok:true,
    approved,
    tags:GALLERY_TAGS,
    viewer:member?{displayName:session.displayName,access:session.access}:null,
    quota:member?galleryQuota(items,session.sub):null,
    mine:member?items.filter(item=>item.ownerId===session.sub).sort(newestFirst).slice(0,20).map(item=>memberGallerySubmission(item,request)):[],
    canModerate:manager,
    pending:manager?items.filter(item=>item.status==='pending').sort(oldestFirst).map(item=>managerGallerySubmission(item,request)):[],
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireMember(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request,'gallery-submission'); if(err)return err;
  if(!galleryImagesConfigured(env))return reply({ok:false,error:'gallery_image_storage_not_configured'},503);

  const items=await readGallerySubmissions(env,{fresh:true});
  const quota=galleryQuota(items,auth.session.sub);
  if(quota.remaining<=0)return reply({ok:false,error:'gallery_daily_upload_limit',quota},429);

  let form;
  try{form=await request.formData();}
  catch{return reply({ok:false,error:'invalid_gallery_submission'},400);}

  const file=form.get('image');
  if(!file||typeof file.arrayBuffer!=='function')return reply({ok:false,error:'gallery_image_required'},400);
  const contentType=String(file.type||'').toLowerCase();
  const ext=galleryImageExtension(contentType);
  if(!ext)return reply({ok:false,error:'unsupported_gallery_image_type'},415);
  const size=Number(file.size)||0;
  if(size<1)return reply({ok:false,error:'gallery_image_empty'},400);
  if(size>GALLERY_IMAGE_MAX_BYTES)return reply({ok:false,error:'gallery_image_too_large',maxBytes:GALLERY_IMAGE_MAX_BYTES},413);

  const title=cleanGalleryText(form.get('title'),120);
  const caption=cleanGalleryText(form.get('caption'),600);
  let tags=[];
  try{tags=normalizeGalleryTags(JSON.parse(String(form.get('tags')||'[]')));}
  catch{tags=normalizeGalleryTags(form.get('tags'));}
  if(!title)return reply({ok:false,error:'gallery_title_required'},400);
  if(!tags.length)return reply({ok:false,error:'gallery_tag_required'},400);

  const imageKey=createGalleryImageKey(contentType);
  try{
    await env.EVENT_IMAGES.put(imageKey,await file.arrayBuffer(),{
      httpMetadata:{contentType,cacheControl:'public, max-age=31536000, immutable'},
      customMetadata:{
        uploadedBy:String(auth.session.sub||'').slice(0,80),
        uploadedAt:new Date().toISOString(),
        purpose:'gallery-submission',
      },
    });
  }catch(error){
    console.error('Could not upload Gallery image',error);
    return reply({ok:false,error:'gallery_image_upload_failed'},500);
  }

  const now=new Date().toISOString();
  const submission={
    id:crypto.randomUUID(),
    ownerId:auth.session.sub,
    ownerName:auth.session.displayName||'Mongrel Commander',
    title,caption,tags,imageKey,
    status:'pending',
    submittedAt:now,
    reviewedAt:'',
    reviewedBy:'',
    reviewNote:'',
  };
  items.unshift(submission);
  try{await writeGallerySubmissions(env,items);}
  catch(error){
    await deleteGalleryImage(env,imageKey).catch(()=>{});
    console.error('Could not save Gallery submission',error);
    return reply({ok:false,error:'gallery_submission_save_failed'},500);
  }

  return reply({
    ok:true,
    submission:memberGallerySubmission(submission,request),
    quota:galleryQuota(items,auth.session.sub),
  },201);
}

export async function onRequestPatch({request,env}){
  const auth=await requireManager(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request,'gallery-moderation'); if(err)return err;

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}
  const id=cleanGalleryText(body?.id,100);
  const action=String(body?.action||'').trim().toLowerCase();
  if(!id||!['approve','reject'].includes(action))return reply({ok:false,error:'invalid_gallery_moderation'},400);

  const items=await readGallerySubmissions(env,{fresh:true});
  const index=items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'gallery_submission_not_found'},404);
  const item=items[index];
  if(item.status!=='pending')return reply({ok:false,error:'gallery_submission_already_reviewed'},409);

  const title=cleanGalleryText(body?.title,120)||item.title;
  const caption=body?.caption===undefined?item.caption:cleanGalleryText(body.caption,600);
  const tags=body?.tags===undefined?item.tags:normalizeGalleryTags(body.tags);
  if(action==='approve'&&!tags.length)return reply({ok:false,error:'gallery_tag_required'},400);

  item.title=title;
  item.caption=caption;
  item.tags=tags.length?tags:item.tags;
  item.status=action==='approve'?'approved':'rejected';
  item.reviewedAt=new Date().toISOString();
  item.reviewedBy=auth.session.displayName||'Squadron Leadership';
  item.reviewNote=cleanGalleryText(body?.reviewNote,300);
  items[index]=item;
  await writeGallerySubmissions(env,items);

  if(action==='reject'&&item.imageKey){
    const oldKey=item.imageKey;
    try{
      await deleteGalleryImage(env,oldKey);
      item.imageKey='';
      items[index]=item;
      await writeGallerySubmissions(env,items);
    }catch(error){
      console.error('Could not clean up rejected Gallery image',error);
    }
  }

  return reply({ok:true,submission:managerGallerySubmission(item,request)});
}

async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return {response:reply({ok:false,error:'authentication_required'},401)};
  if(!MEMBER_ACCESS.has(session.access))return {response:reply({ok:false,error:'member_access_required'},403)};
  return {session};
}
async function requireManager(request,env){
  const session=await readSession(request,env);
  if(!session)return {response:reply({ok:false,error:'authentication_required'},401)};
  if(!MANAGER_ACCESS.has(session.access))return {response:reply({ok:false,error:'officer_access_required'},403)};
  return {session};
}
function validateSameOrigin(request,marker){
  const origin=request.headers.get('Origin');
  if(origin!==new URL(request.url).origin||request.headers.get('X-Mongrels-Request')!==marker){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}
function newestFirst(a,b){return Date.parse(b.submittedAt||0)-Date.parse(a.submittedAt||0)}
function oldestFirst(a,b){return Date.parse(a.submittedAt||0)-Date.parse(b.submittedAt||0)}
function headers(){return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}}
function reply(data,status=200){return json(data,{status,headers:headers()})}
