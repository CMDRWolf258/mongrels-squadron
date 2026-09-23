import { json, readSession } from '../../../lib/auth.js';
import { getEvents, listFrontierAccounts, summarizeEvents } from '../../../lib/frontier.js';
import { matchVerifiedActivityHistory, readCurrentOrderCycle } from '../../../lib/order-activity.js';

const MAX_EVENTS=300;

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(session.access!=='site_admin')return reply({ok:false,error:'site_admin_access_required'},403);

  const accounts=await listFrontierAccounts(env);
  const members=(Array.isArray(accounts)?accounts:[]).map(row=>({
    ownerId:String(row?.userId||''),
    commander:String(row?.account?.commander||'Elite CMDR'),
    lastSyncAt:row?.account?.lastSyncAt||null,
    lastJournalEventAt:row?.account?.lastJournalEventAt||null,
    lastSystem:String(row?.account?.lastSystem||''),
    authorizedAt:row?.account?.authorizedAt||null,
  })).filter(row=>row.ownerId).sort((a,b)=>a.commander.localeCompare(b.commander));

  const url=new URL(request.url);
  const ownerId=String(url.searchParams.get('ownerId')||'').trim();
  if(!ownerId)return reply({ok:true,members,selected:null,events:[]});

  const selected=members.find(member=>member.ownerId===ownerId);
  if(!selected)return reply({ok:false,error:'frontier_member_not_found'},404);

  const [events,current]=await Promise.all([
    getEvents(env,ownerId),
    readCurrentOrderCycle(env,{historyDepth:7}),
  ]);
  const matched=matchVerifiedActivityHistory(events,current,{depth:7});
  const rows=(Array.isArray(matched?.events)?matched.events:[])
    .slice()
    .sort((a,b)=>String(b?.timestamp||'').localeCompare(String(a?.timestamp||'')))
    .slice(0,MAX_EVENTS)
    .map(eventView);

  return reply({
    ok:true,
    members,
    selected:{
      ...selected,
      storedEventCount:Array.isArray(events)?events.length:0,
      summary:summarizeEvents(events),
    },
    events:rows,
    eventLimit:MAX_EVENTS,
    currentCycleId:current?.cycleId||null,
  });
}

function eventView(event){
  const base={
    id:String(event?.id||''),
    timestamp:event?.timestamp||null,
    type:String(event?.type||event?.sourceEvent||'event'),
    sourceEvent:String(event?.sourceEvent||''),
    system:String(event?.system||event?.affectedSystem||''),
    station:String(event?.station||''),
    stationFaction:String(event?.stationFaction||''),
    stationType:String(event?.stationType||''),
    orderMatchStatus:String(event?.orderMatchStatus||'unmatched'),
    orderMatches:(Array.isArray(event?.orderMatches)?event.orderMatches:[]).slice(0,8).map(match=>({
      orderId:String(match?.orderId||''),
      task:String(match?.orderTask||'Daily Order'),
      type:String(match?.type||''),
      contribution:Number(match?.contribution)||0,
      unit:String(match?.unit||''),
      faction:String(match?.faction||''),
      system:String(match?.system||''),
      sourceCycleId:String(match?.sourceCycleId||''),
    })),
    ambiguousCount:Array.isArray(event?.orderMatchAmbiguous)?event.orderMatchAmbiguous.length:0,
    unmatchedCount:Array.isArray(event?.orderMatchUnmatched)?event.orderMatchUnmatched.length:0,
  };

  if(event?.type==='market_sell')Object.assign(base,{
    commodity:String(event?.commodity||''),
    count:Number(event?.count)||0,
    sellPrice:Number(event?.sellPrice)||0,
    total:Number(event?.total)||0,
    avgPricePaid:event?.avgPricePaid===null?null:Number(event?.avgPricePaid),
    costBasis:event?.costBasis===null?null:Number(event?.costBasis),
    profit:event?.profit===null?null:Number(event?.profit),
    profitKnown:event?.profitKnown===true,
    tradeSource:String(event?.tradeSource||'unknown'),
    tradeSourceVerified:event?.tradeSourceVerified===true,
    bgsTradeEligible:event?.bgsTradeEligible===true,
    tradeEligibilityReason:String(event?.tradeEligibilityReason||''),
  });

  if(event?.type==='mission_inf')Object.assign(base,{
    missionId:String(event?.missionId||''),
    missionName:String(event?.missionName||event?.name||''),
    sourceFaction:String(event?.sourceFaction||''),
    effects:(Array.isArray(event?.effects)?event.effects:[]).slice(0,16).map(effect=>({
      faction:String(effect?.faction||''),
      system:String(effect?.system||''),
      infUnits:Number(effect?.infUnits)||0,
    })),
  });

  if(['bounties_redeemed','combat_bonds_redeemed','cz_bond_awarded','exploration_sale'].includes(event?.type)){
    base.amount=Number(event?.amount)||0;
  }
  if(event?.type==='bounties_redeemed'){
    base.factions=(Array.isArray(event?.factions)?event.factions:[]).slice(0,16).map(row=>({
      faction:String(row?.faction||''),
      amount:Number(row?.amount)||0,
    }));
  }
  if(event?.type==='colonization_contribution'){
    base.totalTons=Number(event?.totalTons)||0;
    base.contributions=(Array.isArray(event?.contributions)?event.contributions:[]).slice(0,32).map(row=>({
      commodity:String(row?.commodity||row?.commodityCode||''),
      amount:Number(row?.amount)||0,
    }));
  }
  return base;
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
