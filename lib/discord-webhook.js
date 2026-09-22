const DISCORD_WEBHOOK_PREFIXES=[
  'https://discord.com/api/webhooks/',
  'https://discordapp.com/api/webhooks/',
];

export function discordOperationsConfigured(env){
  return validDiscordWebhookUrl(env?.DISCORD_OPERATIONS_WEBHOOK_URL);
}

export function discordOperationsWebhookId(env){
  const url=webhookUrl(env);
  if(!url)return'';
  const match=url.pathname.match(/^\/api\/webhooks\/(\d+)\//);
  return match?.[1]||'';
}

export async function sendOperationsDiscord(env,{embeds=[],content='',username='Mongrel Mission Control'}={}){
  const result=await requestOperationsDiscord(env,{
    method:'POST',
    payload:{embeds,content,username},
    wait:false,
  });
  return {ok:true,status:result.status};
}

export async function createOperationsDiscordMessage(env,{embeds=[],content='',username='Mongrel Mission Control'}={}){
  const result=await requestOperationsDiscord(env,{
    method:'POST',
    payload:{embeds,content,username},
    wait:true,
  });
  return {
    ok:true,
    status:result.status,
    messageId:String(result.data?.id||''),
  };
}

export async function editOperationsDiscordMessage(env,messageId,{embeds=[],content='',username='Mongrel Mission Control'}={}){
  const id=String(messageId||'').trim();
  if(!/^\d{5,30}$/.test(id))throw new Error('discord_message_id_invalid');
  const result=await requestOperationsDiscord(env,{
    method:'PATCH',
    messageId:id,
    payload:{embeds,content,username},
    wait:false,
    expectJson:true,
  });
  return {
    ok:true,
    status:result.status,
    messageId:String(result.data?.id||id),
  };
}

async function requestOperationsDiscord(env,{method='POST',messageId='',payload={},wait=false,expectJson=false}={}){
  const base=webhookUrl(env);
  if(!base)throw new Error('discord_webhook_not_configured');

  const url=new URL(base.toString());
  if(messageId)url.pathname=url.pathname.replace(/\/$/,'')+'/messages/'+encodeURIComponent(messageId);
  if(wait)url.searchParams.set('wait','true');

  const body=normalizePayload(payload,{includeUsername:method==='POST'&&!messageId});
  const response=await fetch(url.toString(),{
    method,
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(body),
  });

  if(!response.ok){
    let detail='';
    try{detail=(await response.text()).slice(0,300);}catch{}
    console.error('Discord operations webhook failed',response.status,detail);
    const error=new Error('discord_webhook_request_failed');
    error.status=response.status;
    throw error;
  }

  let data=null;
  if(wait||expectJson){
    try{data=await response.json();}
    catch{data=null;}
  }
  return {status:response.status,data};
}

function normalizePayload({embeds=[],content='',username='Mongrel Mission Control'}={}, {includeUsername=true}={}){
  return {
    ...(includeUsername?{username:String(username||'Mongrel Mission Control').slice(0,80)}:{}),
    content:String(content||'').slice(0,2000),
    embeds:Array.isArray(embeds)?embeds.slice(0,10):[],
    allowed_mentions:{parse:[]},
  };
}

function webhookUrl(env){
  const text=String(env?.DISCORD_OPERATIONS_WEBHOOK_URL||'').trim();
  if(!validDiscordWebhookUrl(text))return null;
  try{return new URL(text);}
  catch{return null;}
}

function validDiscordWebhookUrl(value){
  const text=String(value||'').trim();
  if(!text||!DISCORD_WEBHOOK_PREFIXES.some(prefix=>text.startsWith(prefix)))return false;
  try{
    const url=new URL(text);
    return ['discord.com','discordapp.com'].includes(url.hostname)
      && /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(url.pathname);
  }catch{return false;}
}
