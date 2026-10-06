import { readCarrierDialogue, writeCarrierDialogue, normalizeLine, normalizeProfile, publicDialogueProfile, requireDialogueAdmin, dialogueReply } from '../../../lib/carrier-dialogue.js';

const REGISTRY_KEY='registry-v1';
const CANINE_CATALYST_ID='squad-carrier-r1mm';
const CANINE_CATALYST_CALLSIGN='R1MM';
const CANINE_STARTER_SEED_VERSION=2;

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
    const targetSeed=isCanineCatalyst(carrier)?CANINE_STARTER_SEED_VERSION:1;
    if(!existing){
      library.profiles[id]=starterProfile(carrier);
      seeded=true;
      continue;
    }
    if(Number(existing.starterSeedVersion||0)<targetSeed){
      const lines=Array.isArray(existing.lines)?existing.lines:[];
      const starterOnly=lines.length===0||lines.every(line=>String(line?.id||'').startsWith('starter:'));
      if(starterOnly){
        const starter=starterProfile(carrier);
        starter.settings=existing.settings||starter.settings;
        library.profiles[id]=starter;
      }else{
        library.profiles[id]=normalizeProfile({...existing,starterSeedVersion:targetSeed},id);
      }
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

function starterProfile(carrier){
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

  return normalizeProfile({carrierId:id,starterSeedVersion:canine?CANINE_STARTER_SEED_VERSION:1,lines:rows,settings:{
    ambientEnabled:true,hangarMinSeconds:120,hangarMaxSeconds:240,concourseMinSeconds:90,concourseMaxSeconds:210
  }},id);
}
