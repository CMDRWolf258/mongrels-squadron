import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { discordOperationsConfigured, sendOperationsDiscord } from '../lib/discord-webhook.js';

const webhook='https://discord.com/api/webhooks/1234567890/test_token-ABC_123';
assert.equal(discordOperationsConfigured({DISCORD_OPERATIONS_WEBHOOK_URL:webhook}),true);
assert.equal(discordOperationsConfigured({DISCORD_OPERATIONS_WEBHOOK_URL:'https://example.com/not-discord'}),false);
assert.equal(discordOperationsConfigured({}),false);

const originalFetch=globalThis.fetch;
let captured=null;
globalThis.fetch=async(url,options)=>{
  captured={url,options};
  return new Response('',{status:204});
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

const endpoint=readFileSync('functions/api/operations/discord-test.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /X-Mongrels-Request/,
  /wolf-bgs-control/,
  /DISCORD_OPERATIONS_WEBHOOK_URL|discordOperationsConfigured/,
  /Mission Control Link Test/,
  /no automatic Discord alerts are enabled yet/i,
])assert.match(endpoint,pattern);
assert.doesNotMatch(endpoint,/webhookUrl\s*:/i,'Webhook URL must never be included in the browser response');

const client=readFileSync('js/wolf-bgs-discord.js','utf8');
for(const pattern of [
  /data-discord-integration/,
  /data-discord-test/,
  /api\/operations\/discord-test/,
  /X-Mongrels-Request/,
  /Send Test Alert|Sending test alert/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('wolf-bgs/index.html','utf8');
for(const pattern of [
  /Discord Integration/,
  /data-discord-integration/,
  /data-discord-test/,
  /data-discord-status/,
  /wolf-bgs-discord\.js\?v=1/,
  /wolf-bgs\.css\?v=22/,
])assert.match(page,pattern);

console.log('✓ Discord operations webhook helper, admin-only test endpoint, safe payload, and Wolf BGS test control are wired');
