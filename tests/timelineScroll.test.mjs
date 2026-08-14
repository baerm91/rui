import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTimelineScrollLimits,
  getTimelineScrollStep,
  normalizeScrollSpeed
} from '../src/utils/timelineScroll.js';

test('project scroll speed is clamped platform-wide', () => {
  assert.equal(normalizeScrollSpeed(99), 1.6);
  assert.equal(normalizeScrollSpeed(-2), 0.4);
  assert.equal(normalizeScrollSpeed(undefined), 1);
});

test('maximum timeline speed stays close to one station per second', () => {
  const limits = getTimelineScrollLimits(1000, 1.6);
  assert.equal(limits.maxPixelsPerSecond, 1040);
  assert.equal(limits.maxBufferedDelta, 320);
});

test('minimum project speed takes several seconds per station', () => {
  const limits = getTimelineScrollLimits(1000, 0.4);
  assert.equal(limits.maxPixelsPerSecond, 260);
  assert.ok(1000 / limits.maxPixelsPerSecond > 3.8);
});

test('large wheel impulses are limited by elapsed time', () => {
  assert.equal(getTimelineScrollStep(5000, 16, 1000), 16);
  assert.equal(getTimelineScrollStep(-5000, 16, 1000), -16);
  assert.equal(getTimelineScrollStep(5, 16, 1000), 5);
  assert.equal(getTimelineScrollStep(5000, 1000, 1000), 34);
});
