import { json, readSession } from '../../../lib/auth.js';
import { getTradeCommodityCatalog } from '../../../lib/trade-market.js';

const ALLOWED_ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}) {
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  try{
    const catalog=await getTradeCommodityCatalog(env);
    return reply({ok:true,...catalog});
  }catch(error){
    return reply({ok:false,error:'Commodity catalog is temporarily unavailable.'},502);
  }
}

async function requireMember(request,env) {
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!ALLOWED_ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}
function headers(){return{'Cache-Control':'no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
