import { json, readSession } from '../../../lib/auth.js';
import { evaluateTradeCgCampaigns } from '../../../lib/trade-cg-evaluator.js';

const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestPost({request,env}){
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!MANAGER_ACCESS.has(session.access))return reply({ok:false,error:'officer_access_required'},403);
  const originHeader=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  if(originHeader!==expected||request.headers.get('X-Mongrels-Request')!=='trade-cg-evaluate'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  let body={};
  try{body=await request.json();}catch{}
  const id=String(body?.campaignId||'').trim();
  if(!id)return reply({ok:false,error:'cg_id_required'},400);
  try{
    const result=await evaluateTradeCgCampaigns(env,{
      campaignIds:[id],
      maxCampaigns:1,
      force:true,
      origin:expected,
    });
    return reply(result);
  }catch(error){
    return reply({ok:false,error:String(error?.message||error||'cg_evaluation_failed')},502);
  }
}

function headers(){return{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
