import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createAnnouncementsDiscordMessage,
  discordAnnouncementsConfigured,
  editAnnouncementsDiscordMessage,
} from '../lib/discord-webhook.js';
import { buildAnnouncementDiscordPayload } from '../lib/announcements-discord.js';

const webhook='https://discord.com/api/webhooks/9191919191/announcements_token_ABC_123';
assert.equal(discordAnnouncementsConfigured({DISCORD_ANNOUNCEMENTS_WEBHOOK_URL:webhook}),true);
assert.equal(discordAnnouncementsConfigured({DISCORD_ANNOUNCEMENTS_WEBHOOK_URL:'https://example.com/nope'}),false);

const payload=buildAnnouncementDiscordPayload({
  id:'a1',
  title:'Squad Update',
  body:'The pack has a new announcement.',
  priority:'important',
  authorName:'CMDR Wolf258',
  publishedAt:'2026-09-23T15:00:00.000Z',
},{siteUrl:'https://mongrels-squadron.pages.dev/announcements/#announcement-a1'});
assert.equal(payload.embeds[0].title,'Squad Update');
assert.match(payload.embeds[0].description,/new announcement/);
assert.match(payload.embeds[0].footer.text,/Official Announcement/);
assert.equal(payload.embeds[0].fields[1].value,'Important');

const originalFetch=globalThis.fetch;
let captured=[];
globalThis.fetch=async(url,options)=>{
  captured.push({url,options});
  return Response.json({id:'123456789012345678'},{status:200});
};
try{
  const created=await createAnnouncementsDiscordMessage(
    {DISCORD_ANNOUNCEMENTS_WEBHOOK_URL:webhook},
    {embeds:[{title:'Create'}]}
  );
  assert.equal(created.messageId,'123456789012345678');
  assert.equal(captured[0].options.method,'POST');
  assert.match(captured[0].url,/wait=true/);

  const edited=await editAnnouncementsDiscordMessage(
    {DISCORD_ANNOUNCEMENTS_WEBHOOK_URL:webhook},
    '123456789012345678',
    {embeds:[{title:'Edit'}]}
  );
  assert.equal(edited.messageId,'123456789012345678');
  assert.equal(captured[1].options.method,'PATCH');
  assert.match(captured[1].url,/messages\/123456789012345678/);
  const editBody=JSON.parse(captured[1].options.body);
  assert.deepEqual(editBody.allowed_mentions,{parse:[]});
}finally{
  globalThis.fetch=originalFetch;
}

const api=readFileSync('functions/api/announcements/index.js','utf8');
for(const pattern of [
  /announcements-v1/,
  /env\.PROJECTS/,
  /session\.access!=='site_admin'/,
  /mongrels-announcements/,
  /discordAnnouncementsConfigured/,
  /syncAnnouncementDiscord/,
  /status='published'|status:'published'|item\.status='published'/,
  /published_announcements_must_be_archived/,
])assert.match(api,pattern);

const client=readFileSync('js/announcements.js','utf8');
for(const pattern of [
  /\/api\/announcements/,
  /X-Mongrels-Request/,
  /mongrels-announcements/,
  /Publish to Squad \+ Discord/,
  /Discord announcements not connected/,
  /data-announcement-filter/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('announcements/index.html','utf8');
for(const pattern of [
  /Official Squadron Communications/,
  /data-announcements-board/,
  /data-announcement-new/,
  /data-announcement-form/,
  /announcements\.js\?v=1/,
  /announcements\.css\?v=1/,
])assert.match(page,pattern);

console.log('✓ Announcements manager, PROJECTS storage, member board, and dedicated Discord webhook path are wired');
