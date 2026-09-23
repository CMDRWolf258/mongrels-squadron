export const EVENT_IMAGE_MAX_BYTES=8*1024*1024;
export const EVENT_IMAGE_TYPES=new Map([
  ['image/png','png'],
  ['image/jpeg','jpg'],
  ['image/webp','webp'],
]);

export function eventImagesConfigured(env){
  return Boolean(env?.EVENT_IMAGES&&typeof env.EVENT_IMAGES.put==='function'&&typeof env.EVENT_IMAGES.get==='function');
}

export function eventImageExtension(contentType){
  return EVENT_IMAGE_TYPES.get(String(contentType||'').toLowerCase())||'';
}

export function isManagedEventImageKey(value){
  return /^events\/[0-9]{10,16}-[0-9a-f-]{20,60}\.(?:png|jpg|webp)$/i.test(String(value||''));
}

export function createEventImageKey(contentType){
  const ext=eventImageExtension(contentType);
  if(!ext)return'';
  return `events/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

export function eventImagePublicUrl(request,key){
  if(!isManagedEventImageKey(key))return'';
  const origin=new URL(request.url).origin;
  const file=String(key).slice('events/'.length);
  return `${origin}/media/events/${encodeURIComponent(file)}`;
}

export async function deleteManagedEventImage(env,key){
  if(!env?.EVENT_IMAGES||typeof env.EVENT_IMAGES.delete!=='function'||!isManagedEventImageKey(key))return false;
  await env.EVENT_IMAGES.delete(key);
  return true;
}
