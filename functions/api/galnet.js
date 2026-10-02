import { json } from '../../lib/auth.js';
import {
  GALNET_FALLBACK_NAME,
  GALNET_FALLBACK_URL,
  GALNET_SOURCE_NAME,
  GALNET_SOURCE_URL,
  normalizeGalnetFeed,
} from '../../lib/galnet.js';

const CACHE_KEY='galnet-wire-v2';
const FRESH_MS=15*60*1000;
const FETCH_TIMEOUT_MS=8000;
const PROVIDERS=[
  {name:GALNET_SOURCE_NAME,url:GALNET_SOURCE_URL},
  {name:GALNET_FALLBACK_NAME,url:GALNET_FALLBACK_URL},
];

export async function onRequestGet({env}){
  const cached=await readCache(env);
  if(isFresh(cached))return respond(cached,{cache:'fresh'});

  try{
    const upstream=await fetchLatestGalnet();
    const next={
      version:1,
      fetchedAt:new Date().toISOString(),
      source:{name:upstream.provider.name,url:upstream.provider.url},
      items:upstream.items,
    };
    await writeCache(env,next);
    return respond(next,{cache:'refreshed'});
  }catch(error){
    console.error('Could not refresh GalNet Wire',error);
    if(cached?.items?.length){
      return respond(cached,{cache:'stale',stale:true,warning:'Live GalNet refresh unavailable; showing the last successful feed.'});
    }
    return json({
      ok:false,
      error:'galnet_unavailable',
      message:'GalNet Wire is temporarily unavailable.',
    },{status:502,headers:responseHeaders(60)});
  }
}

async function fetchLatestGalnet(){
  const errors=[];
  for(const provider of PROVIDERS){
    try{
      const document=await fetchProvider(provider.url);
      const items=normalizeGalnetFeed(document,{limit:10});
      if(!items.length)throw new Error('returned no usable articles');
      return{provider,items};
    }catch(error){
      errors.push(`${provider.name}: ${error?.message||error}`);
    }
  }
  throw new Error(errors.join(' | ')||'No GalNet providers available');
}

async function fetchProvider(url){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const response=await fetch(url,{
      headers:{
        Accept:'application/vnd.api+json, application/json',
        'User-Agent':'MongrelsSquadron-Newsroom/1.0',
      },
      signal:controller.signal,
    });
    if(!response.ok)throw new Error('HTTP '+response.status);
    return await response.json();
  }finally{
    clearTimeout(timeout);
  }
}

async function readCache(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return null;
  try{
    const value=await env.PROJECTS.get(CACHE_KEY,{type:'json'});
    return value&&Array.isArray(value.items)?value:null;
  }catch(error){
    console.error('Could not read GalNet cache',error);
    return null;
  }
}

async function writeCache(env,value){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return;
  try{
    await env.PROJECTS.put(CACHE_KEY,JSON.stringify(value));
  }catch(error){
    console.error('Could not write GalNet cache',error);
  }
}

function isFresh(value){
  const at=Date.parse(value?.fetchedAt||'');
  return Number.isFinite(at)&&Date.now()-at<FRESH_MS&&Array.isArray(value?.items)&&value.items.length>0;
}

function respond(value,{cache='fresh',stale=false,warning=''}={}){
  return json({
    ok:true,
    feed:'galnet',
    source:value.source||{name:GALNET_SOURCE_NAME,url:GALNET_SOURCE_URL},
    fetchedAt:value.fetchedAt||'',
    stale:Boolean(stale),
    warning:warning||'',
    items:Array.isArray(value.items)?value.items:[],
  },{headers:{...responseHeaders(stale?60:300),'X-Galnet-Cache':cache}});
}

function responseHeaders(maxAge){
  return{
    'Cache-Control':`public, max-age=${maxAge}, s-maxage=${maxAge}`,
    'X-Content-Type-Options':'nosniff',
  };
}
