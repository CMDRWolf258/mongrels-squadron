import { json, readSession } from './auth.js';
import { invalidateKeyListCache, listKeysCached } from './kv-list-cache.js';

const AUTH_URL = 'https://auth.frontierstore.net/auth';
const TOKEN_URL = 'https://auth.frontierstore.net/token';
const CAPI_HOST = 'https://companion.orerve.net';
const FLOW_PREFIX = 'frontier-oauth-flow:';
const ACCOUNT_PREFIX = 'frontier-account:';
const ACCOUNT_LIST_CACHE_KEY = 'kv-list-cache:frontier-accounts-v1';
const EVENTS_PREFIX = 'frontier-bgs-events:';
const FLOW_TTL_SECONDS = 60 * 10;
const ACCESS_SAFETY_SECONDS = 60;
const REAUTH_DAYS = 25;
export const FRONTIER_SYNC_COOLDOWN_SECONDS = 300;
export const TEST_SYSTEM = 'NGC 2546 Sector UZ-G d10-16';

const DIAGNOSTIC_NOISE_EVENTS = new Set([
  'FSSSignalDiscovered','FSSDiscoveryScan','Scan','NavBeaconScan','CodexEntry','SAAScanComplete','SAASignalsFound','ShipTargeted',
  'ApproachBody','LeaveBody','SupercruiseEntry','SupercruiseExit','StartJump','JetConeBoost','ReservoirReplenished',
  'DockingRequested','DockingGranted','DockingCancelled','DockingDenied','DockingTimeout','Docked','Undocked',
  'Repair','RepairAll','RefuelAll','RefuelPartial','BuyAmmo','RestockVehicle','Loadout','ModulesInfo',
  'StoredShips','StoredModules','ShipyardSwap','ShipyardTransfer','ModuleBuy','ModuleSell','ModuleSwap','ModuleStore','ModuleRetrieve',
  'Cargo','ShipLocker','Backpack','BackpackChange','MaterialCollected','MaterialDiscarded','MaterialDiscovered','Synthesis',
  'Market','Outfitting','Shipyard','EngineerProgress','Statistics','Rank','Progress','Powerplay','SquadronStartup'
]);

export async function requireMember(request, env) {
  const session = await readSession(request, env);
  if (!session) return {response:json({ok:false,error:'authentication_required'}, {status:401,headers:privateHeaders()})};
  if (!['member','officer','site_admin'].includes(session.access)) {
    return {response:json({ok:false,error:'member_access_required'}, {status:403,headers:privateHeaders()})};
  }
  return {session};
}

export function frontierConfigured(env) {
  return Boolean(env?.FRONTIER_CLIENT_ID && storageReady(env));
}

export function redirectUri(request, env) {
  return String(env?.FRONTIER_REDIRECT_URI || new URL('/api/frontier/callback', request.url));
}

export function userAgent(env) {
  return String(env?.FRONTIER_USER_AGENT || 'EDCD-MongrelScout-0.1.0');
}

export async function beginFrontierFlow(request, env, session) {
  const state = randomBase64Url(32);
  const verifier = randomPkceVerifier(48);
  const challenge = await sha256Base64Url(verifier);
  const record = {
    userId:session.sub,
    verifier,
    createdAt:new Date().toISOString(),
    returnTo:'/member/#mongrel-scout',
  };
  await env.DAILY_ORDERS.put(FLOW_PREFIX + state, JSON.stringify(record), {expirationTtl:FLOW_TTL_SECONDS});
  const params = new URLSearchParams({
    audience:'frontier,steam,epic',
    scope:'auth capi',
    response_type:'code',
    client_id:env.FRONTIER_CLIENT_ID,
    code_challenge:challenge,
    code_challenge_method:'S256',
    state,
    redirect_uri:redirectUri(request, env),
  });
  return AUTH_URL + '?' + params.toString();
}

export async function finishFrontierFlow(request, env, session, state, code) {
  const key = FLOW_PREFIX + state;
  const flow = await env.DAILY_ORDERS.get(key, {type:'json'});
  await env.DAILY_ORDERS.delete(key);
  if (!flow || flow.userId !== session.sub || !flow.verifier) throw new Error('frontier_state_invalid');

  const response = await fetch(TOKEN_URL, {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':userAgent(env)},
    body:new URLSearchParams({
      grant_type:'authorization_code',
      client_id:env.FRONTIER_CLIENT_ID,
      ...(env.FRONTIER_CLIENT_SECRET ? {client_secret:env.FRONTIER_CLIENT_SECRET} : {}),
      code,
      code_verifier:flow.verifier,
      redirect_uri:redirectUri(request, env),
    }),
  });
  const token = await response.json().catch(()=>({}));
  if (!response.ok || !token.access_token || !token.refresh_token) {
    throw new Error('frontier_token_exchange_failed');
  }

  const profile = await fetchCapi('/profile', token.access_token, env);
  if (!profile.response.ok) throw new Error('frontier_profile_failed');
  const data = await profile.response.json().catch(()=>({}));
  const now = Date.now();
  const commander = cleanText(data?.commander?.name, 'Unknown CMDR', 80);
  const commanderId = String(data?.commander?.id ?? '');
  const account = {
    version:1,
    commander,
    commanderId,
    authorizedAt:new Date(now).toISOString(),
    reauthDueAt:new Date(now + REAUTH_DAYS * 86400000).toISOString(),
    accessExpiresAt:new Date(now + Math.max(60, Number(token.expires_in)||14400) * 1000).toISOString(),
    tokenType:cleanText(token.token_type, 'Bearer', 24),
    accessToken:await seal(env, token.access_token),
    refreshToken:await seal(env, token.refresh_token),
    lastSyncAt:null,
    lastJournalEventAt:null,
    lastSystem:'',
  };
  await saveAccount(env, session.sub, account);
  return publicAccount(account);
}

export async function getAccount(env, userId) {
  if (!storageReady(env)) return null;
  const value = await env.DAILY_ORDERS.get(ACCOUNT_PREFIX + userId, {type:'json'});
  return value && typeof value === 'object' ? value : null;
}

export async function listFrontierAccounts(env) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.list !== 'function') return [];
  const keys=await listKeysCached(env,{
    prefix:ACCOUNT_PREFIX,
    cacheKey:ACCOUNT_LIST_CACHE_KEY,
    maxAgeSeconds:21600,
    maxKeys:1000,
  });
  const rows=await Promise.all(keys.map(async key=>{
    const account=await env.DAILY_ORDERS.get(key,{type:'json'});
    if (!account || typeof account !== 'object') return null;
    const userId=decodeURIComponent(key.slice(ACCOUNT_PREFIX.length));
    return {userId,account:publicAccount(account)};
  }));
  return rows.filter(Boolean);
}

export async function saveAccount(env, userId, account) {
  const key=ACCOUNT_PREFIX + userId;
  let existed=true;
  try{existed=Boolean(await env.DAILY_ORDERS.get(key));}
  catch{existed=true;}
  await env.DAILY_ORDERS.put(key, JSON.stringify(account));
  if(!existed)await invalidateKeyListCache(env,ACCOUNT_LIST_CACHE_KEY);
}

export async function disconnectAccount(env, userId) {
  await env.DAILY_ORDERS.delete(ACCOUNT_PREFIX + userId);
  await invalidateKeyListCache(env,ACCOUNT_LIST_CACHE_KEY);
}

export function syncCooldown(account, now = Date.now()) {
  const last = Date.parse(account?.lastSyncAt || '');
  if (!Number.isFinite(last)) return {ready:true,remainingSeconds:0,nextSyncAt:null};
  const next = last + FRONTIER_SYNC_COOLDOWN_SECONDS * 1000;
  const remainingSeconds = Math.max(0, Math.ceil((next - now) / 1000));
  return {
    ready:remainingSeconds <= 0,
    remainingSeconds,
    nextSyncAt:new Date(next).toISOString(),
  };
}

export function publicAccount(account) {
  if (!account) return null;
  return {
    connected:true,
    commander:account.commander || '',
    commanderId:account.commanderId || '',
    authorizedAt:account.authorizedAt || null,
    reauthDueAt:account.reauthDueAt || null,
    accessExpiresAt:account.accessExpiresAt || null,
    lastSyncAt:account.lastSyncAt || null,
    lastJournalEventAt:account.lastJournalEventAt || null,
    lastSystem:account.lastSystem || '',
  };
}

export async function ensureAccessToken(request, env, userId, account) {
  const expires = Date.parse(account?.accessExpiresAt || '');
  if (Number.isFinite(expires) && expires > Date.now() + ACCESS_SAFETY_SECONDS * 1000) {
    return {accessToken:await unseal(env, account.accessToken),account};
  }
  const refreshToken = await unseal(env, account.refreshToken);
  const body = {
    grant_type:'refresh_token',
    client_id:env.FRONTIER_CLIENT_ID,
    refresh_token:refreshToken,
  };
  if (env.FRONTIER_CLIENT_SECRET) body.client_secret = env.FRONTIER_CLIENT_SECRET;
  const response = await fetch(TOKEN_URL, {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':userAgent(env)},
    body:new URLSearchParams(body),
  });
  const token = await response.json().catch(()=>({}));
  if (!response.ok || !token.access_token) throw new Error(response.status === 401 ? 'frontier_reauthorization_required' : 'frontier_refresh_failed');
  const updated = {
    ...account,
    accessExpiresAt:new Date(Date.now() + Math.max(60, Number(token.expires_in)||14400) * 1000).toISOString(),
    tokenType:cleanText(token.token_type, account.tokenType || 'Bearer', 24),
    accessToken:await seal(env, token.access_token),
    refreshToken:token.refresh_token ? await seal(env, token.refresh_token) : account.refreshToken,
  };
  await saveAccount(env, userId, updated);
  return {accessToken:token.access_token,account:updated};
}

export async function fetchJournal(accessToken, env, datePath='') {
  return fetchCapi('/journal' + datePath, accessToken, env);
}

async function fetchCapi(path, accessToken, env) {
  const response = await fetch(CAPI_HOST + path, {
    headers:{Authorization:'Bearer ' + accessToken,'User-Agent':userAgent(env),Accept:'application/json'},
  });
  return {response};
}

export function parseJournal(text, targetSystems = [TEST_SYSTEM], options = {}) {
  const requested = Array.isArray(targetSystems) ? targetSystems : [targetSystems];
  const targets = requested.map(value=>cleanText(value,'',140)).filter(Boolean);
  const targetByNorm = new Map(targets.map(system=>[norm(system),system]));
  const targetSet = new Set(targetByNorm.keys());

  const entries = String(text || '').split(/\r?\n/).filter(Boolean).map(line=>{
    try { return JSON.parse(line); } catch { return null; }
  }).filter(entry=>entry && typeof entry === 'object')
    .sort((a,b)=>String(a.timestamp||'').localeCompare(String(b.timestamp||'')));

  const knownAddresses = options.knownSystemAddresses && typeof options.knownSystemAddresses === 'object'
    ? options.knownSystemAddresses
    : {};
  const knownMissionOrigins = options.knownMissionOrigins && typeof options.knownMissionOrigins === 'object'
    ? options.knownMissionOrigins
    : {};
  const systemAddresses = {};
  const addressToSystem = new Map();
  const missionOrigins = new Map();
  for (const [missionId,value] of Object.entries(knownMissionOrigins)) {
    const origin=normalizeMissionOrigin(value);
    if(!missionId||!origin?.originSystem)continue;
    missionOrigins.set(String(missionId),origin);
    if(origin.originSystemAddress!==null&&origin.originSystemAddress!==undefined){
      systemAddresses[origin.originSystem]=origin.originSystemAddress;
      addressToSystem.set(String(origin.originSystemAddress),origin.originSystem);
    }
  }
  for (const [system,address] of Object.entries(knownAddresses)) {
    if (!system || address === null || address === undefined || address === '') continue;
    systemAddresses[system]=address;
    addressToSystem.set(String(address),system);
  }
  for (const entry of entries) {
    const system=cleanText(entry.StarSystem,'',140);
    const address=entry.SystemAddress;
    if (!system || address === null || address === undefined || address === '') continue;
    systemAddresses[system]=address;
    addressToSystem.set(String(address),system);
  }

  const relevant = [];
  const excluded = [];
  const diagnostics = [];
  const diagnosticMode = Boolean(options.diagnostics);
  const tradeProvenance = new Map();
  let currentSystem = '';
  let currentAddress = null;
  let currentStation = '';
  let currentStationFaction = '';
  let currentStationType = '';
  let lastEventAt = null;

  for (const entry of entries) {
    const timestamp = cleanText(entry.timestamp, '', 40);
    if (timestamp && (!lastEventAt || timestamp > lastEventAt)) lastEventAt = timestamp;

    if (['Location','FSDJump','CarrierJump'].includes(entry.event)) {
      currentSystem = cleanText(entry.StarSystem, currentSystem, 140);
      currentAddress = entry.SystemAddress ?? currentAddress;
      if (currentSystem && currentAddress !== null && currentAddress !== undefined) {
        systemAddresses[currentSystem]=currentAddress;
        addressToSystem.set(String(currentAddress),currentSystem);
      }
      if (entry.Docked === true) {
        currentStation = cleanText(entry.StationName, currentStation, 140);
        currentStationFaction = cleanText(entry?.StationFaction?.Name || entry?.StationFaction, currentStationFaction, 120);
        currentStationType = cleanText(entry.StationType, currentStationType, 80);
      } else if (entry.Docked === false) {
        currentStation = '';
        currentStationFaction = '';
        currentStationType = '';
      }
    }
    if (entry.event === 'Docked') {
      currentStation = cleanText(entry.StationName, currentStation, 140);
      currentStationFaction = cleanText(entry?.StationFaction?.Name || entry?.StationFaction, currentStationFaction, 120);
      currentStationType = cleanText(entry.StationType, currentStationType, 80);
      currentSystem = cleanText(entry.StarSystem, currentSystem, 140);
      currentAddress = entry.SystemAddress ?? currentAddress;
      if (currentSystem && currentAddress !== null && currentAddress !== undefined) {
        systemAddresses[currentSystem]=currentAddress;
        addressToSystem.set(String(currentAddress),currentSystem);
      }
    }
    if (entry.event === 'Undocked') {
      currentStation = '';
      currentStationFaction = '';
      currentStationType = '';
    }

    let saleProvenance = null;
    if (entry.event === 'MarketBuy') {
      addTradeProvenance(
        tradeProvenance,
        entry.Type,
        Number(entry.Count)||0,
        isFleetCarrier(currentStationType,currentStationFaction) ? 'carrier_market' : 'station_market',
      );
    } else if (entry.event === 'MiningRefined') {
      addTradeProvenance(tradeProvenance, entry.Type, 1, 'mined');
    } else if (entry.event === 'MarketSell') {
      saleProvenance = consumeTradeProvenance(tradeProvenance, entry.Type, Number(entry.Count)||0);
    }

    const canonicalCurrent = targetByNorm.get(norm(currentSystem)) || '';
    const inTarget = Boolean(canonicalCurrent);
    if (diagnosticMode && !DIAGNOSTIC_NOISE_EVENTS.has(entry.event)) {
      diagnostics.push(diagnosticEvent(entry, currentSystem, currentStation, currentStationType));
    }

    if (entry.event === 'MissionAccepted') {
      const missionId=String(entry.MissionID ?? '').trim();
      const destinationSystem=cleanText(entry.DestinationSystem, '', 140);
      const relevantMission=targetSet.has(norm(currentSystem)) || targetSet.has(norm(destinationSystem));
      if(missionId&&currentSystem&&relevantMission){
        const origin={
          missionId,
          acceptedAt:timestamp || null,
          originSystem:currentSystem,
          originSystemAddress:currentAddress ?? null,
          originStation:currentStation || '',
          sourceFaction:cleanText(entry.Faction, '', 120),
          destinationSystem,
          destinationStation:cleanText(entry.DestinationStation, '', 140),
        };
        missionOrigins.set(missionId,origin);
        if(origin.originSystemAddress!==null&&origin.originSystemAddress!==undefined){
          systemAddresses[origin.originSystem]=origin.originSystemAddress;
          addressToSystem.set(String(origin.originSystemAddress),origin.originSystem);
        }
      }
      continue;
    }

    if (entry.event === 'ColonisationSystemClaim' || entry.event === 'ColonisationSystemClaimRelease') {
      const claimSystem=cleanText(entry.StarSystem, currentSystem, 140);
      const claimAddress=entry.SystemAddress ?? currentAddress ?? null;
      if (claimSystem) {
        relevant.push(baseEvent(entry,claimSystem,claimAddress,'',{
          type:entry.event === 'ColonisationSystemClaim' ? 'colonization_system_claim' : 'colonization_system_claim_release',
          claimed:entry.event === 'ColonisationSystemClaim',
        }));
      }
      continue;
    }

    if (entry.event === 'MissionCompleted') {
      const missionId=String(entry.MissionID ?? '').trim();
      const accepted=missionOrigins.get(missionId) || null;
      const sourceFaction=cleanText(accepted?.sourceFaction || entry.Faction, '', 120);
      const effects = [];
      for (const effect of Array.isArray(entry.FactionEffects) ? entry.FactionEffects : []) {
        const effectFaction=cleanText(effect?.Faction, '', 120);
        const influenceRows=Array.isArray(effect?.Influence) ? effect.Influence : [];
        for (const inf of influenceRows) {
          let address = inf?.SystemAddress ?? null;
          let resolved='';
          if(address!==null&&address!==undefined){
            resolved=addressToSystem.get(String(address)) || '';
            if(!resolved&&accepted?.originSystemAddress!==null&&accepted?.originSystemAddress!==undefined
              && String(address)===String(accepted.originSystemAddress)){
              resolved=accepted.originSystem;
            }
          }else if(accepted&&norm(effectFaction)===norm(sourceFaction)){
            resolved=accepted.originSystem;
            address=accepted.originSystemAddress ?? null;
          }else if(inTarget){
            resolved=canonicalCurrent;
          }
          const affectedSystem=targetByNorm.get(norm(resolved)) || '';
          if (!affectedSystem) continue;
          const influence = cleanText(inf?.Influence, '', 16);
          const reputation = cleanText(effect?.Reputation, '', 16);
          const isOriginEffect=Boolean(
            accepted
            && norm(effectFaction)===norm(sourceFaction)
            && norm(affectedSystem)===norm(accepted.originSystem)
          );
          effects.push({
            faction:effectFaction,
            system:affectedSystem,
            systemAddress:address,
            influence,
            infUnits:(influence.match(/\+/g)||[]).length,
            reputation,
            repUnits:(reputation.match(/\+/g)||[]).length - (reputation.match(/-/g)||[]).length,
            role:isOriginEffect?'source':'secondary',
          });
        }
      }
      if (accepted) {
        missionOrigins.set(missionId,{...accepted,completedAt:timestamp||accepted.completedAt||null});
      }
      if (effects.length) {
        const affectedSystems=[...new Set(effects.map(effect=>effect.system).filter(Boolean))];
        relevant.push(baseEvent(entry,currentSystem,currentAddress,currentStation,{
          type:'mission_inf',
          missionId:entry.MissionID ?? null,
          originSystem:accepted?.originSystem || '',
          originSystemAddress:accepted?.originSystemAddress ?? null,
          originStation:accepted?.originStation || '',
          sourceFaction,
          destinationSystem:cleanText(entry.DestinationSystem || accepted?.destinationSystem, '', 140),
          affectedSystem:affectedSystems.length===1 ? affectedSystems[0] : '',
          affectedSystems,
          effects,
        }));
      }
      continue;
    }

    if (!inTarget) continue;
    if (entry.event === 'RedeemVoucher') {
      const voucherType = String(entry.Type || '').trim().toLowerCase();
      if (voucherType === 'bounty' || voucherType === 'combatbond') {
        const factions = (Array.isArray(entry.Factions) ? entry.Factions : []).slice(0,20).map(item => ({
          faction:cleanText(item?.Faction, '', 120),
          amount:Number(item?.Amount)||0,
        })).filter(item => item.faction || item.amount);
        const normalized = baseEvent(entry,canonicalCurrent,currentAddress,currentStation,{
          type:voucherType === 'combatbond' ? 'combat_bonds_redeemed' : 'bounties_redeemed',
          amount:Number(entry.Amount)||0,
          faction:cleanText(entry.Faction, '', 120),
          factions,
          stationFaction:currentStationFaction,
          stationType:currentStationType,
        });
        if (isFleetCarrier(currentStationType,currentStationFaction)) excluded.push(normalized);
        else relevant.push(normalized);
      }
    } else if (entry.event === 'FactionKillBond') {
      relevant.push(baseEvent(entry,canonicalCurrent,currentAddress,currentStation,{
        type:'cz_bond_awarded',
        amount:Number(entry.Reward)||0,
        awardingFaction:cleanText(entry.AwardingFaction, '', 120),
        victimFaction:cleanText(entry.VictimFaction, '', 120),
      }));
    } else if (entry.event === 'ColonisationConstructionDepot') {
      const resources=(Array.isArray(entry.ResourcesRequired)?entry.ResourcesRequired:[]).slice(0,96).map(item=>({
        commodityCode:cleanText(item?.Name, '', 120).replace(/^\$/,'').replace(/_name;$/i,''),
        commodity:cleanText(item?.Name_Localised || item?.Name, '', 120),
        requiredAmount:Math.max(0,Math.floor(Number(item?.RequiredAmount)||0)),
        providedAmount:Math.max(0,Math.floor(Number(item?.ProvidedAmount)||0)),
        payment:Math.max(0,Math.floor(Number(item?.Payment)||0)),
      }));
      relevant.push(baseEvent(entry,canonicalCurrent,currentAddress,currentStation,{
        type:'colonization_depot',
        marketId:String(entry.MarketID ?? ''),
        constructionProgress:Number(entry.ConstructionProgress)||0,
        constructionComplete:Boolean(entry.ConstructionComplete),
        constructionFailed:Boolean(entry.ConstructionFailed),
        resources,
      }));
    } else if (entry.event === 'ColonisationContribution') {
      const contributions=(Array.isArray(entry.Contributions)?entry.Contributions:[]).slice(0,64).map(item=>({
        commodityCode:cleanText(item?.Name, '', 120).replace(/^\$/,'').replace(/_name;$/i,''),
        commodity:cleanText(item?.Name_Localised || item?.Name, '', 120),
        amount:Math.max(0,Math.floor(Number(item?.Amount)||0)),
      })).filter(item=>item.amount>0);
      const totalTons=contributions.reduce((sum,item)=>sum+item.amount,0);
      if(totalTons>0) {
        relevant.push(baseEvent(entry,canonicalCurrent,currentAddress,currentStation,{
          type:'colonization_contribution',
          marketId:String(entry.MarketID ?? ''),
          totalTons,
          contributions,
        }));
      }
    } else if (entry.event === 'MarketSell') {
      const count = Number(entry.Count)||0;
      const sellPrice = Number(entry.SellPrice)||0;
      const total = Number(entry.TotalSale)||0;
      const profitKnown = entry.AvgPricePaid !== undefined
        && entry.AvgPricePaid !== null
        && Number.isFinite(Number(entry.AvgPricePaid));
      const avgPricePaid = profitKnown ? Number(entry.AvgPricePaid) : null;
      const costBasis = profitKnown ? avgPricePaid * count : null;
      const profit = profitKnown ? total - costBasis : null;
      const source = saleProvenance?.source || 'unknown';
      const sourceVerified = Boolean(saleProvenance?.verified);
      const profitable = profitKnown && Number.isFinite(profit) && profit > 0;
      const standardMarket = !Boolean(entry.BlackMarket || entry.StolenGoods);
      const bgsTradeEligible = profitable
        && avgPricePaid > 0
        && sourceVerified
        && source === 'station_market'
        && standardMarket;
      let tradeEligibilityReason = 'eligible';
      if (!profitable) tradeEligibilityReason = 'not_profitable';
      else if (!(avgPricePaid > 0)) tradeEligibilityReason = 'mined_or_zero_cost';
      else if (!sourceVerified) tradeEligibilityReason = 'purchase_provenance_unverified';
      else if (source === 'carrier_market') tradeEligibilityReason = 'carrier_market_source';
      else if (source === 'mined') tradeEligibilityReason = 'mined_source';
      else if (source !== 'station_market') tradeEligibilityReason = 'mixed_or_nonstation_source';
      else if (!standardMarket) tradeEligibilityReason = 'nonstandard_market';
      const normalized = baseEvent(entry,canonicalCurrent,currentAddress,currentStation,{
        type:'market_sell',
        commodity:cleanText(entry.Type_Localised || entry.Type, '', 100),
        count,
        sellPrice,
        total,
        avgPricePaid,
        costBasis,
        profit,
        profitKnown,
        tradeSource:source,
        tradeSourceVerified:sourceVerified,
        bgsTradeEligible,
        tradeEligibilityReason,
        stationFaction:currentStationFaction,
        stationType:currentStationType,
      });
      if (isFleetCarrier(currentStationType,currentStationFaction)) excluded.push(normalized);
      else relevant.push(normalized);
    } else if (['SellExplorationData','MultiSellExplorationData'].includes(entry.event)) {
      const normalized = baseEvent(entry,canonicalCurrent,currentAddress,currentStation,{
        type:'exploration_sale',
        amount:Number(entry.TotalEarnings ?? entry.TotalEarningsWithBonus ?? entry.BaseValue)||0,
        stationFaction:currentStationFaction,
        stationType:currentStationType,
      });
      if (isFleetCarrier(currentStationType,currentStationFaction)) excluded.push(normalized);
      else relevant.push(normalized);
    }
  }

  const scopedAddresses={};
  for (const system of targets) {
    const address=systemAddresses[system];
    if (address !== undefined && address !== null) scopedAddresses[system]=address;
  }
  return {
    events:relevant,
    excluded,
    diagnostics,
    lastEventAt,
    lastSystem:currentSystem,
    targetSystems:targets,
    systemAddresses:scopedAddresses,
    missionOrigins:Object.fromEntries([...missionOrigins.entries()]),
  };
}

function normalizeMissionOrigin(value){
  if(!value||typeof value!=='object')return null;
  const originSystem=cleanText(value.originSystem,'',140);
  if(!originSystem)return null;
  return {
    missionId:String(value.missionId??''),
    acceptedAt:cleanText(value.acceptedAt,'',40)||null,
    completedAt:cleanText(value.completedAt,'',40)||null,
    originSystem,
    originSystemAddress:value.originSystemAddress ?? null,
    originStation:cleanText(value.originStation,'',140),
    sourceFaction:cleanText(value.sourceFaction,'',120),
    destinationSystem:cleanText(value.destinationSystem,'',140),
    destinationStation:cleanText(value.destinationStation,'',140),
  };
}

export async function mergeEvents(env, userId, events, excluded = []) {
  const key = EVENTS_PREFIX + userId;
  const previous = await env.DAILY_ORDERS.get(key, {type:'json'});
  const existing = Array.isArray(previous?.events) ? previous.events : [];
  const byId = new Map();
  for (const event of existing) {
    const id = await eventId(event);
    byId.set(id,{...event,id});
  }
  for (const event of excluded) {
    const id = await eventId(event);
    byId.delete(id);
  }
  for (const event of events) {
    const id = await eventId(event);
    const prior = byId.get(id);
    if (
      event?.type === 'market_sell'
      && prior?.type === 'market_sell'
      && prior?.bgsTradeEligible === true
      && event?.bgsTradeEligible !== true
    ) {
      byId.set(id,{...event,...prior,id});
      continue;
    }
    byId.set(id,{...event,id});
  }
  const merged = [...byId.values()].sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp))).slice(-1000);
  await env.DAILY_ORDERS.put(key, JSON.stringify({version:3,events:merged}));
  return merged;
}

export async function getEvents(env, userId) {
  const stored = await env.DAILY_ORDERS.get(EVENTS_PREFIX + userId, {type:'json'});
  return Array.isArray(stored?.events) ? stored.events : [];
}

export function summarizeEvents(events) {
  const summary = {
    missionInf:0,bounties:0,combatBondsRedeemed:0,czBondAwards:0,
    tradeTonnage:0,tradeSales:0,tradeProfit:0,tradeEligibleProfit:0,tradeEligibleSales:0,tradeIneligibleSales:0,tradeProfitKnownSales:0,tradeProfitLegacySales:0,tradeProfitUnavailableSales:0,
    explorationSales:0,colonizationTons:0,colonizationContributions:0,
    colonizationSystemClaims:0,colonizationSystemClaimReleases:0
  };
  for (const event of events) {
    if (event.type === 'mission_inf') summary.missionInf += (event.effects||[]).reduce((n,x)=>n+(Number(x.infUnits)||0),0);
    if (event.type === 'bounties_redeemed') summary.bounties += Number(event.amount)||0;
    if (event.type === 'combat_bonds_redeemed') summary.combatBondsRedeemed += Number(event.amount)||0;
    if (event.type === 'cz_bond_awarded') summary.czBondAwards += Number(event.amount)||0;
    if (event.type === 'market_sell') {
      summary.tradeTonnage += Number(event.count)||0;
      summary.tradeSales += Number(event.total)||0;
      if (event.profitKnown === true && Number.isFinite(Number(event.profit))) {
        summary.tradeProfit += Number(event.profit);
        summary.tradeProfitKnownSales += 1;
        if (event.bgsTradeEligible === true) {
          summary.tradeEligibleProfit += Number(event.profit);
          summary.tradeEligibleSales += 1;
        } else {
          summary.tradeIneligibleSales += 1;
        }
      } else if (event.profitKnown === false) {
        summary.tradeProfitUnavailableSales += 1;
      } else {
        summary.tradeProfitLegacySales += 1;
      }
    }
    if (event.type === 'exploration_sale') summary.explorationSales += Number(event.amount)||0;
    if (event.type === 'colonization_contribution') {
      summary.colonizationTons += Number(event.totalTons)||0;
      summary.colonizationContributions += 1;
    }
    if (event.type === 'colonization_system_claim') summary.colonizationSystemClaims += 1;
    if (event.type === 'colonization_system_claim_release') summary.colonizationSystemClaimReleases += 1;
  }
  return summary;
}

function diagnosticEvent(entry, system, station, stationType) {
  const out = {
    timestamp:cleanText(entry.timestamp, '', 40),
    event:cleanText(entry.event, '', 80),
    system:cleanText(system, '', 140),
    station:cleanText(station, '', 140),
    stationType:cleanText(stationType, '', 80),
    keys:Object.keys(entry).filter(key=>!['timestamp','event'].includes(key)).slice(0,24),
  };
  const safeKeys = [
    'Faction','FactionName','AwardingFaction','VictimFaction','Result','Status','Success',
    'Message','Message_Localised','From','From_Localised','Channel','MusicTrack','Reward',
    'Amount','Influence','Reputation','MissionID','War','Conflict','Combat',
    'Count','SellPrice','TotalSale','AvgPricePaid','Type','Type_Localised','MarketID'
  ];
  for (const key of safeKeys) {
    if (entry[key] === undefined || entry[key] === null) continue;
    const value = entry[key];
    if (typeof value === 'string') out[key] = value.slice(0,300);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  if (Array.isArray(entry.FactionEffects)) {
    out.factionEffects = entry.FactionEffects.slice(0,8).map(effect => {
      const faction = cleanText(effect?.Faction, 'Unknown faction', 120);
      const reputation = cleanText(effect?.Reputation, '', 16);
      const influence = (Array.isArray(effect?.Influence) ? effect.Influence : []).slice(0,8)
        .map(inf => `${cleanText(inf?.Influence, '', 16)}@${String(inf?.SystemAddress ?? '?')}`)
        .filter(Boolean).join(',');
      return [faction, reputation ? `REP ${reputation}` : '', influence ? `INF ${influence}` : ''].filter(Boolean).join(' | ');
    }).join(' ; ').slice(0,1200);
  }
  if (Array.isArray(entry.Factions)) {
    out.factions = entry.Factions.slice(0,20).map(item => {
      const faction = cleanText(item?.Faction, 'Unknown faction', 120);
      const amount = Number(item?.Amount)||0;
      return `${faction} | ${amount} Cr`;
    }).join(' ; ').slice(0,1200);
  }
  if (Array.isArray(entry.Contributions)) {
    out.contributions = entry.Contributions.slice(0,32).map(item => {
      const commodity=cleanText(item?.Name_Localised || item?.Name, 'Unknown commodity', 120);
      const amount=Math.max(0,Math.floor(Number(item?.Amount)||0));
      return `${commodity} | ${amount} t`;
    }).join(' ; ').slice(0,1600);
  }
  if (Array.isArray(entry.ResourcesRequired)) {
    out.resourcesRequired = entry.ResourcesRequired.slice(0,32).map(item => {
      const commodity=cleanText(item?.Name_Localised || item?.Name, 'Unknown commodity', 120);
      const required=Math.max(0,Math.floor(Number(item?.RequiredAmount)||0));
      const provided=Math.max(0,Math.floor(Number(item?.ProvidedAmount)||0));
      return `${commodity} | ${provided}/${required} t`;
    }).join(' ; ').slice(0,1800);
  }
  return out;
}

function tradeCommodityKey(value) {
  return norm(String(value || '').replace(/^\$|;$/g,''));
}

function addTradeProvenance(store, commodity, count, source) {
  const key = tradeCommodityKey(commodity);
  const qty = Math.max(0, Math.floor(Number(count)||0));
  if (!key || !qty) return;
  const lots = store.get(key) || [];
  const last = lots[lots.length - 1];
  if (last && last.source === source) last.count += qty;
  else lots.push({source,count:qty});
  store.set(key,lots);
}

function consumeTradeProvenance(store, commodity, count) {
  const key = tradeCommodityKey(commodity);
  let remaining = Math.max(0, Math.floor(Number(count)||0));
  if (!key || !remaining) return {source:'unknown',verified:false,covered:0,total:remaining};
  const lots = store.get(key) || [];
  const sources = new Set();
  let covered = 0;
  while (remaining > 0 && lots.length) {
    const lot = lots[0];
    const used = Math.min(remaining, Math.max(0,Number(lot.count)||0));
    if (used > 0) {
      sources.add(lot.source || 'unknown');
      covered += used;
      remaining -= used;
      lot.count -= used;
    }
    if (lot.count <= 0) lots.shift();
  }
  if (lots.length) store.set(key,lots); else store.delete(key);
  if (remaining > 0) sources.add('unknown');
  const source = sources.size === 1 ? [...sources][0] : sources.size ? 'mixed' : 'unknown';
  return {source,verified:remaining===0 && sources.size===1 && source!=='unknown',covered,total:Math.max(0,Number(count)||0)};
}

function isFleetCarrier(stationType, stationFaction) {
  return norm(stationType) === 'fleetcarrier' || norm(stationFaction) === 'fleetcarrier';
}

function baseEvent(entry, system, systemAddress, station, extra) {
  return {
    timestamp:cleanText(entry.timestamp, '', 40),
    sourceEvent:cleanText(entry.event, '', 60),
    system:cleanText(system, '', 140),
    systemAddress:systemAddress ?? null,
    station:cleanText(station, '', 140),
    ...extra,
  };
}

async function eventId(event) {
  const stable = {
    timestamp:event.timestamp || '',
    sourceEvent:event.sourceEvent || '',
    type:event.type || '',
    systemAddress:event.systemAddress ?? null,
    station:event.station || '',
  };
  if (event.type === 'mission_inf') stable.missionId = event.missionId ?? null;
  if (event.type === 'market_sell') Object.assign(stable,{
    commodity:event.commodity || '',
    count:Number(event.count)||0,
    total:Number(event.total)||0,
    sellPrice:Number(event.sellPrice)||0,
  });
  if (['colonization_system_claim','colonization_system_claim_release'].includes(event.type)) {
    delete stable.station;
  }
  if (event.type === 'colonization_depot') {
    delete stable.timestamp;
    delete stable.station;
    Object.assign(stable,{marketId:String(event.marketId||'')});
  }
  if (event.type === 'colonization_contribution') Object.assign(stable,{
    marketId:String(event.marketId||''),
    totalTons:Number(event.totalTons)||0,
    contributions:(event.contributions||[]).map(item=>[item.commodityCode||item.commodity||'',Number(item.amount)||0]),
  });
  if (['bounties_redeemed','combat_bonds_redeemed','cz_bond_awarded','exploration_sale'].includes(event.type)) {
    stable.amount = Number(event.amount)||0;
  }
  if (event.type === 'cz_bond_awarded') {
    stable.awardingFaction = event.awardingFaction || '';
    stable.victimFaction = event.victimFaction || '';
  }
  const encoded = new TextEncoder().encode(JSON.stringify(stable));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

async function seal(env, plaintext) {
  const key = await encryptionKey(env);
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const data = new TextEncoder().encode(String(plaintext));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, data);
  return bytesToBase64Url(iv) + '.' + bytesToBase64Url(new Uint8Array(encrypted));
}

async function unseal(env, sealed) {
  const [ivText,dataText] = String(sealed||'').split('.');
  if (!ivText || !dataText) throw new Error('frontier_token_missing');
  const key = await encryptionKey(env);
  const decrypted = await crypto.subtle.decrypt({name:'AES-GCM',iv:base64UrlToBytes(ivText)}, key, base64UrlToBytes(dataText));
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey(env) {
  const secret = String(env.FRONTIER_TOKEN_SECRET || env.SESSION_SECRET || '');
  if (!secret) throw new Error('frontier_token_secret_missing');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}
function randomBase64Url(length) { const bytes=new Uint8Array(length); crypto.getRandomValues(bytes); return bytesToBase64Url(bytes); }
function randomPkceVerifier(length) {
  const bytes=new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let s='';
  for (const b of bytes) s+=String.fromCharCode(b);
  return btoa(s).replaceAll('+','-').replaceAll('/','_');
}
function bytesToBase64Url(bytes) { let s=''; for (const b of bytes) s+=String.fromCharCode(b); return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function base64UrlToBytes(value) { const p=value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4); const s=atob(p); const b=new Uint8Array(s.length); for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i); return b; }
function norm(value) { return String(value||'').trim().toLowerCase().replace(/\s+/g,' '); }
function cleanText(value, fallback, maxLength) { if(typeof value!=='string')return fallback; const s=value.trim(); return s?s.slice(0,maxLength):fallback; }
function storageReady(env) { return Boolean(env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.get==='function' && typeof env.DAILY_ORDERS.put==='function'); }
export function privateHeaders() { return {'Cache-Control':'private, no-store, max-age=0',Pragma:'no-cache','X-Content-Type-Options':'nosniff',Vary:'Cookie'}; }
export function sameOrigin(request, marker='mongrel-frontier') { const origin=request.headers.get('Origin'); const expected=new URL(request.url).origin; return origin===expected && request.headers.get('X-Mongrels-Request')===marker; }
