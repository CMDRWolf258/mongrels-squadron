import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyTradeDataAge,
  defaultTradeControl,
  normalizeTradeControl,
  tradeDiscordChannelId,
  tradePriorityProfile,
} from '../lib/trade-intelligence.js';
import {
  DISCORD_SUPPRESS_NOTIFICATIONS,
  buildCompactTradeDiscordPayload,
  buildTradeDiscordPayload,
  parseTradeAlertCustomId,
  tradeAlertActionCustomId,
  tradeAlertCustomId,
} from '../lib/trade-discord.js';

const control=defaultTradeControl();
assert.equal(control.discord.mode,'testing');
assert.equal(control.discord.testingChannelId,'1552127291234983956');
assert.equal(control.discord.productionChannelId,'1029221573988720722');
assert.equal(tradeDiscordChannelId(control),'1552127291234983956');
assert.equal(control.priorities.critical.refreshMinutes,5);
assert.equal(control.priorities.critical.freshMinutes,30);
assert.equal(control.priorities.critical.agingMinutes,90);
assert.equal(control.priorities.standard.freshMinutes,1440);
assert.equal(control.priorities.standard.agingMinutes,2880);

const clamped=normalizeTradeControl({
  priorities:{
    critical:{refreshMinutes:1,freshMinutes:30,agingMinutes:15},
  },
});
assert.equal(clamped.priorities.critical.refreshMinutes,5,'refresh must never go below five minutes');
assert.equal(clamped.priorities.critical.agingMinutes,30,'aging cutoff cannot precede fresh cutoff');

const observed=new Date(Date.now()-45*60*1000).toISOString();
assert.equal(classifyTradeDataAge(observed,control,'critical').state,'aging');
assert.equal(classifyTradeDataAge(observed,control,'standard').state,'fresh');
assert.equal(tradePriorityProfile(control,'does-not-exist').key,'standard');

assert.equal(DISCORD_SUPPRESS_NOTIFICATIONS,4096);
const route={
  id:'12345678-abcd-4321-abcd-123456789012',
  title:'Gold CG Supply Watch',
  commodity:'Gold',
  ownerName:'CMDR Lucky',
  category:'credits',
  originSystem:'Source System',
  originStation:'Source Station',
  destinationSystem:'CG System',
  destinationStation:'CG Station',
  profitPerTon:250000,
  quantity:'42,000 t',
  returnCommodity:'Tritium',
  returnProfitPerTon:18000,
  returnQuantity:'18,500 t',
  padSize:'large',
  distanceLy:'18.4',
  status:'active',
  updatedAt:new Date().toISOString(),
  intelligence:{priority:'critical'},
};
const customId=tradeAlertCustomId(route.id);
assert.deepEqual(parseTradeAlertCustomId(customId),{routeId:route.id,action:'settings'});
assert.deepEqual(parseTradeAlertCustomId('mongrels_trade_alert:'+route.id),{routeId:route.id,action:'settings'},'legacy Alert Me buttons should still open settings');
const disableId=tradeAlertActionCustomId(route.id,'disable');
assert.deepEqual(parseTradeAlertCustomId(disableId),{routeId:route.id,action:'disable'});

const payload=buildTradeDiscordPayload(route,{origin:'https://mongrels-squadron.pages.dev',control,subscriberCount:3});
assert.equal(payload.allowed_mentions.parse.length,0);
assert.match(payload.embeds[0].description,/TEST FEED/);
assert.match(payload.embeds[0].footer.text,/3 watching/);
assert.equal(payload.components[0].components[0].custom_id,customId);
assert.equal(payload.components[0].components[0].label,'Alert Me');
const routeFields=payload.embeds[0].fields;
assert.equal(routeFields.find(field=>field.name==='📦 Outbound Cargo')?.value,'**Gold**');
assert.match(routeFields.find(field=>field.name==='📥 Buy / Load')?.value||'',/Source Station/);
assert.match(routeFields.find(field=>field.name==='📤 Sell / Deliver')?.value||'',/CG Station/);
assert.equal(routeFields.find(field=>field.name==='↩️ Return Cargo')?.value,'**Tritium**');
assert.match(routeFields.find(field=>field.name==='📥 Return / Load')?.value||'',/CG Station/,'return load should reverse to the outbound destination');
assert.match(routeFields.find(field=>field.name==='📤 Return / Deliver')?.value||'',/Source Station/,'return delivery should reverse to the outbound origin');
assert.equal(routeFields.find(field=>field.name==='Return Profit / t')?.value,'18,000 Cr');
assert.equal(routeFields.find(field=>field.name==='Return Supply / Demand')?.value,'18,500 t');

const compact=buildCompactTradeDiscordPayload({...route,status:'expired'},{control,reason:'Superseded'});
assert.equal(compact.embeds.length,0);
assert.equal(compact.components.length,0);
assert.match(compact.content,/SUPERSEDED/);

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/data-trade-control/);
assert.match(html,/project-editor-actions is-standard/);
assert.match(html,/project-editor-danger/);
assert.match(html,/project-editor-primary-actions/);
assert.match(html,/Trade Operations Control/);
assert.match(html,/1552127291234983956/);
assert.match(html,/1029221573988720722/);
assert.match(html,/production routing is locked during development/i);
assert.match(html,/data-priority-duration="refreshMinutes"/);
assert.match(html,/data-priority-duration="freshMinutes"/);
assert.match(html,/data-priority-duration="agingMinutes"/);
assert.match(html,/data-duration-hours/);
assert.match(html,/data-duration-minutes/);
assert.match(html,/entering 90 in a minutes box becomes 1 hr 30 min/i);
assert.doesNotMatch(html,/data-priority-field=/,'legacy minute-only freshness controls should be removed');

const client=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(client,/\/api\/trade-control/);
assert.match(client,/X-Mongrels-Request':'trade-control/);
assert.match(client,/article\.id = `trade-\$\{route\.id\}`/);
assert.match(client,/function normalizeDurationOverflow\(container\)/);
assert.match(client,/minuteValue>=60/);
assert.match(client,/const hourValue=Math\.floor\(minuteValue\/60\)/,'overflow minutes should replace the hour field with their normalized hour component');
assert.doesNotMatch(client,/hourValue\+=Math\.floor\(minuteValue\/60\)/,'overflow minutes must not add onto existing hours');
assert.match(client,/minutes\.value=minuteValue/);
assert.match(client,/function readDuration\(container,field/);
assert.match(client,/refreshMinutes:\{min:5,max:10080\}/);

const tradeApi=readFileSync(new URL('../functions/api/trades/index.js',import.meta.url),'utf8');
assert.match(tradeApi,/syncTradeDiscord/);
assert.match(tradeApi,/Boolean\(existing\.official\)/,'member edit must preserve an Officer-designated official status');
assert.match(tradeApi,/removeTradeAlertSubscriptions/);
assert.match(tradeApi,/returnCommodity:/);
assert.match(tradeApi,/returnProfitPerTon:/);
assert.match(tradeApi,/returnQuantity:/);

const controlApi=readFileSync(new URL('../functions/api/trade-control/index.js',import.meta.url),'utf8');
assert.match(controlApi,/officer','site_admin/);
assert.match(controlApi,/liveSwitchExposed:false/);
assert.match(controlApi,/mode:current\.discord\.mode/);

const interactions=readFileSync(new URL('../functions/api/discord/interactions.js',import.meta.url),'utf8');
assert.match(interactions,/parseTradeAlertCustomId/);
assert.match(interactions,/hasTradeAlertSubscription/);
assert.match(interactions,/toggleTradeAlertSubscription/);
assert.match(interactions,/Alerts Enabled ✓/);
assert.match(interactions,/Alerts Enabled ✓/);
assert.match(interactions,/Trader’s Outpost alerts are available to recognized Mongrel members/);

const discord=readFileSync(new URL('../lib/trade-discord.js',import.meta.url),'utf8');
assert.match(discord,/flags:DISCORD_SUPPRESS_NOTIFICATIONS/,'public threshold cards must remain silent');
assert.match(discord,/deliverTradeAlertDms/,'subscribers should receive the opt-in alert privately');

console.log('Trade Intelligence smoke checks passed.');
