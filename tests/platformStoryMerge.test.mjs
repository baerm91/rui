import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeStoryCollections } from '../src/platform/platformStore.js';

test('keeps local stories which are not present in the public database', () => {
  const local = [
    { id: 'local-draft', name: 'Lokaler Entwurf' },
    { id: 'published', name: 'Alter Titel' }
  ];
  const remote = [{ id: 'published', name: 'Neuer Titel' }];

  assert.deepEqual(mergeStoryCollections(local, remote), [
    { id: 'local-draft', name: 'Lokaler Entwurf' },
    { id: 'published', name: 'Neuer Titel' }
  ]);
});
