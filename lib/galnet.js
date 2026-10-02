export const GALNET_SOURCE_URL='https://cms.zaonce.net/en-GB/jsonapi/node/galnet_article?&sort=-published_at&page[offset]=0&page[limit]=12';
export const GALNET_SOURCE_NAME='Frontier GalNet';
export const GALNET_FALLBACK_URL='https://api.eddata.dev/v2/news/galnet';
export const GALNET_FALLBACK_NAME='EDData GalNet';

export function normalizeGalnetFeed(value,{limit=10}={}){
  const rows=extractRows(value);
  return rows
    .map(normalizeArticle)
    .filter(Boolean)
    .sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0))
    .slice(0,Math.max(1,Math.min(Number(limit)||10,20)));
}

export function summarizeGalnetText(value,max=320){
  const text=cleanText(value,12000);
  const cap=Math.max(80,Math.min(Number(max)||320,600));
  if(text.length<=cap)return text;
  const sliced=text.slice(0,cap+1);
  const boundary=sliced.lastIndexOf(' ');
  return (boundary>cap*0.7?sliced.slice(0,boundary):sliced.slice(0,cap)).trimEnd()+'…';
}

function extractRows(value){
  if(Array.isArray(value))return value;
  if(Array.isArray(value?.articles))return value.articles;
  if(Array.isArray(value?.data))return value.data.map(normalizeFrontierJsonApiRecord).filter(Boolean);
  return[];
}

function normalizeFrontierJsonApiRecord(value){
  const attributes=value?.attributes;
  if(!attributes||typeof attributes!=='object')return null;
  const slug=cleanSlug(attributes.field_slug);
  const guid=cleanText(attributes.field_galnet_guid,180);
  const imageName=cleanImageName(attributes.field_galnet_image);
  return{
    published:attributes.published_at,
    date:attributes.field_galnet_date,
    title:attributes.title,
    text:attributes.body?.value||attributes.body?.processed||'',
    slug,
    image:imageName?`https://hosting.zaonce.net/elite-dangerous/galnet/${imageName}.png`:'',
    url:guid
      ?`https://community.elitedangerous.com/galnet/uid/${encodeURIComponent(guid)}`
      :slug?`https://www.elitedangerous.com/news/galnet/${encodeURIComponent(slug)}`:'',
  };
}

function normalizeArticle(value){
  if(!value||typeof value!=='object')return null;
  const title=cleanText(value.title,240);
  if(!title)return null;
  const published=toIso(value.published||value.publishedAt||value.pubDate);
  const galnetDate=cleanText(value.date||value.galnetDate,64);
  const text=cleanText(value.text||value.description||value.body,12000);
  const slug=cleanSlug(value.slug);
  const url=httpsUrl(value.url||value.link);
  const image=httpsUrl(value.image||value.imageUrl);
  return{
    id:slug||stableId(title,published),
    title,
    published,
    galnetDate,
    teaser:summarizeGalnetText(text,320),
    url,
    imageUrl:image,
  };
}

function cleanText(value,max=1000){
  return decodeEntities(String(value??'')
    .replace(/<br\s*\/?\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .trim())
    .slice(0,max);
}

function decodeEntities(value){
  return value
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&nbsp;/gi,' ');
}

function toIso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}

function httpsUrl(value){
  try{
    const url=new URL(String(value||''));
    return url.protocol==='https:'?url.href:'';
  }catch{return'';}
}

function cleanSlug(value){
  return String(value??'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,160);
}

function cleanImageName(value){
  return String(value??'').trim().replace(/[^a-zA-Z0-9_-]+/g,'').slice(0,180);
}

function stableId(title,published){
  let hash=2166136261;
  for(const char of title+'|'+published){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return 'galnet-'+(hash>>>0).toString(16);
}
