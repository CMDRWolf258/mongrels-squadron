export const NEWSROOM_IMAGE_MAX_BYTES=8*1024*1024;
export const NEWSROOM_IMAGE_TYPES=new Map([
  ['image/png','png'],
  ['image/jpeg','jpg'],
  ['image/webp','webp'],
]);

export function newsroomImagesConfigured(env){
  return Boolean(env?.EVENT_IMAGES&&typeof env.EVENT_IMAGES.put==='function'&&typeof env.EVENT_IMAGES.get==='function');
}
export function newsroomImageExtension(contentType){
  return NEWSROOM_IMAGE_TYPES.get(String(contentType||'').toLowerCase())||'';
}
export function isManagedNewsroomImageKey(value){
  return /^newsroom\/[0-9]{10,16}-[0-9a-f-]{20,60}\.(?:png|jpg|webp)$/i.test(String(value||''));
}
export function createNewsroomImageKey(contentType){
  const ext=newsroomImageExtension(contentType);
  if(!ext)return'';
  return 'newsroom/'+Date.now()+'-'+crypto.randomUUID()+'.'+ext;
}
export function newsroomImagePublicUrl(request,key){
  if(!isManagedNewsroomImageKey(key))return'';
  const origin=new URL(request.url).origin;
  const file=String(key).slice('newsroom/'.length);
  return origin+'/media/newsroom/'+encodeURIComponent(file);
}
export function newsroomImagePreviewUrl(request,key){
  if(!isManagedNewsroomImageKey(key))return'';
  const origin=new URL(request.url).origin;
  return origin+'/api/newsroom/image?key='+encodeURIComponent(key);
}
export async function deleteManagedNewsroomImage(env,key){
  if(!env?.EVENT_IMAGES||typeof env.EVENT_IMAGES.delete!=='function'||!isManagedNewsroomImageKey(key))return false;
  await env.EVENT_IMAGES.delete(key);
  return true;
}
