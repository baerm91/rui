import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('station overview keeps every station accessible and defers thumbnails and 3D content', async () => {
  const compiler = await createServer({ configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null } });
  try {
    const { StationOverview } = await compiler.ssrLoadModule('/src/exhibition/StationOverview.jsx');
    const stations = [0, 1, 3, 6, 12].map((count, index) => ({
      id: `station-${index}`, title: `Sammlung ${index + 1}`,
      items: Array.from({ length: count }, (_, itemIndex) => ({ id: `item-${itemIndex}`, title: `Objekt ${itemIndex + 1}`, thumbnailUrl: `/thumb-${index}-${itemIndex}.jpg` }))
    }));
    const html = renderToStaticMarkup(React.createElement(StationOverview, { title: 'Ausstellung', stations, stationIndex: 1 }));
    assert.equal((html.match(/<article /g) || []).length, 5);
    for (let index = 0; index < stations.length; index++) {
      assert.ok(html.includes(`Station ${index + 1}: Sammlung ${index + 1} öffnen`));
    }
    assert.match(html, /Diese Station wird noch kuratiert/);
    assert.match(html, /12 Objekte/);
    assert.match(html, /\+ 3 weitere Objekte/);
    assert.equal((html.match(/class="station-overview-object"/g) || []).length, 19);
    assert.doesNotMatch(html, /<canvas|<iframe|src="\/thumb-/);
    assert.equal((html.match(/loading="lazy"/g) || []).length, 19);
  } finally {
    await compiler.close();
  }
});
