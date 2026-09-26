import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCompactTradeWatchDiscordPayload,
  buildTradeWatchDiscordPayload,
  parseTradeAlertCustomId,
  sendTradeWatchTestAlert,
  tradeAlertActionCustomId,
  tradeAlertCustomId,
} from '../lib/trade-discord.js';
import {
  defaultTradeControl,
  toggleTradeAlertSubscription,
} from '../lib/trade-intelligence.js';
import { evaluateTradeWatches } from '../lib/trade-watch-evaluator.js';
import {
  normalizeTradeWatch,
  readTradeWatches,
  writeTradeWatches,
} from '../lib/trade-watches.js';

class FakeKV {
  constructor(){this.map=new Map();}
  async get(key,options={}){
    if(!this.map.has(key))return null;
    const value=this.map.get(key);
    return options?.type==='json'?JSON.parse(value):value;
  }
  async put(key,value){this.map.set(key,String(value));}
  async delete(key){this.map.delete(key);}
  async list({prefix='',limit=1000}={}){
    const keys=[...this.map.keys()]
      .filter(key=>key.startsWith(prefix))
      .slice(0,limit)
      .map(name=>({name}));
    return{keys,list_complete:true};
  }
}

const control=defaultTradeControl();
const watch=normalizeTradeWatch({
  id:'12345678-abcd-4321-abcd-123456789012',
  name:'Soontil Relics Trigger',
  status:'active',
  query:{
    commodity:'Soontil Relics',
    direction:'sell',
    referenceSystem:'Diaba',
    radiusLy:100,
    minVolume:400,
    price:0,
    minPad:0,
    carrierMode:'exclude',
    maxAgeMinutes:90,
    priority:'critical',
    sort:'price',
    limit:100,
  },
  createdById:'111111111111111111',
  createdByName:'CMDR Wolf258',
  createdAt:'2026-09-25T18:00:00.000Z',
  updatedAt:'2026-09-25T18:00:00.000Z',
  evaluation:{
    state:'healthy',
    lastEvaluatedAt:'2026-09-25T18:30:00.000Z',
    matchCount:0,
    currentBest:null,
  },
  discord:{publish:true},
});

const payload=buildTradeWatchDiscordPayload(watch,{
  origin:'https://mongrels-squadron.pages.dev',
  control,
  subscriberCount:2,
});
assert.equal(payload.allowed_mentions.parse.length,0);
assert.equal(payload.content,'','expanded Watch payload must explicitly clear compact PAUSED/REMOVED content');
assert.match(payload.embeds[0].title,/Soontil Relics Trigger/);
assert.match(payload.embeds[0].description,/Automated Market Watch/);
assert.match(payload.embeds[0].fields.map(field=>field.value).join('\n'),/No qualifying market currently matches/);
assert.equal(payload.components[0].components[0].label,'Alert Me');
assert.equal(payload.components[0].components[0].custom_id,tradeAlertCustomId(watch.id));
assert.match(payload.components[0].components[1].url,/\/trading\/#watch-/);

const parsed=parseTradeAlertCustomId(tradeAlertActionCustomId(watch.id,'enable'));
assert.deepEqual(parsed,{routeId:watch.id,action:'enable'});

const bestWatch=normalizeTradeWatch({
  ...watch,
  evaluation:{
    ...watch.evaluation,
    matchCount:5,
    currentBest:{
      rank:1,
      marketId:'555',
      stationName:'Cheranovsky City',
      systemName:'Ngurii',
      price:19880,
      volume:512,
      distanceLy:12.3,
      observedAt:'2026-09-25T18:29:00.000Z',
      source:'Spansh',
    },
    rankedMarkets:[
      {rank:1,marketId:'555',stationName:'Cheranovsky City',systemName:'Ngurii',price:19880,volume:512,distanceLy:12.34567,observedAt:'2026-09-25T18:29:00.000Z',source:'Spansh'},
      {rank:2,marketId:'556',stationName:'Fallback One',systemName:'Beta',price:20100,volume:480,distanceLy:18.5678,observedAt:'2026-09-25T18:28:00.000Z',source:'Spansh'},
      {rank:3,marketId:'557',stationName:'Fallback Two',systemName:'Gamma',price:20350,volume:450,distanceLy:22.1234,observedAt:'2026-09-25T18:27:00.000Z',source:'Spansh'},
      {rank:4,marketId:'558',stationName:'Fallback Three',systemName:'Delta',price:20500,volume:425,distanceLy:25.6789,observedAt:'2026-09-25T18:26:00.000Z',source:'Spansh'},
      {rank:5,marketId:'559',stationName:'Fallback Four',systemName:'Epsilon',price:20700,volume:400,distanceLy:29.9876,observedAt:'2026-09-25T18:25:00.000Z',source:'Spansh'},
    ],
  },
});
const bestPayload=buildTradeWatchDiscordPayload(bestWatch,{origin:'https://mongrels-squadron.pages.dev',control});
assert.match(bestPayload.embeds[0].fields.map(field=>field.value).join('\n'),/Cheranovsky City/);
assert.match(bestPayload.embeds[0].fields.map(field=>field.value).join('\n'),/19,880 Cr\/t/);
assert.match(bestPayload.embeds[0].fields.map(field=>field.name).join('\n'),/Next Best Markets/);
assert.match(bestPayload.embeds[0].fields.map(field=>field.value).join('\n'),/Fallback One/);
assert.match(bestPayload.embeds[0].fields.map(field=>field.value).join('\n'),/Fallback Four/,'Discord Watch card should show rank #5');
assert.match(bestPayload.embeds[0].fields.map(field=>field.value).join('\n'),/18\.57 ly/,'Discord fallback distance should be capped at two decimals');

const rareBuyPayload=buildTradeWatchDiscordPayload(normalizeTradeWatch({
  ...watch,
  id:'99999999-abcd-4321-abcd-999999999999',
  query:{...watch.query,direction:'buy',radiusLy:5,minVolume:1},
}),{origin:'https://mongrels-squadron.pages.dev',control});
assert.match(rareBuyPayload.embeds[0].fields.map(field=>field.value).join('\n'),/all distances \(rare source\)/);
assert.match(rareBuyPayload.embeds[0].description,/hourly from 1–8 PM CT/);

const rareNoStockPayload=buildTradeWatchDiscordPayload(normalizeTradeWatch({
  ...watch,
  id:'99999999-abcd-4321-abcd-999999999998',
  name:'Soontill Relics No Stock',
  query:{...watch.query,commodity:'Soontill Relics',direction:'buy',radiusLy:200,minVolume:1},
  evaluation:{
    state:'healthy',
    matchCount:0,
    currentBest:null,
    rankedMarkets:[],
    knownRareSource:{
      rank:1,marketId:'555',stationName:'Cheranovsky City',systemName:'Ngurii',
      price:19700,volume:0,reportedVolume:0,allocationVolume:0,distanceLy:250,observedAt:'2026-09-25T18:29:00.000Z',
      source:'Spansh',qualifies:false,rareSourceStatus:'no_positive_allocation_observed',
    },
  },
}),{origin:'https://mongrels-squadron.pages.dev',control});
const rareNoStockFields=rareNoStockPayload.embeds[0].fields.map(field=>field.value).join('\n');
assert.match(rareNoStockFields,/Known Rare Source|Cheranovsky City/);
assert.match(rareNoStockFields,/0 t/);
assert.match(rareNoStockFields,/No positive allocation|zero commander reports/);

const infraWatch=normalizeTradeWatch({
  ...watch,
  id:'77777777-abcd-4321-abcd-777777777777',
  name:'Infrastructure Failure Metals',
  query:{...watch.query,commodity:'Silver',direction:'buy',minVolume:1000},
  evaluation:{
    ...watch.evaluation,
    matchCount:1,
    currentBest:{
      rank:1,
      marketId:'888',
      stationName:'Low Price Metals Port',
      systemName:'Delta',
      price:3500,
      volume:25000,
      distanceLy:42.123,
      observedAt:'2026-09-25T18:29:00.000Z',
      source:'Spansh',
      bgs:{
        controllingFaction:'Delta Metals Cooperative',
        factionState:'Infrastructure Failure',
        stationPrimaryEconomy:'Industrial',
        stationSecondaryEconomy:'Refinery',
        stationEconomies:[{name:'Industrial',share:0.6},{name:'Refinery',share:0.4}],
        systemPrimaryEconomy:'Industrial',
        systemSecondaryEconomy:'Refinery',
        metadataAt:'2026-09-25T12:00:00.000Z',
        metadataAgeMinutes:390,
        metadataLagMinutes:389,
        metadataFreshness:'fresh',
        infrastructureFailure:true,
        metalCommodity:true,
        infrastructureFailureMetalOpportunity:true,
        ownershipNeedsConfirmation:false,
        source:'Spansh station metadata',
      },
    },
    rankedMarkets:[],
  },
});
const infraPayload=buildTradeWatchDiscordPayload(infraWatch,{origin:'https://mongrels-squadron.pages.dev',control});
assert.match(infraPayload.embeds[0].fields.map(field=>field.name).join('\n'),/Infrastructure Failure Metal Source/);
assert.match(infraPayload.embeds[0].fields.map(field=>field.value).join('\n'),/Delta Metals Cooperative/);

const staleInfraWatch=normalizeTradeWatch({
  ...infraWatch,
  id:'66666666-abcd-4321-abcd-666666666666',
  evaluation:{
    ...infraWatch.evaluation,
    currentBest:{
      ...infraWatch.evaluation.currentBest,
      bgs:{
        ...infraWatch.evaluation.currentBest.bgs,
        metadataFreshness:'stale',
        metadataAgeMinutes:6000,
        ownershipNeedsConfirmation:true,
      },
    },
  },
});
const staleInfraPayload=buildTradeWatchDiscordPayload(staleInfraWatch,{origin:'https://mongrels-squadron.pages.dev',control});
assert.match(staleInfraPayload.embeds[0].fields.map(field=>field.value).join('\n'),/Ownership needs confirmation/);

const compact=buildCompactTradeWatchDiscordPayload(watch,{control,reason:'Removed'});
assert.match(compact.content,/REMOVED/);
assert.deepEqual(compact.components,[]);

const normalized=normalizeTradeWatch({
  ...watch,
  discord:{
    publish:true,
    messageId:'900000000000000001',
    channelId:'1552127291234983956',
    lastSyncedAt:'2026-09-25T18:31:00.000Z',
    lifecycle:'active',
    lastAlertAt:'2026-09-25T18:32:00.000Z',
    lastAlertType:'condition_met',
  },
});
assert.equal(normalized.discord.messageId,'900000000000000001');
assert.equal(normalized.discord.lastAlertType,'condition_met');

const env={TRADES:new FakeKV(),DISCORD_BOT_TOKEN:'test-bot-token'};
const liveWatch=normalizeTradeWatch({
  ...watch,
  evaluation:{state:'pending_scheduler'},
  createdAt:new Date(Date.now()-60000).toISOString(),
  updatedAt:new Date(Date.now()-60000).toISOString(),
});
await writeTradeWatches(env,[liveWatch]);

let marketRows=[];
const marketFetch=async ()=>new Response(JSON.stringify({count:marketRows.length,results:marketRows}),{
  status:200,
  headers:{'Content-Type':'application/json'},
});

const discordCalls=[];
let channelPostCount=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async (input,options={})=>{
  const url=String(input);
  discordCalls.push({url,method:options.method||'GET',body:options.body||''});
  if(url.includes('/users/@me/channels')){
    return new Response(JSON.stringify({id:'777777777777777777'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url.includes('/channels/777777777777777777/messages')){
    return new Response(JSON.stringify({id:'778888888888888888'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if((options.method||'GET')==='PATCH'){
    const id=url.split('/').pop();
    return new Response(JSON.stringify({id}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url.includes('/channels/1552127291234983956/messages')){
    channelPostCount+=1;
    const id=channelPostCount===1?'900000000000000001':'900000000000000002';
    return new Response(JSON.stringify({id}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
};

try{
  const baseline=await evaluateTradeWatches(env,{
    now:Date.now(),
    force:true,
    fetchImpl:marketFetch,
    origin:'https://mongrels-squadron.pages.dev',
  });
  assert.equal(baseline.results[0].transition,'baseline');
  assert.equal(baseline.discord.synced,1);
  assert.equal(baseline.discord.alerts,0);

  let stored=(await readTradeWatches(env))[0];
  assert.equal(stored.discord.messageId,'900000000000000001');
  assert.equal(stored.discord.channelId,'1552127291234983956');

  await toggleTradeAlertSubscription(env,{
    routeId:stored.id,
    userId:'222222222222222222',
    displayName:'CMDR Tester',
  });

  const beforeTestAlert=JSON.stringify((await readTradeWatches(env))[0]);
  const testAlert=await sendTradeWatchTestAlert(env,{
    watch:(await readTradeWatches(env))[0],
    origin:'https://mongrels-squadron.pages.dev',
    control,
  });
  assert.equal(testAlert.ok,true);
  assert.equal(testAlert.subscriberCount,1);
  assert.equal(testAlert.delivered,1);
  assert.equal(testAlert.failed,0);
  assert.equal(JSON.stringify((await readTradeWatches(env))[0]),beforeTestAlert,'Test Alert must not mutate Watch state or alert history');

  const now=Date.now();
  marketRows=[{
    id:'555',
    market_id:'555',
    name:'Cheranovsky City',
    type:'Coriolis Starport',
    distance_to_arrival:420,
    large_pads:4,medium_pads:4,small_pads:4,
    system_id64:'123',
    system_name:'Ngurii',
    system_x:1,system_y:2,system_z:3,
    carrier_docking_access:null,
    market_updated_at:new Date(now-60000).toISOString(),
    distance:12.3,
    market:[{commodity:'Soontil Relics',buy_price:10000,sell_price:19880,supply:512,demand:512}],
  }];

  const triggered=await evaluateTradeWatches(env,{
    now:now+5*60*1000,
    force:true,
    fetchImpl:marketFetch,
    origin:'https://mongrels-squadron.pages.dev',
  });
  assert.equal(triggered.results[0].transition,'condition_met');
  assert.equal(triggered.discord.synced,1);
  assert.equal(triggered.discord.alerts,1);
  assert.equal(triggered.discord.delivered,1);

  stored=(await readTradeWatches(env))[0];
  assert.equal(stored.discord.lastAlertType,'condition_met');
  assert.ok(stored.discord.lastAlertAt);
  assert.equal(stored.evaluation.matchCount,1);

  const alertChannelPosts=discordCalls.filter(call=>
    call.url.includes('/channels/1552127291234983956/messages')
    &&call.method==='POST'
  );
  assert.equal(alertChannelPosts.length,3,'baseline card + test alert + transition alert should be separate channel posts');
  assert.match(alertChannelPosts[0].body,/"flags":4096/,'routine Watch card must suppress channel notifications');
  assert.match(alertChannelPosts[1].body,/TEST ALERT/,'Officer Test Alert must be unmistakably labeled');
  assert.match(alertChannelPosts[1].body,/"flags":4096/,'Test Alert channel message must stay silent for everyone');
  assert.match(alertChannelPosts[2].body,/"flags":4096/,'transition channel alert must also stay silent for everyone');
  assert.ok(discordCalls.some(call=>call.url.includes('/users/@me/channels')),'subscriber should receive the DM delivery path');

  const noChange=await evaluateTradeWatches(env,{
    now:now+10*60*1000,
    force:true,
    fetchImpl:marketFetch,
    origin:'https://mongrels-squadron.pages.dev',
  });
  assert.equal(noChange.results[0].transition,'','unchanged state must not repeat the prior transition');
  assert.equal(noChange.discord.alerts,0,'unchanged state must not send another subscriber alert');
}finally{
  globalThis.fetch=originalFetch;
}

const interactions=readFileSync(new URL('../functions/api/discord/interactions.js',import.meta.url),'utf8');
assert.match(interactions,/readTradeWatches/);
assert.match(interactions,/syncTradeWatchDiscord/);
assert.match(interactions,/Alerts Enabled ✓/);

const testAlertApi=readFileSync(new URL('../functions/api/trade-watches/test-alert.js',import.meta.url),'utf8');
assert.match(testAlertApi,/officer','site_admin/);
assert.match(testAlertApi,/trade-watch-test-alert/);
assert.match(testAlertApi,/sendTradeWatchTestAlert/);
assert.match(testAlertApi,/watch_not_active/);
assert.match(testAlertApi,/watch_discord_disabled/);

const tradingClient=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(tradingClient,/Test Alert/);
assert.match(tradingClient,/\/api\/trade-watches\/test-alert/);
assert.match(tradingClient,/will not change the Watch state/);

const watchApi=readFileSync(new URL('../functions/api/trade-watches/index.js',import.meta.url),'utf8');
assert.match(watchApi,/closeTradeWatchDiscord/);
assert.match(watchApi,/removeTradeAlertSubscriptions/);
assert.match(watchApi,/syncTradeWatchDiscord/);

const discord=readFileSync(new URL('../lib/trade-discord.js',import.meta.url),'utf8');
const evaluator=readFileSync(new URL('../lib/trade-watch-evaluator.js',import.meta.url),'utf8');
assert.match(evaluator,/sendTradeWatchTransitionAlert/);
assert.match(evaluator,/condition_met','condition_cleared','best_market_changed','rare_allocation_changed/);
assert.match(discord,/has \*\*not disappeared\*\*/);
assert.match(discord,/Rare-source buys are searched at all distances/);
assert.match(discord,/Rare Allocation Changed/);
assert.match(discord,/Zero\/partial commander depletion reports are ignored/);
assert.match(discord,/Tracked Allocation/);
assert.match(evaluator,/syncEvaluatedWatchDiscord/);
assert.match(evaluator,/TRADE_WATCH_SHORTLIST_SIZE=5/);
assert.match(evaluator,/rankedMarkets/);

console.log('Trade Watch Discord smoke checks passed.');
