import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModelSourceMetadata } from '../src/utils/modelSourceAdapters.js';

test('Sketchfab metadata supplies and caches the official thumbnail fallback', async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return {
      ok: true,
      async json() {
        return {
          title: 'Roman brooch',
          thumbnail_url: 'https://media.sketchfab.com/thumbnail.jpg',
          author_name: 'Museum'
        };
      }
    };
  };
  try {
    const url = 'https://sketchfab.com/models/11111111111111111111111111111111';
    const first = await resolveModelSourceMetadata(url);
    const second = await resolveModelSourceMetadata(url);
    assert.equal(first.providerThumbnailUrl, 'https://media.sketchfab.com/thumbnail.jpg');
    assert.equal(second.providerThumbnailUrl, first.providerThumbnailUrl);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
