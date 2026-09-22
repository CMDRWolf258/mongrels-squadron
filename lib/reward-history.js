export function buildRewardPaidHistoryPage(entries,{offset=0,limit=12}={}) {
  const safeOffset=Math.max(0,Math.floor(Number(offset)||0));
  const safeLimit=Math.min(25,Math.max(5,Math.floor(Number(limit)||12)));
  const groups=groupPaidBatches(entries);
  const page=groups.slice(safeOffset,safeOffset+safeLimit);
  const nextOffset=safeOffset+page.length;
  return {
    offset:safeOffset,
    limit:safeLimit,
    totalBatchCount:groups.length,
    returnedBatchCount:page.length,
    hasMore:nextOffset<groups.length,
    nextOffset:nextOffset<groups.length?nextOffset:null,
    batches:page,
  };
}

export function groupPaidBatches(entries){
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
