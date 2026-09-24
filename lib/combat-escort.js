const STORAGE_KEY='combat-escort-requests-v1';
const MAX_ITEMS=150;
const RESPONSE_STATES=new Set(['available','on_my_way']);
const STATUSES=new Set(['open','complete','cancelled']);
const URGENCIES=new Set(['routine','priority','immediate']);

export async function readEscortRequests(env){
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function')return[];
  try{
    const value=await env.PROJECTS.get(STORAGE_KEY,{type:'json'});
    return Array.isArray(value)?value.map(normalizeRequest).filter(Boolean):[];
  }catch(error){
    console.error('Could not read combat escort requests',error);
    return[];
  }
}

export async function writeEscortRequests(env,items){
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')throw new Error('escort_storage_not_configured');
  const cleanItems=(Array.isArray(items)?items:[]).map(normalizeRequest).filter(Boolean).slice(0,MAX_ITEMS);
  await env.PROJECTS.put(STORAGE_KEY,JSON.stringify(cleanItems));
}

export function createEscortRequest(value,{ownerId,ownerName}={}){
  const now=new Date().toISOString();
  const src=value&&typeof value==='object'?value:{};
  const system=clean(src.system).slice(0,100);
  const objective=clean(src.objective).slice(0,180);
  if(!system)throw new Error('system_required');
  if(!objective)throw new Error('objective_required');
  return normalizeRequest({
    id:crypto.randomUUID(),
    ownerId:clean(ownerId).slice(0,40),
    ownerName:clean(ownerName||'Commander').slice(0,100),
    title:clean(src.title||'Combat Escort Requested').slice(0,100),
    system,
    destination:clean(src.destination).slice(0,120),
    objective,
    timing:clean(src.timing||'As soon as available').slice(0,120),
    urgency:normalizeUrgency(src.urgency),
    notes:clean(src.notes).slice(0,700),
    status:'open',
    responses:{},
    discord:{},
    createdAt:now,
    updatedAt:now,
  });
}

export function updateEscortRequest(existing,value){
  const src=value&&typeof value==='object'?value:{};
  const next={...normalizeRequest(existing)};
  if(next.status!=='open')throw new Error('escort_request_closed');
  if(Object.hasOwn(src,'title'))next.title=clean(src.title||'Combat Escort Requested').slice(0,100);
  if(Object.hasOwn(src,'system'))next.system=clean(src.system).slice(0,100);
  if(Object.hasOwn(src,'destination'))next.destination=clean(src.destination).slice(0,120);
  if(Object.hasOwn(src,'objective'))next.objective=clean(src.objective).slice(0,180);
  if(Object.hasOwn(src,'timing'))next.timing=clean(src.timing||'As soon as available').slice(0,120);
  if(Object.hasOwn(src,'urgency'))next.urgency=normalizeUrgency(src.urgency);
  if(Object.hasOwn(src,'notes'))next.notes=clean(src.notes).slice(0,700);
  if(!next.system)throw new Error('system_required');
  if(!next.objective)throw new Error('objective_required');
  next.updatedAt=new Date().toISOString();
  return next;
}

export function setEscortStatus(existing,status,{actorId='',actorName=''}={}){
  const next={...normalizeRequest(existing)};
  const value=clean(status).toLowerCase();
  if(!STATUSES.has(value)||value==='open')throw new Error('invalid_escort_status');
  if(next.status!=='open')return next;
  next.status=value;
  next.closedAt=new Date().toISOString();
  next.closedBy=clean(actorName||actorId).slice(0,100);
  next.updatedAt=next.closedAt;
  return next;
}

export function setEscortResponse(existing,{userId,displayName,state}={}){
  const next=normalizeRequest(existing);
  if(next.status!=='open')throw new Error('escort_request_closed');
  const id=clean(userId).slice(0,40);
  if(!id)throw new Error('member_id_required');
  if(id===next.ownerId)throw new Error('requester_cannot_respond');
  const choice=clean(state).toLowerCase();
  next.responses={...next.responses};
  if(choice==='withdraw'){
    delete next.responses[id];
  }else{
    if(!RESPONSE_STATES.has(choice))throw new Error('invalid_escort_response');
    next.responses[id]={
      state:choice,
      displayName:clean(displayName||'Commander').slice(0,100),
      updatedAt:new Date().toISOString(),
    };
  }
  next.updatedAt=new Date().toISOString();
  return next;
}

export function escortResponseSummary(item,viewerId=''){
  const request=normalizeRequest(item);
  const entries=Object.entries(request.responses||{});
  const available=entries.filter(([,v])=>v.state==='available').map(([,v])=>v.displayName);
  const onMyWay=entries.filter(([,v])=>v.state==='on_my_way').map(([,v])=>v.displayName);
  return {
    current:request.responses?.[String(viewerId||'')]?.state||'',
    available,
    onMyWay,
    total:entries.length,
  };
}

export function presentEscortRequest(item,{viewerId='',access='member'}={}){
  const request=normalizeRequest(item);
  const canManage=request.ownerId===String(viewerId||'')||access==='officer'||access==='site_admin';
  return {
    ...request,
    responses:escortResponseSummary(request,viewerId),
    canManage,
    isMine:request.ownerId===String(viewerId||''),
  };
}

export function normalizeRequest(value){
  if(!value||typeof value!=='object')return null;
  const id=clean(value.id).slice(0,60);
  if(!id)return null;
  const responses={};
  const source=value.responses&&typeof value.responses==='object'?value.responses:{};
  for(const [userId,entry] of Object.entries(source)){
    const uid=clean(userId).slice(0,40);
    const state=clean(entry?.state).toLowerCase();
    if(!uid||!RESPONSE_STATES.has(state))continue;
    responses[uid]={
      state,
      displayName:clean(entry?.displayName||'Commander').slice(0,100),
      updatedAt:iso(entry?.updatedAt),
    };
  }
  const discord=value.discord&&typeof value.discord==='object'?value.discord:{};
  return {
    id,
    ownerId:clean(value.ownerId).slice(0,40),
    ownerName:clean(value.ownerName||'Commander').slice(0,100),
    title:clean(value.title||'Combat Escort Requested').slice(0,100),
    system:clean(value.system).slice(0,100),
    destination:clean(value.destination).slice(0,120),
    objective:clean(value.objective).slice(0,180),
    timing:clean(value.timing||'As soon as available').slice(0,120),
    urgency:normalizeUrgency(value.urgency),
    notes:clean(value.notes).slice(0,700),
    status:STATUSES.has(clean(value.status).toLowerCase())?clean(value.status).toLowerCase():'open',
    responses,
    discord:{
      messageId:clean(discord.messageId).slice(0,40),
      channelId:clean(discord.channelId).slice(0,40),
      lastSyncedAt:iso(discord.lastSyncedAt),
      lastError:clean(discord.lastError).slice(0,500),
    },
    createdAt:iso(value.createdAt)||new Date().toISOString(),
    updatedAt:iso(value.updatedAt)||iso(value.createdAt)||new Date().toISOString(),
    closedAt:iso(value.closedAt),
    closedBy:clean(value.closedBy).slice(0,100),
  };
}

export function escortUrgencyLabel(value){
  return ({routine:'Routine',priority:'Priority',immediate:'Immediate'})[normalizeUrgency(value)];
}

function normalizeUrgency(value){const v=clean(value).toLowerCase();return URGENCIES.has(v)?v:'routine'}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function iso(value){if(!value)return'';const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():'';}
