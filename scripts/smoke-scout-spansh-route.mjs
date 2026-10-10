import assert from 'node:assert/strict';
import { normalizeShipSnapshot, SCOUT_LINK_KEY_PREFIX } from '../lib/scout-link.js';
import { plotNeutronRoute, getRouteJob, activateRoute, clearActiveRoute, readActiveRoute, normalizeSpanshWaypoints } from '../lib/scout-route.js';
import { onRequestGet as hudFeed } from '../functions/api/hud/feed.js';
import { onRequestGet as hudManifest } from '../functions/api/hud/manifest.js';
import { sha256Hex } from '../lib/scout-link.js';

class Kv {
  constructor(){this.rows=new Map();}
  async get(key,{type}={}) {const v=this.rows.get(key);return type==='json' && v ? JSON.parse(v) : v??null;}
  async put(k,v) {this.rows.set(k,v);}
  async delete(k){this.rows.delete(k);}
}
const store=new Kv();
const env={ADMIN_USER_ID:'user-999',SCOUT_CHATGPT_LINK_ENABLED:'true',SCOUT_CHATGPT_ROUTE_ENABLED:'true',DAILY_ORDERS:store};
const time=new Date().toISOString();
const base = normalizeShipSnapshot({
  version:1,system:'NGC 2546 Sector UZ-G d10-16',ship:'Leaf On the Wind',shipType:'Caspian Explorer',observedAt:time,
  currentJumpRange:70.5,fuel:110,fuelCapacity:128,cargo:0,unladenMass:1502.22,
  jumpModel:{kind:'mkii',optimalMass:7528.04,maxFuelPerJump:6.8,ratingConstant:11,powerConstant:2.5025,guardianBoost:10.5}
});
await store.put(SCOUT_LINK_KEY_PREFIX+'user-999',JSON.stringify(base));
const posted=[];
const job='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const mockFetch=async (url,init)=>{
  posted.push([String(url),init]);
  if(String(url).endsWith('/api/route'))return new Response(JSON.stringify({job}),{status:202});
  if(String(url).includes('/api/results/'))return new Response(JSON.stringify({result:{jumps:[
    {system:'NGC 2546 Sector UZ-G d10-16',has_neutron:false,is_scoopable:true},
    {system:'TEST NEUTRON 1',has_neutron:true,is_scoopable:false},
    {system:'Diaba',has_neutron:false,is_scoopable:true},
  ]}}),{status:200});
  return new Response('nope',{status:404});
};
const plotted=await plotNeutronRoute(env,{destination:'Diaba'},mockFetch);
assert.equal(plotted.status,'pending');
assert.equal(plotted.superchargeMultiplier,6);
const sent=new URLSearchParams(posted[0][1].body);
assert.equal(sent.get('from'),'NGC 2546 Sector UZ-G d10-16');
assert.equal(sent.get('to'),'Diaba');
assert.equal(sent.get('supercharge_multiplier'),'6');
assert.ok(+sent.get('range') > 55 && +sent.get('range') < 80);
assert.equal(await readActiveRoute(env),null);
const complete=await getRouteJob(env,plotted.id,mockFetch);
assert.equal(complete.status,'ready');
assert.equal(complete.waypoints.length,3);
assert.equal(complete.waypoints[1].neutron,true);
assert.equal(complete.waypoints[1].scoopable,false);
assert.equal(normalizeSpanshWaypoints({jumps:[{system:'Wrong'}]},'Anywhere','Diaba'),null);
assert.equal(await readActiveRoute(env),null); // Preview may not activate.
const active=await activateRoute(env,plotted.id);
assert.equal(active.ok,true);
assert.equal(active.autoCopy,true);
const stored=await readActiveRoute(env);
assert.equal(stored.waypoints[1].system,'TEST NEUTRON 1');
assert.equal(stored.destination,'Diaba');
const cleared=await clearActiveRoute(env);
assert.equal(cleared.active,false);
assert.equal(await readActiveRoute(env),null);
const stale={...base,receivedAt:new Date(Date.now()-3600_000).toISOString(),observedAt:new Date(Date.now()-3600_000).toISOString()};
await store.put(SCOUT_LINK_KEY_PREFIX+'user-999',JSON.stringify(stale));
assert.equal((await plotNeutronRoute(env,{destination:'Diaba'},mockFetch)).error,'ship_telemetry_stale');
assert.equal((await activateRoute(env,plotted.id)).error,'ship_changed_or_stale');
const disabled={...env,SCOUT_CHATGPT_ROUTE_ENABLED:'false'};
assert.equal((await plotNeutronRoute(disabled,{destination:'Diaba'},mockFetch)).error,'route_planner_disabled');
console.log('Scout Spansh route plotting, preview, activation and safe-failure checks passed');
