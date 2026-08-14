import assert from 'node:assert/strict';
import test from 'node:test';
import { detectThunderEvents } from '../src/utils/audioManager.js';

test('thunder analysis detects separated peaks in an ambience buffer', () => {
  const sampleRate = 100;
  const samples = new Float32Array(sampleRate * 12).fill(0.04);
  for (let index = 200; index < 235; index += 1) samples[index] = 0.9;
  for (let index = 800; index < 845; index += 1) samples[index] = 0.75;
  const buffer = {
    duration: 12,
    sampleRate,
    getChannelData: () => samples
  };
  const events = detectThunderEvents(buffer);
  assert.ok(events.some((time) => time >= 1.8 && time <= 2.5));
  assert.ok(events.some((time) => time >= 7.8 && time <= 8.6));
});
