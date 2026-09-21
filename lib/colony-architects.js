export const COLONY_ARCHITECTS_KEY = 'colony-architects-v1';

export async function readColonyArchitects(env) {
  const empty={version:1,pairs:[],history:[],updatedAt:null,updatedBy:null};
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function')return empty;
  const stored=await env.DAILY_ORDERS.get(COLONY_ARCHITECTS_KEY,{type:'json'});
  if(!stored||typeof stored!=='object')return empty;
  return {
    version:1,
    pairs:(Array.isArray(stored.pairs)?stored.pairs:[]).map(normalizePair).filter(pair=>pair.system&&pair.commander),
    history:(Array.isArray(stored.history)?stored.history:[]).map(normalizeHistory).filter(Boolean).slice(-500),
    updatedAt:iso(stored.updatedAt),
    updatedBy:clean(stored.updatedBy,120),
  };
}

export async function writeColonyArchitects(env,store,actor='Wolf') {
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.put!=='function')throw new Error('architect_storage_not_configured');
  const saved={
    version:1,
    pairs:(Array.isArray(store?.pairs)?store.pairs:[]).map(normalizePair).filter(pair=>pair.system&&pair.commander).slice(0,1000),
    history:(Array.isArray(store?.history)?store.history:[]).map(normalizeHistory).filter(Boolean).slice(-500),
    updatedAt:new Date().toISOString(),
    updatedBy:clean(actor,120)||'Wolf',
  };
  await env.DAILY_ORDERS.put(COLONY_ARCHITECTS_KEY,JSON.stringify(saved));
  return saved;
}

export function upsertArchitectPair(store,value={},actor='Wolf') {
  const pairs=Array.isArray(store?.pairs)?[...store.pairs]:[];
  const history=Array.isArray(store?.history)?[...store.history]:[];
  const system=clean(value.system,140);
  const commander=clean(value.commander,100);
  if(!system||!commander)return {error:'architect_pair_required'};

  const key=norm(system);
  const index=pairs.findIndex(pair=>norm(pair.system)===key);
  const previous=index>=0?pairs[index]:null;
  const now=new Date().toISOString();
  const next=normalizePair({
    ...previous,
    ...value,
    system,
    commander,
    pairedAt:previous?.pairedAt||now,
    pairedBy:previous?.pairedBy||actor,
    updatedAt:now,
    updatedBy:actor,
  });
  if(index>=0)pairs[index]=next; else pairs.push(next);
  history.push(normalizeHistory({
    id:crypto.randomUUID(),
    action:previous?'updated':'paired',
    system,
    at:now,
    by:actor,
    previous:previous?pairSnapshot(previous):null,
    next:pairSnapshot(next),
  }));
  return {pairs,history,pair:next};
}

export function unpairArchitect(store,system,actor='Wolf') {
  const pairs=Array.isArray(store?.pairs)?[...store.pairs]:[];
  const history=Array.isArray(store?.history)?[...store.history]:[];
  const key=norm(system);
  const index=pairs.findIndex(pair=>norm(pair.system)===key);
  if(index<0)return {error:'architect_pair_not_found'};
  const previous=pairs[index];
  pairs.splice(index,1);
  const now=new Date().toISOString();
  history.push(normalizeHistory({
    id:crypto.randomUUID(),
    action:'unpaired',
    system:previous.system,
    at:now,
    by:actor,
    previous:pairSnapshot(previous),
    next:null,
  }));
  return {pairs,history,previous};
}

export function pairForSystem(storeOrPairs,system) {
  const pairs=Array.isArray(storeOrPairs)?storeOrPairs:(Array.isArray(storeOrPairs?.pairs)?storeOrPairs.pairs:[]);
  const key=norm(system);
  return pairs.find(pair=>norm(pair.system)===key)||null;
}

function normalizePair(value={}) {
  return {
    system:clean(value.system,140),
    systemAddress:value.systemAddress===null||value.systemAddress===undefined||value.systemAddress===''?null:String(value.systemAddress).slice(0,40),
    commander:clean(value.commander,100),
    ownerId:clean(value.ownerId,160),
    source:['manual','claim_confirmed'].includes(value.source)?value.source:'manual',
    claimEventId:clean(value.claimEventId,100),
    claimTimestamp:iso(value.claimTimestamp),
    note:clean(value.note,500),
    pairedAt:iso(value.pairedAt),
    pairedBy:clean(value.pairedBy,120),
    updatedAt:iso(value.updatedAt),
    updatedBy:clean(value.updatedBy,120),
  };
}

function pairSnapshot(pair) {
  const value=normalizePair(pair);
  return {
    system:value.system,
    systemAddress:value.systemAddress,
    commander:value.commander,
    ownerId:value.ownerId,
    source:value.source,
    claimEventId:value.claimEventId,
    claimTimestamp:value.claimTimestamp,
    note:value.note,
  };
}

function normalizeHistory(value) {
  if(!value||typeof value!=='object')return null;
  const action=['paired','updated','unpaired'].includes(value.action)?value.action:'updated';
  return {
    id:clean(value.id,100),
    action,
    system:clean(value.system,140),
    at:iso(value.at),
    by:clean(value.by,120),
    previous:value.previous&&typeof value.previous==='object'?pairSnapshot(value.previous):null,
    next:value.next&&typeof value.next==='object'?pairSnapshot(value.next):null,
  };
}
function clean(value,max){return typeof value==='string'?value.trim().slice(0,max):String(value??'').trim().slice(0,max)}
function norm(value){return clean(value,200).toLowerCase().replace(/\s+/g,' ')}
function iso(value){if(!value)return null;const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null}
