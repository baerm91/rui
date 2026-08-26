import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublishedDiscoverStories } from '../src/platform/discoverStories.js';

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

