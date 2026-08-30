import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModelSourceMetadata } from '../src/utils/modelSourceAdapters.js';

test('Sketchfab metadata supplies and caches thumbnail, attribution and license', async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return {
      ok: true,
      async json() {
        return {
          name: 'Roman brooch',
          thumbnails: { images: [{ width: 320, url: 'https://media.sketchfab.com/small.jpg' }, { width: 720, url: 'https://media.sketchfab.com/thumbnail.jpg' }] },
          user: { displayName: 'Museum' },
          license: { label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' }
        };
      }
    };
  };
  try {
    const url = 'https://sketchfab.com/models/11111111111111111111111111111111';
    const first = await resolveModelSourceMetadata(url);
    const second = await resolveModelSourceMetadata(url);
    assert.equal(first.providerThumbnailUrl, 'https://media.sketchfab.com/thumbnail.jpg');
    assert.equal(first.attribution, 'Museum');
    assert.equal(first.license, 'CC BY-NC 4.0');
    assert.equal(second.providerThumbnailUrl, first.providerThumbnailUrl);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
