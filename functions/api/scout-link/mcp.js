import { linkEnabled, linkStorageReady, readShipSnapshot } from '../../../lib/scout-link.js';
import { authenticateMcp, authRequired, oauthJson, resourceUrl } from '../../../lib/scout-link-oauth.js';

const TOOL = {
  name:'get_current_ship',
  title:'Get current ship from MongrelScout',
  description:'Return the Site Admin\'s latest opt-in Elite Dangerous ship/system snapshot: current and full-fuel zero-cargo jump range, fuel, cargo, timestamps and freshness. Read-only; never changes the ship, HUD or website. Data may be stale when Scout is offline.',
  inputSchema:{type:'object',properties:{},additionalProperties:false},
  securitySchemes:[{type:'oauth2',scopes:['scout.read']}],
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
};
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
    instructions:'Admin-only read-only ship telemetry. Always disclose observedAt, receivedAt, ageSeconds and fresh; never treat stale telemetry as current.',
  }));
  if (input.method === 'ping') return rpcResponse(ok(input.id,{}));
  if (input.method === 'tools/list') return rpcResponse(ok(input.id,{tools:[TOOL]}));
  if (input.method === 'tools/call') {
    if (input.params?.name !== TOOL.name) return rpcResponse(err(input.id,-32602,'Unknown tool'));
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
