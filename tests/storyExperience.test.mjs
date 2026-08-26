import test from 'node:test';
import assert from 'node:assert/strict';
import { isRoomStory } from '../src/utils/storyExperience.js';

test('stories without a primary model use the room experience', () => {
  assert.equal(isRoomStory({ models: { primary: '' }, settings: {} }), true);
  assert.equal(isRoomStory({ models: {}, settings: {} }), true);
});

test('the explicit room type remains stable when models are added later', () => {
  assert.equal(isRoomStory({
    models: { primary: 'https://example.org/object.glb' },
    settings: { experienceType: 'room' }
  }), true);
});

test('model stories continue to use the existing viewer', () => {
  assert.equal(isRoomStory({
    models: { primary: 'https://example.org/object.glb' },
    settings: { experienceType: 'model' }
  }), false);
  assert.equal(isRoomStory(null), false);
});

