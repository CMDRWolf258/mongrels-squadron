import { json, readSession } from '../../../lib/auth.js';
import {
  normalizeCgSolverSettings,
  normalizeTradeCgCampaign,
  readTradeCgCampaigns,
  writeTradeCgCampaigns,
} from '../../../lib/trade-cg.js';
import {
  evaluateTradeCgCampaigns,
  promoteTradeCgPending,
} from '../../../lib/trade-cg-evaluator.js';
import { syncTradeCgDiscord } from '../../../lib/trade-cg-discord.js';

const MEMBER_ACCESS=new Set(['member','officer','site_admin']);
const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}){
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  const campaigns=await readTradeCgCampaigns(env);
  const now=Date.now();
  return reply({
    ok:true,
    canManage:MANAGER_ACCESS.has(auth.session.access),
    campaigns:campaigns
      .sort((a,b)=>statusRank(a,now)-statusRank(b,now)||Date.parse(b.updatedAt)-Date.parse(a.updatedAt))
      .map(campaign=>present(campaign,auth.session)),
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;
  const body=await readBody(request);
  if(body.response)return body.response;

  const error=validateCampaignInput(body.value);
  if(error)return reply({ok:false,error},400);
  const now=new Date().toISOString();
  const campaign=normalizeTradeCgCampaign({
    id:crypto.randomUUID(),
    title:String(body.value?.title||'Community Goal').trim(),
    status:'active',
    destinationSystem:String(body.value?.destinationSystem||'').trim(),
    destinationStation:String(body.value?.destinationStation||'').trim(),
    commodities:body.value?.commodities,
    startsAt:body.value?.startsAt||now,
    endsAt:body.value?.endsAt||'',
    notes:String(body.value?.notes||'').trim(),
    automation:normalizeCgSolverSettings(body.value?.automation),
    primary:null,
    pendingPrimary:null,
    evaluation:{},
    discord:{},
    createdById:auth.session.sub,
    createdByName:auth.session.displayName,
    createdAt:now,
    updatedAt:now,
    updatedBy:auth.session.displayName,
  });
  const items=await readTradeCgCampaigns(env);
  items.unshift(campaign);
  await writeTradeCgCampaigns(env,items);

  await evaluateTradeCgCampaigns(env,{
    campaignIds:[campaign.id],
    maxCampaigns:1,
    force:true,
    origin:new URL(request.url).origin,
  }).catch(()=>{});

  const refreshed=(await readTradeCgCampaigns(env)).find(item=>item.id===campaign.id)||campaign;
  return reply({ok:true,campaign:present(refreshed,auth.session)},201);
}

export async function onRequestPut({request,env}){
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;
  const body=await readBody(request);
  if(body.response)return body.response;

  const id=String(body.value?.id||'').trim();
  const items=await readTradeCgCampaigns(env);
  const index=items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'cg_not_found'},404);

  const current=items[index];
  const action=String(body.value?.action||'edit').trim();
  const now=new Date().toISOString();

  if(action==='close'){
    current.status='closed';
    current.pendingPrimary=null;
    current.updatedAt=now;
    current.updatedBy=auth.session.displayName;
    items[index]=current;
    await writeTradeCgCampaigns(env,items);
    await syncTradeCgDiscord(env,{campaign:current,origin:new URL(request.url).origin}).catch(()=>{});
    return reply({ok:true,campaign:present(current,auth.session)});
  }

  if(action==='promote_pending'){
    const promoted=promoteTradeCgPending(current,{now:Date.now(),reason:'officer_override'});
    if(!promoted?.primary||promoted.primary.key===current.primary?.key){
      return reply({ok:false,error:'no_healthy_pending_primary'},400);
    }
    promoted.updatedBy=auth.session.displayName;
    items[index]=promoted;
    await writeTradeCgCampaigns(env,items);
    await syncTradeCgDiscord(env,{campaign:promoted,origin:new URL(request.url).origin,transition:'primary_promoted'}).catch(()=>{});
    return reply({ok:true,campaign:present(promoted,auth.session)});
  }

  if(action!=='edit')return reply({ok:false,error:'unsupported_cg_action'},400);
  const error=validateCampaignInput(body.value);
  if(error)return reply({ok:false,error},400);

  const edited=normalizeTradeCgCampaign({
    ...current,
    title:String(body.value?.title||'').trim(),
    status:'active',
    destinationSystem:String(body.value?.destinationSystem||'').trim(),
    destinationStation:String(body.value?.destinationStation||'').trim(),
    commodities:body.value?.commodities,
    startsAt:body.value?.startsAt||current.startsAt,
    endsAt:body.value?.endsAt||'',
    notes:String(body.value?.notes||'').trim(),
    automation:normalizeCgSolverSettings(body.value?.automation),
    primary:null,
    pendingPrimary:null,
    evaluation:{},
    updatedAt:now,
    updatedBy:auth.session.displayName,
  });
  items[index]=edited;
  await writeTradeCgCampaigns(env,items);

  await evaluateTradeCgCampaigns(env,{
    campaignIds:[edited.id],
    maxCampaigns:1,
    force:true,
    origin:new URL(request.url).origin,
  }).catch(()=>{});

  const refreshed=(await readTradeCgCampaigns(env)).find(item=>item.id===edited.id)||edited;
  return reply({ok:true,campaign:present(refreshed,auth.session)});
}

function present(campaign,session){
  return{
    ...campaign,
    canManage:Boolean(session&&MANAGER_ACCESS.has(session.access)),
  };
}

function validateCampaignInput(value){
  if(!String(value?.title||'').trim())return'cg_title_required';
  if(!String(value?.destinationSystem||'').trim())return'cg_destination_system_required';
  if(!String(value?.destinationStation||'').trim())return'cg_destination_station_required';
  const commodities=Array.isArray(value?.commodities)
    ?value.commodities
    :String(value?.commodities||'').split(/[\n,;]+/);
  if(!commodities.some(item=>String(item||'').trim()))return'cg_commodity_required';
  const end=Date.parse(value?.endsAt||'');
  if(value?.endsAt&&!Number.isFinite(end))return'cg_end_time_invalid';
  return'';
}

async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!MEMBER_ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}
async function requireManager(request,env){
  const auth=await requireMember(request,env);
  if(auth.response)return auth;
  if(!MANAGER_ACCESS.has(auth.session.access))return{response:reply({ok:false,error:'officer_access_required'},403)};
  return auth;
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='trade-cg-editor')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
async function readBody(request){
  try{return{value:await request.json()};}
  catch{return{response:reply({ok:false,error:'invalid_json'},400)};}
}
function statusRank(campaign,now){
  if(campaign.status==='active'){
    const end=Date.parse(campaign.endsAt||'');
    if(!Number.isFinite(end)||end>now)return 0;
  }
  return 1;
}
function headers(){return{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
