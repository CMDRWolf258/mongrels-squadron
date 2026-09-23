import { announcementImagesConfigured, isManagedAnnouncementImageKey } from '../../../lib/announcement-images.js';

const KV_KEY='announcements-v1';

export async function onRequestGet({request,env,params}){
  if(!announcementImagesConfigured(env)||!env?.PROJECTS)return new Response('Not found',{status:404});
  const file=decodeURIComponent(String(params?.file||'')).trim();
  const key='announcements/'+file;
  if(!isManagedAnnouncementImageKey(key))return new Response('Not found',{status:404});

  let document;
  try{document=await env.PROJECTS.get(KV_KEY,{type:'json'});}
  catch(error){
    console.error('Could not verify announcement image publication state',error);
    return new Response('Image unavailable',{status:503});
  }
  const published=Array.isArray(document?.items)&&document.items.some(item=>
    ['published','archived'].includes(String(item?.status||''))&&String(item?.imageKey||'')===key
  );
  if(!published)return new Response('Not found',{status:404});

  let object;
  try{object=await env.EVENT_IMAGES.get(key);}
  catch(error){
    console.error('Could not read published announcement image',error);
    return new Response('Image unavailable',{status:503});
  }
  if(!object)return new Response('Not found',{status:404});

  const headers=new Headers();
  headers.set('Content-Type',object.httpMetadata?.contentType||contentTypeForFile(file));
  headers.set('Cache-Control','public, max-age=3600');
  headers.set('X-Content-Type-Options','nosniff');
  if(object.httpEtag)headers.set('ETag',object.httpEtag);
  return new Response(object.body,{status:200,headers});
}

function contentTypeForFile(file){
  const lower=String(file||'').toLowerCase();
  if(lower.endsWith('.png'))return'image/png';
  if(lower.endsWith('.webp'))return'image/webp';
  return'image/jpeg';
}
