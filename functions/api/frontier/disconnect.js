import { disconnectAccount, privateHeaders, requireMember, sameOrigin } from '../../../lib/frontier.js';
import { json } from '../../../lib/auth.js';

export async function onRequestPost({request,env}) {
  const auth=await requireMember(request,env); if(auth.response)return auth.response;
  if(!sameOrigin(request))return json({ok:false,error:'request_validation_failed'},{status:403,headers:privateHeaders()});
  await disconnectAccount(env,auth.session.sub);
  return json({ok:true},{headers:privateHeaders()});
}
