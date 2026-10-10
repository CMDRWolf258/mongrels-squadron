import { linkEnabled, linkStorageReady, readShipSnapshot } from '../../../lib/scout-link.js';
import { authenticateMcp, authRequired, oauthJson, resourceUrl } from '../../../lib/scout-link-oauth.js';
import { plotNeutronRoute, getRouteJob, activateRoute, clearActiveRoute, readActiveRoute } from '../../../lib/scout-route.js';

const TOOL = {
  name:'get_current_ship',
  title:'Get current ship from MongrelScout',
  description:'Return the Site Admin\'s latest opt-in Elite Dangerous ship/system snapshot: current and full-fuel zero-cargo jump range, fuel, cargo, timestamps and freshness. Read-only; never changes the ship, HUD or website. Data may be stale when Scout is offline.',
  inputSchema:{type:'object',properties:{},additionalProperties:false},
  securitySchemes:[{type:'oauth2',scopes:['scout.read']}],
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
};
const ROUTE_TOOLS = [
  { name:'plot_neutron_route',title:'Plot a neutron route using Spansh',
    description:'Submit a new Spansh neutron route from the current fresh Scout system to a destination, with safe live ship range and 6x Mk II overcharge when applicable. Returns a job id. Does not activate or copy waypoints.',
    inputSchema:{type:'object',properties:{destination:{type:'string',description:'Destination system (e.g. Diaba)'},efficiency:{type:'integer',minimum:25,maximum:100,default:60}},required:['destination'],additionalProperties:false},
    securitySchemes:[{type:'oauth2',scopes:['scout.read','scout.route']}],
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true}},
  { name:'get_neutron_route',title:'Read a calculated Spansh route',
    description:'Retrieve the actual ordered waypoints for a route job. Call again when status pending. Returns route id needed for activation.',
    inputSchema:{type:'object',properties:{route_id:{type:'string'}},required:['route_id'],additionalProperties:false},
    securitySchemes:[{type:'oauth2',scopes:['scout.read','scout.route']}],
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true}},
  { name:'activate_neutron_navigation',title:'Activate route and automatic waypoint copying',
    description:'Changes the live Scout route! Call ONLY following the user explicitly asking to begin navigation for a specific ready route. HUD/Scout will copy the next waypoint to the PC clipboard after waypoint progress. Never activate only to preview.',
    inputSchema:{type:'object',properties:{route_id:{type:'string'}},required:['route_id'],additionalProperties:false},
    securitySchemes:[{type:'oauth2',scopes:['scout.read','scout.route']}],
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
  { name:'stop_neutron_navigation',title:'Stop route and automatic copying',
    description:'Disables the currently active route and automatic clipboard copying on the PC. Only when user requests stop/cancel navigation.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    securitySchemes:[{type:'oauth2',scopes:['scout.read','scout.route']}],
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
  { name:'get_active_neutron_navigation',title:'Read active navigation route',
    description:'Read current active navigation route. Read-only.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    securitySchemes:[{type:'oauth2',scopes:['scout.read','scout.route']}],
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
];
const PROTOCOL_VERSION = '2025-06-18';
const ok = (id,result) => ({jsonrpc:'2.0',id,result});
const err = (id,code,message) => ({jsonrpc:'2.0',id,error:{code,message}});
const rpcResponse = (obj) => oauthJson(obj,200,{'MCP-Protocol-Version':PROTOCOL_VERSION});
export async function onRequestPost({request,env}) {
  if (!linkEnabled(env)) return oauthJson({error:'disabled'},404);
  if (!linkStorageReady(env)) return oauthJson({error:'storage_not_configured'},503);
  const principal = await authenticateMcp(request,env);
  if (!principal) return authRequired(request);
  if (Number(request.headers.get('content-length') || 0) > 8192) return oauthJson({error:'request_too_large'},413);
  let input;
  try { input = await request.json(); } catch { return oauthJson({error:'invalid_json'},400); }
  if (!input || input.jsonrpc !== '2.0' || Array.isArray(input) || typeof input.method !== 'string') return rpcResponse(err(null,-32600,'Invalid Request'));
  if (input.id === undefined) return new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});
  if (input.method === 'initialize') return rpcResponse(ok(input.id,{
    protocolVersion:PROTOCOL_VERSION,
    capabilities:{tools:{listChanged:false}},
    serverInfo:{name:'Mongrel Scout Link',version:'0.1.0'},
    instructions:'Admin-owned ship telemetry and Spansh route previews. Always disclose observation age/freshness. Never activate navigation without explicit user approval. Automatic clipboard copies only after confirmed route activation.',
  }));
  if (input.method === 'ping') return rpcResponse(ok(input.id,{}));
  if (input.method === 'tools/list') return rpcResponse(ok(input.id,{tools:[TOOL,...ROUTE_TOOLS]}));
  if (input.method === 'tools/call') {
    const toolName=input.params?.name;
    const routeTool=ROUTE_TOOLS.find(tool=>tool.name===toolName);
    if (toolName !== TOOL.name && !routeTool) return rpcResponse(err(input.id,-32602,'Unknown tool'));
    if (routeTool && !String(principal.scope||'').split(/\s+/).includes('scout.route')) return rpcResponse(err(input.id,-32001,'Route scope required'));
    const args=input.params?.arguments || {};
    if (routeTool) {
      if (typeof args !== 'object' || Array.isArray(args)) return rpcResponse(err(input.id,-32602,'Invalid arguments'));
      let data;
      if (toolName==='plot_neutron_route') data=await plotNeutronRoute(env,args);
      else if (toolName==='get_neutron_route') data=await getRouteJob(env,args.route_id);
      else if (toolName==='activate_neutron_navigation') data=await activateRoute(env,args.route_id);
      else if (toolName==='stop_neutron_navigation') data=await clearActiveRoute(env);
      else data={ok:true,activeRoute:await readActiveRoute(env)};
      return rpcResponse(ok(input.id,{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:!data.ok}));
    }
    if (input.params?.arguments && (typeof input.params.arguments !== 'object' || Array.isArray(input.params.arguments) || Object.keys(input.params.arguments).length)) {
      return rpcResponse(err(input.id,-32602,'No arguments accepted'));
    }
    const ship = await readShipSnapshot(env);
    const result = {ok:true,ship,readOnly:true};
    return rpcResponse(ok(input.id,{
      content:[{type:'text',text:JSON.stringify(result)}],
      structuredContent:result,
      isError:false,
    }));
  }
  return rpcResponse(err(input.id,-32601,'Method not found'));
}
export async function onRequestGet({request,env}) {
  if (!linkEnabled(env)) return oauthJson({error:'disabled'},404);
  if (!await authenticateMcp(request,env)) return authRequired(request);
  return oauthJson({error:'stream_not_supported',message:'Stateless MCP accepts POST requests.'},405,{'Allow':'POST'});
}
