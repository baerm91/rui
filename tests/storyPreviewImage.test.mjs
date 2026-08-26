import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAutomaticStoryPreviewImage,
  ensurePublishedStoryPreviewImage,
  ensurePublishedStoryPreviewImages
} from '../src/platform/storyPreviewImage.js';

const publishedStory = {
  id: 'story-preview-test',
  name: 'Spuren einer Stadt',
  description: 'Eine räumliche Erzählung.',
  status: 'published',
  publishedAt: '2026-08-26T08:00:00.000Z',
  metadata: { categories: ['Archäologie'] },
  settings: { experienceType: 'model' },
  stations: [{ id: 'one' }, { id: 'two' }]
};

test('published stories without a cover receive a deterministic preview image', () => {
  const updated = ensurePublishedStoryPreviewImage(publishedStory);

  assert.match(updated.coverImage, /^data:image\/svg\+xml;charset=UTF-8,/);
  assert.equal(updated.previewImageSource, 'automatic');
  assert.equal(updated.previewImageGeneratedAt, publishedStory.publishedAt);
  assert.equal(updated.coverImage, createAutomaticStoryPreviewImage(publishedStory));
});

test('manual preview images are never replaced', () => {
  const story = { ...publishedStory, coverImage: 'https://example.org/manual.jpg' };
  assert.equal(ensurePublishedStoryPreviewImage(story), story);
});

test('drafts remain unchanged and published collections are backfilled', () => {
  const draft = { ...publishedStory, id: 'draft', status: 'draft', coverImage: '' };
  const result = ensurePublishedStoryPreviewImages([draft, publishedStory]);

  assert.equal(result[0], draft);
  assert.ok(result[1].coverImage);
});

test('automatic preview images refresh when relevant story data changes', () => {
  const initial = ensurePublishedStoryPreviewImage(publishedStory);
  const renamed = ensurePublishedStoryPreviewImage({ ...initial, name: 'Neuer Titel' });

  assert.notEqual(renamed.coverImage, initial.coverImage);
  assert.notEqual(renamed.previewImageSignature, initial.previewImageSignature);
});
