import { galleryImagesConfigured, isGalleryImageKey, readGallerySubmissions } from '../../../lib/gallery-submissions.js';

export async function onRequestGet({request,env,params}){
  if(!galleryImagesConfigured(env))return new Response('Not found',{status:404});
  const file=decodeURIComponent(String(params?.file||'')).trim();
  const key=`gallery/${file}`;
  if(!isGalleryImageKey(key))return new Response('Not found',{status:404});
  const submissions=await readGallerySubmissions(env,{fresh:true});
  if(!submissions.some(item=>item.status==='approved'&&item.imageKey===key)){
    return new Response('Not found',{status:404});
  }

  let object;
  try{object=await env.EVENT_IMAGES.get(key);}
  catch(error){
    console.error('Could not read Gallery image',error);
    return new Response('Image unavailable',{status:503});
  }
  if(!object)return new Response('Not found',{status:404});

  const headers=new Headers();
  headers.set('Content-Type',object.httpMetadata?.contentType||contentTypeForFile(file));
  headers.set('Cache-Control','public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options','nosniff');
  if(object.httpEtag)headers.set('ETag',object.httpEtag);
  if(request.headers.get('If-None-Match')===object.httpEtag)return new Response(null,{status:304,headers});
  return new Response(object.body,{status:200,headers});
}
function contentTypeForFile(file){
  const lower=String(file||'').toLowerCase();
  if(lower.endsWith('.png'))return'image/png';
  if(lower.endsWith('.webp'))return'image/webp';
  return'image/jpeg';
}
