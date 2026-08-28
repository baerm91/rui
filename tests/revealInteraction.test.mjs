import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileRevealTap,
  shouldRequireExplicitRevealExploration,
  shouldTrackRevealPointer
} from '../src/utils/revealInteraction.js';

test('mobile reveal ignores touch movement so story swipes cannot move the lens', () => {
  assert.equal(shouldTrackRevealPointer({ compactViewport: true, pointerType: 'touch' }), false);
  assert.equal(shouldTrackRevealPointer({ compactViewport: true, pointerType: 'mouse' }), true);
  assert.equal(shouldTrackRevealPointer({ compactViewport: false, pointerType: 'touch' }), true);
});

test('only a short single-finger tap places the guided mobile reveal point', () => {
  const base = {
    compactViewport: true,
    pointerType: 'touch',
    stationMode: 'scroll',
    viewMode: 'reveal',
    freeNavigationActive: false,
    maximumMovement: 4,
    durationMs: 180,
    involvedMultipleTouches: false
  };
  assert.equal(isMobileRevealTap(base), true);
  assert.equal(isMobileRevealTap({ ...base, maximumMovement: 28 }), false);
  assert.equal(isMobileRevealTap({ ...base, durationMs: 700 }), false);
  assert.equal(isMobileRevealTap({ ...base, involvedMultipleTouches: true }), false);
  assert.equal(isMobileRevealTap({ ...base, freeNavigationActive: true }), false);
  assert.equal(isMobileRevealTap({ ...base, stationMode: 'editor' }), false);
});

test('mobile reveal requires the explicit exploration control instead of activating on canvas tap', () => {
  assert.equal(shouldRequireExplicitRevealExploration({ compactViewport: true, viewMode: 'reveal' }), true);
  assert.equal(shouldRequireExplicitRevealExploration({ compactViewport: true, viewMode: 'ruin' }), false);
  assert.equal(shouldRequireExplicitRevealExploration({ compactViewport: false, viewMode: 'reveal' }), false);
});
