import { json, readSession } from '../../../lib/auth.js';
import { listRewardEntries } from '../../../lib/reward-ledger.js';
import { buildRewardPaidHistoryPage } from '../../../lib/reward-history.js';

const ALLOWED=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'member_access_required'},403);

  const url=new URL(request.url);
  const offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
  const limit=Math.min(25,Math.max(5,Math.floor(Number(url.searchParams.get('limit'))||12)));
  const entries=await listRewardEntries(env,session.sub);
  return reply({ok:true,...buildRewardPaidHistoryPage(entries,{offset,limit})});
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
