import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveDistinctAnnotations } from '../src/utils/annotationIdentity.js';

test('exact legacy annotation copies are merged once', () => {
  const annotation = { id: 'shared', title: 'Tor', text: 'Beschreibung' };
  assert.deepEqual(
    preserveDistinctAnnotations([annotation, { ...annotation }]),
    [annotation]
  );
});

test('different annotations with the same id are preserved with unique ids', () => {
  const annotations = preserveDistinctAnnotations([
    { id: 'shared', title: 'Tor A' },
    { id: 'shared', title: 'Tor B' },
    { id: 'shared', title: 'Tor C' }
  ]);

  assert.equal(annotations.length, 3);
  assert.deepEqual(annotations.map(({ title }) => title), ['Tor A', 'Tor B', 'Tor C']);
  assert.equal(new Set(annotations.map(({ id }) => id)).size, 3);
});
