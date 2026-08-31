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
    assert.equal((html.match(/class="station-map-stone stone-/g) || []).length, 5);
    for (let index = 0; index < stations.length; index++) {
      assert.ok(html.includes(`Station ${index + 1}: Sammlung ${index + 1} öffnen`));
      assert.ok(html.includes(`<span class="station-map-station-name">Sammlung ${index + 1}</span>`));
    }
    assert.match(html, /Heranzoomen/);
    assert.match(html, /Alle Stationen anzeigen/);
    assert.doesNotMatch(html, /<canvas|<iframe|src="\/thumb-/);
    assert.match(html, /Station direkt öffnen/);
    assert.match(html, /loading="lazy"/);
    assert.doesNotMatch(html, /station-map-tile-heading|station-map-tile-footer|station-map-preview-caption|station-map-stone-title/);
    assert.equal((html.match(/class="station-map-station-name"/g) || []).length, 5);
    assert.equal((html.match(/class="station-map-image"/g) || []).length, 22);
    assert.doesNotMatch(html, />Objekt \d+</);
    assert.doesNotMatch(html, /NaN|Infinity|station-overview-grid/);
  } finally {
    await compiler.close();
  }
});
