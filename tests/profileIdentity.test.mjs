import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyProfileIdentityToStories,
  getOwnedProfileStoryUpdates
} from '../src/platform/profileIdentity.js';

const stories = [
  { id: 'owned', ownerId: 'user-1', authorName: 'Alter Name', updatedAt: 'old', collaborators: [] },
  { id: 'shared', ownerId: 'user-2', authorName: 'Andere Person', updatedAt: 'old', collaborators: [
    { userId: 'user-1', name: 'Alter Name', username: 'alter-name', role: 'editor' }
  ] }
];

test('username-only profile changes do not rewrite owned story timestamps', () => {
  const updated = applyProfileIdentityToStories(stories, {
    userId: 'user-1', previousName: 'Alter Name', name: 'Alter Name',
    username: 'neuer-name', updatedAt: 'new'
  });

  assert.equal(updated[0].authorName, 'Alter Name');
  assert.equal(updated[0].updatedAt, 'old');
  assert.equal(updated[1].collaborators[0].username, 'neuer-name');
  assert.equal(updated[1].updatedAt, 'old');
});

test('display-name changes update local author and collaborator copies', () => {
  const updated = applyProfileIdentityToStories(stories, {
    userId: 'user-1', previousName: 'Alter Name', name: 'Neuer Name',
    username: 'neuer-name', updatedAt: 'new'
  });

  assert.equal(updated[0].authorName, 'Neuer Name');
  assert.equal(updated[0].updatedAt, 'new');
  assert.equal(updated[1].collaborators[0].name, 'Neuer Name');
  assert.equal(updated[1].authorName, 'Andere Person');
});

test('story synchronization is skipped for username-only and light-user profile changes', () => {
  assert.deepEqual(getOwnedProfileStoryUpdates(stories, {
    userId: 'user-1', previousName: 'Alter Name', name: 'Alter Name', canWriteStories: true
  }), []);
  assert.deepEqual(getOwnedProfileStoryUpdates(stories, {
    userId: 'user-1', previousName: 'Alter Name', name: 'Neuer Name', canWriteStories: false
  }), []);
  assert.deepEqual(getOwnedProfileStoryUpdates(stories, {
    userId: 'user-1', previousName: 'Alter Name', name: 'Neuer Name', canWriteStories: true
  }).map((story) => story.id), ['owned']);
});
