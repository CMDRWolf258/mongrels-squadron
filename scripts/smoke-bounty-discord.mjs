import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  bountyDiscordConfig,
  buildBountyDiscordPayload,
} from '../lib/bounty-discord.js';

const origin='https://mongrels-squadron.pages.dev';
const sample={
  id:'11111111-2222-4333-8444-555555555555',
  ownerId:'wolf',
  ownerName:'Wolf258',
  target:'CMDR TestTarget',
  system:'Diaba',
  reward:'50M Cr',
  reason:'Repeatedly interrupted Mongrel operations. In-game PvP contract only.',
  proof:'Screenshot of destruction or combat report',
  expires:'2026-10-31',
  status:'active',
  createdAt:'2026-09-26T12:00:00Z',
  updatedAt:'2026-09-26T12:00:00Z',
};

assert.equal(bountyDiscordConfig({DISCORD_BOT_TOKEN:'x',GUILD_ID:'1'}).configured,true);
assert.equal(bountyDiscordConfig({}).configured,false);

const active=buildBountyDiscordPayload(sample,{origin});
assert.equal(active.embeds.length,1);
assert.match(active.embeds[0].title,/💀 WANTED · CMDR TestTarget/);
assert.match(active.embeds[0].description,/ACTIVE/);
assert.match(JSON.stringify(active),/50M Cr/);
assert.match(JSON.stringify(active),/Diaba/);
assert.match(JSON.stringify(active),/Wolf258/);
assert.match(JSON.stringify(active),/Screenshot of destruction/);
assert.match(JSON.stringify(active),/View Bounty Board/);
assert.match(JSON.stringify(active),/\/pvp\/#bounty-board/);
assert.deepEqual(active.allowed_mentions,{parse:[]});

const claimed=buildBountyDiscordPayload({...sample,status:'claimed'},{origin});
assert.match(claimed.embeds[0].title,/CLAIMED/);
assert.match(claimed.embeds[0].description,/CLAIMED/);

const complete=buildBountyDiscordPayload({...sample,status:'complete'},{origin});
assert.match(complete.embeds[0].title,/COMPLETE/);
assert.match(complete.embeds[0].description,/COMPLETE/);
assert.equal(complete.components[0].components[0].label,'View Bounty Board');

const discord=readFileSync('lib/bounty-discord.js','utf8');
for(const pattern of [
  /DISCORD_BOUNTY_BOARD_CHANNEL_ID/,
  /configured&&bountyChannelName/,
  /decorated=eligible\.find/,
  /💀〡bounty-board/,
  /plain bounty-board is also accepted/,
  /method:'PATCH'/,
  /method:'DELETE'/,
  /View Bounty Board/,
  /allowed_mentions:\{parse:\[\]\}/,
  /attempted channel ID/,
])assert.match(discord,pattern);
assert.doesNotMatch(discord,/\/guilds\/[^'"]*\/channels'[^\n]*method:'POST'/,'Bounty Board integration must not create Discord channels');
assert.doesNotMatch(discord,/\/pins\//,'Bounty Board integration should leave pinning/manual channel presentation alone');

const api=readFileSync('functions/api/bounties/index.js','utf8');
for(const pattern of [
  /syncBountyDiscord/,
  /applyBountyDiscordState/,
  /deleteBountyDiscord/,
  /await writeItems\(env, items\);[\s\S]*syncBountyDiscord/,
  /discordMessageId/,
  /discordChannelId/,
  /discordLastSyncedAt/,
  /discordLastError/,
])assert.match(api,pattern);

const pvp=readFileSync('pvp/index.html','utf8');
assert.match(pvp,/id="bounty-board"/);
assert.match(pvp,/Post Bounty/);
assert.match(pvp,/Elite Dangerous only/);
assert.match(pvp,/pvp\.js\?v=71/);
assert.match(pvp,/global\.css\?v=72/);

const client=readFileSync('js/pvp.js','utf8');
for(const pattern of [
  /bounty-discord-sync-btn/,
  /Sync Discord/,
  /bounty-discord-error/,
  /Discord sync failed:/,
  /discordFailure/,
  /Bounty saved, but Discord did not sync:/,
  /method:'PUT'/,
  /result\?\.discord\?\.mode==='recreated'/,
])assert.match(client,pattern);
const globalCss=readFileSync('css/global.css','utf8');
assert.match(globalCss,/\.bounty-discord-error/);
new Function(client);

console.log('✓ Bounty Board posts, edits, missing-card repair, completion history, deletion, and Discord channel discovery are wired');
