import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function initialShell({ path = '/', storedTheme = null, darkSystem = false, storageBlocked = false } = {}) {
  const classes = new Set();
  const documentElement = { dataset: {}, classList: { add: (value) => classes.add(value) } };
  runInNewContext(bootstrap, {
    document: { documentElement },
    location: { pathname: path },
    matchMedia: () => ({ matches: darkSystem }),
    localStorage: { getItem: () => {
      if (storageBlocked) throw new Error('Storage denied');
      return storedTheme;
    } }
  });
  return { theme: documentElement.dataset.riuTheme, classes: [...classes] };
}

test('the initial HTML honors saved themes before any application module runs', () => {
  assert.equal(initialShell({ storedTheme: 'dark' }).theme, 'dark');
  assert.equal(initialShell({ storedTheme: 'light', darkSystem: true }).theme, 'light');
});

test('the initial theme falls back to the system when storage is absent, invalid or blocked', () => {
  assert.equal(initialShell().theme, 'light');
  assert.equal(initialShell({ darkSystem: true }).theme, 'dark');
  assert.equal(initialShell({ storedTheme: 'invalid', darkSystem: true }).theme, 'dark');
  assert.equal(initialShell({ storageBlocked: true, darkSystem: true }).theme, 'dark');
});

test('platform and experience routes keep their separate loading shells', () => {
  for (const path of ['/', '/discover', '/login', '/stories/new']) {
    assert.deepEqual(initialShell({ path }).classes, ['route-shell-platform']);
  }
  for (const path of ['/stories/example', '/studio/example', '/__spatial-preview']) {
    assert.deepEqual(initialShell({ path }).classes, ['route-shell-experience']);
  }
});
