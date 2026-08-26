import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublishedDiscoverStories, getRandomFeaturedDiscoverStoryId } from '../src/platform/discoverStories.js';

test('Discover combines published model stories and room exhibitions', () => {
  const stories = [
    { id: 'model-story', status: 'published', settings: { experienceType: 'model' } },
    { id: 'room-story', status: 'published', settings: { experienceType: 'room' } },
    { id: 'draft-room', status: 'draft', settings: { experienceType: 'room' } }
  ];

  assert.deepEqual(
    getPublishedDiscoverStories(stories).map((story) => story.id),
    ['model-story', 'room-story']
  );
});

test('Discover chooses its featured story randomly but deterministically for one selection', () => {
  const stories = [{ id: 'first' }, { id: 'middle' }, { id: 'last' }];

  assert.equal(getRandomFeaturedDiscoverStoryId(stories, () => 0), 'first');
  assert.equal(getRandomFeaturedDiscoverStoryId(stories, () => .5), 'middle');
  assert.equal(getRandomFeaturedDiscoverStoryId(stories, () => .9999), 'last');
  assert.equal(getRandomFeaturedDiscoverStoryId([], () => .5), '');
});
