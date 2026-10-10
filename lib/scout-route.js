// Private, opt-in Spansh Neutron Plotter integration. Only trusted server code
// talks to Spansh. Browser and LLM inputs never choose an upstream URL.
import { SCOUT_LINK_KEY_PREFIX, readShipSnapshot } from './scout-link.js';

const JOB_PREFIX = SCOUT_LINK_KEY_PREFIX + 'route-job:';
const ACTIVE_PREFIX = SCOUT_LINK_KEY_PREFIX + 'route-active:';
const MAX_WAYPOINTS = 128;
const JOB_TTL = 60 * 60 * 24;
export const routeEnabled = env => String(env?.SCOUT_CHATGPT_ROUTE_ENABLED || '').toLowerCase() === 'true';
export const routeActiveKey = env => ACTIVE_PREFIX + String(env.ADMIN_USER_ID || '');
const jobKey = id => JOB_PREFIX + id;
const safeName = (s, limit=140) => typeof s === 'string' ? s.trim().replace(/[\x00-\x1f\x7f]/g,'').slice(0,limit) : '';
const jobIdOk = s => typeof s === 'string' && /^[0-9a-f-]{24,64}$/i.test(s);
const upstreamJobOk = s => typeof s === 'string' && /^[a-zA-Z0-9_-]{8,120}$/.test(s);

export async function plotNeutronRoute(env, params, transport=fetch) {
  if (!routeEnabled(env)) return {ok:false,error:'route_planner_disabled'};
  const ship = await readShipSnapshot(env);
  if (!ship.available || !ship.fresh) return {ok:false,error:'ship_telemetry_stale',ageSeconds:ship.ageSeconds ?? null};
  const source = ship.system;
  const destination = safeName(params?.destination);
  if (!destination || !/^[\p{L}\p{N} .+()_'-]{2,140}$/u.test(destination)) return {ok:false,error:'destination_required'};
  if (source.toLocaleLowerCase() === destination.toLocaleLowerCase()) return {ok:false,error:'already_at_destination'};
  const efficiency = Number.isInteger(params?.efficiency) && params.efficiency >= 25 && params.efficiency <= 100 ? params.efficiency : 60;
  const boost = ship.fsdType === 'mkii' ? 6 : 4;
  const currentRange = Number(ship.currentJumpRange);
  const fullRange = Number(ship.fullFuelZeroCargoRange);
  // Fixed-range Neutron Plotter should not assume a lighter ship than the
  // pilot actually has. Use a small safety margin, then validate in-game.
  const usable = [currentRange,fullRange].filter(n=>Number.isFinite(n) && n>0);
  if (!usable.length) return {ok:false,error:'jump_range_unknown'};
  const effectiveRange = Math.floor(Math.min(...usable) * 0.97 * 100) / 100;
  if (effectiveRange < 1) return {ok:false,error:'jump_range_too_low'};
  const form = new URLSearchParams({
    from:source,to:destination,range:String(effectiveRange),
    efficiency:String(efficiency),supercharge_multiplier:String(boost),
  });
  let response;
  try {
    response = await transport('https://spansh.co.uk/api/route', {
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'application/json'},
      body:form.toString(),signal:AbortSignal.timeout(15000),
    });
  } catch { return {ok:false,error:'spansh_unreachable'}; }
  if (response.status !== 202) return {ok:false,error:'spansh_rejected_request',upstreamStatus:response.status};
  let upstream;
  try { upstream = (await response.json()).job; } catch { return {ok:false,error:'spansh_invalid_response'}; }
  if (!upstreamJobOk(upstream)) return {ok:false,error:'spansh_invalid_job'};
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  const job = {id,upstream,createdAt,source,destination,ship:ship.ship,range:effectiveRange,
    superchargeMultiplier:boost,efficiency,status:'pending'};
  await env.DAILY_ORDERS.put(jobKey(id),JSON.stringify(job),{expirationTtl:JOB_TTL});
  return publicJob(job);
}

export function normalizeSpanshWaypoints(result, source, destination) {
  const items = result?.jumps || result?.system_jumps;
  if (!Array.isArray(items) || !items.length || items.length > MAX_WAYPOINTS) return null;
  const stops = items.map(x => {
    const name = safeName(x?.system || x?.name);
    return {
      system:name,
      neutron:Boolean(x?.neutron_star || x?.has_neutron),
      scoopable:Boolean(x?.is_scoopable),
      distance:Number.isFinite(Number(x?.distance)) ? Number(x.distance) : null,
    };
  });
  if (stops.some(x => !x.system)) return null;
  // Spansh normally includes the destination; never silently invent stops.
  if (stops.at(-1).system.toLocaleLowerCase() !== destination.toLocaleLowerCase()) return null;
  if (stops[0].system.toLocaleLowerCase() !== source.toLocaleLowerCase()) {
    stops.unshift({system:source,neutron:false,scoopable:false,distance:0});
  }
  return stops;
}
export async function getRouteJob(env,id,transport=fetch) {
  if (!routeEnabled(env)) return {ok:false,error:'route_planner_disabled'};
  if (!jobIdOk(id)) return {ok:false,error:'invalid_route_id'};
  const job=await env.DAILY_ORDERS.get(jobKey(id),{type:'json'});
  if (!job || job.id !== id) return {ok:false,error:'route_not_found'};
  if (job.status === 'ready') return publicJob(job);
  if (job.status !== 'pending') return {ok:false,error:'route_not_pending'};
  let response;
  try {
    response=await transport('https://spansh.co.uk/api/results/'+encodeURIComponent(job.upstream),{
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),
    });
  } catch { return {ok:false,error:'spansh_unreachable'}; }
  if (response.status === 202) return {...publicJob(job),message:'Spansh is still calculating; request this route again.'};
  if (response.status !== 200) return {ok:false,error:'spansh_route_failed',upstreamStatus:response.status};
  let payload;
  try { payload=await response.json(); } catch { return {ok:false,error:'spansh_invalid_response'}; }
  const waypoints=normalizeSpanshWaypoints(payload?.result,job.source,job.destination);
  if (!waypoints) return {ok:false,error:'spansh_result_invalid_or_too_large'};
  const ready={...job,status:'ready',waypoints,finishedAt:new Date().toISOString()};
  await env.DAILY_ORDERS.put(jobKey(id),JSON.stringify(ready),{expirationTtl:JOB_TTL});
  return publicJob(ready);
}
function publicJob(job) {
  const {upstream,...rest}=job;
  return {ok:true,...rest,waypointCount:job.waypoints?.length ?? null};
}
export async function activateRoute(env,id) {
  if (!routeEnabled(env)) return {ok:false,error:'route_planner_disabled'};
  if (!jobIdOk(id)) return {ok:false,error:'invalid_route_id'};
  const job=await env.DAILY_ORDERS.get(jobKey(id),{type:'json'});
  if (!job || job.status !== 'ready' || !Array.isArray(job.waypoints)) return {ok:false,error:'route_not_ready'};
  const snapshot=await readShipSnapshot(env);
  if (!snapshot.available || !snapshot.fresh || snapshot.ship !== job.ship) return {ok:false,error:'ship_changed_or_stale'};
  // The pilot may have jumped since plotting. Only activate when present
  // somewhere on the actual route; never aim from an unknown position.
  if (!job.waypoints.some(w=>w.system.toLocaleLowerCase() === snapshot.system.toLocaleLowerCase())) {
    return {ok:false,error:'current_system_not_on_route'};
  }
  const active={id:job.id,ship:job.ship,source:job.source,destination:job.destination,
    waypoints:job.waypoints,activatedAt:new Date().toISOString(),autoCopy:true};
  await env.DAILY_ORDERS.put(routeActiveKey(env),JSON.stringify(active),{expirationTtl:JOB_TTL});
  return {ok:true,active:true,id:job.id,source:job.source,destination:job.destination,
    waypointCount:job.waypoints.length,autoCopy:true};
}
export async function clearActiveRoute(env) {
  await env.DAILY_ORDERS.delete(routeActiveKey(env));
  return {ok:true,active:false};
}
export async function readActiveRoute(env) {
  if (!routeEnabled(env)) return null;
  return await env.DAILY_ORDERS.get(routeActiveKey(env),{type:'json'});
}
