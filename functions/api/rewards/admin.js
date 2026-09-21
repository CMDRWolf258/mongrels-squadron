import { json, readSession } from '../../../lib/auth.js';
import { listAllRewardEntries } from '../../../lib/reward-ledger.js';

const ALLOWED = new Set(['officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session = await readSession(request,env);
  if (!session) return reply({ok:false,error:'authentication_required'},401);
  if (!ALLOWED.has(session.access)) return reply({ok:false,error:'officer_access_required'},403);

  const entries = await listAllRewardEntries(env);
  const members = new Map();
  let totalOwedCredits=0;
  let totalPaidCredits=0;

  for (const entry of entries) {
    const amount=Number(entry?.amountCredits)||0;
    if (entry?.status==='paid') totalPaidCredits += amount;
    else if (entry?.status==='owed') totalOwedCredits += amount;

    const key=String(entry?.ownerId||'');
    if (!key) continue;
    const member=members.get(key)||{
      ownerId:key,
      displayName:entry?.displayName||'Mongrel CMDR',
      owedCredits:0,
      paidCredits:0,
      owedEntryCount:0,
      paidEntryCount:0,
      entryCount:0,
      latestAt:null,
    };
    if(entry?.status==='paid'){member.paidCredits+=amount;member.paidEntryCount+=1;}
    else if(entry?.status==='owed'){member.owedCredits+=amount;member.owedEntryCount+=1;}
    member.entryCount+=1;
    if(entry?.createdAt&&(!member.latestAt||entry.createdAt>member.latestAt))member.latestAt=entry.createdAt;
    members.set(key,member);
  }

  return reply({
    ok:true,
    summary:{
      totalOwedCredits:round(totalOwedCredits),
      totalPaidCredits:round(totalPaidCredits),
      memberCount:members.size,
      entryCount:entries.length,
    },
    canConfirmPayments:session.access==='site_admin',
    paymentMode:'manual_confirmation',
    members:[...members.values()]
      .map(m=>({...m,owedCredits:round(m.owedCredits),paidCredits:round(m.paidCredits)}))
      .sort((a,b)=>b.owedCredits-a.owedCredits||String(a.displayName).localeCompare(String(b.displayName))),
    owedEntries:entries.filter(entry=>entry?.status==='owed').slice(0,500),
    entries:entries.slice(0,500),
  });
}

function round(value){return Math.round((Number(value)||0)*100)/100}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
