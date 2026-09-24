import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildPayoutRequestDiscordPayload,
  buildPersonalRewardSummaryDiscordPayload,
  buildSquadRewardSummaryDiscordPayload,
  loadRewardDiscordView,
  syncRewardDiscordBoard,
} from '../lib/reward-discord.js';

function fakeKv(seed={}){
  const map=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
  return{
    map,
    async get(key,{type}={}){
      const value=map.get(key);
      if(value===undefined)return null;
      return type==='json'?JSON.parse(value):value;
    },
    async put(key,value){map.set(key,String(value));},
    async delete(key){map.delete(key);},
    async list({prefix=''}={}) {
      return {keys:[...map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),list_complete:true};
    },
  };
}

const squadEntry={
  id:'daily:a1',
  ownerId:'user-a',
  displayName:'CMDR Alpha',
  kind:'verified_order',
  amountCredits:30_000_000,
  fundingMode:'squad',
  status:'owed',
  createdAt:'2026-09-23T00:00:00Z',
};
const newEntry={
  id:'scout:a2',
  ownerId:'user-a',
  displayName:'CMDR Alpha',
  kind:'scouting_job',
  amountCredits:5_000_000,
  fundingMode:'squad',
  status:'owed',
  createdAt:'2026-09-23T00:05:00Z',
};
const otherEntry={
  id:'colonization:b1',
  ownerId:'user-b',
  displayName:'CMDR Bravo',
  kind:'colonization_job',
  amountCredits:20_000_000,
  fundingMode:'squad',
  status:'owed',
  createdAt:'2026-09-23T00:02:00Z',
};
const memberFunded={
  id:'colonization:private',
  ownerId:'user-c',
  displayName:'CMDR Charlie',
  kind:'colonization_job',
  amountCredits:99_000_000,
  fundingMode:'member',
  payerOwnerId:'payer-x',
  payerDisplayName:'CMDR Payer',
  reason:'Verified Colonization Job reward · 5,000 t · Personal Build Run',
  status:'owed',
  createdAt:'2026-09-23T00:03:00Z',
};
const payoutRequest={
  version:1,
  requestId:'payout-request-alpha',
  ownerId:'user-a',
  displayName:'CMDR Alpha',
  state:'requested',
  requestedAt:'2026-09-23T00:04:00Z',
  requestedBy:'CMDR Alpha',
  requestedCredits:30_000_000,
  entryIds:['daily:a1'],
  fulfilledAt:null,
  fulfilledBy:'',
  paymentBatchId:'',
  cancelledAt:null,
  cancelledBy:'',
  updatedAt:'2026-09-23T00:04:00Z',
};

const env={
  DAILY_ORDERS:fakeKv({
    'reward-ledger:user-a:a1':squadEntry,
    'reward-ledger:user-a:a2':newEntry,
    'reward-ledger:user-b:b1':otherEntry,
    'reward-ledger:user-c:c1':memberFunded,
    'reward-payout-request:user-a':payoutRequest,
    'discord-rewards-v1':{
      version:1,
      summary:{messageId:'710001',webhookId:'1234567890',fingerprint:'legacy-summary'},
      requestCards:{
        'user-a':{
          ownerId:'user-a',
          displayName:'CMDR Alpha',
          messageId:'710002',
          webhookId:'1234567890',
          fingerprint:'legacy-request',
          phase:'operational',
          request:{
            state:'requested',
            active:true,
            requestId:'payout-request-alpha',
            requestedAt:'2026-09-23T00:04:00Z',
            requestedCredits:30_000_000,
            requestedRemainingCredits:30_000_000,
            requestedEntryCount:1,
            currentAvailableCredits:35_000_000,
            newSinceRequestCredits:5_000_000,
          },
          currentAvailableCredits:35_000_000,
        },
      },
    },
  }),
  DISCORD_OPERATIONS_WEBHOOK_URL:'https://discord.com/api/webhooks/1234567890/operations_unit_test',
  DISCORD_SQUAD_PAYOUTS_WEBHOOK_URL:'https://discord.com/api/webhooks/2468135790/squad_payouts_unit_test',
};

const loaded=await loadRewardDiscordView(env);
assert.equal(loaded.summary.totalOwedCredits,55_000_000,'Squad treasury total must remain squad-funded only');
assert.equal(loaded.summary.memberCount,2,'Squad treasury member count must remain squad-funded only');
assert.equal(loaded.summary.activeRequestCount,1);
assert.equal(loaded.summary.personalOutstandingCredits,99_000_000,'Personal job rewards should be visible without entering the treasury total');
assert.equal(loaded.summary.personalRecipientCount,1);
assert.equal(loaded.summary.personalPayerCount,1);
assert.equal(loaded.personalOutstanding.length,1);
assert.equal(loaded.personalOutstanding[0].displayName,'CMDR Charlie');
assert.equal(loaded.personalOutstanding[0].payerDisplayName,'CMDR Payer');
const alpha=loaded.members.find(row=>row.ownerId==='user-a');
assert.equal(alpha.payoutRequest.requestedRemainingCredits,30_000_000);
assert.equal(alpha.payoutRequest.newSinceRequestCredits,5_000_000,'New rewards after request must remain outside frozen payout request');

const summaryPayload=buildSquadRewardSummaryDiscordPayload(loaded,{
  adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
  rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
});
const summaryText=JSON.stringify(summaryPayload);
assert.match(summaryText,/https:\/\/mongrels-squadron\.pages\.dev\/rewards\//);
assert.doesNotMatch(summaryText,/\/wolf-bgs\//,'Squad Payouts Discord must never link members to Reward Administration');
assert.equal(summaryPayload.embeds.length,1,'Squad summary should be one dedicated Discord message');
const squadEmbedText=JSON.stringify(summaryPayload.embeds[0]);
for(const pattern of [
  /Squad-Funded Rewards/,
  /Squad Treasury/,
  /Squad Payout Requests/,
  /Squad-Funded Outstanding Balances/,
  /CMDR Alpha/,
  /CMDR Bravo/,
  /35M Cr/,
  /20M Cr/,
  /PAYOUT REQUESTED/,
  /squad treasury only/,
])assert.match(squadEmbedText,pattern);
assert.doesNotMatch(squadEmbedText,/CMDR Charlie|99M Cr|CMDR Payer|Personal Build Run/);

const personalPayload=buildPersonalRewardSummaryDiscordPayload(loaded,{
  rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
});
assert.equal(personalPayload.embeds.length,1,'Personal jobs should be one dedicated Discord message');
const personalEmbedText=JSON.stringify(personalPayload.embeds[0]);
for(const pattern of [
  /Personal Job Rewards/,
  /Separate from the Squad Treasury/,
  /Outstanding Personal Jobs/,
  /CMDR Charlie/,
  /99M Cr/,
  /Paid by/,
  /CMDR Payer/,
  /Personal Build Run/,
  /OWED/,
  /individually funded jobs/,
])assert.match(personalEmbedText,pattern);
assert.doesNotMatch(personalEmbedText,/CMDR Alpha|CMDR Bravo|Squad Payout Requests/);

const requestPayload=buildPayoutRequestDiscordPayload(alpha,{
  adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
  rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
});
const requestText=JSON.stringify(requestPayload);
assert.match(requestText,/https:\/\/mongrels-squadron\.pages\.dev\/rewards\//);
assert.doesNotMatch(requestText,/\/wolf-bgs\//,'Payout request cards must link to the member Rewards account');
for(const pattern of [/PAYOUT REQUESTED · CMDR Alpha/,/30M Cr/,/35M Cr/,/5M Cr/,/not included in this payout request/])assert.match(requestText,pattern);

const requests=[];
let nextId=810001;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;
  requests.push({url:String(url),method:options.method,body});
  if(options.method==='POST')return Response.json({id:String(nextId++)},{status:200});
  if(options.method==='PATCH'){
    const id=String(url).match(/\/messages\/(\d+)/)?.[1]||String(nextId);
    return Response.json({id},{status:200});
  }
  if(options.method==='DELETE')return new Response(null,{status:204});
  return new Response(null,{status:204});
};

try{
  const first=await syncRewardDiscordBoard(env,{
    view:loaded,
    adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
    rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
    createMissing:true,
  });
  assert.equal(first.summary.mode,'created');
  assert.equal(first.created,1,'Only active payout requests get individual cards');
  const migrationDeletes=requests.filter(row=>row.method==='DELETE');
  assert.equal(migrationDeletes.length,2,'Legacy Rewards summary/request card must be removed from Operations before Squad Payouts seeds');
  assert.ok(migrationDeletes.every(row=>row.url.includes('/api/webhooks/1234567890/')),'Legacy Rewards cleanup must use Operations webhook');
  const firstPosts=requests.filter(row=>row.method==='POST');
  assert.equal(firstPosts.length,2,'Expected one Squad Payouts summary plus one payout request card');
  assert.ok(firstPosts.every(row=>row.url.includes('/api/webhooks/2468135790/')),'All new payout posts must use dedicated Squad Payouts webhook');
  assert.ok(firstPosts.every(row=>row.body.allowed_mentions?.parse?.length===0));
  const migratedState=JSON.parse(env.DAILY_ORDERS.map.get('discord-rewards-v1'));
  assert.equal(migratedState.summary.webhookId,'2468135790');
  assert.ok(Object.values(migratedState.requestCards).every(row=>row.webhookId==='2468135790'));

  const beforeUnchanged=requests.length;
  const unchanged=await syncRewardDiscordBoard(env,{
    view:loaded,
    adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
    rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
    createMissing:false,
  });
  assert.equal(unchanged.summary.mode,'unchanged');
  assert.equal(unchanged.unchanged,1);
  assert.equal(requests.length,beforeUnchanged,'Unchanged Rewards state must make zero Discord requests');

  const partialView=structuredClone(loaded);
  const partialAlpha=partialView.members.find(row=>row.ownerId==='user-a');
  partialAlpha.owedCredits=20_000_000;
  partialAlpha.owedEntryCount=2;
  partialAlpha.payoutRequest.requestedRemainingCredits=15_000_000;
  partialAlpha.payoutRequest.currentAvailableCredits=20_000_000;
  partialAlpha.payoutRequest.newSinceRequestCredits=5_000_000;
  partialView.outstanding=partialView.members.filter(row=>row.owedCredits>0);
  partialView.activeRequests=partialView.members.filter(row=>row.payoutRequest?.active);
  partialView.summary={
    totalOwedCredits:40_000_000,
    memberCount:2,
    activeRequestCount:1,
    requestedRemainingCredits:15_000_000,
  };
  const beforePartial=requests.length;
  const partial=await syncRewardDiscordBoard(env,{
    view:partialView,
    adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
    rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
    createMissing:false,
  });
  assert.equal(partial.summary.mode,'edited');
  assert.equal(partial.edited,1,'Partial payment should edit active payout request card');
  assert.equal(requests.length-beforePartial,2,'Partial payment should PATCH summary and request card');

  const paidView=structuredClone(partialView);
  const paidAlpha=paidView.members.find(row=>row.ownerId==='user-a');
  paidAlpha.owedCredits=5_000_000;
  paidAlpha.owedEntryCount=1;
  paidAlpha.payoutRequest={
    ...paidAlpha.payoutRequest,
    state:'fulfilled',
    active:false,
    requestedRemainingCredits:0,
    currentAvailableCredits:5_000_000,
    newSinceRequestCredits:5_000_000,
    fulfilledAt:'2026-09-23T00:20:00Z',
  };
  paidView.outstanding=paidView.members.filter(row=>row.owedCredits>0);
  paidView.activeRequests=paidView.members.filter(row=>row.payoutRequest?.active);
  paidView.summary={
    totalOwedCredits:25_000_000,
    memberCount:2,
    activeRequestCount:0,
    requestedRemainingCredits:0,
  };
  const beforePaid=requests.length;
  const paid=await syncRewardDiscordBoard(env,{
    view:paidView,
    adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
    rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
    createMissing:false,
  });
  assert.equal(paid.summary.mode,'edited');
  assert.equal(paid.paidShown,1);
  assert.equal(requests.length-beforePaid,2,'Payment completion should PATCH summary and show PAID on request card');
  assert.match(JSON.stringify(requests.slice(beforePaid).map(row=>row.body)),/✓ PAID · CMDR Alpha/);

  const beforeCleanup=requests.length;
  const cleanup=await syncRewardDiscordBoard(env,{
    view:paidView,
    adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
    rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
    createMissing:false,
  });
  assert.equal(cleanup.summary.mode,'unchanged');
  assert.equal(cleanup.deleted,1);
  assert.equal(requests.length-beforeCleanup,1);
  assert.equal(requests.at(-1).method,'DELETE');

  const requestedAgain=structuredClone(paidView);
  const againAlpha=requestedAgain.members.find(row=>row.ownerId==='user-a');
  againAlpha.payoutRequest={
    state:'requested',
    active:true,
    requestId:'payout-request-alpha-2',
    requestedAt:'2026-09-23T00:25:00Z',
    requestedCredits:5_000_000,
    requestedRemainingCredits:5_000_000,
    requestedEntryCount:1,
    currentAvailableCredits:5_000_000,
    newSinceRequestCredits:0,
  };
  requestedAgain.activeRequests=[againAlpha];
  requestedAgain.summary={...requestedAgain.summary,activeRequestCount:1,requestedRemainingCredits:5_000_000};
  const reopened=await syncRewardDiscordBoard(env,{
    view:requestedAgain,
    adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
    rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
    createMissing:false,
  });
  assert.equal(reopened.created,1,'A new payout request should automatically get a card after summary has been seeded');

  const cancelledView=structuredClone(requestedAgain);
  const cancelAlpha=cancelledView.members.find(row=>row.ownerId==='user-a');
  cancelAlpha.payoutRequest={...cancelAlpha.payoutRequest,state:'cancelled',active:false,cancelledAt:'2026-09-23T00:26:00Z'};
  cancelledView.activeRequests=[];
  cancelledView.summary={...cancelledView.summary,activeRequestCount:0,requestedRemainingCredits:0};
  const cancelled=await syncRewardDiscordBoard(env,{
    view:cancelledView,
    adminUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#reward-engine',
    rewardsUrl:'https://mongrels-squadron.pages.dev/rewards/',
    createMissing:false,
  });
  assert.equal(cancelled.cancelledShown,1);
  assert.match(JSON.stringify(requests.at(-1).body),/PAYOUT CANCELLED · CMDR Alpha/);
}finally{
  globalThis.fetch=originalFetch;
}

const manual=readFileSync('functions/api/operations/discord-rewards.js','utf8');
for(const pattern of [/site_admin/,/syncRewardDiscordBoard/,/createMissing:true/,/reward-engine/,/discordSquadPayoutsConfigured/])assert.match(manual,pattern);
const payoutApi=readFileSync('functions/api/rewards/request.js','utf8');
for(const pattern of [/syncRewardsDiscord/,/createMissing:true/,/discord/])assert.match(payoutApi,pattern);
const payApi=readFileSync('functions/api/rewards/pay.js','utf8');
assert.match(payApi,/syncRewardsDiscord/);
const memberPaymentsApi=readFileSync('functions/api/rewards/member-payments.js','utf8');
for(const pattern of [
  /loadRewardDiscordView/,
  /syncRewardDiscordBoard/,
  /Payment marked SENT/,
  /Payment confirmed received and marked PAID/,
])assert.match(memberPaymentsApi,pattern);
const reconcileApi=readFileSync('functions/api/rewards/reconcile.js','utf8');
assert.match(reconcileApi,/result\.created>0\?await syncRewardsDiscord/);
const issueApi=readFileSync('functions/api/rewards/issue.js','utf8');
assert.match(issueApi,/result\.created\?await syncRewardsDiscord/);
const frontier=readFileSync('functions/api/frontier/sync.js','utf8');
assert.match(frontier,/rewardDiscord/);
const scout=readFileSync('functions/api/operations/scout-ingest.js','utf8');
assert.match(scout,/rewardDiscord/);
const client=readFileSync('js/wolf-bgs-discord.js','utf8');
for(const pattern of [/data-discord-sync-rewards/,/discord-rewards/,/Syncing Squad Payouts/])assert.match(client,pattern);
const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/Sync Squad Payouts/);
assert.match(page,/id="reward-engine"/);
assert.match(page,/wolf-bgs-discord\.js\?v=14/);

console.log('✓ Rewards Discord renders squad-funded and personal-job rewards as separate embeds with separate accounting');
console.log('✓ Rewards Discord keeps earning summary-only and gives payout requests a REQUESTED → PAID/CANCELLED → cleanup lifecycle');
console.log('✓ Squad Payouts migrates tracked Operations messages into its dedicated webhook without duplicates');
