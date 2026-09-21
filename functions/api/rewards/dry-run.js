import { json, readSession } from '../../../lib/auth.js';
import { buildUnifiedRewardEngineState } from '../../../lib/reward-engine-runtime.js';

const ALLOWED=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'officer_access_required'},403);

  const {dryRun}=await buildUnifiedRewardEngineState(env,{baselineActor:'Reward Engine migration'});
  return reply({ok:true,...dryRun});
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
