import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWallBackgroundSide } from '../src/utils/spatialWall.js';

test('wall backgrounds face the authored station camera in the editor', () => {
  const frontFacing = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    camera: { position: [0, 1.7, 5] }
  };
  const reversed = {
    position: [9, 0, 0],
    rotation: [0, Math.PI, 0],
    camera: { position: [9, 1.7, 5] }
  };
  assert.equal(resolveWallBackgroundSide(frontFacing), 1);
  assert.equal(resolveWallBackgroundSide(reversed), -1);
});

test('visitor overview keeps every wall background on the curated front side', () => {
  const reversed = {
    position: [9, 0, 0],
    rotation: [0, Math.PI, 0],
    camera: { position: [9, 1.7, 5] }
  };
  assert.equal(resolveWallBackgroundSide(reversed, true), 1);
});
