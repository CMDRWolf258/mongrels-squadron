import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildSquadRulesDiscordPayload,
  squadRulesDiscordConfig,
} from '../lib/squad-rules-discord.js';

const origin='https://mongrels-squadron.pages.dev';
const payload=buildSquadRulesDiscordPayload({origin});

assert.equal(payload.embeds.length,1);
assert.match(payload.embeds[0].title,/Squad Rules & ROE/);
assert.match(payload.embeds[0].description,/website is the authoritative source/i);
for(const field of [
  '01 · Open Play Is the Standard',
  '02 · BGS Is Open Only',
  '03 · No Combat Logging',
  '⚔️ Combat & ROE',
  '🐺 The Mongrel Standard',
]){
  assert.ok(payload.embeds[0].fields.some(item=>item.name===field),`missing Discord rules field ${field}`);
}
assert.match(payload.embeds[0].fields[0].value,/Open Play/);
assert.match(payload.embeds[0].fields[1].value,/Background Simulation/);
assert.match(payload.embeds[0].fields[2].value,/avoid destruction/);
assert.equal(payload.components.length,1);
assert.equal(payload.components[0].components.length,1);
assert.equal(payload.components[0].components[0].label,'View Full Rules & ROE');
assert.equal(payload.components[0].components[0].url,origin+'/about/#squad-rules');
assert.deepEqual(payload.allowed_mentions,{parse:[]});

assert.equal(squadRulesDiscordConfig({DISCORD_BOT_TOKEN:'x',GUILD_ID:'1'}).configured,true);
assert.equal(squadRulesDiscordConfig({}).configured,false);

const discord=readFileSync('lib/squad-rules-discord.js','utf8');
for(const pattern of [
  /squad-rules-discord-v1/,
  /DISCORD_SQUAD_RULES_CHANNEL_ID/,
  /📕〡squad-rules/,
  /squad-rules/,
  /method:'PATCH'/,
  /View Full Rules & ROE/,
]) assert.match(discord,pattern);
assert.doesNotMatch(discord,/\/pins\//,'Squad Rules integration should leave pinning manual');
assert.doesNotMatch(discord,/Carl Bot|RIMM/i,'Squad Rules integration must not target legacy Carl Bot content');

const api=readFileSync('functions/api/squad-rules/index.js','utf8');
for(const pattern of [
  /site_admin/,
  /squad-rules-admin/,
  /syncSquadRulesDiscord/,
  /squad_rules_storage_not_configured/,
]) assert.match(api,pattern);

const admin=readFileSync('js/squad-rules-admin.js','utf8');
new Function(admin);
for(const pattern of [
  /\/api\/squad-rules/,
  /Publish \/ Sync Discord Card/,
  /📕〡squad-rules/,
]) assert.match(admin,pattern);

const about=readFileSync('about/index.html','utf8');
for(const pattern of [
  /id="squad-rules"/,
  /data-squad-rules-discord-admin/,
  /data-squad-rules-discord-sync/,
  /squad-rules-admin\.js\?v=1/,
  /Open Play Is the Standard/,
  /BGS Is Open Only/,
  /No Combat Logging/,
]) assert.match(about,pattern);

console.log('✓ Squad Rules Discord card, Site Admin sync, and legacy-message safety are sound');
