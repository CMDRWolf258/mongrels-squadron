// Owner-only Route Director control used by the paired local Mongrel HUD.
// The browser never receives the Scout token; Scout proxies on localhost.
// This is deliberately separate from the ChatGPT MCP approval layer.
import { json } from '../../../lib/auth.js';
import { authenticateScoutActivity } from '../../../lib/scout-activity.js';
import { activateRoute, clearActiveRoute, readActiveRoute, readReadyRouteForControl, plotNeutronRoute, plotGalaxyRoute, getRouteJob, completeRoute, readLastCompletedRoute } from '../../../lib/scout-route.js';

const reply=(body,status=200)=>json(body,{status,headers:{
  'Cache-Control':'private, no-store, no-cache, must-revalidate',
  'X-Content-Type-Options':'nosniff',
}});

async function authorize(request,env){
  if(!env?.DAILY_ORDERS?.get || !env?.DAILY_ORDERS?.put || !env?.DAILY_ORDERS?.delete)
    return {response:reply({ok:false,error:'route_storage_not_configured'},503)};
  const auth=await authenticateScoutActivity(request,env);
  if(!auth)return {response:reply({ok:false,error:'invalid_scout_token'},401)};
  if(!auth.ownerId || !env.ADMIN_USER_ID || String(auth.ownerId)!==String(env.ADMIN_USER_ID))
    return {response:reply({ok:false,error:'site_admin_required'},403)};
  return {auth};
}

export async function onRequestGet({request,env}){
  const access=await authorize(request,env);
  if(access.response)return access.response;
  try{
    const routeId=new URL(request.url).searchParams.get('routeId')||'';
    const [ready,activeRoute,lastCompleted]=await Promise.all([
      readReadyRouteForControl(env,routeId),readActiveRoute(env),readLastCompletedRoute(env),
    ]);
    if(!ready.ok)return reply(ready,ready.error==='invalid_route_id'?400:404);
    return reply({ok:true,route:ready.route,lastCompleted,activeRoute:activeRoute ? {
      id:activeRoute.id,ship:activeRoute.ship,source:activeRoute.source,
      destination:activeRoute.destination,activatedAt:activeRoute.activatedAt,
      waypointCount:activeRoute.waypoints?.length||0,
    }:null});
  }catch(error){
    console.error('Could not read Route Director state',error);
    return reply({ok:false,error:'route_control_unavailable'},503);
  }
}

export async function onRequestPost({request,env}){
  const access=await authorize(request,env);
  if(access.response)return access.response;
  if(!/application\/json/i.test(request.headers.get('content-type')||''))
    return reply({ok:false,error:'json_required'},415);
  const size=Number(request.headers.get('content-length')||0);
  if(size>4096)return reply({ok:false,error:'payload_too_large'},413);
  let body;
  try{body=await request.json();}catch{return reply({ok:false,error:'invalid_json'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))
    return reply({ok:false,error:'invalid_json'},400);
  try{
    if(body.action==='plot'){
      const mode=body.mode===undefined?'neutron':body.mode;
      if(mode!=='neutron'&&mode!=='galaxy')return reply({ok:false,error:'invalid_route_mode'},400);
      const result=await (mode==='galaxy'?plotGalaxyRoute:plotNeutronRoute)(env,{
        destination:body.destination,
        efficiency:Number(body.efficiency ?? 60),
      });
      return reply(result,result.ok?200:409);
    }
    if(body.action==='check'){
      const result=await getRouteJob(env,body.routeId);
      return reply(result,result.ok?200:404);
    }
    if(body.action==='complete'){
      const result=await completeRoute(env,{
        routeId:body.routeId,ship:body.ship,system:body.system,
      });
      return reply(result,result.ok?200:409);
    }
    if(body.action==='stop')return reply(await clearActiveRoute(env));
    if(body.action!=='start')return reply({ok:false,error:'invalid_action'},400);
    const result=await activateRoute(env,body.routeId);
    return reply(result,result.ok?200:result.error==='invalid_route_id'?400:409);
  }catch(error){
    console.error('Could not update Route Director state',error);
    return reply({ok:false,error:'route_control_unavailable'},503);
  }
}
