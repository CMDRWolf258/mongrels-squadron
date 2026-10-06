import { readCarrierDialogue, writeCarrierDialogue, normalizeLine, normalizeProfile, publicDialogueProfile, requireDialogueAdmin, dialogueReply } from '../../../lib/carrier-dialogue.js';

const REGISTRY_KEY='registry-v1';
const CANINE_CATALYST_ID='squad-carrier-r1mm';
const CANINE_CATALYST_CALLSIGN='R1MM';
const GENERIC_STARTER_SEED_VERSION=2;
const CANINE_STARTER_SEED_VERSION=3;
const EXPANSION_SEED_PREFIX='starter:expansion-2026-10:';

export async function onRequestGet({request,env}){
  const auth=await requireDialogueAdmin(request,env);
  if(auth.response)return auth.response;
  const url=new URL(request.url);
  const carrierId=clean(url.searchParams.get('carrierId'),100);
  const [library,carriers]=await Promise.all([readCarrierDialogue(env),readRegistry(env)]);
  let seeded=false;
  for(const carrier of carriers){
    const id=clean(carrier?.id,100);
    if(!id)continue;
    const existing=library.profiles[id];
    const targetSeed=starterSeedVersionFor(carrier);
    if(!existing){
      library.profiles[id]=starterProfile(carrier);
      seeded=true;
      continue;
    }
    if(Number(existing.starterSeedVersion||0)<targetSeed){
      library.profiles[id]=upgradeStarterProfile(existing,carrier);
      seeded=true;
    }
  }
  if(seeded){
    library.updatedAt=new Date().toISOString();
    library.updatedBy=auth.session.displayName||auth.session.username||'Site Admin';
    await writeCarrierDialogue(env,library);
  }
  if(carrierId){
    const carrier=carriers.find(item=>String(item?.id||'')===carrierId);
    if(!carrier)return dialogueReply({ok:false,error:'carrier_not_found'},404);
    return dialogueReply({ok:true,carrier:presentCarrier(carrier),profile:publicDialogueProfile(library.profiles[carrierId]||{carrierId})});
  }
  return dialogueReply({
    ok:true,
    carriers:carriers.map(presentCarrier),
    profiles:Object.fromEntries(Object.entries(library.profiles).map(([id,profile])=>[id,publicDialogueProfile(profile)])),
    updatedAt:library.updatedAt,
    updatedBy:library.updatedBy,
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireDialogueAdmin(request,env);
  if(auth.response)return auth.response;
  if(!sameOrigin(request))return dialogueReply({ok:false,error:'request_validation_failed'},403);
  let body;
  try{body=await request.json();}catch{return dialogueReply({ok:false,error:'invalid_json'},400);}
  const action=clean(body?.action,40).toLowerCase();
  const carrierId=clean(body?.carrierId,100);
  if(!carrierId)return dialogueReply({ok:false,error:'carrier_id_required'},400);

  const carriers=await readRegistry(env);
  const carrier=carriers.find(item=>String(item?.id||'')===carrierId);
  if(!carrier)return dialogueReply({ok:false,error:'carrier_not_found'},404);

  const library=await readCarrierDialogue(env);
  const profile=normalizeProfile(library.profiles[carrierId]||{carrierId},carrierId);

  if(action==='upsert_line'){
    const line=normalizeLine(body?.line);
    if(!line)return dialogueReply({ok:false,error:'invalid_dialogue_line'},400);
    const index=profile.lines.findIndex(item=>item.id===line.id);
    if(index>=0)profile.lines[index]=line;
    else profile.lines.push(line);
  }else if(action==='delete_line'){
    const lineId=clean(body?.lineId,100);
    if(!lineId)return dialogueReply({ok:false,error:'line_id_required'},400);
    profile.lines=profile.lines.filter(item=>item.id!==lineId);
  }else if(action==='settings'){
    profile.settings=normalizeProfile({carrierId,settings:body?.settings,lines:profile.lines},carrierId).settings;
  }else{
    return dialogueReply({ok:false,error:'unknown_action'},400);
  }

  library.profiles[carrierId]=profile;
  library.updatedAt=new Date().toISOString();
  library.updatedBy=auth.session.displayName||auth.session.username||'Site Admin';
  await writeCarrierDialogue(env,library);
  return dialogueReply({ok:true,carrier:presentCarrier(carrier),profile:publicDialogueProfile(profile),updatedAt:library.updatedAt});
}

async function readRegistry(env){
  if(!env?.CARRIERS||typeof env.CARRIERS.get!=='function')return[];
  const rows=await env.CARRIERS.get(REGISTRY_KEY,{type:'json'});
  return Array.isArray(rows)?rows:[];
}
function presentCarrier(item){
  return{
    id:clean(item?.id,100),
    marketId:clean(item?.marketId,24),
    callsign:clean(item?.callsign,20),
    name:clean(item?.name,100)||clean(item?.callsign,20)||'Fleet Carrier',
    commanderName:clean(item?.commanderName,80),
    official:Boolean(item?.official),
    voicePersonality:clean(item?.voicePersonality,24)||(item?.official?'mongrels':'personal'),
  };
}
function sameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  return origin===expected&&request.headers.get('X-Mongrels-Request')==='carrier-dialogue';
}
function clean(value,max=500){
  const text=typeof value==='string'?value.trim():String(value??'').trim();
  return text.slice(0,max);
}

function isCanineCatalyst(carrier){
  return clean(carrier?.id,100)===CANINE_CATALYST_ID||clean(carrier?.callsign,20).toUpperCase()===CANINE_CATALYST_CALLSIGN;
}

export function starterProfile(carrier){
  const id=clean(carrier?.id,100);
  const personality=clean(carrier?.voicePersonality,24)||(carrier?.official?'mongrels':'personal');
  const canine=isCanineCatalyst(carrier);
  const seedName=canine?'canine-catalyst':personality;
  const rows=[];
  const add=(category,audience,text,rarity='common')=>rows.push({
    id:`starter:${seedName}:${audience}:${category}:${rows.length+1}`,
    category,audience,rarity,enabled:true,text
  });

  if(canine){
    add('docking.granted','owner','Squad command recognized. Welcome back, {commander}. Proceed to {pad}.');
    add('docking.granted','owner','Canine Catalyst has your transponder, Commander {commander}. {pad} is clear.','uncommon');
    add('docking.docked','owner','Commander {commander} aboard. Squadron command is home.');
    add('docking.docked','owner','Welcome back, {commander}. The Catalyst is yours.','uncommon');
    add('docking.undocked','owner','Command vessel clear. Good hunting, {commander}.');
    add('docking.undocked','owner','Squad command departure confirmed. Bring the pack something worth talking about.','rare');
    add('carrier.jump_request','owner','Squad carrier course locked for {destination}. Canine Catalyst is preparing to jump.');
    add('carrier.jump','owner','Canine Catalyst is on station in {destination}. Squadron transit complete.');
    add('carrier.cooldown_ready','owner','Canine Catalyst frame shift systems have recycled. Squad command is ready for another jump.');

    add('docking.granted','squadmate','Mongrel transponder confirmed. Welcome to squad command, {commander}. Proceed to {pad}.');
    add('docking.granted','squadmate','Pack traffic recognized. Canine Catalyst has {pad} ready for you, {commander}.','uncommon');
    add('docking.docked','squadmate','Welcome aboard Canine Catalyst, {commander}. The pack has you.');
    add('docking.docked','squadmate','Mongrel aboard. Welcome to squad command, {commander}.','uncommon');
    add('docking.docked','squadmate','Welcome home, {commander}. Please keep the chewing to designated areas.','rare');
    add('docking.undocked','squadmate','You are clear of Canine Catalyst. Good hunting, {commander}.');
    add('docking.undocked','squadmate','Departure confirmed. Go make the Mongrels proud.','uncommon');

    add('ambient.hangar','all','Canine Catalyst hangar control reminds all pilots to keep launch lanes clear.');
    add('ambient.hangar','squadmate','Mongrel flight crews: squad support services remain available throughout the hangar deck.','uncommon');
    add('ambient.concourse','all','Welcome aboard Canine Catalyst, operational flagship of the Regiment of Imperial Mongrels.');
    add('ambient.concourse','squadmate','Mongrels: check Mission Control before departure for current squad priorities.','uncommon');
    add('bulletin.concourse','all','Squad operations bulletin: flight crews should verify current orders before leaving Canine Catalyst.');
    add('bulletin.concourse','squadmate','Pack bulletin: if you found trouble, log it. If you caused trouble, at least make it interesting.','rare');
    add('advertisement.concourse','all','Need cargo moved, an escort, or a second set of guns? Check the Mongrel boards before departure.','uncommon');
  }else if(personality==='mongrels'){
    add('docking.granted','owner','Command clearance granted. Proceed to {pad}.');
    add('docking.granted','owner','Carrier command recognized. {pad} is yours.','uncommon');
    add('docking.docked','owner','Carrier command aboard. Welcome back, Commander {commander}.');
    add('docking.docked','owner','Welcome aboard. The pack is accounted for.','uncommon');
    add('docking.undocked','owner','Command vessel clear. Good hunting, Commander.');
    add('docking.undocked','owner','Departure complete. Bring something interesting back.','rare');
    add('docking.granted','squadmate','Mongrel transponder recognized. Proceed to {pad}.');
    add('docking.granted','squadmate','Pack traffic has priority. Clearance granted for {pad}.','uncommon');
    add('docking.granted','squadmate','Docking clearance confirmed, Mongrel. Proceed to {pad}.');
    add('docking.docked','squadmate','Welcome aboard {carrier}. Another Mongrel is always welcome.');
    add('docking.docked','squadmate','Mongrel aboard. Welcome home to the pack, Commander.','uncommon');
    add('docking.docked','squadmate','Welcome aboard, Commander. Try not to chew on anything expensive.','rare');
    add('docking.undocked','squadmate','Clear of {carrier}. Go make the squad look good.');
    add('docking.undocked','squadmate','Departure complete. Fly dangerous, Mongrel.');
    add('docking.undocked','squadmate','You are clear. The pack will be here when you get back.','uncommon');
  }else if(personality==='professional'){
    add('docking.granted','owner','Docking clearance confirmed. Proceed to {pad}.');
    add('docking.granted','owner','Clearance granted. Approach {pad} when ready.','uncommon');
    add('docking.docked','owner','Docking complete. Welcome aboard {carrier}, Commander.');
    add('docking.docked','owner','{carrier} confirms secure docking. Welcome aboard.','uncommon');
    add('docking.undocked','owner','Departure complete. Clear of {carrier}.');
    add('docking.undocked','owner','You are clear of the carrier. Safe travels, Commander.','uncommon');
    add('docking.granted','squadmate','Docking clearance confirmed. Proceed to {pad}.');
    add('docking.granted','squadmate','Clearance granted, Commander. Continue to {pad}.','uncommon');
    add('docking.docked','squadmate','Docking complete. Welcome aboard {carrier}.');
    add('docking.docked','squadmate','Welcome aboard {carrier}, Commander.','uncommon');
    add('docking.undocked','squadmate','Departure complete. Safe flying, Commander.');
    add('docking.undocked','squadmate','You are clear of {carrier}. Safe travels.','uncommon');
  }else{
    add('docking.granted','owner','Docking clearance confirmed. Proceed to {pad}.');
    add('docking.granted','owner','Welcome back, Commander. {pad} is ready for you.','uncommon');
    add('docking.granted','owner','Clearance granted. Bring her in to {pad}, Commander.','uncommon');
    add('docking.docked','owner','Welcome home, Commander.');
    add('docking.docked','owner','Welcome back aboard {carrier}, Commander.');
    add('docking.docked','owner','{carrier} has you. Good to have you home, Commander {commander}.','uncommon');
    add('docking.undocked','owner','Departure complete. Clear of {carrier}. Safe flying, Commander.');
    add('docking.undocked','owner','You are clear of {carrier}. See you when you get back, Commander.','uncommon');
    add('docking.undocked','owner','Departure corridor clear. Good hunting, Commander.','uncommon');
    add('carrier.jump_request','owner','{carrier} jump plotted for {destination}. Departure sequence scheduled.');
    add('carrier.jump_request','owner','Course locked for {destination}. Carrier departure sequence is now active.','uncommon');
    add('carrier.jump_request','owner','{destination} is plotted. Preparing {carrier} for departure.','uncommon');
    add('carrier.jump','owner','{carrier} has arrived in {destination}. Jump complete.');
    add('carrier.jump','owner','Jump complete. Welcome to {destination}, Commander.','uncommon');
    add('carrier.jump','owner','Transit complete. {carrier} is now on station in {destination}.','uncommon');
    add('carrier.cooldown_ready','owner','{carrier} jump cooldown complete. Carrier is ready to plot the next jump.');
    add('carrier.cooldown_ready','owner','Frame shift systems have recycled. {carrier} is ready for another jump.','uncommon');
    add('docking.granted','squadmate','Docking clearance confirmed. Proceed to {pad}.');
    add('docking.granted','squadmate','Clearance granted, Commander. {pad} is ready.','uncommon');
    add('docking.granted','squadmate','Mongrel traffic recognized. Proceed to {pad}.','uncommon');
    add('docking.docked','squadmate','Welcome aboard {carrier}, Commander.');
    add('docking.docked','squadmate','Welcome aboard. Always good to have another Mongrel on deck.','uncommon');
    add('docking.docked','squadmate','{carrier} welcomes you aboard, Commander. Make yourself at home.','uncommon');
    add('docking.undocked','squadmate','Departure complete. Clear of {carrier}. Safe flying, Commander.');
    add('docking.undocked','squadmate','You are clear to depart. Fly dangerous, Mongrel.','uncommon');
    add('docking.undocked','squadmate','Departure corridor clear. We\'ll keep a pad open for you.','uncommon');
  }

  if(canine){
    add('docking.granted','visitor','Canine Catalyst confirms your clearance. Proceed to {pad}.');
    add('docking.granted','visitor','Squad carrier traffic control has you. Continue to {pad}.','uncommon');
    add('docking.docked','visitor','Docking complete. Welcome aboard Canine Catalyst.');
    add('docking.docked','visitor','Welcome aboard the Regiment of Imperial Mongrels squad carrier.','uncommon');
    add('docking.undocked','visitor','Departure complete. You are clear of Canine Catalyst.');
    add('docking.undocked','visitor','Squad carrier departure corridor clear. Safe travels.','uncommon');
  }else{
    add('docking.granted','visitor','Docking clearance confirmed. Proceed to {pad}.');
    add('docking.granted','visitor','Clearance granted. Continue to {pad}.','uncommon');
    add('docking.docked','visitor','Docking complete. Welcome aboard.');
    add('docking.docked','visitor','Welcome aboard, Commander.','uncommon');
    add('docking.undocked','visitor','Departure complete. Safe flying, Commander.');
    add('docking.undocked','visitor','You are clear of the carrier. Safe travels.','uncommon');
  }

  addDialogueExpansion(rows,{seedName,canine,personality});

  return normalizeProfile({carrierId:id,starterSeedVersion:starterSeedVersionFor(carrier),lines:rows,settings:{
    ambientEnabled:true,hangarMinSeconds:120,hangarMaxSeconds:240,concourseMinSeconds:90,concourseMaxSeconds:210
  }},id);
}

function starterSeedVersionFor(carrier){
  return isCanineCatalyst(carrier)?CANINE_STARTER_SEED_VERSION:GENERIC_STARTER_SEED_VERSION;
}

export function upgradeStarterProfile(existing,carrier){
  const id=clean(carrier?.id||existing?.carrierId,100);
  const normalized=normalizeProfile(existing,id);
  const targetSeed=starterSeedVersionFor(carrier);
  if(Number(normalized.starterSeedVersion||0)>=targetSeed)return normalized;

  const additions=starterProfile(carrier).lines.filter(line=>String(line?.id||'').startsWith(EXPANSION_SEED_PREFIX));
  const existingIds=new Set(normalized.lines.map(line=>String(line?.id||'')));
  const lines=[
    ...normalized.lines,
    ...additions.filter(line=>!existingIds.has(String(line?.id||''))),
  ];
  return normalizeProfile({...normalized,starterSeedVersion:targetSeed,lines},id);
}

function addDialogueExpansion(rows,{seedName,canine,personality}){
  const add=(slug,category,audience,text,rarity='common')=>rows.push({
    id:`${EXPANSION_SEED_PREFIX}${seedName}:${slug}`,
    category,audience,rarity,enabled:true,text
  });

  // Operational traffic. These deliberately use the universal audience so the
  // same carrier has enough variety for owners, Mongrels, and visitors.
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

  // Hangar PA gets a larger pool because these announcements repeat while the
  // player is walking around the deck.
  add('hangar-launch-lanes','ambient.hangar','all','Hangar control reminds all pilots to keep active launch lanes clear.');
  add('hangar-ground-crew','ambient.hangar','all','Ground crews are operating across the flight deck. Watch for service vehicles and moving equipment.');
  add('hangar-maintenance','ambient.hangar','all','Maintenance teams are available for repair, refuel, and rearm support.');
  add('hangar-gear','ambient.hangar','all','Flight deck reminder: landing gear is not considered an optional module, regardless of previous successful experiments.','rare');
  add('hangar-boost','ambient.hangar','all','Boost testing inside the hangar remains strongly discouraged by everyone responsible for repainting the walls.','rare');
  add('hangar-limpets','ambient.hangar','all','Unattended limpets may be collected, renamed, and reassigned to cargo duty.','rare');
  add('hangar-noise','ambient.hangar','all','If your ship is making a noise you have never heard before, maintenance would prefer to know before departure.','uncommon');
  add('hangar-clearance','ambient.hangar','all','Pilots preparing to launch should confirm ammunition, fuel, limpets, and the vague location of their destination.','uncommon');

  // Concourse PA is intentionally the deepest pool. It should sound like an
  // inhabited carrier rather than one repeating canned ATC every few minutes.
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

  if(personality==='mongrels'||canine){
    add('mongrel-hangar-pack','ambient.hangar','squadmate','Mongrel flight crews: check your loadout before launch. The pack can help; physics remains less flexible.','uncommon');
    add('mongrel-hangar-chewing','ambient.hangar','squadmate','Pack notice: chewing on flight-deck equipment remains prohibited, even when the equipment started it.','rare');
    add('mongrel-concourse-mission-control','ambient.concourse','squadmate','Mongrels: check Mission Control before departure. Someone has probably found productive trouble for you.','uncommon');
    add('mongrel-concourse-stay','ambient.concourse','squadmate','Pack reminder: Mongrels never quite figured out the word stay. Departure boards are available near the lifts.','rare');
    add('mongrel-bulletin-story','bulletin.concourse','squadmate','Pack bulletin: if the operation went well, log the result. If it went badly, at least improve the story.','rare');
    add('mongrel-advert-escort','advertisement.concourse','squadmate','Need an escort? Find another Mongrel. Need several escorts? Whatever you are doing sounds interesting.','rare');
  }

  if(canine){
    add('canine-hangar-flagship','ambient.hangar','all','Canine Catalyst flight deck is operating normally. Squadron support crews are standing by.');
    add('canine-hangar-command','ambient.hangar','squadmate','Mongrel pilots aboard Canine Catalyst should verify current squad priorities before launch.','uncommon');
    add('canine-concourse-flagship','ambient.concourse','all','Welcome aboard Canine Catalyst, squadron flagship of the Regiment of Imperial Mongrels.');
    add('canine-concourse-command','ambient.concourse','squadmate','Squad command notice: Mission Control is current. Check assignments before heading back to the hangar.','uncommon');
    add('canine-concourse-doghouse','ambient.concourse','squadmate','Canine Catalyst reminder: this is squad command, not the doghouse. Standards are marginally higher.','rare');
    add('canine-bulletin-pack','bulletin.concourse','squadmate','Pack bulletin: support requests, current operations, and carrier movements are available through squad channels.','uncommon');
    add('canine-advert-help','advertisement.concourse','squadmate','Need cargo hauled, a wingmate, or somebody to blame? The pack is already aboard.','rare');
  }
}
