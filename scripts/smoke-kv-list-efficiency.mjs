import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invalidateKeyListCache, listKeysCached } from '../lib/kv-list-cache.js';

function fakeKv(seed={}) {
  const map=new Map(Object.entries(seed));
  const metrics={gets:0,puts:0,deletes:0,lists:0};
  return {
    metrics,
    map,
    async get(key,options={}) {
      metrics.gets+=1;
      if(!map.has(key))return null;
      const value=map.get(key);
      return options?.type==='json' ? JSON.parse(value) : value;
    },
    async put(key,value) {
      metrics.puts+=1;
      map.set(key,String(value));
    },
    async delete(key) {
      metrics.deletes+=1;
      map.delete(key);
    },
    async list({prefix=''}) {
      metrics.lists+=1;
      const keys=[...map.keys()].filter(key=>key.startsWith(prefix)).sort().map(name=>({name}));
      return {keys,list_complete:true};
    },
  };
}

const kv=fakeKv({
  'order-history:a':'{}',
  'order-history:b':'{}',
});
const env={DAILY_ORDERS:kv};
const options={
  prefix:'order-history:',
  cacheKey:'kv-list-cache:test-order-history',
  maxAgeSeconds:3600,
  maxKeys:100,
};

const first=await listKeysCached(env,options);
assert.deepEqual(first,['order-history:a','order-history:b']);
assert.equal(kv.metrics.lists,1,'first lookup should enumerate KV once');

const second=await listKeysCached(env,options);
assert.deepEqual(second,first);
assert.equal(kv.metrics.lists,1,'warm cache must not consume another KV list operation');

kv.map.set('order-history:c','{}');
const stillCached=await listKeysCached(env,options);
assert.deepEqual(stillCached,first,'membership stays cached until a mutation invalidates the key list');
assert.equal(kv.metrics.lists,1);

await invalidateKeyListCache(env,options.cacheKey);
const rebuilt=await listKeysCached(env,options);
assert.deepEqual(rebuilt,['order-history:a','order-history:b','order-history:c']);
assert.equal(kv.metrics.lists,2,'invalidated cache should rebuild exactly once');
assert.equal(kv.metrics.deletes,1);

const directListFiles=[
  'lib/order-history.js',
  'lib/colonization-job-history.js',
  'lib/frontier.js',
  'lib/reward-ledger.js',
  'functions/api/operations/order-reports.js',
];
for(const path of directListFiles){
  const source=fs.readFileSync(path,'utf8');
  assert(!source.includes('DAILY_ORDERS.list('),path+' should route key enumeration through the shared cache');
}

const reportApi=fs.readFileSync('functions/api/operations/order-reports.js','utf8');
assert(reportApi.includes("legacyCyclePrefix(cycle)"),'legacy reports should enumerate once per cycle');
assert(!reportApi.includes('orders.map(order => listRecords'),'legacy reports must not issue one KV list per active order');
assert(reportApi.includes("reportListCacheKey('submissions',cycle)"));
assert(reportApi.includes("reportListCacheKey('legacy',cycle)"));

const reportUi=fs.readFileSync('js/wolf-bgs-reports.js','utf8');
assert(reportUi.includes('Open to load'),'report manager should advertise lazy loading');
assert(reportUi.includes("details?.addEventListener('toggle'"),'report manager should load when opened');
assert(!/function start\(\)\s*\{\s*ensurePanel\(\);\s*load\(\);/s.test(reportUi),'report manager must not enumerate reports on every control-page load');

const page=fs.readFileSync('wolf-bgs/index.html','utf8');
assert(page.includes('wolf-bgs-reports.js?v=2'));

console.log('KV list efficiency smoke checks passed.');
