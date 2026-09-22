import { json, readSession } from '../../../lib/auth.js';
import { listRewardEntries } from '../../../lib/reward-ledger.js';
import {
  cancelRewardPayoutRequest,
  readRewardPayoutRequest,
  requestRewardPayout,
  rewardPayoutRequestView,
} from '../../../lib/reward-payout-requests.js';

const ALLOWED=new Set(['member','officer','site_admin']);

export async function onRequestPost({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'member_access_required'},403);

  const originError=validateSameOrigin(request);
  if(originError)return originError;

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const action=clean(body?.action).toLowerCase();
  const actor=clean(session.displayName||session.username)||'Mongrel Member';
  const entries=(await listRewardEntries(env,session.sub)).filter(entry=>entry?.fundingMode!=='member');

  if(action==='request'){
    const owed=entries.filter(entry=>entry?.status==='owed'&&(Number(entry?.amountCredits)||0)>0);
    const expected=Math.round(Number(body?.expectedAvailableCredits)||0);
    const current=Math.round(owed.reduce((sum,entry)=>sum+(Number(entry.amountCredits)||0),0));
    if(!owed.length)return reply({ok:false,error:'nothing_owed',message:'There is no available reward balance to request.'},409);
    if(expected!==current){
      return reply({
        ok:false,
        error:'reward_balance_changed',
        expectedAvailableCredits:expected,
        currentAvailableCredits:current,
        message:'Your reward balance changed. Refresh the account before requesting payout.',
      },409);
    }
    const record=await requestRewardPayout(env,{
      ownerId:session.sub,
      displayName:actor,
      entries,
      actor,
    });
    return reply({
      ok:true,
      payoutRequest:rewardPayoutRequestView(record,entries),
      message:'Payout requested. Leadership can now see that you are ready to collect.',
    });
  }

  if(action==='cancel'){
    const current=await readRewardPayoutRequest(env,session.sub);
    if(!current||current.state!=='requested'){
      return reply({
        ok:true,
        payoutRequest:rewardPayoutRequestView(current,entries),
        message:'There is no active payout request to cancel.',
      });
    }
    const record=await cancelRewardPayoutRequest(env,{ownerId:session.sub,actor});
    return reply({
      ok:true,
      payoutRequest:rewardPayoutRequestView(record,entries),
      message:'Payout request cancelled. Your reward balance is still owed.',
    });
  }

  return reply({ok:false,error:'unsupported_action'},400);
}

function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='mongrels-reward-request'){
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
