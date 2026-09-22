import { json, readSession } from '../../../lib/auth.js';
import { listRewardEntries } from '../../../lib/reward-ledger.js';

const ALLOWED=new Set(['member','officer','site_admin']);
const DEFAULT_LIMIT=12;
const MAX_LIMIT=25;

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'member_access_required'},403);

  const url=new URL(request.url);
  const offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
  const limit=Math.min(MAX_LIMIT,Math.max(5,Math.floor(Number(url.searchParams.get('limit'))||DEFAULT_LIMIT)));

  const entries=await listRewardEntries(env,session.sub);
  const groups=groupPaidBatches(entries);
  const page=groups.slice(offset,offset+limit);
  const nextOffset=offset+page.length;
  return reply({
    ok:true,
    offset,
    limit,
    totalBatchCount:groups.length,
    returnedBatchCount:page.length,
    hasMore:nextOffset<groups.length,
    nextOffset:nextOffset<groups.length?nextOffset:null,
    batches:page,
  });
}

function groupPaidBatches(entries){
  const groups=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
    if(entry?.status!=='paid')continue;
    const batchId=clean(entry.paymentBatchId);
    const fallback='legacy:'+clean(entry.id||entry.paidAt||entry.createdAt);
    const key=batchId||fallback;
    const existing=groups.get(key)||{
      batchId,
      legacy:!batchId,
      paidAt:entry.paidAt||entry.paymentConfirmedAt||entry.createdAt||null,
      paidBy:clean(entry.paidBy||entry.paymentConfirmedBy),
      totalCredits:0,
      entryCount:0,
      entries:[],
    };
    const paidAt=entry.paidAt||entry.paymentConfirmedAt||entry.createdAt||null;
    if(paidAt&&(!existing.paidAt||String(paidAt)>String(existing.paidAt)))existing.paidAt=paidAt;
    if(!existing.paidBy)existing.paidBy=clean(entry.paidBy||entry.paymentConfirmedBy);
    const amount=Math.max(0,Math.round(Number(entry.amountCredits)||0));
    existing.totalCredits+=amount;
    existing.entryCount+=1;
    existing.entries.push(publicEntry(entry));
    groups.set(key,existing);
  }

  return [...groups.values()]
    .map(group=>({
      ...group,
      totalCredits:Math.round(group.totalCredits),
      entries:group.entries.sort((a,b)=>String(b.paidAt||b.createdAt||'').localeCompare(String(a.paidAt||a.createdAt||''))),
    }))
    .sort((a,b)=>String(b.paidAt||'').localeCompare(String(a.paidAt||'')));
}

function publicEntry(entry={}){
  return {
    id:clean(entry.id),
    displayName:clean(entry.displayName),
    kind:clean(entry.kind),
    amountCredits:Math.max(0,Math.round(Number(entry.amountCredits)||0)),
    reason:clean(entry.reason).slice(0,500),
    rewardType:clean(entry.rewardType).slice(0,40),
    verifiedContribution:Math.max(0,Math.round(Number(entry.verifiedContribution)||0)),
    verifiedUnit:clean(entry.verifiedUnit).slice(0,40),
    createdAt:entry.createdAt||null,
    paidAt:entry.paidAt||null,
    paidBy:clean(entry.paidBy),
    paymentBatchId:clean(entry.paymentBatchId),
  };
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
