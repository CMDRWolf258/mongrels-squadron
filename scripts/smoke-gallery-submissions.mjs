import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GALLERY_DAILY_LIMIT,
  GALLERY_IMAGE_MAX_BYTES,
  GALLERY_TAGS,
  galleryImageExtension,
  galleryQuota,
  isGalleryImageKey,
  normalizeGalleryTags,
  publicGallerySubmission,
} from '../lib/gallery-submissions.js';

assert.equal(GALLERY_DAILY_LIMIT,10);
assert.equal(GALLERY_IMAGE_MAX_BYTES,8*1024*1024);
for(const tag of ['Combat','Exploration','Mining','PvP','BGS'])assert.ok(GALLERY_TAGS.includes(tag));
assert.equal(galleryImageExtension('image/png'),'png');
assert.equal(galleryImageExtension('image/jpeg'),'jpg');
assert.equal(galleryImageExtension('image/webp'),'webp');
assert.equal(galleryImageExtension('image/gif'),'');
assert.equal(isGalleryImageKey('gallery/1727112345678-12345678-1234-1234-1234-123456789abc.webp'),true);
assert.equal(isGalleryImageKey('events/1727112345678-12345678-1234-1234-1234-123456789abc.webp'),false);
assert.deepEqual(normalizeGalleryTags(['combat','Exploration','Combat','not-real','Mining','Ships']),['Combat','Exploration','Mining']);

const now=new Date('2026-09-23T17:00:00Z');
const quotaItems=Array.from({length:10},(_,i)=>({
  ownerId:'wolf',
  submittedAt:`2026-09-23T${String(i).padStart(2,'0')}:00:00Z`,
}));
assert.deepEqual(galleryQuota(quotaItems,'wolf',now),{
  limit:10,
  used:10,
  remaining:0,
  day:'2026-09-23',
  resetAt:'2026-09-24T00:00:00.000Z',
});

const request=new Request('https://mongrels-squadron.pages.dev/api/gallery');
const approved={
  id:'submission-1',
  ownerId:'wolf',
  ownerName:'CMDR Wolf258',
  title:'Pack Shot',
  caption:'Testing.',
  tags:['Community'],
  imageKey:'gallery/1727112345678-12345678-1234-1234-1234-123456789abc.webp',
  status:'approved',
  submittedAt:'2026-09-23T16:00:00Z',
  reviewedAt:'2026-09-23T16:05:00Z',
};
const publicItem=publicGallerySubmission(approved,request);
assert.equal(publicItem.contributorName,'CMDR Wolf258');
assert.match(publicItem.url,/\/media\/gallery\/1727112345678-12345678-1234-1234-1234-123456789abc\.webp$/);
assert.equal(publicGallerySubmission({...approved,status:'pending'},request),null);
assert.equal(publicGallerySubmission({...approved,status:'removed'},request),null);

const api=readFileSync('functions/api/gallery/index.js','utf8');
for(const pattern of [
  /gallery_daily_upload_limit/,
  /GALLERY_DAILY_LIMIT|galleryQuota/,
  /request\.formData\(\)/,
  /status:'pending'/,
  /action==='approve'/,
  /action==='reject'/,
  /action==='remove'/,
  /session\.access!=='site_admin'/,
  /site_admin_access_required/,
  /status='removed'/,
  /approvedManaged:admin\?/,
  /deleteGalleryImage/,
  /officer_access_required/,
  /fresh:true/,
])assert.match(api,pattern);

const preview=readFileSync('functions/api/gallery/image.js','utf8');
for(const pattern of [
  /readSession/,
  /MEMBER_ACCESS/,
  /item\.ownerId===session\.sub/,
  /MANAGER_ACCESS/,
  /EVENT_IMAGES\.get/,
  /private, no-store/,
])assert.match(preview,pattern);

const media=readFileSync('functions/media/gallery/[file].js','utf8');
for(const pattern of [
  /status==='approved'/,
  /item\.imageKey===key/,
  /EVENT_IMAGES\.get/,
  /immutable/,
  /fresh:true/,
])assert.match(media,pattern);

const client=readFileSync('js/gallery.js','utf8');
for(const pattern of [
  /MAX_UPLOAD_BYTES\s*=\s*8 \* 1024 \* 1024/,
  /MAX_SOURCE_BYTES\s*=\s*25 \* 1024 \* 1024/,
  /prepareImage/,
  /gallery-submission/,
  /gallery-moderation/,
  /Submit for Review|submitGalleryImage/,
  /normalizeReviewTags/,
  /Submitted by/,
  /renderAdminApproved/,
  /removeApprovedSubmission/,
  /Remove from Gallery/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('gallery/index.html','utf8');
for(const pattern of [
  /data-gallery-submit-form/,
  /data-gallery-upload-drop/,
  /data-gallery-quota/,
  /data-gallery-review-section/,
  /data-gallery-review-grid/,
  /data-gallery-admin-section/,
  /data-gallery-admin-grid/,
  /gallery\.js\?v=73/,
  /gallery-contributions\.css\?v=3/,
])assert.match(page,pattern);

const css=readFileSync('css/gallery-contributions.css','utf8');
for(const pattern of [
  /gallery-upload-drop/,
  /gallery-review-card/,
  /gallery-status\.approved/,
  /gallery-status\.removed/,
  /gallery-review-card>img\{[^}]*object-fit:contain/,
  /gallery-admin-card/,
])assert.match(css,pattern);

const galleryIndex=readFileSync('gallery/index.html','utf8');
assert.ok(galleryIndex.indexOf('class="section gallery-section"') < galleryIndex.indexOf('class="section gallery-contribute-section"'));
assert.ok(galleryIndex.indexOf('class="section gallery-contribute-section"') < galleryIndex.indexOf('data-gallery-review-section'));
assert.ok(galleryIndex.indexOf('data-gallery-review-section') < galleryIndex.indexOf('data-gallery-admin-section'));

console.log('✓ Gallery keeps images first, supports 10/day moderated uploads, and restricts approved removal to Site Admin');
