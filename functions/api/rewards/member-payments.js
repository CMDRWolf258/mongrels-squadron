import { json, readSession } from '../../../lib/auth.js';
import {
  confirmMemberRewardPayment,
  listAllRewardEntries,
  markMemberRewardPaymentSent,
} from '../../../lib/reward-ledger.js';

const ALLOWED=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'member_access_required'},403);

  const entries=await listAllRewardEntries(env);
  const payerEntries=entries
    .filter(entry=>entry?.fundingMode==='member'&&String(entry?.payerOwnerId||'')===String(session.sub))
    .map(publicEntry);
  const owed=payerEntries.filter(entry=>entry.status==='owed');
  const sent=payerEntries.filter(entry=>entry.status==='payment_sent');

  return reply({
    ok:true,
    viewer:{userId:session.sub,displayName:session.displayName||session.username||'Mongrel Member',access:session.access},
    summary:{
      owedCredits:sum(owed),
      paymentSentCredits:sum(sent),
      unsettledCredits:sum([...owed,...sent]),
      owedEntryCount:owed.length,
      paymentSentEntryCount:sent.length,
    },
    entries:payerEntries.filter(entry=>entry.status!=='paid').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),
    recentPaid:payerEntries.filter(entry=>entry.status==='paid').slice(0,20),
  });
}

export async function onRequestPost({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'member_access_required'},403);
  if(!sameOrigin(request))return reply({ok:false,error:'request_validation_failed'},403);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const action=clean(body?.action);
  const actor=session.displayName||session.username||'Mongrel Member';
  try{
    if(action==='mark-sent'){
      const entry=await markMemberRewardPaymentSent(env,{
        payerOwnerId:session.sub,
        ownerId:clean(body?.ownerId),
        entryId:clean(body?.entryId),
        actor,
      });
      return reply({ok:true,entry:publicEntry(entry),message:'Payment marked SENT. The recipient can now confirm receipt.'});
    }
    if(action==='confirm-received'){
      const entry=await confirmMemberRewardPayment(env,{
        ownerId:session.sub,
        entryId:clean(body?.entryId),
        actor,
      });
      return reply({ok:true,entry:publicEntry(entry),message:'Payment confirmed received and marked PAID.'});
    }
    return reply({ok:false,error:'unsupported_action'},400);
  }catch(error){
    const code=String(error?.message||error||'member_payment_failed').split(':')[0];
    const status=code.includes('not_payer')||code.includes('not_recipient')?403:code.includes('not_owed')||code.includes('not_sent')?409:code.includes('missing')?404:400;
    return reply({ok:false,error:code,message:messageFor(code)},status);
  }
}

function publicEntry(entry={}){
  return{
    id:entry.id||'',
    ownerId:entry.ownerId||'',
    displayName:entry.displayName||'Mongrel CMDR',
    amountCredits:Number(entry.amountCredits)||0,
    reason:entry.reason||'Member-funded Colonization reward',
    sourceJobId:entry.sourceJobId||'',
    verifiedContribution:Number(entry.verifiedContribution)||0,
    verifiedUnit:entry.verifiedUnit||'',
    payerDisplayName:entry.payerDisplayName||'Posting CMDR',
    status:entry.status||'owed',
    createdAt:entry.createdAt||null,
    paymentSentAt:entry.paymentSentAt||null,
    paymentSentBy:entry.paymentSentBy||'',
    paidAt:entry.paidAt||null,
  };
}
function sum(entries){return Math.round((Array.isArray(entries)?entries:[]).reduce((total,entry)=>total+(Number(entry.amountCredits)||0),0))}
function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('X-Mongrels-Request')==='member-reward-payment'}
function clean(value){return String(value??'').trim()}
function messageFor(code){
  const map={
    member_payment_not_payer:'Only the member who funded this reward can mark it sent.',
    member_payment_not_recipient:'Only the reward recipient can confirm receipt.',
    member_payment_not_owed:'This reward is no longer in the OWED state.',
    member_payment_not_sent:'The payer has not marked this reward as sent.',
    reward_entry_missing:'That reward entry could not be found.',
  };
  return map[code]||'The member-funded payment could not be updated.';
}
function reply(body,status=200){return json(body,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}})}
