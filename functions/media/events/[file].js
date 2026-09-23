import { eventImagesConfigured, isManagedEventImageKey } from '../../../lib/event-images.js';

export async function onRequestGet({request,env,params}){
  if(!eventImagesConfigured(env))return new Response('Not found',{status:404});
  const file=decodeURIComponent(String(params?.file||'')).trim();
  const key=`events/${file}`;
  if(!isManagedEventImageKey(key))return new Response('Not found',{status:404});

  let object;
  try{object=await env.EVENT_IMAGES.get(key);}
  catch(error){
    console.error('Could not read Squad Event image',error);
    return new Response('Image unavailable',{status:503});
  }
  if(!object)return new Response('Not found',{status:404});

  const headers=new Headers();
  if(object.httpMetadata?.contentType)headers.set('Content-Type',object.httpMetadata.contentType);
  else headers.set('Content-Type',contentTypeForFile(file));
  headers.set('Cache-Control','public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options','nosniff');
  if(object.httpEtag)headers.set('ETag',object.httpEtag);

  const ifNoneMatch=request.headers.get('If-None-Match');
  if(ifNoneMatch&&object.httpEtag&&ifNoneMatch===object.httpEtag){
    return new Response(null,{status:304,headers});
  }
  return new Response(object.body,{status:200,headers});
}

function contentTypeForFile(file){
  const lower=String(file||'').toLowerCase();
  if(lower.endsWith('.png'))return'image/png';
  if(lower.endsWith('.webp'))return'image/webp';
  return'image/jpeg';
}
