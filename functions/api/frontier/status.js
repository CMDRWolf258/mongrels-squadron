import { frontierConfigured, getAccount, getEvents, privateHeaders, publicAccount, requireMember, summarizeEvents, TEST_SYSTEM } from '../../../lib/frontier.js';
import { json } from '../../../lib/auth.js';

export async function onRequestGet({request,env}) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const configured = frontierConfigured(env);
  const account = configured ? await getAccount(env, auth.session.sub) : null;
  const events = account ? await getEvents(env, auth.session.sub) : [];
  return json({
    ok:true,
    configured,
    connected:Boolean(account),
    account:publicAccount(account),
    targetSystem:TEST_SYSTEM,
    summary:summarizeEvents(events),
    recentEvents:events.slice(-20).reverse(),
    requirements:configured ? [] : ['FRONTIER_CLIENT_ID'],
  }, {headers:privateHeaders()});
}
