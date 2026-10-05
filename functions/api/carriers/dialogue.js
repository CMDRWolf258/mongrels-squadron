import { readCarrierDialogue, writeCarrierDialogue, normalizeLine, normalizeProfile, publicDialogueProfile, requireDialogueAdmin, dialogueReply } from '../../../lib/carrier-dialogue.js';

const REGISTRY_KEY='registry-v1';

export async function onRequestGet({request,env}){
  const auth=await requireDialogueAdmin(request,env);
  if(auth.response)return auth.response;
  const url=new URL(request.url);
  const carrierId=clean(url.searchParams.get('carrierId'),100);
  const [library,carriers]=await Promise.all([readCarrierDialogue(env),readRegistry(env)]);
  let seeded=false;
  for(const carrier of carriers){
    const id=clean(carrier?.id,100);
    if(!id||library.profiles[id])continue;
    library.profiles[id]=starterProfile(carrier);
    seeded=true;
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

function starterProfile(carrier){
  const id=clean(carrier?.id,100);
  const personality=clean(carrier?.voicePersonality,24)||(carrier?.official?'mongrels':'personal');
  const rows=[];
  const add=(category,audience,text,rarity='common')=>rows.push({
    id:`starter:${personality}:${audience}:${category}:${rows.length+1}`,
    category,audience,rarity,enabled:true,text
  });

  if(personality==='mongrels'){
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

  add('docking.granted','visitor','Docking clearance confirmed. Proceed to {pad}.');
  add('docking.granted','visitor','Clearance granted. Continue to {pad}.','uncommon');
  add('docking.docked','visitor','Docking complete. Welcome aboard.');
  add('docking.docked','visitor','Welcome aboard, Commander.','uncommon');
  add('docking.undocked','visitor','Departure complete. Safe flying, Commander.');
  add('docking.undocked','visitor','You are clear of the carrier. Safe travels.','uncommon');

  return normalizeProfile({carrierId:id,lines:rows,settings:{
    ambientEnabled:true,hangarMinSeconds:120,hangarMaxSeconds:240,concourseMinSeconds:90,concourseMaxSeconds:210
  }},id);
}
