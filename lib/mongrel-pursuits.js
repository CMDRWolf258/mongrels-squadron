const STORAGE_KEY='mongrel-pursuits-v1';
const PROFILE_KEY='profiles-v1';

export const MONGREL_PURSUITS=[
  {id:'bgs',label:'BGS',emoji:'📊',group:'Squad & Strategic',description:'Background Simulation work, faction support, missions, trade and combat objectives.',aliases:['BGS Operations']},
  {id:'scouting',label:'Scouting & Recon',emoji:'📡',group:'Squad & Strategic',description:'System reconnaissance, Live Scout reporting and current operational intelligence.',aliases:['Recon','Scouting']},
  {id:'colonization',label:'Colonization',emoji:'🏗️',group:'Squad & Strategic',description:'Construction hauling, colony development and system-building projects.',aliases:['Colonization']},
  {id:'powerplay',label:'Powerplay',emoji:'♟️',group:'Squad & Strategic',description:'Powerplay objectives, coordinated support and strategic Power activity.',aliases:['Powerplay']},
  {id:'pve',label:'PvE / Bounty Hunting',emoji:'🎯',group:'Combat',description:'NPC combat, bounty hunting and general combat operations.',aliases:['Bounty Hunting','Combat']},
  {id:'combat-zones',label:'Conflict Zones',emoji:'⚔️',group:'Combat',description:'Conflict Zones, wars and sustained faction combat.',aliases:['Combat Zones','Conflict Zones','CZ']},
  {id:'ax',label:'Anti-Xeno',emoji:'☣️',group:'Combat',description:'Thargoid combat, AX operations and defensive response.',aliases:['AX','AX Combat']},
  {id:'pvp',label:'PvP',emoji:'🔥',group:'Combat',description:'Dueling, organized PvP, Open combat and player-versus-player training.',aliases:['PvP']},
  {id:'surface',label:'Surface Operations',emoji:'🪖',group:'Combat',description:'On-foot and planetary combat, settlements and mixed surface operations.',aliases:['Surface Operations','Surface Warfare']},
  {id:'trade',label:'Trade & Hauling',emoji:'🚛',group:'Industry & Logistics',description:'Trading, cargo hauling and strategic logistics.',aliases:['Trade','Logistics']},
  {id:'mining',label:'Mining',emoji:'⛏️',group:'Industry & Logistics',description:'Resource extraction, mining operations and material supply.',aliases:['Mining']},
  {id:'carriers',label:'Carrier Operations',emoji:'🛳️',group:'Industry & Logistics',description:'Fleet Carrier loading, staging, movement and logistics support.',aliases:['Carrier Logistics','Carriers']},
  {id:'engineering',label:'Engineering & Shipbuilding',emoji:'🛠️',group:'Industry & Logistics',description:'Engineering, ship builds, testing and fleet development.',aliases:['Engineering','Ship Building']},
  {id:'exploration',label:'Exploration',emoji:'🧭',group:'Discovery & Community',description:'Long-range travel, discovery, surveying and deep-space exploration.',aliases:['Exploration']},
  {id:'exobiology',label:'Exobiology',emoji:'🧬',group:'Discovery & Community',description:'Biological surveys, sampling and exobiology field work.',aliases:['Exobiology']},
  {id:'expeditions',label:'Expeditions & Community Events',emoji:'🌌',group:'Discovery & Community',description:'Squad expeditions, social events and organized community activities.',aliases:['Expeditions','Community Events']},
];

const BY_ID=new Map(MONGREL_PURSUITS.map(item=>[item.id,item]));
const BY_LABEL=new Map(MONGREL_PURSUITS.flatMap(item=>[item.label,...(item.aliases||[])].map(label=>[String(label).toLowerCase(),item.id])));

export function normalizePursuitIds(value){
  const list=Array.isArray(value)?value:[];
  return [...new Set(list.map(x=>String(x||'').trim()).filter(id=>BY_ID.has(id)))].slice(0,MONGREL_PURSUITS.length);
}

export function pursuitLabels(ids){
  return normalizePursuitIds(ids).map(id=>BY_ID.get(id)?.label).filter(Boolean);
}

export function pursuitIdsFromLabels(labels){
  const list=Array.isArray(labels)?labels:[];
  return [...new Set(list.map(x=>BY_LABEL.get(String(x||'').trim().toLowerCase())).filter(Boolean))];
}

export async function readPursuitsState(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return emptyState();
  try{
    const value=await env.PROJECTS.get(STORAGE_KEY,{type:'json'});
    if(!value||typeof value!=='object')return emptyState();
    const members=value.members&&typeof value.members==='object'?value.members:{};
    return {
      version:1,
      updatedAt:iso(value.updatedAt),
      members,
      discord:normalizeDiscord(value.discord),
    };
  }catch(error){
    console.error('Could not read Mongrel Pursuits state',error);
    return emptyState();
  }
}

export async function writePursuitsState(env,state){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')throw new Error('pursuits_storage_not_configured');
  await env.PROJECTS.put(STORAGE_KEY,JSON.stringify({
    version:1,
    updatedAt:state.updatedAt||new Date().toISOString(),
    members:state.members||{},
    discord:normalizeDiscord(state.discord),
  }));
}

export async function getMemberPursuitIds(env,ownerId,{profileFallback=true}={}){
  const id=String(ownerId||'').trim();
  if(!id)return[];
  const state=await readPursuitsState(env);
  const stored=state.members?.[id];
  if(stored)return normalizePursuitIds(stored.pursuits);
  if(!profileFallback)return[];
  const profile=await findProfile(env,id);
  return pursuitIdsFromLabels(profile?.activities||[]);
}

export async function setMemberPursuits(env,{ownerId,displayName='',pursuits=[],source='website'}={}){
  const id=String(ownerId||'').trim();
  if(!id)throw new Error('member_id_required');
  const state=await readPursuitsState(env);
  const now=new Date().toISOString();
  const selected=normalizePursuitIds(pursuits);
  state.members[id]={
    ownerId:id,
    displayName:clean(displayName).slice(0,120),
    pursuits:selected,
    source:source==='discord'?'discord':'website',
    updatedAt:now,
  };
  state.updatedAt=now;
  await writePursuitsState(env,state);
  await syncProfileActivities(env,id,selected);
  return {state,member:state.members[id]};
}

export async function syncProfileActivities(env,ownerId,pursuits){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function'||typeof env.PROJECTS.put!=='function')return false;
  const profiles=await env.PROJECTS.get(PROFILE_KEY,{type:'json'}).catch(()=>null);
  if(!Array.isArray(profiles))return false;
  const index=profiles.findIndex(profile=>profile?.ownerId===ownerId);
  if(index<0)return false;
  profiles[index]={...profiles[index],activities:pursuitLabels(pursuits),updatedAt:new Date().toISOString()};
  await env.PROJECTS.put(PROFILE_KEY,JSON.stringify(profiles.slice(0,500)));
  return true;
}

export async function seedProfileActivitiesFromPursuits(env,ownerId){
  return pursuitLabels(await getMemberPursuitIds(env,ownerId,{profileFallback:false}));
}

async function findProfile(env,ownerId){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return null;
  try{
    const profiles=await env.PROJECTS.get(PROFILE_KEY,{type:'json'});
    return Array.isArray(profiles)?profiles.find(profile=>profile?.ownerId===ownerId)||null:null;
  }catch{return null;}
}

function normalizeDiscord(value){
  const src=value&&typeof value==='object'?value:{};
  const roleIds=src.roleIds&&typeof src.roleIds==='object'?src.roleIds:{};
  return {
    messageId:clean(src.messageId).slice(0,40),
    channelId:clean(src.channelId).slice(0,40),
    roleIds:Object.fromEntries(Object.entries(roleIds).filter(([id,value])=>BY_ID.has(id)&&clean(value)).map(([id,value])=>[id,clean(value).slice(0,40)])),
    lastSyncedAt:iso(src.lastSyncedAt),
    lastError:clean(src.lastError).slice(0,500),
  };
}
function emptyState(){return{version:1,updatedAt:'',members:{},discord:normalizeDiscord({})}}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){if(!value)return'';const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():'';}
