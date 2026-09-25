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
assert.equal(payload.components[0].components[0].label,'Alert Settings');

const compact=buildCompactTradeDiscordPayload({...route,status:'expired'},{control,reason:'Superseded'});
assert.equal(compact.embeds.length,0);
assert.equal(compact.components.length,0);
assert.match(compact.content,/SUPERSEDED/);

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/data-trade-control/);
assert.match(html,/Trade Operations Control/);
assert.match(html,/1552127291234983956/);
assert.match(html,/1029221573988720722/);
assert.match(html,/production routing is locked during development/i);

const client=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(client,/\/api\/trade-control/);
assert.match(client,/X-Mongrels-Request':'trade-control/);
assert.match(client,/article\.id = `trade-\$\{route\.id\}`/);

const tradeApi=readFileSync(new URL('../functions/api/trades/index.js',import.meta.url),'utf8');
assert.match(tradeApi,/syncTradeDiscord/);
assert.match(tradeApi,/Boolean\(existing\.official\)/,'member edit must preserve an Officer-designated official status');
assert.match(tradeApi,/removeTradeAlertSubscriptions/);

const controlApi=readFileSync(new URL('../functions/api/trade-control/index.js',import.meta.url),'utf8');
assert.match(controlApi,/officer','site_admin/);
assert.match(controlApi,/liveSwitchExposed:false/);
assert.match(controlApi,/mode:current\.discord\.mode/);

const interactions=readFileSync(new URL('../functions/api/discord/interactions.js',import.meta.url),'utf8');
assert.match(interactions,/parseTradeAlertCustomId/);
assert.match(interactions,/hasTradeAlertSubscription/);
assert.match(interactions,/toggleTradeAlertSubscription/);
assert.match(interactions,/Alerts Enabled ✓/);
assert.match(interactions,/Disable Alerts/);
assert.match(interactions,/Trader’s Outpost alerts are available to recognized Mongrel members/);

const discord=readFileSync(new URL('../lib/trade-discord.js',import.meta.url),'utf8');
assert.match(discord,/flags:DISCORD_SUPPRESS_NOTIFICATIONS/,'public threshold cards must remain silent');
assert.match(discord,/deliverTradeAlertDms/,'subscribers should receive the opt-in alert privately');

console.log('Trade Intelligence smoke checks passed.');
