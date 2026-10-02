import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeGalnetFeed } from '../lib/galnet.js';

const api=readFileSync('functions/api/newsroom/index.js','utf8');
const page=readFileSync('newsroom/index.html','utf8');
const client=readFileSync('js/newsroom.js','utf8');
const css=readFileSync('css/newsroom.css','utf8');
const site=readFileSync('js/site.js','utf8');
const galnetApi=readFileSync('functions/api/galnet.js','utf8');
const galnetLib=readFileSync('lib/galnet.js','utf8');
for(const pattern of [/galnet-wire-v1/,/cms\.zaonce\.net\/en-GB\/jsonapi\/node\/galnet_article/,/api\.eddata\.dev\/v2\/news\/galnet/,/PROVIDERS/,/FRESH_MS/,/Last successful feed|last successful feed/,/PROJECTS/]) assert.match(galnetApi+galnetLib,pattern);
const normalizedGalnet=normalizeGalnetFeed([{
  published:'2026-10-02T12:00:00Z',
  date:'02 OCT 3312',
  title:'Test Dispatch',
  text:'<p>One &amp; two from GalNet.</p>',
  slug:'test-dispatch',
  image:'https://example.com/image.jpg',
  url:'https://example.com/article',
}]);
assert.equal(normalizedGalnet.length,1);
assert.equal(normalizedGalnet[0].galnetDate,'02 OCT 3312');
assert.equal(normalizedGalnet[0].teaser,'One & two from GalNet.');
assert.equal(normalizedGalnet[0].url,'https://example.com/article');
assert.equal(normalizedGalnet[0].imageUrl,'https://example.com/image.jpg');

const normalizedFrontierGalnet=normalizeGalnetFeed({data:[{
  type:'node--galnet_article',
  attributes:{
    published_at:'2026-10-02T13:00:00Z',
    field_galnet_date:'02 OCT 3312',
    title:'Frontier Test Dispatch',
    body:{value:'<p>Official &amp; direct from Frontier.</p>'},
    field_slug:'frontier-test-dispatch',
    field_galnet_guid:'test-guid',
    field_galnet_image:'test_image',
  },
}]});
assert.equal(normalizedFrontierGalnet.length,1);
assert.equal(normalizedFrontierGalnet[0].galnetDate,'02 OCT 3312');
assert.equal(normalizedFrontierGalnet[0].teaser,'Official & direct from Frontier.');
assert.equal(normalizedFrontierGalnet[0].url,'https://www.elitedangerous.com/news/galnet/frontier-test-dispatch');
assert.equal(normalizedFrontierGalnet[0].imageUrl,'https://hosting.zaonce.net/elite-dangerous/galnet/test_image.png');

for(const pattern of [
  /newsroom-v1/,/The Morning Walk/,/squadron-news/,/field-report/,/command-briefing/,
  /colonial-dispatch/,/lore/,/site_admin_required/,/mongrels-newsroom/,
  /only_drafts_can_be_deleted/,/only_published_stories_can_be_archived/,
]) assert.match(api,pattern);
assert.match(api,/filter\(item=>canManage\|\|item\.status==='published'\)/,'Public Newsroom must never return drafts or archived stories');
assert.match(api,/12000/,'Story body must have a server-side length cap');
for(const pattern of [/imageKey/,/imagePlacement/,/imageCaption/,/imageCredit/,/newsroomImagePublicUrl/,/newsroomImagePreviewUrl/]) assert.match(api,pattern);
const imageApi=readFileSync('functions/api/newsroom/image.js','utf8');
const imageLib=readFileSync('lib/newsroom-images.js','utf8');
const imageMedia=readFileSync('functions/media/newsroom/[file].js','utf8');
for(const pattern of [/8\*1024\*1024/,/image\/png/,/image\/jpeg/,/image\/webp/,/mongrels-newsroom-image/,/site_admin_required/]) assert.match(imageApi+imageLib,pattern);
assert.match(imageMedia,/status\|\|''\)==='published'/,'Only published stories may expose a public Newsroom image');

for(const pattern of [/Newsroom/,/The Morning Walk/,/data-newsroom-list/,/data-newsroom-editor/,/newsroom\.css/,/newsroom\.js/,/data-newsroom-image-placement/,/Upper Left/,/Lower Right/,/data-newsroom-preview/,/GalNet Wire/,/data-galnet-list/,/data-galnet-status/]) assert.match(page,pattern);
for(const pattern of [/textContent/,/safe\(/,/mongrels-newsroom/,/\?story=/,/saveStory/,/publish/,/articleMarkup/,/articleBodyMarkup/,/uploadImage/,/mongrels-newsroom-image/,/previewStory/,/loadGalnet/,/renderGalnet/,/\/api\/galnet/,/rel=\"noopener noreferrer\"/]) assert.match(client,pattern);
for(const pattern of [/Save Draft/,/Publish/,/Plain text is intentional in v1/]) assert.match(page,pattern);
for(const pattern of [/newsroom-masthead/,/newsroom-lead/,/newsroom-story-card/,/newsroom-editor/,/newsroom-press-photo/,/grayscale\(1\)/,/float:left/,/float:right/,/@media\(max-width:720px\)/,/newsroom-preview-shell/,/newsroom-galnet/,/galnet-wire-lead-card/,/galnet-wire-grid/]) assert.match(css,pattern);
assert.match(site,/root\('newsroom\/'\)/,'Community navigation must expose the Newsroom');
assert.match(site,/about\|members\|gallery\|announcements\|newsroom/,'Newsroom must resolve to the Community navigation group');

console.log('✓ Newsroom shell, Morning Walk publishing, and cached GalNet Wire integration are structurally sound');
