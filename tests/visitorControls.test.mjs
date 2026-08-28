import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVisibleStationAnnotations } from '../src/utils/visitorControls.js';

test('annotation controls appear only where project annotations are visible', () => {
  const annotations = [
    { id: 'global', positionExplicitlySet: true },
    { id: 'only-b', positionExplicitlySet: true, visibleStationIds: ['b'] },
    { id: 'draft', positionExplicitlySet: false, visibleStationIds: ['a'] }
  ];
  assert.equal(hasVisibleStationAnnotations(annotations, 'a'), true);
  assert.equal(hasVisibleStationAnnotations(annotations.slice(1), 'a'), false);
  assert.equal(hasVisibleStationAnnotations(annotations.slice(1), 'b'), true);
});
