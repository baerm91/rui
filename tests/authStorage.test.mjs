import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthStorage, readRememberLoginPreference, REMEMBER_LOGIN_KEY, writeRememberLoginPreference
} from '../src/platform/supabaseClient.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
};

test('remember login is enabled by default and persists the preference', () => {
  const preferences = memoryStorage();
  assert.equal(readRememberLoginPreference(preferences), true);
  writeRememberLoginPreference(false, preferences);
  assert.equal(preferences.getItem(REMEMBER_LOGIN_KEY), 'false');
  assert.equal(readRememberLoginPreference(preferences), false);
});

test('remembered sessions use persistent storage and clear the tab copy', () => {
  const persistent = memoryStorage();
  const tab = memoryStorage();
  tab.setItem('session', 'old-tab-session');
  const storage = createAuthStorage(persistent, tab, () => true);
  storage.setItem('session', 'remembered-session');
  assert.equal(persistent.getItem('session'), 'remembered-session');
  assert.equal(tab.getItem('session'), null);
  assert.equal(storage.getItem('session'), 'remembered-session');
});

test('temporary sessions use tab storage and clear the persistent copy', () => {
  const persistent = memoryStorage();
  const tab = memoryStorage();
  persistent.setItem('session', 'old-persistent-session');
  const storage = createAuthStorage(persistent, tab, () => false);
  storage.setItem('session', 'temporary-session');
  assert.equal(persistent.getItem('session'), null);
  assert.equal(tab.getItem('session'), 'temporary-session');
  assert.equal(storage.getItem('session'), 'temporary-session');
  storage.removeItem('session');
  assert.equal(tab.getItem('session'), null);
});
