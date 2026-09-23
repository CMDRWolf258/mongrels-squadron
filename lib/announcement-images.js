export const ANNOUNCEMENT_IMAGE_MAX_BYTES=8*1024*1024;
export const ANNOUNCEMENT_IMAGE_TYPES=new Map([
  ['image/png','png'],
  ['image/jpeg','jpg'],
  ['image/webp','webp'],
]);

export function announcementImagesConfigured(env){
  return Boolean(env?.EVENT_IMAGES&&typeof env.EVENT_IMAGES.put==='function'&&typeof env.EVENT_IMAGES.get==='function');
}

export function announcementImageExtension(contentType){
  return ANNOUNCEMENT_IMAGE_TYPES.get(String(contentType||'').toLowerCase())||'';
}

export function isManagedAnnouncementImageKey(value){
  return /^announcements\/[0-9]{10,16}-[0-9a-f-]{20,60}\.(?:png|jpg|webp)$/i.test(String(value||''));
}

export function createAnnouncementImageKey(contentType){
  const ext=announcementImageExtension(contentType);
  if(!ext)return'';
  return 'announcements/'+Date.now()+'-'+crypto.randomUUID()+'.'+ext;
}

export function announcementImagePublicUrl(request,key){
  if(!isManagedAnnouncementImageKey(key))return'';
  const origin=new URL(request.url).origin;
  const file=String(key).slice('announcements/'.length);
  return origin+'/media/announcements/'+encodeURIComponent(file);
}

export function announcementImagePreviewUrl(request,key){
  if(!isManagedAnnouncementImageKey(key))return'';
  const origin=new URL(request.url).origin;
  return origin+'/api/announcements/image?key='+encodeURIComponent(key);
}

export async function deleteManagedAnnouncementImage(env,key){
  if(!env?.EVENT_IMAGES||typeof env.EVENT_IMAGES.delete!=='function'||!isManagedAnnouncementImageKey(key))return false;
  await env.EVENT_IMAGES.delete(key);
  return true;
}
