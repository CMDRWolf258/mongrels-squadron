import { json, readSession } from '../../../lib/auth.js';
import {
  NEWSROOM_IMAGE_MAX_BYTES,
  newsroomImageExtension,
  newsroomImagePreviewUrl,
  newsroomImagesConfigured,
  createNewsroomImageKey,
  deleteManagedNewsroomImage,
  isManagedNewsroomImageKey,
} from '../../../lib/newsroom-images.js';

export async function onRequestGet({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  if(!newsroomImagesConfigured(env))return new Response('Not found',{status:404});
  const key=String(new URL(request.url).searchParams.get('key')||'').trim();
  if(!isManagedNewsroomImageKey(key))return new Response('Not found',{status:404});

  let object;
  try{object=await env.EVENT_IMAGES.get(key);}
  catch(error){
    console.error('Could not read Newsroom image preview',error);
    return new Response('Image unavailable',{status:503});
  }
  if(!object)return new Response('Not found',{status:404});

  const headers=new Headers();
  headers.set('Content-Type',object.httpMetadata?.contentType||contentTypeForKey(key));
  headers.set('Cache-Control','private, no-store, no-cache, must-revalidate');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(object.body,{status:200,headers});
}

export async function onRequestPost({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  const err=validateRequest(request,'POST'); if(err)return err;
  if(!newsroomImagesConfigured(env))return reply({ok:false,error:'newsroom_image_storage_not_configured'},503);

  let form;
  try{form=await request.formData();}
  catch{return reply({ok:false,error:'invalid_newsroom_image_upload'},400);}

  const file=form.get('image');
  if(!file||typeof file.arrayBuffer!=='function')return reply({ok:false,error:'newsroom_image_required'},400);

  const contentType=String(file.type||'').toLowerCase();
  if(!newsroomImageExtension(contentType))return reply({ok:false,error:'unsupported_newsroom_image_type'},415);

  const size=Number(file.size)||0;
  if(size<1)return reply({ok:false,error:'newsroom_image_empty'},400);
  if(size>NEWSROOM_IMAGE_MAX_BYTES)return reply({ok:false,error:'newsroom_image_too_large',maxBytes:NEWSROOM_IMAGE_MAX_BYTES},413);

  const key=createNewsroomImageKey(contentType);
  try{
    await env.EVENT_IMAGES.put(key,await file.arrayBuffer(),{
      httpMetadata:{contentType,cacheControl:'private, no-store'},
      customMetadata:{
        uploadedBy:String(auth.session.sub||'').slice(0,80),
        uploadedAt:new Date().toISOString(),
        purpose:'morning-walk-story',
      },
    });
  }catch(error){
    console.error('Could not upload Newsroom image',error);
    return reply({ok:false,error:'newsroom_image_upload_failed'},500);
  }

  return reply({ok:true,key,previewUrl:newsroomImagePreviewUrl(request,key),contentType,size},201);
}

export async function onRequestDelete({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  const err=validateRequest(request,'DELETE'); if(err)return err;
  if(!newsroomImagesConfigured(env))return reply({ok:false,error:'newsroom_image_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}
  const key=String(body?.key||'').trim();
  if(!isManagedNewsroomImageKey(key))return reply({ok:false,error:'invalid_newsroom_image_key'},400);

  try{
    await deleteManagedNewsroomImage(env,key);
    return reply({ok:true});
  }catch(error){
    console.error('Could not delete Newsroom image',error);
    return reply({ok:false,error:'newsroom_image_delete_failed'},500);
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
  if(origin!==expected||marker!=='mongrels-newsroom-image'||request.method!==method){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}
function contentTypeForKey(key){
  const lower=String(key||'').toLowerCase();
  if(lower.endsWith('.png'))return'image/png';
  if(lower.endsWith('.webp'))return'image/webp';
  return'image/jpeg';
}
function reply(data,status=200){return json(data,{status,headers:{
  'Cache-Control':'private, no-store, no-cache, must-revalidate',
  Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff',
}})}
