import { json, readSession } from '../../../lib/auth.js';
import {
  EVENT_IMAGE_MAX_BYTES,
  createEventImageKey,
  deleteManagedEventImage,
  eventImageExtension,
  eventImagePublicUrl,
  eventImagesConfigured,
  isManagedEventImageKey,
} from '../../../lib/event-images.js';

const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestPost({request,env}){
  const auth=await requireManager(request,env); if(auth.response)return auth.response;
  const err=validateRequest(request,'POST'); if(err)return err;
  if(!eventImagesConfigured(env))return reply({ok:false,error:'event_image_storage_not_configured'},503);

  let form;
  try{form=await request.formData();}
  catch{return reply({ok:false,error:'invalid_event_image_upload'},400);}

  const file=form.get('image');
  if(!file||typeof file.arrayBuffer!=='function')return reply({ok:false,error:'event_image_required'},400);

  const contentType=String(file.type||'').toLowerCase();
  const ext=eventImageExtension(contentType);
  if(!ext)return reply({ok:false,error:'unsupported_event_image_type'},415);

  const size=Number(file.size)||0;
  if(size<1)return reply({ok:false,error:'event_image_empty'},400);
  if(size>EVENT_IMAGE_MAX_BYTES)return reply({ok:false,error:'event_image_too_large',maxBytes:EVENT_IMAGE_MAX_BYTES},413);

  const key=createEventImageKey(contentType);
  if(!key)return reply({ok:false,error:'unsupported_event_image_type'},415);

  try{
    const body=await file.arrayBuffer();
    await env.EVENT_IMAGES.put(key,body,{
      httpMetadata:{
        contentType,
        cacheControl:'public, max-age=31536000, immutable',
      },
      customMetadata:{
        uploadedBy:String(auth.session.sub||'').slice(0,80),
        uploadedAt:new Date().toISOString(),
      },
    });
  }catch(error){
    console.error('Could not upload Squad Event image',error);
    return reply({ok:false,error:'event_image_upload_failed'},500);
  }

  return reply({
    ok:true,
    key,
    url:eventImagePublicUrl(request,key),
    contentType,
    size,
  },201);
}

export async function onRequestDelete({request,env}){
  const auth=await requireManager(request,env); if(auth.response)return auth.response;
  const err=validateRequest(request,'DELETE'); if(err)return err;
  if(!eventImagesConfigured(env))return reply({ok:false,error:'event_image_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}
  const key=String(body?.key||'').trim();
  if(!isManagedEventImageKey(key))return reply({ok:false,error:'invalid_event_image_key'},400);

  try{
    const object=typeof env.EVENT_IMAGES.head==='function'?await env.EVENT_IMAGES.head(key):null;
    if(object?.customMetadata?.uploadedBy&&String(object.customMetadata.uploadedBy)!==String(auth.session.sub)&&auth.session.access!=='site_admin'){
      return reply({ok:false,error:'event_image_not_owned'},403);
    }
    await deleteManagedEventImage(env,key);
    return reply({ok:true});
  }catch(error){
    console.error('Could not delete Squad Event image',error);
    return reply({ok:false,error:'event_image_delete_failed'},500);
  }
}

async function requireManager(request,env){
  const session=await readSession(request,env);
  if(!session)return {response:reply({ok:false,error:'authentication_required'},401)};
  if(!MANAGER_ACCESS.has(session.access))return {response:reply({ok:false,error:'event_manager_access_required'},403)};
  return {session};
}

function validateRequest(request,method){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='project-event-image'||request.method!==method){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}

function headers(){
  return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};
}
function reply(data,status=200){return json(data,{status,headers:headers()});}
