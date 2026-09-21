const CACHE_VERSION=1;

export async function listKeysCached(env,{
  prefix,
  cacheKey,
  maxAgeSeconds=3600,
  maxKeys=5000,
  pageLimit=1000,
}={}) {
  const kv=env?.DAILY_ORDERS;
  if(!kv||typeof kv.list!=='function'||typeof kv.get!=='function')return[];
  const cleanPrefix=String(prefix||'');
  const cleanCacheKey=String(cacheKey||'');
  const cap=Math.max(1,Math.min(10000,Math.floor(Number(maxKeys)||5000)));
  const maxAgeMs=Math.max(60,Math.floor(Number(maxAgeSeconds)||3600))*1000;

  if(cleanCacheKey){
    try{
      const cached=await kv.get(cleanCacheKey,{type:'json'});
      const cachedAt=Date.parse(cached?.cachedAt||'');
      if(
        cached?.version===CACHE_VERSION
        && cached?.prefix===cleanPrefix
        && Array.isArray(cached?.keys)
        && Number.isFinite(cachedAt)
        && Date.now()-cachedAt<=maxAgeMs
      ){
        return cached.keys
          .map(value=>String(value||''))
          .filter(key=>key.startsWith(cleanPrefix))
          .slice(0,cap);
      }
    }catch(error){
      console.error('Could not read KV list cache',cleanCacheKey,error);
    }
  }

  const keys=[];
  let cursor;
  do{
    const page=await kv.list({
      prefix:cleanPrefix,
      cursor,
      limit:Math.max(1,Math.min(1000,Math.floor(Number(pageLimit)||1000))),
    });
    keys.push(...(page?.keys||[]).map(item=>String(item?.name||'')).filter(Boolean));
    cursor=page?.list_complete?undefined:page?.cursor;
  }while(cursor&&keys.length<cap);

  const normalized=[...new Set(keys)].filter(key=>key.startsWith(cleanPrefix)).slice(0,cap);
  if(cleanCacheKey&&typeof kv.put==='function'){
    try{
      await kv.put(cleanCacheKey,JSON.stringify({
        version:CACHE_VERSION,
        prefix:cleanPrefix,
        cachedAt:new Date().toISOString(),
        keys:normalized,
      }));
    }catch(error){
      console.error('Could not write KV list cache',cleanCacheKey,error);
    }
  }
  return normalized;
}

export async function invalidateKeyListCache(env,cacheKey){
  const kv=env?.DAILY_ORDERS;
  const key=String(cacheKey||'');
  if(!key||!kv||typeof kv.delete!=='function')return false;
  try{
    await kv.delete(key);
    return true;
  }catch(error){
    console.error('Could not invalidate KV list cache',key,error);
    return false;
  }
}
