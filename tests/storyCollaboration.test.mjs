import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditStory,
  canViewStory,
  getStoryEditors,
  getStoryPermission,
  normalizeStoryCollaborators,
  normalizeUsername
} from '../src/platform/platformStore.js';

const story = {
  ownerId: 'owner',
  status: 'draft',
  collaborators: [
    { userId: 'editor', username: 'Editor.One', name: 'Edita', role: 'editor', status: 'accepted' },
    { userId: 'viewer', username: 'viewer', name: 'Vera', role: 'viewer', status: 'accepted' },
    { userId: 'pending', username: 'pending', name: 'Peer', role: 'editor', status: 'pending' }
  ]
};

test('story permissions distinguish owner, editor, viewer, and pending invitations', () => {
  assert.equal(getStoryPermission(story, 'owner'), 'owner');
  assert.equal(getStoryPermission(story, 'editor'), 'editor');
  assert.equal(getStoryPermission(story, 'viewer'), 'viewer');
  assert.equal(getStoryPermission(story, 'pending'), null);
  assert.equal(canEditStory(story, 'editor'), true);
  assert.equal(canEditStory(story, 'viewer'), false);
  assert.equal(canViewStory(story, 'viewer'), true);
  assert.equal(canViewStory(story, 'pending'), false);
});

test('only accepted editors are credited on published story surfaces', () => {
  assert.deepEqual(getStoryEditors(story).map(({ userId }) => userId), ['editor']);
});

test('collaborators and usernames are normalized safely', () => {
  assert.equal(normalizeUsername('  Anna Museum!  '), 'anna-museum');
  const normalized = normalizeStoryCollaborators([
    { userId: 'one', username: 'One', role: 'invalid', status: 'invalid' },
    { userId: 'one', username: 'duplicate', role: 'editor', status: 'accepted' }
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].role, 'viewer');
  assert.equal(normalized[0].status, 'pending');
});
