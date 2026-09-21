import { json, readSession } from './auth.js';

const AUTH_URL = 'https://auth.frontierstore.net/auth';
const TOKEN_URL = 'https://auth.frontierstore.net/token';
const CAPI_HOST = 'https://companion.orerve.net';
const FLOW_PREFIX = 'frontier-oauth-flow:';
const ACCOUNT_PREFIX = 'frontier-account:';
const EVENTS_PREFIX = 'frontier-bgs-events:';
const FLOW_TTL_SECONDS = 60 * 10;
const ACCESS_SAFETY_SECONDS = 60;
const REAUTH_DAYS = 25;
export const TEST_SYSTEM = 'NGC 2546 Sector UZ-G d10-16';

const DIAGNOSTIC_NOISE_EVENTS = new Set([
  'FSSSignalDiscovered','FSSDiscoveryScan','Scan','NavBeaconScan','CodexEntry','SAAScanComplete','SAASignalsFound',
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

export async function saveAccount(env, userId, account) {
  await env.DAILY_ORDERS.put(ACCOUNT_PREFIX + userId, JSON.stringify(account));
}

export async function disconnectAccount(env, userId) {
  await env.DAILY_ORDERS.delete(ACCOUNT_PREFIX + userId);
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

export function parseJournal(text, targetSystem = TEST_SYSTEM, options = {}) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  const relevant = [];
  const diagnostics = [];
  const diagnosticMode = Boolean(options.diagnostics);
  let currentSystem = '';
  let currentAddress = null;
  let currentStation = '';
  let targetAddress = null;
  let lastEventAt = null;

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || typeof entry !== 'object') continue;
    const timestamp = cleanText(entry.timestamp, '', 40);
    if (timestamp && (!lastEventAt || timestamp > lastEventAt)) lastEventAt = timestamp;

    if (['Location','FSDJump','CarrierJump'].includes(entry.event)) {
      currentSystem = cleanText(entry.StarSystem, currentSystem, 140);
      currentAddress = entry.SystemAddress ?? currentAddress;
      if (norm(currentSystem) === norm(targetSystem)) targetAddress = currentAddress;
      if (entry.Docked === false) currentStation = '';
    }
    if (entry.event === 'Docked') {
      currentStation = cleanText(entry.StationName, currentStation, 140);
      currentSystem = cleanText(entry.StarSystem, currentSystem, 140);
      currentAddress = entry.SystemAddress ?? currentAddress;
      if (norm(currentSystem) === norm(targetSystem)) targetAddress = currentAddress;
    }
    if (entry.event === 'Undocked') currentStation = '';

    const inTarget = norm(currentSystem) === norm(targetSystem);
    if (diagnosticMode && !DIAGNOSTIC_NOISE_EVENTS.has(entry.event)) diagnostics.push(diagnosticEvent(entry, currentSystem, currentStation));
    if (entry.event === 'MissionCompleted') {
      const effects = [];
      for (const effect of Array.isArray(entry.FactionEffects) ? entry.FactionEffects : []) {
        for (const inf of Array.isArray(effect?.Influence) ? effect.Influence : []) {
          const address = inf?.SystemAddress ?? null;
          const matches = inTarget || (targetAddress !== null && String(address) === String(targetAddress));
          if (!matches) continue;
          const influence = cleanText(inf?.Influence, '', 16);
          effects.push({
            faction:cleanText(effect?.Faction, '', 120),
            systemAddress:address,
            influence,
            infUnits:(influence.match(/\+/g)||[]).length,
          });
        }
      }
      if (effects.length) relevant.push(baseEvent(entry,currentSystem,currentAddress,currentStation,{type:'mission_inf',missionId:entry.MissionID ?? null,effects}));
      continue;
    }

    if (!inTarget) continue;
    if (entry.event === 'RedeemVoucher' && ['Bounty','CombatBond'].includes(entry.Type)) {
      relevant.push(baseEvent(entry,currentSystem,currentAddress,currentStation,{
        type:entry.Type === 'CombatBond' ? 'combat_bonds_redeemed' : 'bounties_redeemed',
        amount:Number(entry.Amount)||0,
        faction:cleanText(entry.Faction, '', 120),
        factions:Array.isArray(entry.Factions) ? entry.Factions.slice(0,20) : [],
      }));
    } else if (entry.event === 'FactionKillBond') {
      relevant.push(baseEvent(entry,currentSystem,currentAddress,currentStation,{
        type:'cz_bond_awarded',
        amount:Number(entry.Reward)||0,
        awardingFaction:cleanText(entry.AwardingFaction, '', 120),
        victimFaction:cleanText(entry.VictimFaction, '', 120),
      }));
    } else if (entry.event === 'MarketSell') {
      relevant.push(baseEvent(entry,currentSystem,currentAddress,currentStation,{
        type:'market_sell',
        commodity:cleanText(entry.Type_Localised || entry.Type, '', 100),
        count:Number(entry.Count)||0,
        sellPrice:Number(entry.SellPrice)||0,
        total:Number(entry.TotalSale)||0,
      }));
    } else if (['SellExplorationData','MultiSellExplorationData'].includes(entry.event)) {
      relevant.push(baseEvent(entry,currentSystem,currentAddress,currentStation,{
        type:'exploration_sale',
        amount:Number(entry.TotalEarnings ?? entry.TotalEarningsWithBonus ?? entry.BaseValue)||0,
      }));
    }
  }
  return {events:relevant,diagnostics,lastEventAt,lastSystem:currentSystem,targetAddress};
}

export async function mergeEvents(env, userId, events) {
  const key = EVENTS_PREFIX + userId;
  const previous = await env.DAILY_ORDERS.get(key, {type:'json'});
  const existing = Array.isArray(previous?.events) ? previous.events : [];
  const byId = new Map(existing.map(item=>[item.id,item]));
  for (const event of events) {
    event.id = await eventId(event);
    byId.set(event.id,event);
  }
  const merged = [...byId.values()].sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp))).slice(-1000);
  await env.DAILY_ORDERS.put(key, JSON.stringify({version:1,events:merged}));
  return merged;
}

export async function getEvents(env, userId) {
  const stored = await env.DAILY_ORDERS.get(EVENTS_PREFIX + userId, {type:'json'});
  return Array.isArray(stored?.events) ? stored.events : [];
}

export function summarizeEvents(events) {
  const summary = {missionInf:0,bounties:0,combatBondsRedeemed:0,czBondAwards:0,tradeTonnage:0,tradeSales:0,explorationSales:0};
  for (const event of events) {
    if (event.type === 'mission_inf') summary.missionInf += (event.effects||[]).reduce((n,x)=>n+(Number(x.infUnits)||0),0);
    if (event.type === 'bounties_redeemed') summary.bounties += Number(event.amount)||0;
    if (event.type === 'combat_bonds_redeemed') summary.combatBondsRedeemed += Number(event.amount)||0;
    if (event.type === 'cz_bond_awarded') summary.czBondAwards += Number(event.amount)||0;
    if (event.type === 'market_sell') { summary.tradeTonnage += Number(event.count)||0; summary.tradeSales += Number(event.total)||0; }
    if (event.type === 'exploration_sale') summary.explorationSales += Number(event.amount)||0;
  }
  return summary;
}

function diagnosticEvent(entry, system, station) {
  const out = {
    timestamp:cleanText(entry.timestamp, '', 40),
    event:cleanText(entry.event, '', 80),
    system:cleanText(system, '', 140),
    station:cleanText(station, '', 140),
    keys:Object.keys(entry).filter(key=>!['timestamp','event'].includes(key)).slice(0,24),
  };
  const safeKeys = [
    'Faction','FactionName','AwardingFaction','VictimFaction','Result','Status','Success',
    'Message','Message_Localised','From','From_Localised','Channel','MusicTrack','Reward',
    'Amount','Influence','Reputation','MissionID','War','Conflict','Combat'
  ];
  for (const key of safeKeys) {
    if (entry[key] === undefined || entry[key] === null) continue;
    const value = entry[key];
    if (typeof value === 'string') out[key] = value.slice(0,300);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  return out;
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
  const encoded = new TextEncoder().encode(JSON.stringify(event));
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
