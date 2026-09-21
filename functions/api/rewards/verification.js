import { json, readSession } from '../../../lib/auth.js';
import { getEvents, listFrontierAccounts } from '../../../lib/frontier.js';
import { matchVerifiedActivity, readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { buildRewardPreview, readRewardSettings } from '../../../lib/reward-rules.js';

const ALLOWED = new Set(['officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session) return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access)) return reply({ok:false,error:'officer_access_required'},403);

  const current=await readCurrentOrderCycle(env);
  const rewardSettings=await readRewardSettings(env);
  const accounts=await listFrontierAccounts(env);
  const cycleStartedAt=current?.cycleStartedAt || current?.updatedAt || null;
  const cycleStartMs=Date.parse(cycleStartedAt||'');

  const members=await Promise.all(accounts.map(async item=>{
    const events=await getEvents(env,item.userId);
    const matched=matchVerifiedActivity(events,current);
    const previews=buildRewardPreview(matched.orderTotals,rewardSettings.settings);
    const scopedEvents=matched.events.filter(event=>{
      const time=Date.parse(event?.timestamp||'');
      return !Number.isFinite(cycleStartMs) || !Number.isFinite(time) || time>=cycleStartMs;
    });

    const flagged=scopedEvents.filter(event=>
      (Array.isArray(event.orderMatchAmbiguous)&&event.orderMatchAmbiguous.length)
      || (Array.isArray(event.orderMatchUnmatched)&&event.orderMatchUnmatched.length)
    );

    const ambiguousComponents=flagged.reduce((n,event)=>n+(event.orderMatchAmbiguous?.length||0),0);
    const unmatchedComponents=flagged.reduce((n,event)=>n+(event.orderMatchUnmatched?.length||0),0);

    return {
      ownerId:item.userId,
      commander:item.account?.commander||'Elite CMDR',
      account:item.account,
      verifiedOrders:previews,
      matchedOrderCount:previews.length,
      ambiguousComponents,
      unmatchedComponents,
      flaggedEvents:flagged.slice(-25).reverse().map(event=>({
        id:event.id||'',
        timestamp:event.timestamp||null,
        type:event.type||event.sourceEvent||'event',
        sourceEvent:event.sourceEvent||'',
        system:event.system||event.affectedSystem||'',
        station:event.station||'',
        ambiguous:event.orderMatchAmbiguous||[],
        unmatched:event.orderMatchUnmatched||[],
      })),
    };
  }));

  return reply({
    ok:true,
    cycleId:current?.cycleId||null,
    cycleStartedAt,
    summary:{
      connectedMembers:members.length,
      membersWithVerified:members.filter(member=>member.verifiedOrders.length).length,
      verifiedOrderMatches:members.reduce((n,member)=>n+member.verifiedOrders.length,0),
      ambiguousComponents:members.reduce((n,member)=>n+member.ambiguousComponents,0),
      unmatchedComponents:members.reduce((n,member)=>n+member.unmatchedComponents,0),
    },
    members:members.sort((a,b)=>String(a.commander).localeCompare(String(b.commander))),
  });
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
