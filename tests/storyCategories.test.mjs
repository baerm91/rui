import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStoryCategories } from '../src/platform/platformStore.js';

test('story categories preserve multiple unique selections', () => {
  assert.deepEqual(
    normalizeStoryCategories(['Kulturerbe', 'Architektur', 'Kulturerbe']),
    ['Kulturerbe', 'Architektur']
  );
});

test('legacy single category remains compatible', () => {
  assert.deepEqual(normalizeStoryCategories(undefined, 'Archäologie'), ['Archäologie']);
  assert.deepEqual(normalizeStoryCategories([], ''), ['Sonstiges']);
});
