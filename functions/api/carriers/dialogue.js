import { readCarrierDialogue, writeCarrierDialogue, normalizeLine, normalizeProfile, publicDialogueProfile, requireDialogueAdmin, dialogueReply } from '../../../lib/carrier-dialogue.js';

const REGISTRY_KEY='registry-v1';

export async function onRequestGet({request,env}){
  const auth=await requireDialogueAdmin(request,env);
  if(auth.response)return auth.response;
  const url=new URL(request.url);
  const carrierId=clean(url.searchParams.get('carrierId'),100);
  const [library,carriers]=await Promise.all([readCarrierDialogue(env),readRegistry(env)]);
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
