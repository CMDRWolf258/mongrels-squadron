import { json, readSession } from './auth.js';

const DIALOGUE_KEY='carrier-dialogue-v1';
export const SHARED_DIALOGUE_PROFILE_ID='shared:squad';
const SHARED_STARTER_SEED_VERSION=1;

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
  const sharedProfile=Object.prototype.hasOwnProperty.call(src,'sharedProfile')
    ? normalizeProfile(src.sharedProfile,SHARED_DIALOGUE_PROFILE_ID)
    : sharedStarterProfile();
  return{
    version:2,
    sharedProfile,
    profiles,
    updatedAt:clean(src.updatedAt,60)||null,
    updatedBy:clean(src.updatedBy,100),
  };
}

// Voice and cue preferences published by the carrier owner. These are
// portable voice IDs; visitors use them only when the voice exists locally.
// This is stored with the existing carrier dialogue profile, with no new KV key.
export const CARRIER_PA_CUES=Object.freeze([
  'docking.requested','docking.granted','docking.docked','docking.undocked',
  'carrier.jump_request','carrier.countdown_10','carrier.countdown_5',
  'carrier.jump_cancelled','carrier.jump','carrier.cooldown_ready',
]);
export const PORTABLE_CARRIER_VOICES=Object.freeze([
  'af_alloy','af_aoede','af_bella','af_heart','af_jessica','af_kore','af_nicole',
  'af_nova','af_river','af_sarah','af_sky','am_adam','am_echo','am_eric',
  'am_fenrir','am_liam','am_michael','am_onyx','am_puck','am_santa',
  'bf_alice','bf_emma','bf_isabella','bf_lily','bm_daniel','bm_fable',
  'bm_george','bm_lewis',
]);
function portableVoice(value){
  const candidate=value&&typeof value==='object'?value:{};
  const requested=clean(candidate.voiceId,64);
  const supported=PORTABLE_CARRIER_VOICES.includes(requested);
  return{
    voiceProvider:supported&&candidate.voiceProvider==='kokoro'?'kokoro':'system',
    voiceId:supported&&candidate.voiceProvider==='kokoro'?requested:'',
    voiceName:'',
  };
}
export function normalizePublishedVoiceProfile(value){
  const raw=value&&typeof value==='object'?value:{};
  const roles=raw.roles&&typeof raw.roles==='object'?raw.roles:{};
  const slots=Array.isArray(raw.concourseVoices)?raw.concourseVoices:[];
  const cues=raw.cues&&typeof raw.cues==='object'?raw.cues:{};
  const normalizedCues={};
  for(const cue of CARRIER_PA_CUES){
    const row=cues[cue];
    if(!row||typeof row!=='object')continue;
    const min=Math.max(0,Math.min(60,Number.isFinite(Number(row.minDelay))?Number(row.minDelay):0));
    const max=Math.max(min,Math.min(60,Number.isFinite(Number(row.maxDelay))?Number(row.maxDelay):min));
    normalizedCues[cue]={
      enabled:row.enabled!==false,
      minDelay:min,
      maxDelay:max,
      cooldown:Math.max(0,Math.min(300,Number(row.cooldown)||0)),
    };
    if(cue==='carrier.cooldown_ready'){
      normalizedCues[cue].offsetSeconds=Math.max(0,Math.min(900,Number(row.offsetSeconds)||180));
    }
  }
  return{
    roles:{
      announcement:portableVoice(roles.announcement),
      atc:portableVoice(roles.atc),
    },
    concourseVoices:Array.from({length:4},(_,i)=>({
      ...portableVoice(slots[i]),
      enabled:slots[i]?.enabled!==false&&(i===0||slots[i]?.enabled===true),
    })),
    cues:normalizedCues,
  };
}

export function normalizeProfile(value,carrierId=''){
  const src=value&&typeof value==='object'?value:{};
  const lines=(Array.isArray(src.lines)?src.lines:[]).slice(0,1500).map(normalizeLine).filter(Boolean);
  const settings=src.settings&&typeof src.settings==='object'?src.settings:{};
  return{
    carrierId:clean(src.carrierId||carrierId,100),
    starterSeedVersion:Number.isFinite(Number(src.starterSeedVersion))?Math.max(0,Math.min(99,Math.trunc(Number(src.starterSeedVersion)))):0,
    settings:{
      sharedEnabled:settings.sharedEnabled!==false,
      ambientEnabled:settings.ambientEnabled!==false,
      hangarMinSeconds:clamp(settings.hangarMinSeconds,45,1800,120),
      hangarMaxSeconds:clamp(settings.hangarMaxSeconds,45,2400,240),
      concourseMinSeconds:clamp(settings.concourseMinSeconds,45,1800,90),
      concourseMaxSeconds:clamp(settings.concourseMaxSeconds,45,2400,210),
      voiceProfile:normalizePublishedVoiceProfile(settings.voiceProfile),
    },
    voicePreferences:normalizeVoicePreferences(src.voicePreferences),
    lines,
  };
}

// Published by a carrier's owner: provider/voice IDs are preferences, not
// downloadable voice files. Missing local voices fall back safely on the HUD.
const PUBLISHED_VOICE_CUES=new Set([
  'docking.requested','docking.granted','docking.docked','docking.undocked',
  'carrier.jump_request','carrier.countdown_10','carrier.countdown_5',
  'carrier.jump_cancelled','carrier.jump','carrier.cooldown_ready',
]);
export function normalizeVoicePreferences(value){
  const source=value&&typeof value==='object'?value:{};
  const roles={};
  const rawRoles=source.roles&&typeof source.roles==='object'?source.roles:{};
  for(const role of ['announcement','atc']){
    const row=rawRoles[role];
    if(!row||typeof row!=='object')continue;
    const provider=clean(row.voiceProvider,16).toLowerCase();
    if(!['system','winrt','kokoro'].includes(provider))continue;
    roles[role]={voiceProvider:provider,voiceId:clean(row.voiceId,300),voiceName:clean(row.voiceName,120)};
  }
  const cues={};
  const rawCues=source.cues&&typeof source.cues==='object'?source.cues:{};
  for(const [cue,row] of Object.entries(rawCues)){
    if(!PUBLISHED_VOICE_CUES.has(cue)||!row||typeof row!=='object')continue;
    const number=(key,maximum)=>{
      const n=Number(row[key]);
      return row[key]!==undefined&&row[key]!==null&&Number.isFinite(n)?Math.max(0,Math.min(maximum,n)):undefined;
    };
    const timing={};
    if(typeof row.enabled==='boolean')timing.enabled=row.enabled;
    for(const [field,max] of [['minDelay',60],['maxDelay',60],['cooldown',300],['offsetSeconds',900]]){
      const n=number(field,max);if(n!==undefined)timing[field]=n;
    }
    if(timing.minDelay!==undefined&&timing.maxDelay!==undefined&&timing.maxDelay<timing.minDelay)timing.maxDelay=timing.minDelay;
    if(Object.keys(timing).length)cues[cue]=timing;
  }
  const concourseVoices=(Array.isArray(source.concourseVoices)?source.concourseVoices:[]).slice(0,4).map(row=>{
    if(!row||typeof row!=='object')return null;
    const provider=clean(row.voiceProvider,16).toLowerCase();
    if(!['system','winrt','kokoro'].includes(provider))return null;
    return {voiceProvider:provider,voiceId:clean(row.voiceId,300),voiceName:clean(row.voiceName,120),enabled:row.enabled!==false};
  }).filter(Boolean);
  return{roles,cues,concourseVoices};
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
    starterSeedVersion:normalized.starterSeedVersion,
    settings:normalized.settings,
    voicePreferences:normalized.voicePreferences,
    lines:normalized.lines.map(line=>({...line,weight:rarityWeight(line.rarity)})),
  };
}

export function effectiveDialogueProfile(library,profile){
  const normalizedLibrary=normalizeLibrary(library);
  const privateProfile=normalizeProfile(profile,profile?.carrierId||'');
  if(privateProfile.settings.sharedEnabled===false){
    return publicDialogueProfile(privateProfile);
  }
  const privateLines=privateProfile.lines;
  const privateKeys=new Set(privateLines.map(dialogueOverrideKey).filter(Boolean));
  const sharedLines=normalizedLibrary.sharedProfile.lines.filter(line=>{
    const key=dialogueOverrideKey(line);
    return !key||!privateKeys.has(key);
  });
  return publicDialogueProfile({...privateProfile,lines:[...sharedLines,...privateLines]});
}

export function publicSharedDialogueProfile(library){
  const normalized=normalizeLibrary(library);
  return publicDialogueProfile(normalized.sharedProfile);
}

export function sharedStarterProfile(){
  const rows=[];
  const add=(slug,category,audience,text,rarity='common')=>rows.push({
    id:`shared:starter:${slug}`,category,audience,rarity,enabled:true,text
  });

  add('dock-request-traffic','docking.requested','all','Docking request received. Traffic control is checking the pattern now.');
  add('dock-request-transponder','docking.requested','all','Transponder received. Stand by for an assigned pad.','uncommon');
  add('dock-request-busy','docking.requested','all','Docking request logged. Please hold position while the flight deck finds somewhere sensible to put you.','rare');
  add('dock-granted-standard','docking.granted','all','Clearance granted. Proceed to {pad}.');
  add('dock-granted-path','docking.granted','all','Approach corridor is clear. Continue to {pad}.','uncommon');
  add('dock-granted-wings','docking.granted','all','{pad} is ready. Try to arrive with the same number of wings you started with.','rare');
  add('docked-secure','docking.docked','all','Docking complete. Ship secured aboard {carrier}.');
  add('docked-services','docking.docked','all','Welcome aboard {carrier}. Carrier services are available when you are ready.','uncommon');
  add('docked-emotional-damage','docking.docked','all','Docking complete. The landing pad reports only minor emotional damage.','rare');
  add('undocked-clear','docking.undocked','all','Departure confirmed. You are clear of {carrier}.');
  add('undocked-return','docking.undocked','all','Launch corridor clear. Safe flying, Commander.','uncommon');
  add('undocked-story','docking.undocked','all','You are clear of {carrier}. Return with cargo, credits, or at least a good story.','rare');
  add('jump-request-course','carrier.jump_request','all','Course plotted for {destination}. Carrier jump preparations are underway.');
  add('jump-request-secure','carrier.jump_request','all','{destination} is locked in. Secure loose equipment before departure.','uncommon');
  add('jump-request-drinks','carrier.jump_request','all','Jump sequence started for {destination}. Loose objects, drinks, and optimistic navigation estimates should now be secured.','rare');
  add('countdown-ten-standard','carrier.countdown_10','all','Ten minutes to carrier jump. Final boarding and departure preparations are in progress.');
  add('countdown-ten-services','carrier.countdown_10','all','Ten minutes to jump. Complete carrier services and return to your ship when ready.','uncommon');
  add('countdown-ten-memory','carrier.countdown_10','all','Ten minutes to jump. This is an excellent time to remember anything you meant to do before leaving.','rare');
  add('countdown-five-standard','carrier.countdown_5','all','Five minutes to carrier jump. All personnel should prepare for transit.');
  add('countdown-five-final','carrier.countdown_5','all','Five minutes remaining. Flight operations are entering final jump configuration.','uncommon');
  add('countdown-five-decision','carrier.countdown_5','all','Five minutes to jump. If you are still deciding whether to board, the carrier has nearly decided for you.','rare');
  add('jump-cancelled-standard','carrier.jump_cancelled','all','Carrier jump cancelled. Normal operations may resume.');
  add('jump-cancelled-course','carrier.jump_cancelled','all','Jump sequence cancelled. Navigation has released the plotted destination.','uncommon');
  add('jump-cancelled-universe','carrier.jump_cancelled','all','Jump cancelled. The universe will remain where it is for the moment.','rare');
  add('jump-arrival-standard','carrier.jump','all','Jump complete. {carrier} has arrived in {destination}.');
  add('jump-arrival-station','carrier.jump','all','Transit complete. Carrier is on station in {destination}.','uncommon');
  add('jump-arrival-navigation','carrier.jump','all','Jump complete. {destination} appears to be exactly where navigation promised.','rare');
  add('cooldown-standard','carrier.cooldown_ready','all','Carrier frame shift cooldown complete. Jump systems are available.');
  add('cooldown-ready','carrier.cooldown_ready','all','Frame shift systems have recycled. {carrier} is ready for another jump.','uncommon');
  add('cooldown-coffee','carrier.cooldown_ready','all','Jump cooldown complete. The frame shift drive is ready; the coffee may not be.','rare');

  add('hangar-launch-lanes','ambient.hangar','all','Hangar control reminds all pilots to keep active launch lanes clear.');
  add('hangar-ground-crew','ambient.hangar','all','Ground crews are operating across the flight deck. Watch for service vehicles and moving equipment.');
  add('hangar-maintenance','ambient.hangar','all','Maintenance teams are available for repair, refuel, and rearm support.');
  add('hangar-gear','ambient.hangar','all','Flight deck reminder: landing gear is not considered an optional module, regardless of previous successful experiments.','rare');
  add('hangar-boost','ambient.hangar','all','Boost testing inside the hangar remains strongly discouraged by everyone responsible for repainting the walls.','rare');
  add('hangar-limpets','ambient.hangar','all','Unattended limpets may be collected, renamed, and reassigned to cargo duty.','rare');
  add('hangar-noise','ambient.hangar','all','If your ship is making a noise you have never heard before, maintenance would prefer to know before departure.','uncommon');
  add('hangar-clearance','ambient.hangar','all','Pilots preparing to launch should confirm ammunition, fuel, limpets, and the vague location of their destination.','uncommon');

  add('concourse-welcome','ambient.concourse','all','Welcome aboard {carrier}. Concourse services are open for arriving and departing Commanders.');
  add('concourse-services','ambient.concourse','all','Carrier services, crew facilities, and the concourse bar remain available throughout normal operations.');
  add('concourse-departures','ambient.concourse','all','Passengers and flight crews should monitor local traffic notices before returning to the hangar.');
  add('concourse-hydrate','ambient.concourse','all','Concourse reminder: hydrate, rearm, and continue insisting the last interdiction went exactly as planned.','rare');
  add('concourse-lost-found','ambient.concourse','all','Lost and found currently contains one flight-suit glove, several limpets, and somebody\'s dignity.','rare');
  add('concourse-rumors','ambient.concourse','all','The concourse is open. The rumors are free. Accuracy is not guaranteed.','rare');
  add('concourse-security','ambient.concourse','all','Please report unattended cargo, suspicious activity, and unusually confident Sidewinder pilots to carrier security.','rare');
  add('concourse-bar','ambient.concourse','all','The bar accepts credits. Excuses remain subject to local approval.','uncommon');
  add('concourse-rest','ambient.concourse','all','Long-range pilots are reminded that actual rest remains more effective than staring at the galaxy map for another hour.','uncommon');
  add('concourse-flight-suit','ambient.concourse','all','For your safety, magnetic boots and flight suits should be worn where posted. Swagger remains optional.','rare');

  add('bulletin-check-orders','bulletin.concourse','all','Operations bulletin: review current assignments and destination details before departure.');
  add('bulletin-maintenance','bulletin.concourse','all','Maintenance bulletin: if you broke it, tell someone. If you fixed it, definitely tell someone.','rare');
  add('bulletin-cargo','bulletin.concourse','all','Cargo crews are reminded to verify commodity, destination, and tonnage before loading.');
  add('bulletin-coordination','bulletin.concourse','all','Flight crews conducting group operations should confirm rendezvous points before launch.','uncommon');
  add('bulletin-heroics','bulletin.concourse','all','Operations reminder: uncoordinated heroics may still be heroic, but they are considerably harder to count.','rare');
  add('bulletin-route','bulletin.concourse','all','Navigation bulletin: check jump range after refuel, repair, cargo loading, or any other decision involving several hundred tonnes.','uncommon');

  add('advert-repairs','advertisement.concourse','all','Need repairs? Carrier technicians specialize in heat damage, hull damage, and damage caused by saying, watch this.','rare');
  add('advert-cargo','advertisement.concourse','all','Cargo moving slowly? Ask around the concourse. Somebody always owns a ship larger than they intended.','uncommon');
  add('advert-bar','advertisement.concourse','all','Off duty? The concourse bar offers drinks, rumors, and tactical advice of highly variable quality.','rare');
  add('advert-cartographics','advertisement.concourse','all','Returning from the black? Check available carrier services before hauling valuable exploration data somewhere less convenient.','uncommon');
  add('advert-outfitting','advertisement.concourse','all','Before departure, confirm your modules match the mission. Confidence is not a substitute for a fuel scoop.','rare');
  add('advert-crew','advertisement.concourse','all','Need another set of guns, cargo racks, or questionable ideas? Check with the Commanders already aboard.','uncommon');

  return normalizeProfile({
    carrierId:SHARED_DIALOGUE_PROFILE_ID,
    starterSeedVersion:SHARED_STARTER_SEED_VERSION,
    settings:{sharedEnabled:true,ambientEnabled:true,hangarMinSeconds:120,hangarMaxSeconds:240,concourseMinSeconds:90,concourseMaxSeconds:210},
    lines:rows,
  },SHARED_DIALOGUE_PROFILE_ID);
}

function dialogueOverrideKey(line){
  const id=clean(line?.id,100);
  const expansion=id.match(/^starter:expansion-2026-10:[^:]+:(.+)$/);
  if(expansion)return 'template:'+expansion[1];
  const shared=id.match(/^shared:starter:(.+)$/);
  if(shared)return 'template:'+shared[1];
  const category=clean(line?.category,40).toLowerCase();
  const audience=clean(line?.audience,20).toLowerCase();
  const text=clean(line?.text,700).replace(/\s+/g,' ').toLowerCase();
  return category&&audience&&text?`text:${category}|${audience}|${text}`:'';
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
