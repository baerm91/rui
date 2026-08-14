import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { updateWeatherEffects } from '../src/three/weatherEffects.js';

test('snow and thunder assignments create particles, darkness and lightning', () => {
  const context = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    renderer: { toneMappingExposure: 1.25 }
  };
  const effects = new Set(['builtin-snow', 'builtin-thunder']);

  updateWeatherEffects(context, effects, 0.1, 0, { serial: 0, thunderDelay: 0 });
  assert.equal(context.weatherEffects.snow.points.visible, true);
  assert.ok(context.renderer.toneMappingExposure < 1.25);

  updateWeatherEffects(context, effects, 0.1, 100, { serial: 1, thunderDelay: 0.8 });
  assert.ok(context.weatherEffects.flashLight.intensity > 0);
  assert.ok(context.renderer.toneMappingExposure > 1);

  updateWeatherEffects(context, new Set(), 1, 101);
  assert.equal(context.weatherEffects.snow.points.visible, false);
  assert.equal(context.weatherEffects.flashLight.intensity, 0);
});

test('weather dynamics controls snow density but not lightning brightness', () => {
  const low = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: { toneMappingExposure: 1.25 } };
  updateWeatherEffects(low, new Map([['builtin-snow', 50], ['builtin-thunder', 50]]), 0.1, 0, { serial: 0, thunderDelay: 0 });
  updateWeatherEffects(low, new Map([['builtin-snow', 50], ['builtin-thunder', 50]]), 0.1, 100, { serial: 1, thunderDelay: 0.8 });

  const high = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: { toneMappingExposure: 1.25 } };
  updateWeatherEffects(high, new Map([['builtin-snow', 200], ['builtin-thunder', 200]]), 0.1, 0, { serial: 0, thunderDelay: 0 });
  updateWeatherEffects(high, new Map([['builtin-snow', 200], ['builtin-thunder', 200]]), 0.1, 100, { serial: 1, thunderDelay: 0.8 });

  assert.ok(low.weatherEffects.snow.geometry.drawRange.count < high.weatherEffects.snow.geometry.drawRange.count);
  assert.equal(low.weatherEffects.flashLight.intensity, high.weatherEffects.flashLight.intensity);
});
