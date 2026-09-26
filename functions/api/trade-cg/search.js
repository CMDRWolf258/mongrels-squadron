import { json, readSession } from '../../../lib/auth.js';
import { readTradeCgCampaigns, solveTradeCgCampaign } from '../../../lib/trade-cg.js';

const MEMBER_ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestPost({request,env}){
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const id=String(body?.campaignId||'').trim();
  const campaign=(await readTradeCgCampaigns(env)).find(item=>item.id===id);
  if(!campaign)return reply({ok:false,error:'cg_not_found'},404);
  if(campaign.status!=='active')return reply({ok:false,error:'cg_not_active'},400);

  try{
    const result=await solveTradeCgCampaign(env,campaign,body?.settings||{},{
      now:Date.now(),
      includePrimaryKey:campaign.primary?.key||'',
    });
    return reply({...result,campaign:{id:campaign.id,title:campaign.title,destinationSystem:campaign.destinationSystem,destinationStation:campaign.destinationStation}});
  }catch(error){
    const code=String(error?.message||error||'cg_search_failed').split(':')[0];
    const status=code==='cg_destination_market_not_found'?404:code==='loop_source_timeout'?504:502;
    return reply({ok:false,error:code,message:friendly(code)},status);
  }
}

async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!MEMBER_ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='trade-cg-search')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
function friendly(code){
  if(code==='cg_destination_market_not_found')return'The CG destination station was not present in the current market snapshot.';
  if(code==='loop_source_timeout')return'The CG market snapshot timed out. Try a smaller radius.';
  return'The live market source could not complete the CG route search.';
}
function headers(){return{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
