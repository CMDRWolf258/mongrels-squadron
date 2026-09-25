import { json, readSession } from '../../../lib/auth.js';
import { searchTradeMarkets } from '../../../lib/trade-market.js';

const ALLOWED_ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}) {
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;

  const url=new URL(request.url);
  const params=url.searchParams;
  const input={
    commodity:params.get('commodity')||'',
    direction:params.get('direction')||'sell',
    referenceSystem:params.get('referenceSystem')||'',
    radiusLy:params.get('radiusLy'),
    minVolume:params.get('minVolume'),
    price:params.get('price'),
    minPad:params.get('minPad'),
    carrierMode:params.get('carrierMode')||'exclude',
    maxAgeMinutes:params.get('maxAgeMinutes'),
    priority:params.get('priority')||'',
    sort:params.get('sort')||'price',
    limit:params.get('limit'),
  };

  try{
    const result=await searchTradeMarkets(env,input);
    return reply(result);
  }catch(error){
    const code=String(error?.message||error||'trade_market_search_failed');
    const status=
      code==='commodity_required'||code==='reference_system_required'?400:
      code==='market_source_not_found'?404:
      code==='market_source_timeout'?504:
      code.startsWith('market_source_http_')||code==='market_source_invalid_response'?502:
      500;
    return reply({ok:false,error:publicError(code)},status);
  }
}

async function requireMember(request,env) {
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!ALLOWED_ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}

function publicError(code){
  if(code==='commodity_required')return'Enter a commodity.';
  if(code==='reference_system_required')return'Enter a reference system.';
  if(code==='market_source_not_found')return'The market source could not find that system or commodity.';
  if(code==='market_source_timeout')return'The market source took too long to respond. Try again.';
  if(code.startsWith('market_source_http_')||code==='market_source_invalid_response')return'The external market source is temporarily unavailable.';
  return'Trade market search failed.';
}

function headers(){return{'Cache-Control':'no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
