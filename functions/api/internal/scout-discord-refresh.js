import { json } from '../../../lib/auth.js';
import { buildScoutJobBoard } from '../../../lib/scout-jobs.js';
import { syncScoutDiscordBoard } from '../../../lib/scout-discord.js';
import { loadActiveMongrelSystems } from '../../../lib/scout-systems.js';
import { discordOperationsConfigured } from '../../../lib/discord-webhook.js';

export async function onRequestPost({request,env}){
  const auth=await authenticateCron(request,env);
  if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
  if(!discordOperationsConfigured(env))return reply({ok:false,error:'discord_webhook_not_configured'},503);

  try{
    const systems=await loadActiveMongrelSystems(request);
    const board=await buildScoutJobBoard(env,{systems,viewer:null,now:new Date()});
    const discord=await syncScoutDiscordBoard(env,{
      board,
      scoutBoardUrl:new URL('/scout-jobs/',request.url).toString(),
      setupUrl:new URL('/member/?section=live-scout-setup#live-scout-setup',request.url).toString(),
      createMissing:false,
      originSystem:'Diaba',
      ordinaryLimit:15,
    });
    return reply({
      ok:true,
      checkedAt:new Date().toISOString(),
      systems:board.summary?.systems||0,
      available:board.summary?.available||0,
      priority:board.summary?.priority||0,
      discord:{
        configured:discord.configured,
        summaryMode:discord.summary?.mode||null,
        created:discord.created||0,
        edited:discord.edited||0,
        completionShown:discord.completionShown||0,
        deleted:discord.deleted||0,
        unchanged:discord.unchanged||0,
        failed:discord.failed||0,
        displayedPriority:discord.displayedPriority||0,
        displayedOrdinary:discord.displayedOrdinary||0,
      },
    });
  }catch(error){
    console.error('Scheduled Scout Discord refresh failed',error);
    return reply({ok:false,error:'scheduled_scout_discord_refresh_failed'},502);
  }
}

async function authenticateCron(request,env){
  const expected=String(env?.SCOUT_DISCORD_CRON_TOKEN||'').trim();
  if(expected.length<24)return{ok:false,status:503,error:'scout_discord_cron_not_configured'};
  const header=String(request.headers.get('Authorization')||'');
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)return{ok:false,status:401,error:'invalid_cron_token'};
  const supplied=match[1].trim();
  return await secureEqual(supplied,expected)
    ? {ok:true,status:200,error:''}
    : {ok:false,status:401,error:'invalid_cron_token'};
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
