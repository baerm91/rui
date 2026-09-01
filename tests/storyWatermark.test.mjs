import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStoryWatermarkFitSize, resolveStoryWatermarkOpacity } from '../src/utils/storyWatermark.js';

test('story watermark fades during departure from the first station', () => {
  assert.equal(resolveStoryWatermarkOpacity({ scrollProgress: 0, stationCount: 5 }), 1);
  assert.ok(resolveStoryWatermarkOpacity({ scrollProgress: 0.08, stationCount: 5 }) < 1);
  assert.equal(resolveStoryWatermarkOpacity({ scrollProgress: 0.17, stationCount: 5 }), 0);
  assert.equal(resolveStoryWatermarkOpacity({ scrollProgress: 0.75, stationCount: 5 }), 0);
});

test('editor watermark is restricted to the first station', () => {
  assert.equal(resolveStoryWatermarkOpacity({ isEditor: true, activeIndex: 0 }), 1);
  assert.equal(resolveStoryWatermarkOpacity({ isEditor: true, activeIndex: 1 }), 0);
});

test('long story titles receive a smaller viewport-fit size', () => {
  const shortTitleSize = Number.parseFloat(resolveStoryWatermarkFitSize('RIU'));
  const longTitleSize = Number.parseFloat(resolveStoryWatermarkFitSize('BURG STARHEMBERG'));

  assert.ok(longTitleSize < shortTitleSize);
  assert.equal(resolveStoryWatermarkFitSize('BURG STARHEMBERG'), '8.3333vw');
  assert.equal(resolveStoryWatermarkFitSize(''), '13.4vw');
});
