import { json, readSession } from '../../../lib/auth.js';
import { readTradeMarketHealth } from '../../../lib/trade-market.js';
import {
  normalizeTradeControl,
  readTradeControl,
  tradeDiscordChannelId,
  writeTradeControl,
} from '../../../lib/trade-intelligence.js';

const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}) {
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const [control,marketData]=await Promise.all([readTradeControl(env),readTradeMarketHealth(env)]);
  return reply({
    ok:true,
    control,
    marketData,
    discord:{
      mode:control.discord.mode,
      targetChannelId:tradeDiscordChannelId(control),
      targetLabel:control.discord.mode==='testing'?'🧪〡system-testing':'💰〡trader’s-outpost',
      testingChannelId:control.discord.testingChannelId,
      productionChannelId:control.discord.productionChannelId,
      liveSwitchExposed:false,
    },
  });
}

export async function onRequestPut({request,env}) {
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const current=await readTradeControl(env);
  const source=body&&typeof body==='object'?body:{};
  const requested=normalizeTradeControl({
    ...current,
    defaultPriority:source.defaultPriority ?? current.defaultPriority,
    priorities:source.priorities ?? current.priorities,
    discord:{
      ...current.discord,
      autoPublish:typeof source.discord?.autoPublish==='boolean'?source.discord.autoPublish:current.discord.autoPublish,
      thresholdMessages:typeof source.discord?.thresholdMessages==='boolean'?source.discord.thresholdMessages:current.discord.thresholdMessages,
      compactSuperseded:typeof source.discord?.compactSuperseded==='boolean'?source.discord.compactSuperseded:current.discord.compactSuperseded,
      // The testing/live destination is intentionally not user-switchable yet.
      mode:current.discord.mode,
      testingChannelId:current.discord.testingChannelId,
      productionChannelId:current.discord.productionChannelId,
      routineSilent:true,
    },
  });

  try{
    const saved=await writeTradeControl(env,requested);
    const marketData=await readTradeMarketHealth(env);
    return reply({
      ok:true,
      control:saved,
      marketData,
      discord:{
        mode:saved.discord.mode,
        targetChannelId:tradeDiscordChannelId(saved),
        targetLabel:saved.discord.mode==='testing'?'🧪〡system-testing':'💰〡trader’s-outpost',
        testingChannelId:saved.discord.testingChannelId,
        productionChannelId:saved.discord.productionChannelId,
        liveSwitchExposed:false,
      },
      updatedBy:auth.session.displayName,
    });
  }catch(error){
    const code=String(error?.message||error);
    const status=code==='trades_storage_not_configured'?503:500;
    return reply({ok:false,error:code.slice(0,200)},status);
  }
}

async function requireManager(request,env) {
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!MANAGER_ACCESS.has(session.access))return{response:reply({ok:false,error:'officer_access_required'},403)};
  return{session};
}

function validateSameOrigin(request) {
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='trade-control')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}

function headers(){
  return {
    'Cache-Control':'no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  };
}
function reply(data,status=200){return json(data,{status,headers:headers()});}
