const STORAGE_KEY='gallery-submissions-v1';
export const GALLERY_DAILY_LIMIT=10;
export const GALLERY_IMAGE_MAX_BYTES=8*1024*1024;
export const GALLERY_TAGS=[
  'AX','Carriers','Colonization','Combat','Community','Exobiology',
  'Exploration','Mining','Operations','Scenic','Ships'
];
const TAG_SET=new Set(GALLERY_TAGS);

export async function readGallerySubmissions(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return[];
  try{
    const stored=await env.PROJECTS.get(STORAGE_KEY,{type:'json',cacheTtl:30});
    return Array.isArray(stored)?stored.map(normalizeStored).filter(Boolean):[];
  }catch(error){
    console.error('Could not read Gallery submissions',error);
    return[];
  }
}

export async function writeGallerySubmissions(env,items){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')throw new Error('gallery_storage_not_configured');
  const list=(Array.isArray(items)?items:[]).slice(0,2000).map(normalizeStored).filter(Boolean);
  await env.PROJECTS.put(STORAGE_KEY,JSON.stringify(list));
}

export function galleryQuota(items,userId,now=new Date()){
  const day=now.toISOString().slice(0,10);
  const used=(Array.isArray(items)?items:[]).filter(item=>String(item?.ownerId||'')===String(userId||'')&&String(item?.submittedAt||'').slice(0,10)===day).length;
  const reset=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)).toISOString();
  return {limit:GALLERY_DAILY_LIMIT,used,remaining:Math.max(0,GALLERY_DAILY_LIMIT-used),day,resetAt:reset};
}

export function normalizeGalleryTags(value){
  const source=Array.isArray(value)?value:String(value||'').split(',');
  const out=[];
  for(const raw of source){
    const tag=String(raw||'').trim();
    const canonical=GALLERY_TAGS.find(x=>x.toLowerCase()===tag.toLowerCase());
    if(canonical&&TAG_SET.has(canonical)&&!out.includes(canonical))out.push(canonical);
    if(out.length>=3)break;
  }
  return out;
}

export function cleanGalleryText(value,max=200){
  return typeof value==='string'?value.trim().slice(0,max):'';
}

export function galleryImagesConfigured(env){
  return Boolean(env?.EVENT_IMAGES&&typeof env.EVENT_IMAGES.put==='function'&&typeof env.EVENT_IMAGES.get==='function');
}

export function galleryImageExtension(contentType){
  return ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'})[String(contentType||'').toLowerCase()]||'';
}

export function createGalleryImageKey(contentType){
  const ext=galleryImageExtension(contentType);
  return ext?`gallery/${Date.now()}-${crypto.randomUUID()}.${ext}`:'';
}

export function isGalleryImageKey(value){
  return /^gallery\/[0-9]{10,16}-[0-9a-f-]{20,60}\.(?:png|jpg|webp)$/i.test(String(value||''));
}

export function galleryImageUrl(request,key){
  if(!isGalleryImageKey(key))return'';
  const origin=new URL(request.url).origin;
  return `${origin}/media/gallery/${encodeURIComponent(String(key).slice('gallery/'.length))}`;
}

export async function deleteGalleryImage(env,key){
  if(!env?.EVENT_IMAGES||typeof env.EVENT_IMAGES.delete!=='function'||!isGalleryImageKey(key))return false;
  await env.EVENT_IMAGES.delete(key);
  return true;
}

export function publicGallerySubmission(item,request){
  if(!item||item.status!=='approved'||!isGalleryImageKey(item.imageKey))return null;
  return {
    id:item.id,
    title:item.title,
    caption:item.caption,
    tags:item.tags,
    url:galleryImageUrl(request,item.imageKey),
    contributorName:item.ownerName||'Mongrel Commander',
    approvedAt:item.reviewedAt||item.submittedAt,
  };
}

export function memberGallerySubmission(item,request){
  if(!item)return null;
  return {
    id:item.id,
    title:item.title,
    caption:item.caption,
    tags:item.tags,
    status:item.status,
    url:item.status!=='rejected'&&isGalleryImageKey(item.imageKey)?galleryImageUrl(request,item.imageKey):'',
    submittedAt:item.submittedAt,
    reviewedAt:item.reviewedAt||'',
    reviewedBy:item.reviewedBy||'',
    reviewNote:item.reviewNote||'',
  };
}

export function managerGallerySubmission(item,request){
  if(!item)return null;
  return {
    ...memberGallerySubmission(item,request),
    ownerName:item.ownerName||'Mongrel Commander',
  };
}

function normalizeStored(raw){
  if(!raw||typeof raw!=='object')return null;
  const id=cleanGalleryText(raw.id,100);
  const ownerId=cleanGalleryText(raw.ownerId,100);
  if(!id||!ownerId)return null;
  const status=['pending','approved','rejected'].includes(raw.status)?raw.status:'pending';
  return {
    id,
    ownerId,
    ownerName:cleanGalleryText(raw.ownerName,100)||'Mongrel Commander',
    title:cleanGalleryText(raw.title,120)||'Mongrel Moment',
    caption:cleanGalleryText(raw.caption,600),
    tags:normalizeGalleryTags(raw.tags),
    imageKey:isGalleryImageKey(raw.imageKey)?raw.imageKey:'',
    status,
    submittedAt:validIso(raw.submittedAt)||new Date().toISOString(),
    reviewedAt:validIso(raw.reviewedAt),
    reviewedBy:cleanGalleryText(raw.reviewedBy,100),
    reviewNote:cleanGalleryText(raw.reviewNote,300),
  };
}

function validIso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
