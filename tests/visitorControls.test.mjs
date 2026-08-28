import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVisibleStationAnnotations, resolveStoryFreeNavigationStationIndex } from '../src/utils/visitorControls.js';

test('story free view stays at the current configured station', () => {
  const stations = [{ id: 'a' }, { id: 'b', freeNavigation: true }, { id: 'c', freeNavigation: true }];
  assert.equal(resolveStoryFreeNavigationStationIndex(stations, 2), 2);
});

test('story free view resolves the configured station from anywhere in the story', () => {
  const stations = [{ id: 'a' }, { id: 'b' }, { id: 'c', freeNavigation: true }];
  assert.equal(resolveStoryFreeNavigationStationIndex(stations, 0), 2);
  assert.equal(resolveStoryFreeNavigationStationIndex(stations, 1), 2);
});

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
