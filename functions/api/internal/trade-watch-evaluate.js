import { json } from '../../../lib/auth.js';
import {
  evaluateTradeWatches,
  TRADE_WATCH_EVALUATION_BATCH_SIZE,
} from '../../../lib/trade-watch-evaluator.js';

export async function onRequestPost({request,env}){
  const auth=await authenticateCron(request,env);
  if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);

  try{
    const result=await evaluateTradeWatches(env,{
      maxWatches:TRADE_WATCH_EVALUATION_BATCH_SIZE,
      concurrency:2,
    });
    return reply(result);
  }catch(error){
    console.error('Scheduled Trade Watch evaluation failed',error);
    return reply({ok:false,error:'scheduled_trade_watch_evaluation_failed'},502);
  }
}

async function authenticateCron(request,env){
  const expected=String(
    env?.TRADE_WATCH_CRON_TOKEN
    || env?.SCOUT_DISCORD_CRON_TOKEN
    || ''
  ).trim();
  if(expected.length<24)return{ok:false,status:503,error:'trade_watch_cron_not_configured'};
  const header=String(request.headers.get('Authorization')||'');
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)return{ok:false,status:401,error:'invalid_cron_token'};
  const supplied=match[1].trim();
  return await secureEqual(supplied,expected)
    ?{ok:true,status:200,error:''}
    :{ok:false,status:401,error:'invalid_cron_token'};
}

async function secureEqual(a,b){
  const [aa,bb]=await Promise.all([sha256(a),sha256(b)]);
  if(aa.length!==bb.length)return false;
  let diff=0;
  for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
  return diff===0;
}
async function sha256(value){
  const data=new TextEncoder().encode(String(value||''));
  return new Uint8Array(await crypto.subtle.digest('SHA-256',data));
}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    'X-Content-Type-Options':'nosniff',
  }});
}
