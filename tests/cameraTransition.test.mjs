import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCameraTransitionDuration } from '../src/utils/cameraTransition.js';

test('camera transitions scale with distance within authored limits', () => {
  const duration = resolveCameraTransitionDuration({
    distance: 10, base: 0.85, multiplier: 0.045, minimum: 0.85, maximum: 1.6
  });
  assert.ok(Math.abs(duration - 1.3) < 1e-10);
  assert.equal(resolveCameraTransitionDuration({
    distance: 100, base: 0.85, multiplier: 0.045, minimum: 0.85, maximum: 1.6
  }), 1.6);
});

test('reduced motion uses an immediate camera state change', () => {
  assert.equal(resolveCameraTransitionDuration({
    distance: 100, base: 1.45, multiplier: 0.055, minimum: 1.45, maximum: 2.6, reducedMotion: true
  }), 0);
});
