import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePreviewLookOffset, resolvePreviewDuration, resolveVisualPreviewProgress, storyHasPreview
} from '../src/platform/storyPreviewScrub.js';

test('pointer position creates a subtle, clamped preview look offset', () => {
  assert.equal(resolvePreviewLookOffset(100, 100, 400), 2.2);
  assert.equal(resolvePreviewLookOffset(300, 100, 400), 0);
  assert.equal(resolvePreviewLookOffset(500, 100, 400), -2.2);
  assert.equal(resolvePreviewLookOffset(700, 100, 400), -2.2);
  assert.equal(resolvePreviewLookOffset(120, 100, 0), 0);
});

test('story preview uses the known recording duration for MediaRecorder WebMs with infinite duration', () => {
  assert.equal(resolvePreviewDuration(Infinity, 3), 3);
  assert.equal(resolvePreviewDuration(NaN, undefined), 3);
  assert.equal(resolvePreviewDuration(2.94, 3), 2.94);
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
