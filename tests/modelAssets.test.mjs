import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveModelAssetUrl, usesOptimizedModelTextures } from '../src/models.js';

test('large Heidentor textures use the optimized local variants', () => {
  assert.equal(
    resolveModelAssetUrl('https://heidentor.vercel.app/the_heidentor_in_petronell-carnuntum/textures/Heidentor_O_u2_v1_baseColor.jpg'),
    '/models/heidentor-primary/textures/Heidentor_O_u2_v1_baseColor.jpg'
  );
  assert.equal(
    resolveModelAssetUrl('https://heidentor.vercel.app/reconstruction_of_the_heidentor/textures/Heidentor_normal.jpg'),
    '/models/heidentor-reconstruction/textures/Heidentor_normal.jpg'
  );
});

test('assets from other models remain untouched', () => {
  const url = 'https://example.org/model/textures/stone.jpg';
  assert.equal(resolveModelAssetUrl(url), url);
});

test('Starhemberg keeps the original website textures', () => {
  const url = 'https://starhemberg.vercel.app/model/textures/Starhemberg_O_u2_v2_baseColor.jpg';
  assert.equal(resolveModelAssetUrl(url), url);
  assert.equal(usesOptimizedModelTextures({ primary: 'https://starhemberg.vercel.app/model/scene.gltf' }), false);
});

test('the optimized asset resolver is installed only for Heidentor projects', () => {
  assert.equal(usesOptimizedModelTextures({
    primary: 'https://heidentor.vercel.app/the_heidentor_in_petronell-carnuntum/scene.gltf'
  }), true);
  assert.equal(usesOptimizedModelTextures({ primary: 'https://example.org/model.gltf' }), false);
});
