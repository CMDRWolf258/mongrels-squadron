import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api=readFileSync('functions/api/newsroom/index.js','utf8');
const page=readFileSync('newsroom/index.html','utf8');
const client=readFileSync('js/newsroom.js','utf8');
const css=readFileSync('css/newsroom.css','utf8');
const site=readFileSync('js/site.js','utf8');

for(const pattern of [
  /newsroom-v1/,/The Morning Walk/,/squadron-news/,/field-report/,/command-briefing/,
  /colonial-dispatch/,/lore/,/site_admin_required/,/mongrels-newsroom/,
  /only_drafts_can_be_deleted/,/only_published_stories_can_be_archived/,
]) assert.match(api,pattern);
assert.match(api,/filter\(item=>canManage\|\|item\.status==='published'\)/,'Public Newsroom must never return drafts or archived stories');
assert.match(api,/12000/,'Story body must have a server-side length cap');

for(const pattern of [/Newsroom/,/The Morning Walk/,/data-newsroom-list/,/data-newsroom-editor/,/newsroom\.css/,/newsroom\.js/]) assert.match(page,pattern);
for(const pattern of [/textContent/,/safe\(/,/mongrels-newsroom/,/\?story=/,/Save Draft/,/Publish/]) assert.match(client,pattern);
for(const pattern of [/newsroom-masthead/,/newsroom-lead/,/newsroom-story-card/,/newsroom-editor/]) assert.match(css,pattern);
assert.match(site,/root\('newsroom\/'\)/,'Community navigation must expose the Newsroom');
assert.match(site,/about\|members\|gallery\|announcements\|newsroom/,'Newsroom must resolve to the Community navigation group');

console.log('✓ Newsroom shell, public Morning Walk feed, and Site Admin publishing workflow are structurally sound');
