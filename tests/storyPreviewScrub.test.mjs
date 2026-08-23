import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directionalPointerProgress, pointerEntrySide, pointerProgress, relativePointerProgress,
  resolvePreviewDuration, resolveScrubDuration, resolveVisualPreviewProgress, storyHasPreview
} from '../src/platform/storyPreviewScrub.js';

test('story preview maps the horizontal card position to clamped video progress', () => {
  assert.equal(pointerProgress(100, 100, 400), 0);
  assert.equal(pointerProgress(300, 100, 400), 0.5);
  assert.equal(pointerProgress(500, 100, 400), 1);
  assert.equal(pointerProgress(40, 100, 400), 0);
  assert.equal(pointerProgress(700, 100, 400), 1);
});

test('story preview handles cards without a measurable width', () => {
  assert.equal(pointerProgress(120, 100, 0), 0);
});

test('story preview advances inward from whichever horizontal edge was entered', () => {
  assert.equal(pointerEntrySide(101, 100, 400), 'left');
  assert.equal(pointerEntrySide(499, 100, 400), 'right');
  assert.equal(directionalPointerProgress(100, 100, 400, 'left'), 0);
  assert.equal(directionalPointerProgress(300, 100, 400, 'left'), 0.5);
  assert.equal(directionalPointerProgress(500, 100, 400, 'right'), 0);
  assert.equal(directionalPointerProgress(300, 100, 400, 'right'), 0.5);
  assert.equal(directionalPointerProgress(100, 100, 400, 'right'), 1);
});

test('re-entering a preview continues scrubbing from its current position', () => {
  assert.equal(relativePointerProgress(240, 200, 400, 0.6, 'left'), 0.7);
  assert.equal(relativePointerProgress(160, 200, 400, 0.6, 'left'), 0.5);
  assert.equal(relativePointerProgress(160, 200, 400, 0.6, 'right'), 0.7);
  assert.equal(relativePointerProgress(240, 200, 400, 0.6, 'right'), 0.5);
});

test('story preview uses the known recording duration for MediaRecorder WebMs with infinite duration', () => {
  assert.equal(resolvePreviewDuration(Infinity, 3), 3);
  assert.equal(resolvePreviewDuration(NaN, undefined), 3);
  assert.equal(resolvePreviewDuration(2.94, 3), 2.94);
});

test('ping-pong previews scrub only across their forward segment', () => {
  assert.equal(resolveScrubDuration(6.35, 3), 3);
  assert.equal(resolveScrubDuration(6.35, undefined), 6.35);
});

test('the recorded return segment maps back to the visible forward position', () => {
  assert.equal(resolveVisualPreviewProgress(1.5, 3, 6.5, 3.5), 0.5);
  assert.equal(resolveVisualPreviewProgress(3, 3, 6.5, 3.5), 1);
  assert.equal(resolveVisualPreviewProgress(4.75, 3, 6.5, 3.5), 0.5);
  assert.equal(resolveVisualPreviewProgress(6.5, 3, 6.5, 3.5), 0);
});

test('remote preview media remains available without a local browser asset', () => {
  assert.equal(storyHasPreview({ previewVideoUrl: 'https://example.supabase.co/preview.webm' }), true);
  assert.equal(storyHasPreview({ previewVideoAssetId: 'story-preview:demo' }), true);
  assert.equal(storyHasPreview({}), false);
});
