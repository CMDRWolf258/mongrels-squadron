import { json, readSession } from '../../../lib/auth.js';
import {
  discordColonizationArchiveConfigured,
  discordFactionAlertsConfigured,
  discordOperationsConfigured,
  discordScoutNetworkConfigured,
  discordSquadPayoutsConfigured,
  sendOperationsDiscord,
} from '../../../lib/discord-webhook.js';

export async function onRequestGet({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  return reply({
    ok:true,
    configured:discordOperationsConfigured(env),
    colonizationArchiveConfigured:discordColonizationArchiveConfigured(env),
    factionAlertsConfigured:discordFactionAlertsConfigured(env),
    scoutNetworkConfigured:discordScoutNetworkConfigured(env),
    squadPayoutsConfigured:discordSquadPayoutsConfigured(env),
    scoutCycleRefreshServerConfigured:String(env?.SCOUT_DISCORD_CRON_TOKEN||'').trim().length>=24,
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  if(!discordOperationsConfigured(env))return reply({ok:false,error:'discord_webhook_not_configured'},503);

  const actor=clean(auth.session.displayName||auth.session.username||'Site Admin').slice(0,100);
  const timestamp=new Date().toISOString();

  try{
    const result=await sendOperationsDiscord(env,{
      embeds:[{
        title:'Mission Control Link Test',
        description:'Discord webhook connectivity is working. This is a manual test from Wolf BGS Control; automated operations messages use the low-noise persistent/update-in-place model.',
        color:0x22d3ee,
        fields:[
          {name:'Source',value:'Wolf BGS Control',inline:true},
          {name:'Status',value:'Webhook connected',inline:true},
          {name:'Triggered by',value:actor||'Site Admin',inline:false},
        ],
        footer:{text:'Regiment of Imperial Mongrels · Mission Control'},
        timestamp,
      }],
    });
    return reply({ok:true,sent:true,discordStatus:result.status,sentAt:timestamp});
  }catch(error){
    const code=clean(error?.message)||'discord_test_failed';
    const status=Number(error?.status);
    return reply({
      ok:false,
      error:code,
      discordStatus:Number.isFinite(status)?status:null,
    },code==='discord_webhook_not_configured'?503:502);
  }
}

async function requireSiteAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_required'},403)};
  return{session};
}

function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='wolf-bgs-control'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
