import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLoadingFailureContent } from '../src/utils/loadingFailure.js';

test('loading failure preserves meaningful story context and rights', () => {
  const result = resolveLoadingFailureContent({
    project: {
      name: 'Das Heidentor',
      description: 'Befund und Rekonstruktion eines römischen Monuments.',
      coverImage: '/heidentor.jpg',
      metadata: { license: 'Museum Carnuntinum · CC BY 4.0' }
    }
  }, new Error('network timeout'));

  assert.deepEqual(result, {
    title: 'Das Heidentor',
    summary: 'Befund und Rekonstruktion eines römischen Monuments.',
    rights: 'Museum Carnuntinum · CC BY 4.0',
    coverImage: '/heidentor.jpg',
    technicalMessage: 'network timeout'
  });
});

test('loading failure falls back to station interpretation and safe labels', () => {
  const result = resolveLoadingFailureContent({
    project: { branding: { title: 'Fundgeschichte' } },
    stations: [{ introduction: 'Der Fund in seinem archäologischen Kontext.' }]
  });

  assert.equal(result.title, 'Fundgeschichte');
  assert.equal(result.summary, 'Der Fund in seinem archäologischen Kontext.');
  assert.equal(result.rights, '');
  assert.equal(result.technicalMessage, '');
});
