import { beginFrontierFlow, frontierConfigured, privateHeaders, requireMember } from '../../../lib/frontier.js';
import { json } from '../../../lib/auth.js';

export async function onRequestGet({request,env}) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  if (!frontierConfigured(env)) return json({ok:false,error:'frontier_not_configured'}, {status:503,headers:privateHeaders()});
  const url = await beginFrontierFlow(request, env, auth.session);
  return Response.redirect(url, 302);
}
