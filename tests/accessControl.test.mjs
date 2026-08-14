import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreateStories, isAdmin, normalizeUserRole } from '../src/platform/accessControl.js';

test('unknown roles fall back to light-user', () => {
  assert.equal(normalizeUserRole('owner'), 'light-user');
  assert.equal(normalizeUserRole(), 'light-user');
});

test('only active admins and pro users can create stories', () => {
  assert.equal(canCreateStories({ role: 'admin' }), true);
  assert.equal(canCreateStories({ role: 'pro-user' }), true);
  assert.equal(canCreateStories({ role: 'light-user' }), false);
  assert.equal(canCreateStories({ role: 'admin', isBlocked: true }), false);
});

test('admin access requires an active admin account', () => {
  assert.equal(isAdmin({ role: 'admin' }), true);
  assert.equal(isAdmin({ role: 'pro-user' }), false);
  assert.equal(isAdmin({ role: 'admin', isBlocked: true }), false);
});
