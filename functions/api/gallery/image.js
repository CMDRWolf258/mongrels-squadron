import { readSession } from '../../../lib/auth.js';
import {
  galleryImagesConfigured,
  isGalleryImageKey,
  readGallerySubmissions,
} from '../../../lib/gallery-submissions.js';

const MEMBER_ACCESS=new Set(['member','officer','site_admin']);
const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}){
  const session=await readSession(request,env);
  if(!session||!MEMBER_ACCESS.has(session.access))return new Response('Not found',{status:404});
  if(!galleryImagesConfigured(env))return new Response('Not found',{status:404});

  const key=new URL(request.url).searchParams.get('key')||'';
  if(!isGalleryImageKey(key))return new Response('Not found',{status:404});

  const submissions=await readGallerySubmissions(env);
  const item=submissions.find(entry=>entry.imageKey===key);
  if(!item)return new Response('Not found',{status:404});
  const allowed=item.ownerId===session.sub||MANAGER_ACCESS.has(session.access);
  if(!allowed)return new Response('Not found',{status:404});

  let object;
  try{object=await env.EVENT_IMAGES.get(key);}
  catch(error){
    console.error('Could not read pending Gallery image',error);
    return new Response('Image unavailable',{status:503});
  }
  if(!object)return new Response('Not found',{status:404});

  const file=key.split('/').pop()||'';
  const headers=new Headers();
  headers.set('Content-Type',object.httpMetadata?.contentType||contentTypeForFile(file));
  headers.set('Cache-Control','private, no-store, no-cache, must-revalidate');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(object.body,{status:200,headers});
}

function contentTypeForFile(file){
  const lower=String(file||'').toLowerCase();
  if(lower.endsWith('.png'))return'image/png';
  if(lower.endsWith('.webp'))return'image/webp';
  return'image/jpeg';
}
