import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATION_BEHAVIOR, getStationRendererDescriptor, normalizeStationBehavior } from '../src/utils/stationBehavior.js';

test('station behaviors receive complete exhibition defaults', () => {
  assert.deepEqual(normalizeStationBehavior(), DEFAULT_STATION_BEHAVIOR);
});

test('renderer descriptors select genuinely different stage modes', () => {
  assert.deepEqual(getStationRendererDescriptor({ layout: 'orbit', scroll: 'horizontal', motion: { parallax: true } }), {
    layoutClass: 'stage-scene-orbit', scrollClass: 'stage-scroll-horizontal', motionClass: 'motion-parallax', pin: true, distance: 2.2
  });
  assert.equal(getStationRendererDescriptor({ layout: 'timeline', scroll: 'normal' }).pin, false);
  assert.equal(getStationRendererDescriptor({ layout: 'cluster', scroll: 'zoom' }).scrollClass, 'stage-scroll-zoom');
});

test('station behaviors preserve valid WebMCP choices and repair invalid values', () => {
  const behavior = normalizeStationBehavior({
    layout: 'orbit', entrance: 'unknown', scroll: 'zoom',
    interactions: { spotlight: true, connections: false },
    motion: { parallax: false, floating: true, magneticCursor: false, depthOfField: true, clusterExplode: false, progressiveText: true },
    atmosphere: { theme: 'nocturne', particles: false, accent: '#7f9fd1' }, viewerTransition: 'morph', stationTransition: 'light-shift'
  });
  assert.equal(behavior.layout, 'orbit');
  assert.equal(behavior.entrance, DEFAULT_STATION_BEHAVIOR.entrance);
  assert.equal(behavior.scroll, 'zoom');
  assert.equal(behavior.interactions.spotlight, true);
  assert.equal(behavior.interactions.connections, false);
  assert.equal(behavior.atmosphere.theme, 'nocturne');
  assert.equal(behavior.atmosphere.particles, false);
  assert.equal(behavior.atmosphere.accent, '#7f9fd1');
  assert.equal(behavior.motion.parallax, false);
  assert.equal(behavior.motion.magneticCursor, false);
  assert.equal(behavior.motion.depthOfField, true);
  assert.equal(behavior.stationTransition, 'light-shift');
  assert.equal(behavior.viewerTransition, 'morph');
});
