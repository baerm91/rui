import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModelSourceMetadata } from '../src/utils/modelSourceAdapters.js';

test('Sketchfab metadata supplies and caches the official thumbnail fallback', async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (requestUrl) => {
    requests += 1;
    if (String(requestUrl).includes('/v3/models/')) return {
      ok: true,
      async json() {
        return {
          name: 'Lion brooch',
          viewerUrl: 'https://sketchfab.com/3d-models/lion-brooch-11111111111111111111111111111111',
          user: { displayName: 'Landessammlungen Niederösterreich', profileUrl: 'https://sketchfab.com/landessammlungen-noe' },
          license: { label: 'CC Attribution-NonCommercial', url: 'http://creativecommons.org/licenses/by-nc/4.0/' }
        };
      }
    };
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
    assert.equal(first.attribution, 'Landessammlungen Niederösterreich');
    assert.equal(first.license, 'CC Attribution-NonCommercial');
    assert.equal(first.licenseUrl, 'https://creativecommons.org/licenses/by-nc/4.0/');
    assert.match(first.sourceUrl, /lion-brooch/);
    assert.equal(second.providerThumbnailUrl, first.providerThumbnailUrl);
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
