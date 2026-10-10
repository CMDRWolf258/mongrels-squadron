import assert from 'node:assert/strict';
import { normalizeShipSnapshot, SCOUT_LINK_KEY_PREFIX } from '../lib/scout-link.js';
import { plotNeutronRoute, getRouteJob, activateRoute, clearActiveRoute, readActiveRoute, normalizeSpanshWaypoints, completeRoute, readLastCompletedRoute } from '../lib/scout-route.js';
import { onRequestGet as hudFeed } from '../functions/api/hud/feed.js';
import { onRequestGet as hudManifest } from '../functions/api/hud/manifest.js';
import { onRequestGet as routeControlGet, onRequestPost as routeControlPost } from '../functions/api/hud/route.js';
import { readReadyRouteForControl } from '../lib/scout-route.js';
import { readFileSync } from 'node:fs';
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
    {system:'NGC 2546 Sector UZ-G d10-16',has_neutron:false,is_scoopable:true,jumps:0,distance_remaining:2800},
    {system:'TEST NEUTRON 1',has_neutron:true,is_scoopable:false,jumps:7,distance_to_arrival:280,distance_remaining:2520},
    {system:'Diaba',has_neutron:false,is_scoopable:true,jumps:4,distance_to_arrival:180,distance_remaining:0},
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
assert.equal(complete.routeType,'neutron_replot_waypoints');
assert.equal(complete.waypointCount,3); // Includes source and destination, NOT 3 actual jumps.
assert.equal(complete.navigationTargetCount,2); // The systems Scout may copy.
assert.equal(complete.estimatedTotalJumps,11); // 7 + 4 upstream per-leg estimates.
assert.equal(complete.waypoints[1].estimatedJumpsFromPrevious,7);
assert.equal(complete.waypoints[1].distanceToArrival,280);
assert.equal(complete.waypoints[2].distanceRemaining,0);
assert.equal(normalizeSpanshWaypoints({jumps:[
  {system:'Start',jumps:0},{system:'Bridge',neutron_star:'Yes',jumps:3},
  {system:'Finish',jumps:2},
]},'Start','Finish')[1].neutron,true);
const missingCounts=normalizeSpanshWaypoints({jumps:[
  {system:'Start'}, {system:'Neutron Replot',neutron_star:true},{system:'Finish',jumps:2},
]},'Start','Finish');
assert.equal(missingCounts[1].estimatedJumpsFromPrevious,null);
assert.equal(missingCounts[1].distance,null);
assert.equal(missingCounts[0].estimatedJumpsFromPrevious,null);
assert.equal(missingCounts.at(-1).estimatedJumpsFromPrevious,2);
const bridging=normalizeSpanshWaypoints({jumps:[{system:'Bridge',jumps:6},{system:'Finish',jumps:3}]},'Start','Finish');
assert.equal(bridging[0].system,'Start'); // Source is a waypoint, not a jump.
assert.equal(bridging.length,3);
assert.equal(bridging[1].estimatedJumpsFromPrevious,6);
assert.equal(complete.waypoints[1].neutron,true);
assert.equal(complete.waypoints[1].scoopable,false);
assert.equal(normalizeSpanshWaypoints({jumps:[{system:'Wrong'}]},'Anywhere','Diaba'),null);
assert.equal(await readActiveRoute(env),null); // Preview may not activate.
assert.equal((await readReadyRouteForControl(env)).route.id,plotted.id);
assert.equal((await readReadyRouteForControl(env,plotted.id)).route.waypoints[1].system,'TEST NEUTRON 1');
// Exercise the exact authenticated API used by the paired iPad HUD.
const adminToken='mscout_owner_route_smoke_test';
const hash=await sha256Hex(adminToken);
await store.put('wolf-bgs-scout-tokens-v1',JSON.stringify({
  tokens:{admin:{id:'admin',hash,ownerId:'user-999',ownerCommander:'Wolf258'}},
}));
const req=(method,body,token=adminToken,query='')=>new Request('https://site.example/api/hud/route'+query,{
  method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
});
const noAccess=await routeControlPost({request:req('POST',{action:'start',routeId:plotted.id},'wrong-token'),env});
assert.equal(noAccess.status,401,'Bad token must not enable navigation');
assert.equal(await readActiveRoute(env),null);
const routeRead=await (await routeControlGet({request:req('GET'),env})).json();
assert.equal(routeRead.route.id,plotted.id,'Latest route available with one on-demand read');
assert.equal(routeRead.activeRoute,null,'Preview remains inactive');
const explicitRead=await (await routeControlGet({request:req('GET',null,adminToken,'?routeId='+plotted.id),env})).json();
assert.equal(explicitRead.route.id,plotted.id);
// The new iPad plot/check flow must remain owner-only and preview-only.
// An invalid destination is rejected before reaching external Spansh.
const rejectedPlot=await routeControlPost({request:req('POST',{action:'plot',destination:'?',efficiency:60}),env});
assert.equal(rejectedPlot.status,409);
assert.equal((await rejectedPlot.json()).error,'destination_required');
assert.equal(await readActiveRoute(env),null,'A failed plot must not activate navigation');
const checkedRoute=await (await routeControlPost({request:req('POST',{action:'check',routeId:plotted.id}),env})).json();
assert.equal(checkedRoute.status,'ready');
assert.equal(checkedRoute.waypoints.length,3,'Route check returns complete flight plan');
assert.equal(await readActiveRoute(env),null,'Retrieving plotted route never activates navigation');
const rejectedCheck=await routeControlPost({request:req('POST',{action:'check',routeId:'not-an-id'}),env});
assert.equal(rejectedCheck.status,404);
assert.equal(await readActiveRoute(env),null);
const badRoute=await routeControlPost({request:req('POST',{action:'start',routeId:'bad'}),env});
assert.equal(badRoute.status,400);
const start=await (await routeControlPost({request:req('POST',{action:'start',routeId:plotted.id}),env})).json();
assert.equal(start.ok,true,'Deliberate admin button activates route');
assert.equal((await readActiveRoute(env)).id,plotted.id);
const activeRead=await (await routeControlGet({request:req('GET'),env})).json();
assert.equal(activeRead.activeRoute.id,plotted.id);
const stop=await (await routeControlPost({request:req('POST',{action:'stop'}),env})).json();
assert.equal(stop.active,false);
assert.equal(await readActiveRoute(env),null);
const secondOwnerHash=await sha256Hex('mscout_other_commander');
await store.put('wolf-bgs-scout-tokens-v1',JSON.stringify({tokens:{
  admin:{id:'admin',hash,ownerId:'user-999'},
  other:{id:'other',hash:secondOwnerHash,ownerId:'different-user'},
}}));
const nonAdmin=await routeControlPost({request:req('POST',{action:'start',routeId:plotted.id},'mscout_other_commander'),env});
assert.equal(nonAdmin.status,403,'Other commander cannot activate Admin route');
assert.equal(await readActiveRoute(env),null);
// Existing local HUD pairing, bridge and clipboard checks are unchanged.
const hudPython=readFileSync('downloads/mongrel-hud/mongrel_hud.py','utf8');
const scoutPython=readFileSync('downloads/mongrel-scout/load.py','utf8');
const controller=readFileSync('downloads/mongrel-hud/controller.html','utf8');
for(const str of ['SCOUT_ROUTE_CONTROL_URL','def route_control(','path == "/api/route"'])assert.ok(hudPython.includes(str));
for(const str of ['HUD_ROUTE_CONTROL_PATH','def _hud_route_control(','X-Mongrel-HUD-Route-Action'])assert.ok(scoutPython.includes(str));
for(const str of ['id="routeStart"','id="routeStop"','id="routeLoad"','routeControlBusy'])assert.ok(controller.includes(str));

const active=await activateRoute(env,plotted.id);
assert.equal(active.ok,true);
assert.equal(active.autoCopy,true);
const stored=await readActiveRoute(env);
assert.equal(stored.waypoints[1].system,'TEST NEUTRON 1');
assert.equal(stored.destination,'Diaba');
assert.equal(stored.estimatedTotalJumps,11);
assert.equal(stored.routeType,'neutron_replot_waypoints');
// Completion requires the admin token, exact route ID, registered ship and
// actual destination; it archives just a small receipt, then clears Active.
const badComplete=await routeControlPost({request:req('POST',{action:'complete',routeId:plotted.id,ship:'Leaf On the Wind',system:'Not Diaba'}),env});
assert.equal(badComplete.status,409);
assert.equal((await readActiveRoute(env)).id,plotted.id,'Wrong destination must never clear active navigation');
const completedByScout=await (await routeControlPost({request:req('POST',{
  action:'complete',routeId:plotted.id,ship:'Leaf On the Wind',system:'Diaba',
}),env})).json();
assert.equal(completedByScout.ok,true);
assert.equal(completedByScout.completed,true);
assert.equal(await readActiveRoute(env),null);
assert.equal((await readLastCompletedRoute(env)).destination,'Diaba');
const afterCompletion=await (await routeControlGet({request:req('GET'),env})).json();
assert.equal(afterCompletion.lastCompleted.id,plotted.id,'Completion receipt is available on demand');
await activateRoute(env,plotted.id);
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
