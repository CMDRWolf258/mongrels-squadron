import { json, readSession } from './auth.js';

const DIALOGUE_KEY='carrier-dialogue-v1';

const CATEGORIES=new Set([
  'docking.requested','docking.granted','docking.docked','docking.undocked',
  'carrier.jump_request','carrier.countdown_10','carrier.countdown_5',
  'carrier.jump_cancelled','carrier.jump','carrier.cooldown_ready',
  'ambient.hangar','ambient.concourse','bulletin.concourse','advertisement.concourse',
]);
const AUDIENCES=new Set(['all','owner','squadmate','visitor']);
const RARITIES=new Set(['common','uncommon','rare']);

export async function readCarrierDialogue(env){
  if(!env?.CARRIERS||typeof env.CARRIERS.get!=='function')return {version:1,profiles:{},updatedAt:null,updatedBy:''};
  const stored=await env.CARRIERS.get(DIALOGUE_KEY,{type:'json'});
  return normalizeLibrary(stored);
}

export async function writeCarrierDialogue(env,value){
  const normalized=normalizeLibrary(value);
  await env.CARRIERS.put(DIALOGUE_KEY,JSON.stringify(normalized));
  return normalized;
}

export function normalizeLibrary(value){
  const src=value&&typeof value==='object'?value:{};
  const rawProfiles=src.profiles&&typeof src.profiles==='object'?src.profiles:{};
  const profiles={};
  for(const [carrierId,profile] of Object.entries(rawProfiles).slice(0,300)){
    const key=clean(carrierId,100);
    if(!key)continue;
    const normalized=normalizeProfile(profile,key);
    profiles[key]=normalized;
  }
  return{
    version:1,
    profiles,
    updatedAt:clean(src.updatedAt,60)||null,
    updatedBy:clean(src.updatedBy,100),
  };
}

export function normalizeProfile(value,carrierId=''){
  const src=value&&typeof value==='object'?value:{};
  const lines=(Array.isArray(src.lines)?src.lines:[]).slice(0,1500).map(normalizeLine).filter(Boolean);
  const settings=src.settings&&typeof src.settings==='object'?src.settings:{};
  return{
    carrierId:clean(src.carrierId||carrierId,100),
    settings:{
      ambientEnabled:settings.ambientEnabled!==false,
      hangarMinSeconds:clamp(settings.hangarMinSeconds,45,1800,120),
      hangarMaxSeconds:clamp(settings.hangarMaxSeconds,45,2400,240),
      concourseMinSeconds:clamp(settings.concourseMinSeconds,45,1800,90),
      concourseMaxSeconds:clamp(settings.concourseMaxSeconds,45,2400,210),
    },
    lines,
  };
}

export function normalizeLine(value){
  if(!value||typeof value!=='object')return null;
  const category=clean(value.category,40);
  const audience=clean(value.audience,20).toLowerCase();
  const rarity=clean(value.rarity,20).toLowerCase();
  const text=clean(value.text,700).replace(/\s+/g,' ');
  if(!CATEGORIES.has(category)||!AUDIENCES.has(audience)||!RARITIES.has(rarity)||!text)return null;
  return{
    id:clean(value.id,100)||crypto.randomUUID(),
    category,
    audience,
    rarity,
    enabled:value.enabled!==false,
    text,
  };
}

export function rarityWeight(value){
  return value==='common'?6:value==='uncommon'?3:1;
}

export function publicDialogueProfile(profile){
  const normalized=normalizeProfile(profile,profile?.carrierId||'');
  return{
    carrierId:normalized.carrierId,
    settings:normalized.settings,
    lines:normalized.lines.map(line=>({...line,weight:rarityWeight(line.rarity)})),
  };
}

export async function requireDialogueAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return {response:reply({ok:false,error:'authentication_required'},401),session:null};
  const adminId=String(env?.ADMIN_USER_ID||'');
  if(!adminId||String(session.sub||'')!==adminId)return {response:reply({ok:false,error:'site_admin_required'},403),session};
  return {response:null,session};
}

export function dialogueReply(body,status=200){
  return reply(body,status);
}

function clamp(value,min,max,fallback){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;
}
function clean(value,max=500){
  const text=typeof value==='string'?value.trim():String(value??'').trim();
  return text.slice(0,max);
}
function reply(body,status=200){
  return json(body,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'}});
}
