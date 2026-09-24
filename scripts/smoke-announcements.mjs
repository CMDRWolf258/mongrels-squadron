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
  imageUrl:'https://mongrels-squadron.pages.dev/media/announcements/test.webp',
},{siteUrl:'https://mongrels-squadron.pages.dev/announcements/#announcement-a1',notifyRoleId:'777777777777777777'});
assert.equal(payload.embeds[0].title,'Squad Update');
assert.match(payload.embeds[0].description,/new announcement/);
assert.match(payload.embeds[0].footer.text,/Official Announcement/);
assert.equal(payload.embeds[0].fields[1].value,'Important');
assert.equal(payload.embeds[0].image.url,'https://mongrels-squadron.pages.dev/media/announcements/test.webp');
assert.equal(payload.content,'<@&777777777777777777>');
assert.deepEqual(payload.allowedRoleMentions,['777777777777777777']);

const originalFetch=globalThis.fetch;
let captured=[];
globalThis.fetch=async(url,options)=>{
  captured.push({url,options});
  return Response.json({id:'123456789012345678'},{status:200});
};
try{
  const created=await createAnnouncementsDiscordMessage(
    {DISCORD_ANNOUNCEMENTS_WEBHOOK_URL:webhook},
    {embeds:[{title:'Create'}],content:'<@&777777777777777777>',allowedRoleMentions:['777777777777777777']}
  );
  assert.equal(created.messageId,'123456789012345678');
  assert.equal(captured[0].options.method,'POST');
  assert.match(captured[0].url,/wait=true/);
  const createBody=JSON.parse(captured[0].options.body);
  assert.equal(createBody.content,'<@&777777777777777777>');
  assert.deepEqual(createBody.allowed_mentions,{parse:[],roles:['777777777777777777']});

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
  /announcementImagePublicUrl/,
  /announcementImagePreviewUrl/,
  /deleteManagedAnnouncementImage/,
  /imageKey/,
  /imageStorageConfigured/,
  /mongrelsRoleConfigured/,
  /notifyMongrels=action==='publish'&&existing\.status==='draft'/,
  /MEMBER_ROLE_ID/,
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
  /mongrels-announcement-image/,
  /prepareImage/,
  /uploadImage/,
  /deleteTemporaryImage/,
  /announcement-card-image/,
  /data-announcement-notify/,
  /notifyMongrels/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('announcements/index.html','utf8');
for(const pattern of [
  /Official Squadron Communications/,
  /data-announcements-board/,
  /data-announcement-new/,
  /data-announcement-form/,
  /data-announcement-image-drop/,
  /data-announcement-image-file/,
  /data-announcement-notify/,
  /Notify @Mongrels/,
  /announcements\.js\?v=3/,
  /announcements\.css\?v=3/,
])assert.match(page,pattern);

const imageApi=readFileSync('functions/api/announcements/image.js','utf8');
for(const pattern of [
  /ANNOUNCEMENT_IMAGE_MAX_BYTES/,
  /site_admin_required/,
  /mongrels-announcement-image/,
  /announcementImagePreviewUrl/,
  /deleteManagedAnnouncementImage/,
])assert.match(imageApi,pattern);

const media=readFileSync('functions/media/announcements/[file].js','utf8');
for(const pattern of [
  /announcements-v1/,
  /published/,
  /archived/,
  /EVENT_IMAGES\.get/,
  /isManagedAnnouncementImageKey/,
])assert.match(media,pattern);

const imageLib=readFileSync('lib/announcement-images.js','utf8');
for(const pattern of [
  /8\*1024\*1024/,
  /announcements\//,
  /image\/png/,
  /image\/jpeg/,
  /image\/webp/,
])assert.match(imageLib,pattern);

console.log('✓ Announcements support managed R2 images, persistent Discord embeds, and opt-in first-publish @Mongrels notifications');
