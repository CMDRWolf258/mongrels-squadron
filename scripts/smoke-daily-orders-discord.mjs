import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildDailyOrdersDiscordPayload,
  clearDailyOrdersDiscord,
  syncDailyOrdersDiscord,
} from '../lib/daily-orders-discord.js';

function fakeKv(seed={}){
  const map=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
  return {
    map,
    async get(key,{type}={}){
      const value=map.get(key);
      if(value===undefined)return null;
      return type==='json'?JSON.parse(value):value;
    },
    async put(key,value){map.set(key,String(value));},
  };
}

const systemTestingWebhook='https://discord.com/api/webhooks/'+'1234567890/'+'system_testing_unit_test';
const missionControlWebhook='https://discord.com/api/webhooks/'+'2468135790/'+'mission_control_unit_test';
const env={
  DISCORD_OPERATIONS_WEBHOOK_URL:systemTestingWebhook,
  DISCORD_MISSION_CONTROL_WEBHOOK_URL:missionControlWebhook,
  DAILY_ORDERS:fakeKv({
    'discord-daily-orders-v1':{
      version:1,
      current:{
        cycleId:'legacy-cycle',
        messageId:'111111',
        webhookId:'1234567890',
        publicationId:'legacy-publication',
        lastSyncedAt:'2026-09-22T21:00:00.000Z',
        lastMode:'edited',
        cleared:false,
      },
    },
  }),
};
const base={
  configured:true,
  title:'Squadron Daily Orders',
  briefing:'Execute the reviewed work below and report results in Mission Control.',
  updatedAt:'2026-09-22T22:00:00.000Z',
  updatedBy:'Wolf',
  cycleId:'cycle-a',
  orders:[
    {id:'1',system:'Diaba',faction:'Regiment of Imperial Mongrels',priority:'high',kind:'bounties',task:'Claim 20–30M bounty vouchers'},
    {id:'2',system:'Diaba',faction:'Regiment of Imperial Mongrels',priority:'high',kind:'inf',task:'Complete 15 INF missions'},
    {id:'3',system:'Miwae',faction:'Regiment of Imperial Mongrels',priority:'critical',kind:'trade',task:'Complete 20M profitable trade'},
  ],
};

const missionControl='https://mongrels-squadron.pages.dev/operations/#daily-orders';
const payload=buildDailyOrdersDiscordPayload(base,{actor:'Wolf',missionControlUrl:missionControl});
assert.equal(payload.embeds[0].fields.length,2,'Orders should group into one Discord field per system');
assert.equal(payload.embeds[0].fields[0].name,'Diaba · HIGH');
assert.match(payload.embeds[0].fields[0].value,/\*\*BOUNTIES\*\* Claim 20–30M bounty vouchers/);
assert.doesNotMatch(payload.embeds[0].fields[0].value,/\*\*HIGH\*\*/,'Shared system priority should not be repeated on each order line');
assert.match(payload.embeds[0].description,/Open Mission Control/);
assert.match(payload.embeds[0].footer.text,/3 tasks · 2 systems · Published by Wolf/);

const worstCase={
  ...base,
  cycleId:'cycle-limit',
  briefing:'B'.repeat(1200),
  orders:Array.from({length:24},(_,index)=>({
    id:String(index+1),
    system:'Long System Name '+String(index+1).padStart(2,'0')+' Sector ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    priority:'critical',
    kind:'bounties',
    task:'Complete this deliberately long operational assignment '.repeat(6),
  })),
};
const mixedPayload=buildDailyOrdersDiscordPayload({
  ...base,
  orders:[
    {...base.orders[0],priority:'high'},
    {...base.orders[1],priority:'low'},
  ],
},{actor:'Wolf',missionControlUrl:missionControl});
assert.equal(mixedPayload.embeds[0].fields[0].name,'Diaba · MIXED','Priority disagreement should stay visible instead of being silently hidden');

const worstPayload=buildDailyOrdersDiscordPayload(worstCase,{actor:'Wolf',missionControlUrl:missionControl});
const embed=worstPayload.embeds[0];
const embedChars=(embed.title||'').length+(embed.description||'').length+(embed.footer?.text||'').length
  +(embed.fields||[]).reduce((sum,field)=>sum+String(field.name||'').length+String(field.value||'').length,0);
assert.ok(embedChars<6000,'Daily Orders embed must remain below Discord total embed text limit');

const requests=[];
let nextMessage=111111;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  requests.push({url:String(url),options,body:options.body?JSON.parse(options.body):null});
  if(options.method==='POST'){
    return Response.json({id:String(nextMessage++)},{status:200});
  }
  if(options.method==='PATCH'){
    const match=String(url).match(/\/messages\/(\d+)/);
    return Response.json({id:match?.[1]||'999999'},{status:200});
  }
  return new Response(null,{status:204});
};

try{
  const first=await syncDailyOrdersDiscord(env,{
    document:base,actor:'Wolf',missionControlUrl:missionControl,publicationId:'pub-1',
  });
  assert.equal(first.ok,true);
  assert.equal(first.mode,'created');
  assert.equal(requests[0].options.method,'DELETE','Legacy Daily Orders message must be removed from System Testing first');
  assert.match(requests[0].url,/\/api\/webhooks\/1234567890\/.*\/messages\/111111/);
  assert.equal(requests[1].options.method,'POST');
  assert.match(requests[1].url,/\/api\/webhooks\/2468135790\//,'Daily Orders must seed into the dedicated Mission Control webhook');
  assert.match(requests[1].url,/wait=true/);
  assert.deepEqual(requests[1].body.allowed_mentions,{parse:[]});

  const revised={...base,updatedAt:'2026-09-22T22:05:00.000Z',orders:[...base.orders,{id:'4',system:'Baldur',priority:'high',kind:'inf',task:'Complete 10 INF'}]};
  const second=await syncDailyOrdersDiscord(env,{
    document:revised,actor:'Wolf',publicationId:'pub-2',missionControlUrl:missionControl,
  });
  assert.equal(second.ok,true);
  assert.equal(second.mode,'edited');
  assert.equal(requests[3].options.method,'PATCH');
  assert.match(requests[3].url,/\/messages\/111111/);

  const nextCycle={...base,cycleId:'cycle-b',updatedAt:'2026-09-23T22:00:00.000Z'};
  const third=await syncDailyOrdersDiscord(env,{
    document:nextCycle,actor:'Wolf',publicationId:'pub-3',missionControlUrl:missionControl,
  });
  assert.equal(third.mode,'edited','A new Daily Orders publication cycle must reuse the living Discord announcement');
  assert.equal(requests[2].options.method,'PATCH');
  assert.match(requests[2].url,/\/messages\/111111/);

  const cleared=await clearDailyOrdersDiscord(env,{
    previous:nextCycle,actor:'Wolf',publicationId:'pub-4',missionControlUrl:missionControl,
  });
  assert.equal(cleared.ok,true);
  assert.equal(cleared.mode,'cleared');
  assert.equal(requests[4].options.method,'PATCH');
  assert.equal(requests[4].body.embeds[0].title,'Daily Orders Cleared');

  const stored=JSON.parse(env.DAILY_ORDERS.map.get('discord-daily-orders-v1'));
  assert.equal(stored.current.cycleId,'cycle-b');
  assert.equal(stored.current.messageId,'111111','The living Daily Orders message ID should survive cycle rollover');
  assert.equal(stored.current.cleared,true);

  env.DISCORD_MISSION_CONTROL_WEBHOOK_URL='https://discord.com/api/webhooks/'+'9876543210/'+'replacement_mission_control_token';
  const changedWebhook=await syncDailyOrdersDiscord(env,{
    document:{...nextCycle,cycleId:'cycle-c'},actor:'Wolf',publicationId:'pub-5',missionControlUrl:missionControl,
  });
  assert.equal(changedWebhook.mode,'created','Changing webhook/channel should create the living message in the new destination');
  assert.equal(requests[5].options.method,'POST');
}finally{
  globalThis.fetch=originalFetch;
}

const noWebhook=await syncDailyOrdersDiscord({DAILY_ORDERS:fakeKv()},{document:base});
assert.equal(noWebhook.configured,false);
assert.equal(noWebhook.attempted,false);

const ordersApi=readFileSync('functions/api/operations/orders.js','utf8');
for(const pattern of [/syncDailyOrdersDiscord/,/clearDailyOrdersDiscord/,/missionControlUrlForRequest/,/discord,/])assert.match(ordersApi,pattern);

const manualEndpoint=readFileSync('functions/api/operations/discord-daily-orders.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /X-Mongrels-Request/,
  /wolf-bgs-control/,
  /no_daily_orders_published/,
  /syncDailyOrdersDiscord/,
  /discordMissionControlConfigured/,
])assert.match(manualEndpoint,pattern);

const publisher=readFileSync('js/wolf-bgs-publish.js','utf8');
for(const pattern of [/data\?\.discord\?\.ok/,/data\.discord\.mode==='edited'/,/announcement updated\./,/Discord sync failed/])assert.match(publisher,pattern);

console.log('✓ Daily Orders migrate the living announcement from System Testing to Mission Control, then reuse it across cycle rollover');
