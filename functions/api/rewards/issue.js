import { json, readSession } from '../../../lib/auth.js';
import { buildUnifiedRewardEngineState, flattenRewardObligations } from '../../../lib/reward-engine-runtime.js';
import { appendRewardEntryWithResult } from '../../../lib/reward-ledger.js';
import { loadRewardDiscordView, syncRewardDiscordBoard } from '../../../lib/reward-discord.js';

export async function onRequestPost({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(session.access!=='site_admin')return reply({ok:false,error:'site_admin_required'},403);

  const originError=validateSameOrigin(request);
  if(originError)return originError;

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const obligationId=clean(body?.obligationId).slice(0,120);
  if(!obligationId)return reply({ok:false,error:'obligation_id_required'},400);

  const {dryRun}=await buildUnifiedRewardEngineState(env,{baselineActor:'Reward issue validation'});
  const obligations=flattenRewardObligations(dryRun);
  const obligation=obligations.find(item=>clean(item?.id)===obligationId);

  if(!obligation){
    return reply({
      ok:false,
      error:'reward_obligation_stale_or_missing',
      message:'The READY obligation changed or is no longer present. Refresh the Reward Engine before issuing it.',
    },409);
  }

  if(obligation.duplicateSuppressed&&!obligation.readyForLive){
    return reply({
      ok:true,
      created:false,
      duplicateSuppressed:true,
      obligationId,
      message:'This obligation is already represented in the reward ledger.',
    });
  }

  if(!obligation.readyForLive||!obligation.plannedEntry||obligation.blockers?.length){
    return reply({
      ok:false,
      error:'reward_obligation_not_ready',
      obligationId,
      blockers:Array.isArray(obligation.blockers)?obligation.blockers:[],
      message:'Only current READY obligations can create an owed ledger entry.',
    },409);
  }

  const expectedAmount=Math.round(Number(body?.expectedAmountCredits)||0);
  const actualAmount=Math.round(Number(obligation.deltaCredits)||0);
  const expectedEvidence=clean(body?.expectedEvidenceDigest);
  const expectedRules=clean(body?.expectedRewardRuleDigest);
  const stale=
    expectedAmount!==actualAmount
    || !expectedEvidence
    || expectedEvidence!==clean(obligation.evidenceDigest)
    || !expectedRules
    || expectedRules!==clean(obligation.rewardRuleDigest);

  if(stale){
    return reply({
      ok:false,
      error:'reward_obligation_changed',
      obligationId,
      current:{
        amountCredits:actualAmount,
        evidenceDigest:clean(obligation.evidenceDigest),
        rewardRuleDigest:clean(obligation.rewardRuleDigest),
      },
      message:'The verified evidence, reward rules, or amount changed since the screen was loaded. Refresh before issuing.',
    },409);
  }

  if(actualAmount<=0)return reply({ok:false,error:'reward_amount_not_positive'},409);

  const actor=clean(session.displayName||session.username)||'Site Admin';
  const approvedAt=new Date().toISOString();
  const entry={
    ...obligation.plannedEntry,
    id:obligation.id,
    amountCredits:actualAmount,
    status:'owed',
    createdAt:approvedAt,
    createdBy:actor,
    sourceObligationId:obligation.id,
    approvalMode:'manual_ready_issue',
    approvedAt,
    approvedBy:actor,
  };

  const result=await appendRewardEntryWithResult(env,entry);
  const discord=result.created?await syncRewardsDiscord(request,env):null;
  return reply({
    ok:true,
    created:result.created,
    discord,
    duplicateSuppressed:!result.created,
    obligationId,
    entry:result.entry,
    automaticIssuance:false,
    manualApproval:true,
    message:result.created
      ? 'READY obligation added to the actual reward ledger as OWED.'
      : 'The same deterministic obligation already exists in the reward ledger.',
  });
}

async function syncRewardsDiscord(request,env){
  try{
    const view=await loadRewardDiscordView(env);
    const adminUrl=new URL('/wolf-bgs/',request.url);
    adminUrl.hash='reward-engine';
    return await syncRewardDiscordBoard(env,{
      view,
      adminUrl:adminUrl.toString(),
      rewardsUrl:new URL('/rewards/',request.url).toString(),
      createMissing:false,
    });
  }catch(error){
    console.error('Reward entry was issued but Rewards Discord sync failed',error);
    return {feature:'rewards',configured:true,error:'discord_rewards_sync_failed',failed:1};
  }
}

function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='wolf-reward-issue'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}

function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
