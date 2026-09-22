const DISCORD_WEBHOOK_PREFIXES=[
  'https://discord.com/api/webhooks/',
  'https://discordapp.com/api/webhooks/',
];

export function discordOperationsConfigured(env){
  return validDiscordWebhookUrl(env?.DISCORD_OPERATIONS_WEBHOOK_URL);
}

export async function sendOperationsDiscord(env,{embeds=[],content='',username='Mongrel Mission Control'}={}){
  const url=String(env?.DISCORD_OPERATIONS_WEBHOOK_URL||'').trim();
  if(!validDiscordWebhookUrl(url))throw new Error('discord_webhook_not_configured');

  const payload={
    username:String(username||'Mongrel Mission Control').slice(0,80),
    content:String(content||'').slice(0,2000),
    embeds:Array.isArray(embeds)?embeds.slice(0,10):[],
    allowed_mentions:{parse:[]},
  };

  const response=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(payload),
  });

  if(!response.ok){
    let detail='';
    try{detail=(await response.text()).slice(0,300);}catch{}
    console.error('Discord operations webhook failed',response.status,detail);
    const error=new Error('discord_webhook_request_failed');
    error.status=response.status;
    throw error;
  }
  return {ok:true,status:response.status};
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
