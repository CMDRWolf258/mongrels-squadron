import { json, readSession } from '../../../lib/auth.js';
import {
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  announcementImageExtension,
  announcementImagePreviewUrl,
  announcementImagesConfigured,
  createAnnouncementImageKey,
  deleteManagedAnnouncementImage,
  isManagedAnnouncementImageKey,
} from '../../../lib/announcement-images.js';

export async function onRequestPost({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  const err=validateRequest(request,'POST'); if(err)return err;
  if(!announcementImagesConfigured(env))return reply({ok:false,error:'announcement_image_storage_not_configured'},503);

  let form;
  try{form=await request.formData();}
  catch{return reply({ok:false,error:'invalid_announcement_image_upload'},400);}

  const file=form.get('image');
  if(!file||typeof file.arrayBuffer!=='function')return reply({ok:false,error:'announcement_image_required'},400);

  const contentType=String(file.type||'').toLowerCase();
  if(!announcementImageExtension(contentType))return reply({ok:false,error:'unsupported_announcement_image_type'},415);

  const size=Number(file.size)||0;
  if(size<1)return reply({ok:false,error:'announcement_image_empty'},400);
  if(size>ANNOUNCEMENT_IMAGE_MAX_BYTES)return reply({ok:false,error:'announcement_image_too_large',maxBytes:ANNOUNCEMENT_IMAGE_MAX_BYTES},413);

  const key=createAnnouncementImageKey(contentType);
  try{
    await env.EVENT_IMAGES.put(key,await file.arrayBuffer(),{
      httpMetadata:{contentType,cacheControl:'private, no-store'},
      customMetadata:{
        uploadedBy:String(auth.session.sub||'').slice(0,80),
        uploadedAt:new Date().toISOString(),
      },
    });
  }catch(error){
    console.error('Could not upload announcement image',error);
    return reply({ok:false,error:'announcement_image_upload_failed'},500);
  }

  return reply({
    ok:true,
    key,
    previewUrl:announcementImagePreviewUrl(request,key),
    contentType,
    size,
  },201);
}

export async function onRequestDelete({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  const err=validateRequest(request,'DELETE'); if(err)return err;
  if(!announcementImagesConfigured(env))return reply({ok:false,error:'announcement_image_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}
  const key=String(body?.key||'').trim();
  if(!isManagedAnnouncementImageKey(key))return reply({ok:false,error:'invalid_announcement_image_key'},400);

  try{
    await deleteManagedAnnouncementImage(env,key);
    return reply({ok:true});
  }catch(error){
    console.error('Could not delete announcement image',error);
    return reply({ok:false,error:'announcement_image_delete_failed'},500);
  }
}

async function requireAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_required'},403)};
  return{session};
}

function validateRequest(request,method){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='mongrels-announcement-image'||request.method!==method){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}

function headers(){
  return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};
}
function reply(data,status=200){return json(data,{status,headers:headers()});}
