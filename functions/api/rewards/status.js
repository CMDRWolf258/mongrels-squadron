import { json, readSession } from '../../../lib/auth.js';
import { listRewardEntries, summarizeRewardLedger } from '../../../lib/reward-ledger.js';
import { readRewardPayoutRequest, rewardPayoutRequestView } from '../../../lib/reward-payout-requests.js';

const ALLOWED = new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session = await readSession(request,env);
  if (!session) return reply({ok:false,error:'authentication_required'},401);
  if (!ALLOWED.has(session.access)) return reply({ok:false,error:'member_access_required'},403);
  const [entries,requestRecord] = await Promise.all([
    listRewardEntries(env,session.sub),
    readRewardPayoutRequest(env,session.sub),
  ]);
  const summary=summarizeRewardLedger(entries);
  return reply({
    ok:true,
    viewer:{
      userId:session.sub,
      displayName:session.displayName||session.username||'Mongrel Member',
      access:session.access,
    },
    summary,
    payoutRequest:rewardPayoutRequestView(requestRecord,entries),
    entries:entries.slice(0,250),
  });
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
