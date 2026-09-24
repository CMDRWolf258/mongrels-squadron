import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildTrainingResourcesDiscordPayload,
  trainingResourcesDiscordConfig,
} from '../lib/training-resources-discord.js';

const origin='https://mongrels-squadron.pages.dev';
const payload=buildTrainingResourcesDiscordPayload({
  origin,
  guildId:'123456789012345678',
  chatChannelId:'987654321098765432',
});

assert.equal(payload.embeds.length,1);
assert.match(payload.embeds[0].title,/Mongrel Training & Resources/);
assert.match(payload.embeds[0].description,/website remains the organized source of truth/i);
for(const label of ['📘 Learn','🔎 Look Up','🧰 Build & Tools','💬 Need Help?']){
  assert.ok(payload.embeds[0].fields.some(field=>field.name===label),`missing Discord field ${label}`);
}
assert.equal(payload.components.length,2);
assert.equal(payload.components[0].components.length,5);
assert.equal(payload.components[1].components.length,3);

const buttons=payload.components.flatMap(row=>row.components);
const expected=[
  ['Mongrel Field Manual','/guides/'],
  ['My Pathway','/pathway/'],
  ['Reference Database','/guides/reference/'],
  ['Mongrel Toolbox','/guides/resources/'],
  ['Ship Catalogue','/ships/'],
  ['Glossary','/guides/glossary/'],
  ['Ask the Mongrels','/assistant/'],
];
for(const [label,path] of expected){
  const button=buttons.find(item=>item.label===label);
  assert.ok(button,`missing ${label} button`);
  assert.equal(button.style,5,`${label} should be a Discord link button`);
  assert.ok(button.url.endsWith(path),`${label} points to wrong destination`);
}
const chat=buttons.find(item=>item.label==='Training Grounds');
assert.ok(chat,'Training Grounds button is missing when an existing chat channel is resolved');
assert.equal(chat.url,'https://discord.com/channels/123456789012345678/987654321098765432');

const noChat=buildTrainingResourcesDiscordPayload({origin,guildId:'123',chatChannelId:''});
assert.ok(!noChat.components.flatMap(row=>row.components).some(item=>item.label==='Training Grounds'),'Training Grounds button should be omitted when no existing channel is found');

assert.equal(trainingResourcesDiscordConfig({DISCORD_BOT_TOKEN:'x',GUILD_ID:'1'}).configured,true);
assert.equal(trainingResourcesDiscordConfig({}).configured,false);

const discord=readFileSync('lib/training-resources-discord.js','utf8');
for(const pattern of [
  /training-resources-discord-v1/,
  /DISCORD_TRAINING_RESOURCES_CHANNEL_ID/,
  /DISCORD_TRAINING_CHAT_CHANNEL_ID/,
  /📚〡training-resources/,
  /training-resources/,
  /☕〡training-grounds/,
  /training-grounds/,
  /training-chat/,
  /method:'PATCH'/,
  /Mongrel Toolbox/,
  /Ask the Mongrels/,
])assert.match(discord,pattern);
assert.doesNotMatch(discord,/\/guilds\/[^'"]*\/channels'[^\n]*method:'POST'/,'Training integration must not create Discord channels');
assert.doesNotMatch(discord,/\/pins\//,'Training integration should leave pinning manual');

const api=readFileSync('functions/api/training-resources/index.js','utf8');
for(const pattern of [
  /site_admin/,
  /training-resources-admin/,
  /syncTrainingResourcesDiscord/,
  /training_resources_storage_not_configured/,
])assert.match(api,pattern);

const admin=readFileSync('js/training-resources-admin.js','utf8');
new Function(admin);
for(const pattern of [
  /\/api\/training-resources/,
  /Publish \/ Sync Discord Card/,
  /training-grounds/,
])assert.match(admin,pattern);

const manual=readFileSync('guides/index.html','utf8');
for(const pattern of [
  /data-training-discord-admin/,
  /data-training-discord-sync/,
  /training-resources-admin\.js\?v=1/,
])assert.match(manual,pattern);

console.log('✓ Training Resources Discord index, existing Training Grounds reuse, and admin sync wiring are sound');
