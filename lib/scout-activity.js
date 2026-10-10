const TOKENS_KEY='wolf-bgs-scout-tokens-v1';
const RATE_KEY_PREFIX='wolf-bgs-scout-rate-v1:';
export const SCOUT_ACTIVITY_RATE_LIMIT_PER_HOUR=120;
export const MAX_SCOUT_ACTIVITY_BATCH=24;

export async function authenticateScoutActivity(request,env){
  const header=String(request.headers.get('Authorization')||'');
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)return null;
  const token=match[1].trim();
  if(!token.startsWith('mscout_')||token.length>180)return null;
  const hash=await sha256Hex(token);
  const stored=await env.DAILY_ORDERS.get(TOKENS_KEY,{type:'json'}).catch(()=>null);
  for(const value of Object.values(stored?.tokens&&typeof stored.tokens==='object'?stored.tokens:{})){
    if(value?.hash&&constantTimeEqual(String(value.hash),hash)){
      return{
        id:cleanText(value.id,'',80),
        label:cleanText(value.label,'Mongrel Scout',80),
        ownerId:cleanText(value.ownerId,'',120),
        ownerCommander:cleanText(value.ownerCommander,'',80),
        scope:normalizeScope(value.scope,'trusted'),
        allowedSystems:normalizeAllowedSystems(value.allowedSystems),
      };
    }
  }
  return null;
}

export async function consumeScoutActivityRateLimit(env,tokenId,{now=Date.now()}={}){
  const current=Number(now);
  const windowStart=Math.floor(current/3600000)*3600000;
  const retryAfterSeconds=Math.max(1,Math.ceil((windowStart+3600000-current)/1000));
  const key=`${RATE_KEY_PREFIX}${tokenId}:${windowStart}`;
  let count=0;
  try{
    const stored=await env.DAILY_ORDERS.get(key,{type:'json'});
    count=Math.max(0,Math.round(Number(stored?.count)||0));
  }catch(error){
    console.error('Could not read Mongrel Scout activity rate counter',error);
  }
  if(count>=SCOUT_ACTIVITY_RATE_LIMIT_PER_HOUR)return{allowed:false,count,retryAfterSeconds};
  try{
    await env.DAILY_ORDERS.put(
      key,
      JSON.stringify({count:count+1,windowStart:new Date(windowStart).toISOString()}),
      {expirationTtl:7200},
    );
  }catch(error){
    console.error('Could not write Mongrel Scout activity rate counter',error);
  }
  return{allowed:true,count:count+1,retryAfterSeconds};
}

export function normalizeScoutActivityBatch(value,auth,{now=Date.now()}={}){
  if(!value||typeof value!=='object'||value.kind!=='activity_batch')return null;
  const rows=Array.isArray(value.events)?value.events.slice(0,MAX_SCOUT_ACTIVITY_BATCH):[];
  if(!rows.length)return{events:[],excluded:[],rejected:0,lastActivityAt:null};
  const events=[],excluded=[];
  let rejected=0,lastActivityAt=null;
  for(const row of rows){
    const normalized=normalizeScoutActivityRow(row,auth,{now});
    if(!normalized){rejected+=1;continue;}
    if(normalized.excluded)excluded.push(normalized.excluded);
    if(normalized.event)events.push(normalized.event);
    const stamp=normalized.event?.timestamp||normalized.excluded?.timestamp||null;
    if(stamp&&(!lastActivityAt||stamp>lastActivityAt))lastActivityAt=stamp;
  }
  return{events,excluded,rejected,lastActivityAt};
}

export function normalizeScoutActivityRow(row,auth,{now=Date.now()}={}){
  if(!row||typeof row!=='object')return null;
  const sourceEvent=cleanText(row.event,'',60);
  const timestamp=normalizeTime(row.timestamp);
  if(!timestamp)return null;
  const eventMs=Date.parse(timestamp);
  if(!Number.isFinite(eventMs)||eventMs>Number(now)+15*60*1000)return null;

  const system=cleanText(row.system,'',140);
  const systemAddress=safeInteger(row.systemAddress);
  const station=cleanText(row.station,'',140);
  const stationType=cleanText(row.stationType,'',80);
  const stationFaction=cleanText(
    typeof row.stationFaction==='object' ? row.stationFaction?.Name : row.stationFaction,
    '',
    120,
  );
  const base={timestamp,sourceEvent,system,systemAddress,station};

  if(sourceEvent==='MissionCompleted'){
    const missionId=safeInteger(row.missionId ?? row.MissionID);
    if(missionId===null)return null;
    const origin=normalizeMissionOrigin(row.missionOrigin);
    const sourceFaction=cleanText(origin?.sourceFaction || row.faction || row.Faction,'',120);
    const addressToSystem=new Map();
    if(system&&systemAddress!==null)addressToSystem.set(String(systemAddress),system);
    if(origin?.originSystem&&origin.originSystemAddress!==null){
      addressToSystem.set(String(origin.originSystemAddress),origin.originSystem);
    }
    for(const known of Array.isArray(row.knownSystems)?row.knownSystems.slice(0,8):[]){
      const knownName=cleanText(known?.system || known?.name,'',140);
      const knownAddress=safeInteger(known?.systemAddress ?? known?.address);
      if(knownName&&knownAddress!==null)addressToSystem.set(String(knownAddress),knownName);
    }

    const effects=[];
    for(const effect of Array.isArray(row.factionEffects)?row.factionEffects.slice(0,16):[]){
      const faction=cleanText(effect?.Faction || effect?.faction,'',120);
      const reputation=cleanText(effect?.Reputation || effect?.reputation,'',16);
      for(const inf of Array.isArray(effect?.Influence || effect?.influence)?(effect.Influence || effect.influence).slice(0,16):[]){
        let address=safeInteger(inf?.SystemAddress ?? inf?.systemAddress);
        let resolved=address!==null ? (addressToSystem.get(String(address))||'') : '';
        if(!resolved&&origin&&norm(faction)===norm(sourceFaction)){
          resolved=origin.originSystem;
          address=origin.originSystemAddress;
        }else if(!resolved&&system){
          resolved=system;
          address=address ?? systemAddress;
        }
        if(!resolved||!systemAuthorized(auth,resolved))continue;
        const influence=cleanText(inf?.Influence || inf?.influence,'',16);
        const isOriginEffect=Boolean(
          origin
          && norm(faction)===norm(sourceFaction)
          && norm(resolved)===norm(origin.originSystem)
        );
        effects.push({
          faction,
          system:resolved,
          systemAddress:address,
          influence,
          infUnits:(influence.match(/\+/g)||[]).length,
          reputation,
          repUnits:(reputation.match(/\+/g)||[]).length-(reputation.match(/-/g)||[]).length,
          role:isOriginEffect?'source':'secondary',
        });
      }
    }
    if(!effects.some(effect=>effect.infUnits>0))return null;
    const affectedSystems=[...new Set(effects.map(effect=>effect.system).filter(Boolean))];
    return{event:{
      ...base,
      type:'mission_inf',
      missionId,
      originSystem:origin?.originSystem||'',
      originSystemAddress:origin?.originSystemAddress??null,
      originStation:origin?.originStation||'',
      sourceFaction,
      destinationSystem:cleanText(row.destinationSystem || row.DestinationSystem || origin?.destinationSystem,'',140),
      affectedSystem:affectedSystems.length===1?affectedSystems[0]:'',
      affectedSystems,
      effects,
      provisional:true,
      ingestSource:'scout-realtime',
    }};
  }

  if(sourceEvent==='RedeemVoucher'){
    if(!system||!systemAuthorized(auth,system))return null;
    const voucherType=cleanText(row.voucherType || row.Type,'',40).toLowerCase();
    if(!['bounty','combatbond'].includes(voucherType))return null;
    const amount=nonNegativeNumber(row.amount ?? row.Amount);
    if(!(amount>0))return null;
    const factions=(Array.isArray(row.factions)?row.factions:[])
      .slice(0,20)
      .map(item=>({
        faction:cleanText(item?.Faction || item?.faction,'',120),
        amount:nonNegativeNumber(item?.Amount ?? item?.amount),
      }))
      .filter(item=>item.faction||item.amount);
    const normalized={
      ...base,
      type:voucherType==='combatbond'?'combat_bonds_redeemed':'bounties_redeemed',
      amount,
      faction:cleanText(row.faction || row.Faction,'',120),
      factions,
      stationFaction,
      stationType,
      provisional:true,
      ingestSource:'scout-realtime',
    };
    if(isFleetCarrier(stationType,stationFaction))return{excluded:normalized};
    return{event:normalized};
  }

  if(sourceEvent==='MarketSell'){
    if(!system||!station||!stationFaction||!systemAuthorized(auth,system))return null;
    // Recompute profit and eligibility on the server; no client-provided
    // profit or eligibility flag is authoritative.
    if(norm(stationType)==='fleetcarrier')return null;
    if(row.tradeSource!=='station_market'||row.tradeSourceVerified!==true)return null;
    if(row.blackMarket!==false||row.stolenGoods!==false)return null;
    const commodity=cleanText(row.commodity,'',100);
    const count=safeInteger(row.count);
    // Match Frontier journal's 1-based same-second transaction occurrence.
    // Older Scout clients omit this and are treated as the first sale.
    const saleOccurrence=row.saleOccurrence===undefined ? 1 : safeInteger(row.saleOccurrence);
    const total=Number(row.total),avgPricePaid=Number(row.avgPricePaid),sellPrice=Number(row.sellPrice);
    if(!commodity||saleOccurrence===null||saleOccurrence<1||saleOccurrence>128
      ||count===null||count<=0||count>25000
      ||[row.total,row.avgPricePaid,row.sellPrice].some(value=>value===undefined||value===null||value==='')
      ||![total,avgPricePaid,sellPrice].every(Number.isFinite)
      ||total<=0||avgPricePaid<=0||sellPrice<=0)return null;
    const profit=total-(avgPricePaid*count);
    if(!Number.isFinite(profit)||profit<=0)return null;
    return{event:{
      ...base,
      type:'market_sell',
      saleOccurrence,
      commodity,count,sellPrice,total,avgPricePaid,
      costBasis:avgPricePaid*count,
      profit,profitKnown:true,
      tradeSource:'station_market',
      tradeSourceVerified:true,
      bgsTradeEligible:true,
      tradeEligibilityReason:'eligible',
      stationFaction,stationType,
      provisional:true,
      ingestSource:'scout-realtime',
    }};
  }

  if(sourceEvent==='ColonisationConstructionDepot'){
    if(!system||!systemAuthorized(auth,system))return null;
    const marketId=digits(row.marketId ?? row.MarketID,24);
    if(!marketId)return null;
    const resources=(Array.isArray(row.resourcesRequired)?row.resourcesRequired:[])
      .slice(0,96)
      .map(item=>({
        commodityCode:commodityCode(item?.Name ?? item?.commodityCode),
        commodity:cleanText(item?.Name_Localised || item?.commodity,'',120),
        requiredAmount:nonNegativeInteger(item?.RequiredAmount ?? item?.requiredAmount),
        providedAmount:nonNegativeInteger(item?.ProvidedAmount ?? item?.providedAmount),
        payment:nonNegativeInteger(item?.Payment ?? item?.payment),
      }));
    return{event:{
      ...base,
      type:'colonization_depot',
      marketId,
      constructionProgress:nonNegativeNumber(row.constructionProgress ?? row.ConstructionProgress),
      constructionComplete:Boolean(row.constructionComplete ?? row.ConstructionComplete),
      constructionFailed:Boolean(row.constructionFailed ?? row.ConstructionFailed),
      resources,
      provisional:true,
      ingestSource:'scout-realtime',
    }};
  }

  if(sourceEvent==='ColonisationContribution'){
    if(!system||!systemAuthorized(auth,system))return null;
    const marketId=digits(row.marketId ?? row.MarketID,24);
    if(!marketId)return null;
    const contributions=(Array.isArray(row.contributions)?row.contributions:[])
      .slice(0,64)
      .map(item=>({
        commodityCode:commodityCode(item?.Name ?? item?.commodityCode),
        commodity:cleanText(item?.Name_Localised || item?.commodity,'',120),
        amount:nonNegativeInteger(item?.Amount ?? item?.amount),
      }))
      .filter(item=>item.amount>0);
    const totalTons=contributions.reduce((sum,item)=>sum+item.amount,0);
    if(totalTons<=0)return null;
    return{event:{
      ...base,
      type:'colonization_contribution',
      marketId,
      totalTons,
      contributions,
      provisional:true,
      ingestSource:'scout-realtime',
    }};
  }

  return null;
}

export function systemAuthorized(token,system){
  if(normalizeScope(token?.scope,'trusted')==='trusted')return true;
  const key=norm(system);
  return normalizeAllowedSystems(token?.allowedSystems).some(name=>norm(name)===key);
}

function normalizeMissionOrigin(value){
  if(!value||typeof value!=='object')return null;
  const originSystem=cleanText(value.originSystem,'',140);
  if(!originSystem)return null;
  return{
    missionId:String(value.missionId??''),
    acceptedAt:normalizeTime(value.acceptedAt),
    originSystem,
    originSystemAddress:safeInteger(value.originSystemAddress),
    originStation:cleanText(value.originStation,'',140),
    sourceFaction:cleanText(value.sourceFaction,'',120),
    destinationSystem:cleanText(value.destinationSystem,'',140),
    destinationStation:cleanText(value.destinationStation,'',140),
  };
}
function commodityCode(value){return cleanText(value,'',120).replace(/^\$/,'').replace(/_name;$/i,'');}
function isFleetCarrier(stationType,stationFaction){return norm(stationType)==='fleetcarrier'||norm(stationFaction)==='fleetcarrier';}
function digits(value,maxLength){return String(value??'').replace(/\D+/g,'').slice(0,maxLength);}
function safeInteger(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isSafeInteger(n)?n:null;
}
function nonNegativeInteger(value){const n=Math.floor(Number(value)||0);return Math.max(0,n);}
function nonNegativeNumber(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0;}
function normalizeTime(value){
  if(!value)return null;
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():null;
}
function normalizeScope(value,fallback='restricted'){
  const scope=String(value||'').trim().toLowerCase();
  return scope==='trusted'||scope==='restricted'?scope:fallback;
}
function normalizeAllowedSystems(value){
  if(!Array.isArray(value))return[];
  const out=[],seen=new Set();
  for(const raw of value){
    const name=cleanText(raw,'',140),key=norm(name);
    if(!name||seen.has(key))continue;
    seen.add(key);out.push(name);
    if(out.length>=80)break;
  }
  return out;
}
function cleanText(value,fallback,maxLength){
  if(typeof value!=='string')return fallback;
  const text=value.trim();
  return text?text.slice(0,maxLength):fallback;
}
function norm(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
async function sha256Hex(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value||'')));
  return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function constantTimeEqual(a,b){
  const left=String(a||''),right=String(b||'');
  if(left.length!==right.length)return false;
  let diff=0;
  for(let i=0;i<left.length;i+=1)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}
