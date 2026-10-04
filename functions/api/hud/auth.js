import { json } from '../../../lib/auth.js';

const TOKENS_KEY='wolf-bgs-scout-tokens-v1';

export async function onRequestGet({request,env}){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function'){
    return reply({ok:false,error:'hud_storage_not_configured'},503);
  }
  const auth=await authenticateScout(request,env);
  if(!auth)return reply({ok:false,error:'invalid_scout_token'},401);
  if(!auth.ownerId)return reply({ok:false,error:'hud_owner_not_bound'},403);
  const access=String(auth.ownerId)===String(env.ADMIN_USER_ID||'')?'site_admin':'member';
  return reply({
    ok:true,
    ownerId:auth.ownerId,
    commander:auth.ownerCommander||auth.label||'',
    access,
  });
}

async function authenticateScout(request,env){
  const header=request.headers.get('Authorization')||'';
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)return null;
  const token=match[1].trim();
  if(!token.startsWith('mscout_')||token.length>180)return null;
  const hash=await sha256Hex(token);
  const stored=await env.DAILY_ORDERS.get(TOKENS_KEY,{type:'json'});
  for(const value of Object.values(stored?.tokens&&typeof stored.tokens==='object'?stored.tokens:{})){
    if(value?.hash&&constantTimeEqual(String(value.hash),hash)){
      return{
        id:clean(value.id),
        label:clean(value.label),
        ownerId:clean(value.ownerId),
        ownerCommander:clean(value.ownerCommander),
      };
    }
  }
  return null;
}

function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
async function sha256Hex(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function constantTimeEqual(a,b){
  const left=String(a||''),right=String(b||'');
  if(left.length!==right.length)return false;
  let diff=0;
  for(let i=0;i<left.length;i+=1)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}
function reply(body,status=200){
  return json(body,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'}});
}
