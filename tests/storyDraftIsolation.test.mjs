import test from 'node:test';
import assert from 'node:assert/strict';
import { getStationsDraftKey } from '../src/stations.js';

test('station drafts are isolated by story id', () => {
  assert.notEqual(getStationsDraftKey('demo-heidentor'), getStationsDraftKey('demo-starhemberg'));
  assert.match(getStationsDraftKey('demo-heidentor'), /demo-heidentor$/);
});
