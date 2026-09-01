import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStoriesByExperienceKind, getStoryExperienceKind, getStoryExperienceLabel, isRoomStory } from '../src/utils/storyExperience.js';

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

test('visitor-facing formats distinguish guided model stories from room exhibitions', () => {
  const tour = { models: { primary: 'https://example.org/heidentor.glb' }, settings: { experienceType: 'model' } };
  const exhibition = { models: {}, settings: { experienceType: 'room' } };
  assert.equal(getStoryExperienceKind(tour), 'tour');
  assert.equal(getStoryExperienceLabel(tour), 'Führung');
  assert.equal(getStoryExperienceKind(exhibition), 'exhibition');
  assert.equal(getStoryExperienceLabel(exhibition), 'Ausstellung');
  assert.deepEqual(filterStoriesByExperienceKind([tour, exhibition], 'tour'), [tour]);
  assert.deepEqual(filterStoriesByExperienceKind([tour, exhibition], 'exhibition'), [exhibition]);
  assert.deepEqual(filterStoriesByExperienceKind([tour, exhibition]), [tour, exhibition]);
});
