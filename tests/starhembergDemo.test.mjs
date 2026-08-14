import test from 'node:test';
import assert from 'node:assert/strict';
import { demoStories } from '../src/platform/platformStore.js';

const starhemberg = demoStories.find((story) => story.id === 'demo-starhemberg');

test('published stories expose discover filter metadata', () => {
  assert.equal(starhemberg.metadata.language, 'de');
  assert.equal(starhemberg.metadata.category, 'Kulturerbe');
  assert.equal(starhemberg.stats.views, 0);
});

test('Starhemberg demo uses the spatial data from the production project export', () => {
  assert.ok(starhemberg);
  assert.equal(starhemberg.models.primary, 'https://starhemberg.vercel.app/model/scene.gltf');
  assert.equal(starhemberg.stations.length, 7);
  assert.equal(starhemberg.annotations.length, 24);

  assert.deepEqual(starhemberg.settings.orbitTarget, {
    x: -0.1432972585640563,
    y: 6.487665256906783,
    z: -0.28723425415782794
  });

  for (const annotation of starhemberg.annotations) {
    assert.equal(annotation.positionExplicitlySet, true);
    assert.equal(annotation.cameraExplicitlySet, true);
    for (const coordinate of ['x', 'y', 'z']) {
      assert.equal(Number.isFinite(annotation.position?.[coordinate]), true);
      assert.equal(Number.isFinite(annotation.cameraPos?.[coordinate]), true);
      assert.equal(Number.isFinite(annotation.cameraTarget?.[coordinate]), true);
    }
  }
});

test('Starhemberg includes its configured free-navigation station', () => {
  const freeStation = starhemberg.stations.find((station) => station.freeNavigation);
  assert.ok(freeStation);
  assert.equal(freeStation.showAnnotations, true);
});
