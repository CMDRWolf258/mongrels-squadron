const STORAGE_KEY='squad-structure-v1';

export const SQUAD_STRUCTURE_DEFINITIONS={
  command:[
    {id:'admiral',rank:'Admiral',role:'Commanding Officer',description:'Oversees squadron operations, sets strategic direction, and delegates objectives to the appropriate officers and departments.',primary:true},
    {id:'vice-admiral',rank:'Vice Admiral',role:'Executive Officer',description:'Second in command. Supports squadron leadership, recruitment, organization, and day-to-day coordination.',primary:false},
  ],
  captains:[
    {id:'anti-xeno',title:'Anti-Xeno',description:'Coordinates defensive and offensive Anti-Xeno operations and Mongrel responses to Thargoid threats.'},
    {id:'trade',title:'Trade',description:'Develops profitable and strategically useful trade operations, including squadron support and Powerplay objectives.'},
    {id:'administration',title:'Administration',description:'Supports squadron administration and organization, including management of community infrastructure.'},
    {id:'mining',title:'Mining',description:'Coordinates mining operations that support squadron members, faction objectives, and larger projects.'},
    {id:'exploration-recon',title:'Exploration / Recon',description:'Organizes expeditions and reconnaissance missions to gather current intelligence on systems and targets.'},
    {id:'powerplay',title:'Powerplay',description:'Manages Power-related objectives and coordinates with other operational commands to complete them.'},
    {id:'combat',title:'Combat',description:'Organizes conflict zones, bounty hunting, cargo escorts, and other conventional combat operations.'},
    {id:'surface-warfare',title:'Surface Warfare',description:'Coordinates ground conflicts, raids, surface engagements, and collaboration with Special Operations.'},
    {id:'faction-relations',title:'Faction Relations',description:'Manages faction objectives and coordinates with other Captains to support broader strategic goals.'},
    {id:'special-operations',title:'Special Operations',description:'Builds task-force wings for specialized missions ranging from PvP engagements to hit-and-run assaults.'},
  ],
  fieldLeadership:[
    {id:'lieutenant',rank:'Lieutenant',title:'Mission Supervisor',description:'Turns command-level objectives into organized missions and coordinates participating wings.'},
    {id:'second-lieutenant',rank:'Second Lieutenant',title:'Wing Supervisor',description:'Leads individual wings and carries out objectives assigned by senior officers.'},
  ],
  specialists:[
    {id:'master-chief',rank:'Master Chief',title:'Mentor / Special Operations',description:'Senior squadron mentor and trusted pilot for critical operations. Requires Senior Pilot qualifications.'},
    {id:'chief-specialist',rank:'Chief Specialist',title:'Top Mission Pilot',description:"Among the squadron's most reliable pilots within a chosen specialty and regularly called upon for assigned missions."},
    {id:'specialist-1',rank:'Specialist 1st Class',title:'Active Mission Pilot',description:"Highest-rated available pilot for tasks related to the member's specialties."},
    {id:'specialist-2',rank:'Specialist 2nd Class',title:'Line Mission Pilot',description:"Proven and dependable within the Commander's operational specialties."},
    {id:'specialist-3',rank:'Specialist 3rd Class',title:'Reserve Mission Pilot',description:'Volunteers for missions related to one or more chosen specialties.'},
  ],
  pilotRanks:[
    {id:'veteran',number:'05',rank:'Veteran Pilot',title:'Elite Pilot',description:'A top-rated, highly experienced Commander with a mature and extensively engineered fleet.',veteran:true},
    {id:'senior',number:'04',rank:'Senior Pilot',title:'Experienced Pilot',description:'An active, experienced squadron member with substantial engineering completed.'},
    {id:'pilot',number:'03',rank:'Pilot',title:'Squadron Pilot',description:'A proven Mongrel who has demonstrated reliability and developed a capable fleet.'},
    {id:'junior',number:'02',rank:'Junior Pilot',title:'Pilot in Training',description:'A developing Commander still building experience, engineering, or Pilot Federation rankings.'},
    {id:'recruit',number:'01',rank:'Recruit',title:'Restricted Member',description:'A new squadron member proving basic squad activity and credibility before promotion into the regular ranks.'},
  ],
};

export function defaultSquadStructureState(){
  return {
    version:1,
    command:{admiral:'CMDR Wolf258','vice-admiral':'CMDR D1scoT1ts'},
    captains:{
      'anti-xeno':'CMDR Lennyshow',
      trade:'CMDR LuckyNed8',
      administration:'CMDR TheSpartanBro',
      mining:'CMDR Nuraghi',
      'exploration-recon':'',
      powerplay:'',
      combat:'',
      'surface-warfare':'',
      'faction-relations':'',
      'special-operations':'',
    },
    fieldLeadership:{
      lieutenant:[{name:'CMDR TeslaBro',focus:'Elite lore and investigative missions'}],
      'second-lieutenant':[
        {name:'CMDR Beaverdaniel03',focus:'Combat / Special Operations'},
        {name:'CMDR Boogeyxxx',focus:'Trade / Combat'},
      ],
    },
    specialists:{
      'master-chief':{holder:'',focus:''},
      'chief-specialist':{holder:'',focus:''},
      'specialist-1':{holder:'CMDR Daisy Huck',focus:'Combat · Pilot Training · Various Missions'},
      'specialist-2':{holder:'CMDR MythicalReign227',focus:'Combat PvE · Trade'},
      'specialist-3':{holder:'CMDR SpaceTrucker007',focus:'Trade'},
    },
    rankCounts:{veteran:1,senior:2,pilot:15,junior:7,recruit:5},
    updatedAt:'',
    updatedBy:'',
    discordMessageId:'',
    discordChannelId:'',
    discordLastSyncedAt:'',
    discordLastError:'',
  };
}

export async function readSquadStructure(env,{fresh=false}={}){
  const fallback=defaultSquadStructureState();
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return fallback;
  try{
    const stored=fresh
      ?await env.PROJECTS.get(STORAGE_KEY,{type:'json'})
      :await env.PROJECTS.get(STORAGE_KEY,{type:'json',cacheTtl:30});
    return normalizeSquadStructureState(stored||fallback,fallback);
  }catch(error){
    console.error('Could not read Squad Structure',error);
    return fallback;
  }
}

export async function writeSquadStructure(env,state){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')throw new Error('squad_structure_storage_not_configured');
  const normalized=normalizeSquadStructureState(state,defaultSquadStructureState());
  await env.PROJECTS.put(STORAGE_KEY,JSON.stringify(normalized));
  return normalized;
}

export function normalizeSquadStructureUpdate(value,existing=defaultSquadStructureState()){
  const src=value&&typeof value==='object'?value:{};
  const next=normalizeSquadStructureState(existing,defaultSquadStructureState());

  for(const def of SQUAD_STRUCTURE_DEFINITIONS.command){
    if(src.command&&Object.hasOwn(src.command,def.id))next.command[def.id]=clean(src.command[def.id],100);
  }
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.captains){
    if(src.captains&&Object.hasOwn(src.captains,def.id))next.captains[def.id]=clean(src.captains[def.id],100);
  }
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.fieldLeadership){
    if(src.fieldLeadership&&Object.hasOwn(src.fieldLeadership,def.id))next.fieldLeadership[def.id]=normalizeAssignments(src.fieldLeadership[def.id]);
  }
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.specialists){
    if(src.specialists&&Object.hasOwn(src.specialists,def.id)){
      const raw=src.specialists[def.id]||{};
      next.specialists[def.id]={holder:clean(raw.holder,100),focus:clean(raw.focus,180)};
    }
  }
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.pilotRanks){
    if(src.rankCounts&&Object.hasOwn(src.rankCounts,def.id))next.rankCounts[def.id]=clampCount(src.rankCounts[def.id]);
  }
  return next;
}

export function squadStructureView(state){
  const safe=normalizeSquadStructureState(state,defaultSquadStructureState());
  return {
    command:SQUAD_STRUCTURE_DEFINITIONS.command.map(def=>({...def,holder:safe.command[def.id]||''})),
    captains:SQUAD_STRUCTURE_DEFINITIONS.captains.map(def=>({...def,holder:safe.captains[def.id]||''})),
    fieldLeadership:SQUAD_STRUCTURE_DEFINITIONS.fieldLeadership.map(def=>({...def,assignments:safe.fieldLeadership[def.id]||[]})),
    specialists:SQUAD_STRUCTURE_DEFINITIONS.specialists.map(def=>({...def,holder:safe.specialists[def.id]?.holder||'',focus:safe.specialists[def.id]?.focus||''})),
    pilotRanks:SQUAD_STRUCTURE_DEFINITIONS.pilotRanks.map(def=>({...def,count:safe.rankCounts[def.id]||0})),
    updatedAt:safe.updatedAt||'',
    updatedBy:safe.updatedBy||'',
  };
}

export function squadStructureDiscordStatus(state){
  const safe=normalizeSquadStructureState(state,defaultSquadStructureState());
  return {
    linked:Boolean(safe.discordMessageId&&safe.discordChannelId),
    lastSyncedAt:safe.discordLastSyncedAt||'',
    lastError:safe.discordLastError||'',
  };
}

function normalizeSquadStructureState(value,fallback){
  const src=value&&typeof value==='object'?value:{};
  const base=fallback&&typeof fallback==='object'?fallback:defaultSquadStructureState();
  const out={
    version:1,
    command:{},
    captains:{},
    fieldLeadership:{},
    specialists:{},
    rankCounts:{},
    updatedAt:iso(src.updatedAt)||iso(base.updatedAt),
    updatedBy:clean(src.updatedBy||base.updatedBy,100),
    discordMessageId:clean(src.discordMessageId||base.discordMessageId,40),
    discordChannelId:clean(src.discordChannelId||base.discordChannelId,40),
    discordLastSyncedAt:iso(src.discordLastSyncedAt)||iso(base.discordLastSyncedAt),
    discordLastError:clean(src.discordLastError||base.discordLastError,500),
  };

  for(const def of SQUAD_STRUCTURE_DEFINITIONS.command)out.command[def.id]=clean(src.command?.[def.id]??base.command?.[def.id],100);
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.captains)out.captains[def.id]=clean(src.captains?.[def.id]??base.captains?.[def.id],100);
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.fieldLeadership)out.fieldLeadership[def.id]=normalizeAssignments(src.fieldLeadership?.[def.id]??base.fieldLeadership?.[def.id]??[]);
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.specialists){
    const raw=src.specialists?.[def.id]??base.specialists?.[def.id]??{};
    out.specialists[def.id]={holder:clean(raw?.holder,100),focus:clean(raw?.focus,180)};
  }
  for(const def of SQUAD_STRUCTURE_DEFINITIONS.pilotRanks)out.rankCounts[def.id]=clampCount(src.rankCounts?.[def.id]??base.rankCounts?.[def.id]??0);
  return out;
}

function normalizeAssignments(value){
  const source=Array.isArray(value)?value:[];
  return source.slice(0,12).map(raw=>({name:clean(raw?.name,100),focus:clean(raw?.focus,180)})).filter(item=>item.name);
}

function clean(value,max=500){
  if(typeof value!=='string')value=String(value??'');
  return value.trim().slice(0,max);
}
function clampCount(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(999,Math.round(n))):0;
}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
