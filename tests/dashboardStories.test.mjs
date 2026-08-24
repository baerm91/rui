import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOwnedStories } from '../src/platform/dashboardStories.js';

const stories = [
  { id: 'own-draft', ownerId: 'user-1', status: 'draft' },
  { id: 'own-published', ownerId: 'user-1', status: 'published' },
  { id: 'foreign-published', ownerId: 'user-2', status: 'published' },
  { id: 'foreign-shared', ownerId: 'user-3', status: 'draft', collaborators: [
    { userId: 'user-1', role: 'editor', status: 'accepted' }
  ] }
];

test('Meine Stories contains every own story regardless of publication status', () => {
  assert.deepEqual(
    filterOwnedStories(stories, 'user-1').map((story) => story.id),
    ['own-draft', 'own-published']
  );
});

test('Meine Stories excludes public and shared stories owned by other users', () => {
  const result = filterOwnedStories(stories, 'user-1');
  assert.equal(result.some((story) => story.id === 'foreign-published'), false);
  assert.equal(result.some((story) => story.id === 'foreign-shared'), false);
  assert.deepEqual(filterOwnedStories(stories, ''), []);
});
