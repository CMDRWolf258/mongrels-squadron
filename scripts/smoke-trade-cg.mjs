import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCgCandidates,
  cgRouteEligibleForPrimary,
  normalizeCgSolverSettings,
  normalizeTradeCgCampaign,
  parseRouteKey,
  routeKey,
  sortCgCandidates,
  writeTradeCgCampaigns,
  readTradeCgCampaigns,
} from '../lib/trade-cg.js';
import {
  evaluateTradeCgCampaigns,
} from '../lib/trade-cg-evaluator.js';
import { buildTradeCgDiscordPayload } from '../lib/trade-cg-discord.js';

class FakeKV{
  constructor(){this.map=new Map();}
  async get(key,options){
    if(!this.map.has(key))return null;
    const value=this.map.get(key);
    if(options?.type==='json')return JSON.parse(value);
    return value;
  }
  async put(key,value){this.map.set(key,String(value));}
  async delete(key){this.map.delete(key);}
}

const settings=normalizeCgSolverSettings({
  cargoCapacity:784,
  radiusLy:100,
  minPad:3,
  carrierMode:'exclude',
  maxAgeMinutes:120,
  primaryFreshMinutes:60,
  minPrimarySupply:5000,
  refreshMinutes:15,
  promotionHoldMinutes:5,
});
assert.equal(settings.promotionHoldMinutes,60,'CG replacement hold must stay fixed at one hour');
assert.equal(settings.refreshMinutes,15);

const campaign=normalizeTradeCgCampaign({
  id:'cg-12345678',
  title:'Test Hauling CG',
  status:'active',
  destinationSystem:'Goal System',
  destinationStation:'Goal Port',
  commodities:['Bertrandite','Indite'],
  endsAt:'2026-10-01T00:00:00Z',
  automation:settings,
  createdAt:'2026-09-26T18:00:00Z',
  updatedAt:'2026-09-26T18:00:00Z',
});
assert.ok(campaign);
assert.deepEqual(campaign.commodities,['Bertrandite','Indite']);

const destination={
  marketId:'DEST',
  stationName:'Goal Port',
  systemName:'Goal System',
  stationType:'Orbis Starport',
  stationControllingFaction:'Goal Faction',
  carrier:false,
  maxLandingPadSize:3,
  distanceLy:0,
  distanceToArrivalLs:500,
  observedAt:'2026-09-26T18:00:00Z',
  market:[
    {commodity:'Bertrandite',buyPrice:0,sellPrice:30000,supply:0,demand:0},
    {commodity:'Indite',buyPrice:0,sellPrice:26000,supply:0,demand:0},
  ],
};
const alpha={
  marketId:'A',
  stationName:'Alpha Hub',
  systemName:'Alpha',
  stationType:'Coriolis Starport',
  stationControllingFaction:'Alpha Faction',
  carrier:false,
  maxLandingPadSize:3,
  distanceLy:20,
  distanceToArrivalLs:800,
  observedAt:'2026-09-26T18:00:00Z',
  market:[
    {commodity:'Bertrandite',buyPrice:10000,sellPrice:0,supply:10000,demand:0},
  ],
};
const beta={
  marketId:'B',
  stationName:'Beta Hub',
  systemName:'Beta',
  stationType:'Coriolis Starport',
  stationControllingFaction:'Beta Faction',
  carrier:false,
  maxLandingPadSize:3,
  distanceLy:30,
  distanceToArrivalLs:1200,
  observedAt:'2026-09-26T18:00:00Z',
  market:[
    {commodity:'Indite',buyPrice:5000,sellPrice:0,supply:20000,demand:0},
  ],
};

const candidates=buildCgCandidates([destination,alpha,beta],destination,campaign,settings,Date.parse('2026-09-26T18:05:00Z'));
assert.equal(candidates.length,2);
const profitRanked=sortCgCandidates(candidates,'profit');
assert.equal(profitRanked[0].sourceMarketId,'B');
assert.equal(profitRanked[0].commodity,'Indite');
assert.equal(profitRanked[0].profitPerTon,21000);
assert.equal(profitRanked[0].tripProfit,16464000);
assert.equal(profitRanked[0].healthy,true);
assert.equal(cgRouteEligibleForPrimary(profitRanked[0]),true);

const supplyRanked=sortCgCandidates(candidates,'supply');
assert.equal(supplyRanked[0].sourceMarketId,'B');

const key=routeKey('B','Indite');
assert.deepEqual(parseRouteKey(key),{marketId:'B',commodity:'Indite'});

const env={TRADES:new FakeKV()};
await writeTradeCgCampaigns(env,[campaign]);

let clock=Date.parse('2026-09-26T18:05:00Z');
let mode='initial';
function stationPayload(){
  const at=new Date(clock-5*60*1000).toISOString();
  const aBuy=mode==='initial'?10000:9000;
  const bBuy=mode==='initial'?5000:1000;
  return{
    count:3,
    results:[
      {
        id:'DEST',market_id:'DEST',name:'Goal Port',type:'Orbis Starport',
        system_name:'Goal System',distance:0,distance_to_arrival:500,
        large_pads:4,medium_pads:4,small_pads:4,
        market_updated_at:at,
        market:[
          {commodity:'Bertrandite',buy_price:0,sell_price:30000,supply:0,demand:0},
          {commodity:'Indite',buy_price:0,sell_price:26000,supply:0,demand:0},
        ],
      },
      {
        id:'A',market_id:'A',name:'Alpha Hub',type:'Coriolis Starport',
        system_name:'Alpha',distance:20,distance_to_arrival:800,
        large_pads:4,medium_pads:4,small_pads:4,
        market_updated_at:at,
        market:[{commodity:'Bertrandite',buy_price:aBuy,sell_price:0,supply:12000,demand:0}],
      },
      {
        id:'B',market_id:'B',name:'Beta Hub',type:'Coriolis Starport',
        system_name:'Beta',distance:30,distance_to_arrival:1200,
        large_pads:4,medium_pads:4,small_pads:4,
        market_updated_at:at,
        market:[{commodity:'Indite',buy_price:bBuy,sell_price:0,supply:18000,demand:0}],
      },
    ],
  };
}
const fetchImpl=async()=>new Response(JSON.stringify(stationPayload()),{
  status:200,headers:{'Content-Type':'application/json'},
});

let first=await evaluateTradeCgCampaigns(env,{
  campaignIds:[campaign.id],force:true,maxCampaigns:1,now:clock,fetchImpl,
});
assert.equal(first.succeeded,1);
let stored=(await readTradeCgCampaigns(env))[0];
assert.ok(stored.primary,'first healthy route should immediately become primary');
assert.equal(stored.primary.sourceMarketId,'B');
assert.equal(stored.pendingPrimary,null);
assert.equal(first.results[0].transition,'primary_initialized');

// Make Alpha the better route after the first primary is established.
mode='replacement';
clock+=15*60*1000;
// In replacement mode B is still better with the current fixture, so swap the market data explicitly.
const replacementFetch=async()=>{
  const at=new Date(clock-5*60*1000).toISOString();
  return new Response(JSON.stringify({
    count:3,
    results:[
      {
        id:'DEST',market_id:'DEST',name:'Goal Port',type:'Orbis Starport',
        system_name:'Goal System',distance:0,distance_to_arrival:500,
        large_pads:4,medium_pads:4,small_pads:4,market_updated_at:at,
        market:[
          {commodity:'Bertrandite',buy_price:0,sell_price:30000,supply:0,demand:0},
          {commodity:'Indite',buy_price:0,sell_price:26000,supply:0,demand:0},
        ],
      },
      {
        id:'A',market_id:'A',name:'Alpha Hub',type:'Coriolis Starport',
        system_name:'Alpha',distance:20,distance_to_arrival:800,
        large_pads:4,medium_pads:4,small_pads:4,market_updated_at:at,
        market:[{commodity:'Bertrandite',buy_price:1000,sell_price:0,supply:15000,demand:0}],
      },
      {
        id:'B',market_id:'B',name:'Beta Hub',type:'Coriolis Starport',
        system_name:'Beta',distance:30,distance_to_arrival:1200,
        large_pads:4,medium_pads:4,small_pads:4,market_updated_at:at,
        market:[{commodity:'Indite',buy_price:10000,sell_price:0,supply:18000,demand:0}],
      },
    ],
  }),{status:200,headers:{'Content-Type':'application/json'}});
};

let second=await evaluateTradeCgCampaigns(env,{
  campaignIds:[campaign.id],force:true,maxCampaigns:1,now:clock,fetchImpl:replacementFetch,
});
stored=(await readTradeCgCampaigns(env))[0];
assert.equal(stored.primary.sourceMarketId,'B','new best route should not replace primary immediately');
assert.equal(stored.pendingPrimary.route.sourceMarketId,'A');
assert.equal(second.results[0].transition,'candidate_started');
const promoteAt=Date.parse(stored.pendingPrimary.promoteAfter);
assert.equal(promoteAt,clock+60*60*1000);

clock+=45*60*1000;
await evaluateTradeCgCampaigns(env,{
  campaignIds:[campaign.id],force:true,maxCampaigns:1,now:clock,fetchImpl:replacementFetch,
});
stored=(await readTradeCgCampaigns(env))[0];
assert.equal(stored.primary.sourceMarketId,'B');
assert.equal(stored.pendingPrimary.route.sourceMarketId,'A');

clock+=15*60*1000;
const promoted=await evaluateTradeCgCampaigns(env,{
  campaignIds:[campaign.id],force:true,maxCampaigns:1,now:clock,fetchImpl:replacementFetch,
});
stored=(await readTradeCgCampaigns(env))[0];
assert.equal(stored.primary.sourceMarketId,'A','same healthy #1 candidate should auto-promote after one hour');
assert.equal(stored.pendingPrimary,null);
assert.equal(stored.primary.promotionReason,'auto_after_1h_stable');
assert.equal(promoted.results[0].transition,'primary_promoted');

const discord=buildTradeCgDiscordPayload(stored,{origin:'https://mongrels-squadron.pages.dev',control:{discord:{mode:'testing'}}});
assert.match(discord.embeds[0].description,/1 hour/);
assert.match(discord.embeds[0].fields.map(field=>field.value).join('\n'),/Alpha Hub/);

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/data-trade-cg/);
assert.match(html,/Community Goal Operations/);
assert.match(html,/data-cg-create/);
assert.match(html,/data-cg-form/);
assert.match(html,/trade-cg\.css\?v=1/);
assert.match(html,/trade-cg\.js\?v=1/);
assert.match(html,/trading\.js\?v=87/);
assert.match(html,/data-trading-build="93"/);

const client=readFileSync(new URL('../js/trade-cg.js',import.meta.url),'utf8');
assert.match(client,/\/api\/trade-cg\/search/);
assert.match(client,/Promote Pending Now/);
assert.match(client,/Find Best CG Routes/);
assert.match(client,/Post Route/);

const internal=readFileSync(new URL('../functions/api/internal/trade-watch-evaluate.js',import.meta.url),'utf8');
assert.match(internal,/evaluateTradeCgCampaigns/);
assert.match(internal,/communityGoals/);

const api=readFileSync(new URL('../functions/api/trade-cg/index.js',import.meta.url),'utf8');
assert.match(api,/promote_pending/);
assert.match(api,/evaluateTradeCgCampaigns/);

console.log('Community Goal Operations smoke checks passed.');
