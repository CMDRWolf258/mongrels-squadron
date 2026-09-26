import { json } from '../../../lib/auth.js';
import { getTradeCommodityCatalog } from '../../../lib/trade-market.js';

export async function onRequestGet({request,env}) {
  try{
    const catalog=await getTradeCommodityCatalog(env);
    return reply({ok:true,...catalog});
  }catch(error){
    return reply({ok:false,error:'Commodity catalog is temporarily unavailable.'},502);
  }
}

function headers(){return{'Cache-Control':'no-store, no-cache, must-revalidate',Pragma:'no-cache','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
