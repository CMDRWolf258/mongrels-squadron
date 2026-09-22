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

const syntheticWebhook='https://discord.com/api/webhooks/'+'1234567890/'+'unit_test_token';
const env={
  DISCORD_OPERATIONS_WEBHOOK_URL:syntheticWebhook,
  DAILY_ORDERS:fakeKv(),
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
    {id:'2',system:'Diaba',faction:'Regiment of Imperial Mongrels',priority:'normal',kind:'inf',task:'Complete 15 INF missions'},
    {id:'3',system:'Miwae',faction:'Regiment of Imperial Mongrels',priority:'critical',kind:'trade',task:'Complete 20M profitable trade'},
  ],
};

const missionControl='https://mongrels-squadron.pages.dev/operations/#daily-orders';
const payload=buildDailyOrdersDiscordPayload(base,{actor:'Wolf',missionControlUrl:missionControl});
assert.equal(payload.embeds[0].fields.length,2,'Orders should group into one Discord field per system');
assert.equal(payload.embeds[0].fields[0].name,'Diaba');
assert.match(payload.embeds[0].fields[0].value,/20–30M bounty vouchers/);
assert.match(payload.embeds[0].description,/Open Mission Control/);
assert.match(payload.embeds[0].footer.text,/3 tasks · 2 systems · Published by Wolf/);

const requests=[];
let nextMessage=111111;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  requests.push({url:String(url),options,body:JSON.parse(options.body)});
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
  assert.equal(requests[0].options.method,'POST');
  assert.match(requests[0].url,/wait=true/);
  assert.deepEqual(requests[0].body.allowed_mentions,{parse:[]});

  const revised={...base,updatedAt:'2026-09-22T22:05:00.000Z',orders:[...base.orders,{id:'4',system:'Baldur',priority:'high',kind:'inf',task:'Complete 10 INF'}]};
  const second=await syncDailyOrdersDiscord(env,{
    document:revised,actor:'Wolf',publicationId:'pub-2',missionControlUrl:missionControl,
  });
  assert.equal(second.ok,true);
  assert.equal(second.mode,'edited');
  assert.equal(requests[1].options.method,'PATCH');
  assert.match(requests[1].url,/\/messages\/111111/);

  const nextCycle={...base,cycleId:'cycle-b',updatedAt:'2026-09-23T22:00:00.000Z'};
  const third=await syncDailyOrdersDiscord(env,{
    document:nextCycle,actor:'Wolf',publicationId:'pub-3',missionControlUrl:missionControl,
  });
  assert.equal(third.mode,'created','A genuinely new Daily Orders cycle should create a new Discord post');
  assert.equal(requests[2].options.method,'POST');

  const cleared=await clearDailyOrdersDiscord(env,{
    previous:nextCycle,actor:'Wolf',publicationId:'pub-4',missionControlUrl:missionControl,
  });
  assert.equal(cleared.ok,true);
  assert.equal(cleared.mode,'cleared');
  assert.equal(requests[3].options.method,'PATCH');
  assert.equal(requests[3].body.embeds[0].title,'Daily Orders Cleared');

  const stored=JSON.parse(env.DAILY_ORDERS.map.get('discord-daily-orders-v1'));
  assert.equal(stored.current.cycleId,'cycle-b');
  assert.equal(stored.current.cleared,true);
}finally{
  globalThis.fetch=originalFetch;
}

const noWebhook=await syncDailyOrdersDiscord({DAILY_ORDERS:fakeKv()},{document:base});
assert.equal(noWebhook.configured,false);
assert.equal(noWebhook.attempted,false);

const ordersApi=readFileSync('functions/api/operations/orders.js','utf8');
for(const pattern of [/syncDailyOrdersDiscord/,/clearDailyOrdersDiscord/,/missionControlUrlForRequest/,/discord,/])assert.match(ordersApi,pattern);

const publisher=readFileSync('js/wolf-bgs-publish.js','utf8');
for(const pattern of [/data\?\.discord\?\.ok/,/data\.discord\.mode==='edited'/,/announcement updated\./,/Discord sync failed/])assert.match(publisher,pattern);

console.log('✓ Daily Orders create, edit, replace-cycle, clear, and publish-status Discord behavior is wired');
