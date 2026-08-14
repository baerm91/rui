import assert from 'node:assert/strict';
import test from 'node:test';
import { getStoryCreatedAt, getStoryPublishedAt } from '../src/platform/storyDates.js';

test('story creation date prefers the original creation timestamp', () => {
  assert.equal(getStoryCreatedAt({ createdAt: 'created', publishedAt: 'published', updatedAt: 'updated' }), 'created');
});

test('legacy story dates use stable stored timestamps as fallbacks', () => {
  assert.equal(getStoryCreatedAt({ publishedAt: 'published', updatedAt: 'updated' }), 'published');
  assert.equal(getStoryPublishedAt({ status: 'published', updatedAt: 'updated' }), 'updated');
});

test('drafts are not presented as currently published', () => {
  assert.equal(getStoryPublishedAt({ status: 'draft', publishedAt: 'former-publication' }), null);
});
