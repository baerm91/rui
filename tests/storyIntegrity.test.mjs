import test from 'node:test';
import assert from 'node:assert/strict';
import { demoStories, findCrossStoryStationSource } from '../src/platform/platformStore.js';

test('cross-story station contamination is detected by station ids', () => {
  const starhemberg = demoStories.find((story) => story.id === 'demo-starhemberg');
  const heidentor = demoStories.find((story) => story.id === 'demo-heidentor');

  assert.equal(
    findCrossStoryStationSource(starhemberg.stations, heidentor.id, demoStories),
    starhemberg.id
  );
  assert.equal(findCrossStoryStationSource(heidentor.stations, heidentor.id, demoStories), null);
});
