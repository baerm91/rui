import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureSharedPublishedStoryCover,
  invalidatePublishedStoryCoverUpload,
  isSharedPublishedStoryCover
} from '../src/platform/storyCoverPublishing.js';

test('bundled and already uploaded cover URLs need no second upload', async () => {
  assert.equal(isSharedPublishedStoryCover({ coverImage: '/heidentor-cover.jpg' }), true);
  assert.equal(isSharedPublishedStoryCover({
    coverImage: 'https://project.supabase.co/cover.jpg',
    coverImageStoragePath: 'owner/cover.jpg'
  }), true);
  assert.equal(isSharedPublishedStoryCover({ coverImage: 'https://external.example.org/cover.jpg' }), false);
  const story = { id: 'shared', coverImage: '/heidentor-cover.jpg' };
  assert.equal(await ensureSharedPublishedStoryCover(story, () => assert.fail()), story);
});

test('browser-local cover data is uploaded and replaced by its public URL', async () => {
  const story = {
    id: 'local-cover',
    coverImage: 'data:image/png;base64,iVBORw0KGgo='
  };
  let uploadedBlob;
  const published = await ensureSharedPublishedStoryCover(story, async (_story, blob) => {
    uploadedBlob = blob;
    return {
      storagePath: 'owner/local-cover-cover.png',
      publicUrl: 'https://project.supabase.co/storage/v1/object/public/story-previews/owner/local-cover-cover.png?v=1'
    };
  });

  assert.equal(uploadedBlob.type, 'image/png');
  assert.ok(uploadedBlob.size > 0);
  assert.match(published.coverImage, /^https:\/\/project\.supabase\.co\//);
  assert.equal(published.coverImageStoragePath, 'owner/local-cover-cover.png');
});

test('changing an already published cover invalidates the previous upload', () => {
  const changed = invalidatePublishedStoryCoverUpload({
    id: 'published-story',
    status: 'published',
    coverImage: 'data:image/png;base64,iVBORw0KGgo=',
    coverImageStoragePath: 'owner/published-story-cover.jpg',
    coverImageUploadedAt: '2026-08-01T10:00:00.000Z'
  });

  assert.equal(changed.coverImageStoragePath, '');
  assert.equal(changed.coverImageUploadedAt, '');
  assert.equal(isSharedPublishedStoryCover(changed), false);
});

test('publishing rejects missing or invalid local cover data', async () => {
  await assert.rejects(
    ensureSharedPublishedStoryCover({ id: 'missing', coverImage: '' }, () => assert.fail()),
    /Vorschaubild/
  );
  await assert.rejects(
    ensureSharedPublishedStoryCover({ id: 'invalid', coverImage: 'C:\\cover.jpg' }, () => assert.fail()),
    /unterstütztes Format/
  );
});
