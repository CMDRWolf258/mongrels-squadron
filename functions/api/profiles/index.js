import { json, readSession } from '../../../lib/auth.js';
import {
  MONGREL_PURSUITS,
  normalizePursuitIds,
  pursuitIdsFromLabels,
  pursuitLabels,
  readPursuitsState,
} from '../../../lib/mongrel-pursuits.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);
const MANAGER_ACCESS = new Set(['officer','site_admin']);
const PROFILE_KEY = 'profiles-v1';
const DEFAULT_SPECIALTIES = ['BGS','Combat','PvP','AX','Mining','Exploration','Exobiology','Trade','Colonization','Carriers','Engineering','Powerplay','Surface Warfare','Logistics','Ship Building','Faction Relations'];
const DEFAULT_ACTIVITIES = MONGREL_PURSUITS.map(item=>item.label);
const AVAILABILITY_STATUSES = ['none','Available to Help','Looking for Group','Busy','Away'];

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const profiles = await readProfiles(env);
  const [contributions,pursuitsState] = await Promise.all([buildContributions(env),readPursuitsState(env)]);
  const canModerate = MANAGER_ACCESS.has(auth.session.access);
  const mineRaw = profiles.find(p => p.ownerId === auth.session.sub) || null;
  const activitiesFor = profile => {
    const stored=pursuitsState.members?.[profile.ownerId];
    const ids=stored?normalizePursuitIds(stored.pursuits):pursuitIdsFromLabels(profile.activities||[]);
    return pursuitLabels(ids);
  };
  const visible = profiles
    .filter(p => p.directoryVisible || p.ownerId === auth.session.sub || canModerate)
    .map(p => present(p, auth.session, contributions.get(p.ownerId),activitiesFor(p)))
    .sort(profileSort);
  return reply({ok:true,viewer:viewer(auth.session),canModerate,specialties:DEFAULT_SPECIALTIES,activities:DEFAULT_ACTIVITIES,availabilityStatuses:AVAILABILITY_STATUSES,mine:mineRaw?present(mineRaw,auth.session,contributions.get(mineRaw.ownerId),activitiesFor(mineRaw)):null,profiles:visible});
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const profiles = await readProfiles(env);
  if (profiles.some(p => p.ownerId === auth.session.sub)) return reply({ok:false,error:'profile_already_exists'},409);
  const now = new Date().toISOString();
  const defaults = auth.session.access === 'site_admin' ? {squadRank:'Admiral',leadershipRole:'Commanding Officer'} : {squadRank:'Pilot',leadershipRole:''};
  const item = normalizeProfile(body.value,{id:crypto.randomUUID(),ownerId:auth.session.sub,ownerName:auth.session.displayName,createdAt:now,updatedAt:now,updatedBy:auth.session.displayName},auth.session,defaults);
  const pursuitsState=await readPursuitsState(env);
  const stored=pursuitsState.members?.[auth.session.sub];
  item.activities=stored
    ?pursuitLabels(normalizePursuitIds(stored.pursuits))
    :pursuitLabels(pursuitIdsFromLabels(item.activities||[]));
  profiles.push(item); await writeProfiles(env,profiles);
  const contributions = await buildContributions(env);
  return reply({ok:true,profile:present(item,auth.session,contributions.get(item.ownerId))},201);
}

export async function onRequestPut({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const id = clean(body.value?.id,'',100); if(!id) return reply({ok:false,error:'profile_id_required'},400);
  const profiles = await readProfiles(env); const idx = profiles.findIndex(p=>p.id===id);
  if(idx<0) return reply({ok:false,error:'profile_not_found'},404);
  const existing=profiles[idx]; const manager=MANAGER_ACCESS.has(auth.session.access);
  if(!manager && existing.ownerId!==auth.session.sub) return reply({ok:false,error:'not_profile_owner'},403);
  profiles[idx]=normalizeProfile(body.value,{id:existing.id,ownerId:existing.ownerId,ownerName:existing.ownerName,createdAt:existing.createdAt,updatedAt:new Date().toISOString(),updatedBy:auth.session.displayName},auth.session,existing);
  // Mongrel Pursuits is the authoritative editor for member activities.
  const pursuitsState=await readPursuitsState(env);
  const stored=pursuitsState.members?.[existing.ownerId];
  profiles[idx].activities=stored
    ?pursuitLabels(normalizePursuitIds(stored.pursuits))
    :pursuitLabels(pursuitIdsFromLabels(existing.activities||[]));
  await writeProfiles(env,profiles);
  const contributions = await buildContributions(env);
  return reply({ok:true,profile:present(profiles[idx],auth.session,contributions.get(existing.ownerId))});
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const id = new URL(request.url).searchParams.get('id') || '';
  const profiles = await readProfiles(env); const idx=profiles.findIndex(p=>p.id===id);
  if(idx<0) return reply({ok:false,error:'profile_not_found'},404);
  const existing=profiles[idx]; const manager=MANAGER_ACCESS.has(auth.session.access);
  if(!manager && existing.ownerId!==auth.session.sub) return reply({ok:false,error:'not_profile_owner'},403);
  profiles.splice(idx,1); await writeProfiles(env,profiles); return reply({ok:true});
}

function normalizeProfile(value,fixed,session,existing={}) {
  const src=value&&typeof value==='object'?value:{};
  const manager=MANAGER_ACCESS.has(session.access);
  const squadRank=manager ? clean(src.squadRank,existing.squadRank||'Pilot',60) : clean(existing.squadRank,'Pilot',60);
  const leadershipRole=manager ? clean(src.leadershipRole,existing.leadershipRole||'',100) : clean(existing.leadershipRole,'',100);
  return {id:fixed.id,ownerId:fixed.ownerId,ownerName:fixed.ownerName,commanderName:clean(src.commanderName,existing.commanderName||fixed.ownerName,80),squadRank,leadershipRole,tagline:clean(src.tagline,existing.tagline||'',140),bio:clean(src.bio,existing.bio||'',1800),homeSystem:clean(src.homeSystem,existing.homeSystem||'',120),availabilityStatus:allowedValue(src.availabilityStatus,AVAILABILITY_STATUSES,existing.availabilityStatus||'none'),availability:clean(src.availability,existing.availability||'',300),specialties:normalizeAllowedList(src.specialties,existing.specialties||[],DEFAULT_SPECIALTIES,12),activities:normalizeAllowedList(src.activities,existing.activities||[],DEFAULT_ACTIVITIES,12),carrierCallsign:clean(src.carrierCallsign,existing.carrierCallsign||'',20).toUpperCase(),featuredShips:normalizeShips(src.featuredShips,existing.featuredShips||[]),directoryVisible:booleanValue(src.directoryVisible,existing.directoryVisible ?? true),showDiscord:booleanValue(src.showDiscord,existing.showDiscord ?? true),showBio:booleanValue(src.showBio,existing.showBio ?? true),showCarrier:booleanValue(src.showCarrier,existing.showCarrier ?? true),showShips:booleanValue(src.showShips,existing.showShips ?? true),createdAt:fixed.createdAt,updatedAt:fixed.updatedAt,updatedBy:fixed.updatedBy};
}

function normalizeShips(value,fallback){const list=Array.isArray(value)?value:fallback; return list.slice(0,6).map(item=>({name:clean(item?.name,'',80),type:clean(item?.type,'',80),role:clean(item?.role,'',80),edsy:cleanUrl(item?.edsy)})).filter(x=>x.name||x.type);}
function present(item,session,contribution={},activitiesOverride=null){const mine=item.ownerId===session.sub; const canEdit=mine||MANAGER_ACCESS.has(session.access); const profile={id:item.id,commanderName:item.commanderName,squadRank:item.squadRank,leadershipRole:item.leadershipRole,tagline:item.tagline,homeSystem:item.homeSystem,specialties:item.specialties,activities:Array.isArray(activitiesOverride)?activitiesOverride:item.activities,availabilityStatus:item.availabilityStatus||'none',availability:item.availability,directoryVisible:item.directoryVisible,updatedAt:item.updatedAt,canEdit,isMine:mine,privacy:{showDiscord:item.showDiscord,showBio:item.showBio,showCarrier:item.showCarrier,showShips:item.showShips},contributions:contribution?.summary||{projects:0,trades:0,bounties:0,carriers:0}}; if(item.showDiscord||mine||canEdit)profile.discordName=item.ownerName; if(item.showBio||mine||canEdit)profile.bio=item.bio; if(item.showCarrier||mine||canEdit){profile.carrierCallsign=item.carrierCallsign;profile.registeredCarriers=contribution?.carriers||[];} if(item.showShips||mine||canEdit)profile.featuredShips=item.featuredShips; return profile;}
async function buildContributions(env){const [projects,trades,bounties,carriers]=await Promise.all([readKv(env.PROJECTS,'board-v1',[]),readKv(env.TRADES,'trade-board-v1',[]),readKv(env.BOUNTIES,'board-v1',[]),readKv(env.CARRIERS,'registry-v1',[])]); const map=new Map(); const get=id=>{if(!map.has(id))map.set(id,{summary:{projects:0,trades:0,bounties:0,carriers:0},carriers:[]}); return map.get(id);}; for(const x of projects)if(x?.ownerId)get(x.ownerId).summary.projects++; for(const x of trades)if(x?.ownerId)get(x.ownerId).summary.trades++; for(const x of bounties)if(x?.ownerId)get(x.ownerId).summary.bounties++; for(const x of carriers)if(x?.ownerId){const v=get(x.ownerId);v.summary.carriers++;v.carriers.push({name:x.name||'Fleet Carrier',callsign:x.callsign||'',role:x.role||'',currentSystem:x.currentSystem||''});} return map;}
async function readProfiles(env){if(!env.PROJECTS||typeof env.PROJECTS.get!=='function')return[]; const v=await env.PROJECTS.get(PROFILE_KEY,{type:'json'}); return Array.isArray(v)?v:[];}
async function writeProfiles(env,items){await env.PROJECTS.put(PROFILE_KEY,JSON.stringify(items.slice(0,500)));}
async function readKv(binding,key,fallback){try{if(!binding||typeof binding.get!=='function')return fallback; const v=await binding.get(key,{type:'json'}); return v??fallback;}catch{return fallback;}}
function requireStorage(env){return(!env.PROJECTS||typeof env.PROJECTS.put!=='function')?reply({ok:false,error:'profile_storage_not_configured'},503):null;}
async function requireMember(request,env){const session=await readSession(request,env);if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};if(!ALLOWED_ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};return{session};}
function validateSameOrigin(request){const origin=request.headers.get('Origin');const expected=new URL(request.url).origin;const marker=request.headers.get('X-Mongrels-Request');if(origin!==expected||marker!=='profile-editor')return reply({ok:false,error:'request_validation_failed'},403);return null;}
async function readBody(request){try{return{value:await request.json()};}catch{return{response:reply({ok:false,error:'invalid_json'},400)};}}
function viewer(s){return{displayName:s.displayName,access:s.access};}
function profileSort(a,b){const leadership=x=>x.leadershipRole?0:1;return leadership(a)-leadership(b)||String(a.squadRank).localeCompare(String(b.squadRank))||String(a.commanderName).localeCompare(String(b.commanderName));}
function normalizeList(value,fallback,maxItems,maxLen){const list=Array.isArray(value)?value:fallback;return[...new Set(list.map(x=>clean(x,'',maxLen)).filter(Boolean))].slice(0,maxItems);}
function normalizeAllowedList(value,fallback,allowed,maxItems){const list=Array.isArray(value)?value:fallback;const allowedSet=new Set(allowed);return[...new Set(list.map(x=>clean(x,'',60)).filter(x=>allowedSet.has(x)))].slice(0,maxItems);}
function allowedValue(value,allowed,fallback){return allowed.includes(value)?value:fallback;}
function booleanValue(value,fallback){return typeof value==='boolean'?value:fallback;}
function cleanUrl(v){const s=clean(v,'',300);if(!s)return'';try{const u=new URL(s);return u.protocol==='https:'?u.toString():'';}catch{return'';}}
function clean(v,fallback,max){if(typeof v!=='string')return fallback;const x=v.trim();return x?x.slice(0,max):fallback;}
function headers(){return{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
