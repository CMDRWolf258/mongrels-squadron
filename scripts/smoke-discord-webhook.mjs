import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createColonizationArchiveDiscordMessage,
  createFactionAlertsDiscordMessage,
  createScoutNetworkDiscordMessage,
  createSquadPayoutsDiscordMessage,
  discordColonizationArchiveConfigured,
  discordFactionAlertsConfigured,
  discordOperationsConfigured,
  discordScoutNetworkConfigured,
  discordSquadPayoutsConfigured,
  sendOperationsDiscord,
} from '../lib/discord-webhook.js';

const webhook='https://discord.com/api/webhooks/1234567890/test_token-ABC_123';
assert.equal(discordOperationsConfigured({DISCORD_OPERATIONS_WEBHOOK_URL:webhook}),true);
assert.equal(discordOperationsConfigured({DISCORD_OPERATIONS_WEBHOOK_URL:'https://example.com/not-discord'}),false);
assert.equal(discordOperationsConfigured({}),false);
const archiveWebhook='https://discord.com/api/webhooks/2468135790/archive_token_ABC_123';
assert.equal(discordColonizationArchiveConfigured({DISCORD_COLONIZATION_ARCHIVE_WEBHOOK_URL:archiveWebhook}),true);
assert.equal(discordColonizationArchiveConfigured({DISCORD_COLONIZATION_ARCHIVE_WEBHOOK_URL:'https://example.com/nope'}),false);
const factionWebhook='https://discord.com/api/webhooks/1357924680/faction_alerts_token_ABC_123';
assert.equal(discordFactionAlertsConfigured({DISCORD_FACTION_ALERTS_WEBHOOK_URL:factionWebhook}),true);
assert.equal(discordFactionAlertsConfigured({DISCORD_FACTION_ALERTS_WEBHOOK_URL:'https://example.com/nope'}),false);
const scoutWebhook='https://discord.com/api/webhooks/1122334455/scout_network_token_ABC_123';
assert.equal(discordScoutNetworkConfigured({DISCORD_SCOUT_NETWORK_WEBHOOK_URL:scoutWebhook}),true);
assert.equal(discordScoutNetworkConfigured({DISCORD_SCOUT_NETWORK_WEBHOOK_URL:'https://example.com/nope'}),false);
const payoutsWebhook='https://discord.com/api/webhooks/5566778899/squad_payouts_token_ABC_123';
assert.equal(discordSquadPayoutsConfigured({DISCORD_SQUAD_PAYOUTS_WEBHOOK_URL:payoutsWebhook}),true);
assert.equal(discordSquadPayoutsConfigured({DISCORD_SQUAD_PAYOUTS_WEBHOOK_URL:'https://example.com/nope'}),false);


const originalFetch=globalThis.fetch;
let captured=null;
globalThis.fetch=async(url,options)=>{
  captured={url,options};
  return new Response(null,{status:204});
};
try{
  const result=await sendOperationsDiscord(
    {DISCORD_OPERATIONS_WEBHOOK_URL:webhook},
    {embeds:[{title:'Test'}],content:'Connectivity test'}
  );
  assert.equal(result.ok,true);
  assert.equal(result.status,204);
  assert.equal(captured.url,webhook);
  assert.equal(captured.options.method,'POST');
  const body=JSON.parse(captured.options.body);
  assert.deepEqual(body.allowed_mentions,{parse:[]},'Discord webhook posts must disable mentions by default');
  assert.equal(body.username,'Mongrel Mission Control');
  assert.equal(body.embeds[0].title,'Test');
}finally{
  globalThis.fetch=originalFetch;
}

let archiveCaptured=null;
globalThis.fetch=async(url,options)=>{
  archiveCaptured={url,options};
  return Response.json({id:'9876543210'},{status:200});
};
try{
  const result=await createColonizationArchiveDiscordMessage(
    {DISCORD_COLONIZATION_ARCHIVE_WEBHOOK_URL:archiveWebhook},
    {embeds:[{title:'Archive Test'}],content:'Completed colonization'}
  );
  assert.equal(result.messageId,'9876543210');
  assert.match(archiveCaptured.url,/2468135790/);
  assert.equal(archiveCaptured.options.method,'POST');
  const body=JSON.parse(archiveCaptured.options.body);
  assert.deepEqual(body.allowed_mentions,{parse:[]});
  assert.equal(body.embeds[0].title,'Archive Test');
}finally{
  globalThis.fetch=originalFetch;
}

let scoutCaptured=null;
globalThis.fetch=async(url,options)=>{
  scoutCaptured={url,options};
  return Response.json({id:'7766554433'},{status:200});
};
try{
  const result=await createScoutNetworkDiscordMessage(
    {DISCORD_SCOUT_NETWORK_WEBHOOK_URL:scoutWebhook},
    {embeds:[{title:'Scout Network Test'}],content:'Scout routing test'}
  );
  assert.equal(result.messageId,'7766554433');
  assert.match(scoutCaptured.url,/1122334455/);
  assert.equal(scoutCaptured.options.method,'POST');
  const body=JSON.parse(scoutCaptured.options.body);
  assert.deepEqual(body.allowed_mentions,{parse:[]});
  assert.equal(body.embeds[0].title,'Scout Network Test');
}finally{
  globalThis.fetch=originalFetch;
}

let payoutsCaptured=null;
globalThis.fetch=async(url,options)=>{
  payoutsCaptured={url,options};
  return Response.json({id:'6655443322'},{status:200});
};
try{
  const result=await createSquadPayoutsDiscordMessage(
    {DISCORD_SQUAD_PAYOUTS_WEBHOOK_URL:payoutsWebhook},
    {embeds:[{title:'Squad Payouts Test'}],content:'Payout routing test'}
  );
  assert.equal(result.messageId,'6655443322');
  assert.match(payoutsCaptured.url,/5566778899/);
  assert.equal(payoutsCaptured.options.method,'POST');
  const body=JSON.parse(payoutsCaptured.options.body);
  assert.deepEqual(body.allowed_mentions,{parse:[]});
  assert.equal(body.embeds[0].title,'Squad Payouts Test');
}finally{
  globalThis.fetch=originalFetch;
}

const endpoint=readFileSync('functions/api/operations/discord-test.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /X-Mongrels-Request/,
  /wolf-bgs-control/,
  /DISCORD_OPERATIONS_WEBHOOK_URL|discordOperationsConfigured/,
  /Mission Control Link Test/,
  /scoutCycleRefreshServerConfigured/,
  /colonizationArchiveConfigured/,
  /factionAlertsConfigured/,
  /scoutNetworkConfigured/,
  /squadPayoutsConfigured/,
  /low-noise persistent\/update-in-place model/i,
])assert.match(endpoint,pattern);
assert.doesNotMatch(endpoint,/webhookUrl\s*:/i,'Webhook URL must never be included in the browser response');

const client=readFileSync('js/wolf-bgs-discord.js','utf8');
for(const pattern of [
  /data-discord-integration/,
  /data-discord-test/,
  /data-discord-sync-orders/,
  /data-discord-sync-colonization/,
  /data-discord-sync-scout/,
  /data-discord-sync-rewards/,
  /api\/operations\/discord-test/,
  /api\/operations\/discord-rewards/,
  /api\/operations\/discord-scout-jobs/,
  /api\/operations\/discord-colonization-jobs/,
  /api\/operations\/discord-daily-orders/,
  /X-Mongrels-Request/,
  /Send Test Alert|Sending test alert/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('wolf-bgs/index.html','utf8');
for(const pattern of [
  /Discord Integration/,
  /data-discord-integration/,
  /data-discord-test/,
  /data-discord-sync-orders/,
  /data-discord-sync-colonization/,
  /data-discord-sync-scout/,
  /data-discord-sync-rewards/,
  /data-discord-status/,
  /wolf-bgs-discord\.js\?v=12/,
  /wolf-bgs\.css\?v=23/,
])assert.match(page,pattern);

console.log('✓ Discord operations webhook helper, admin-only test endpoint, safe payload, and Wolf BGS test control are wired');
