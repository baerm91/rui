import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('cluster overview exposes every object and empty topic while deferring image and 3D loading', async () => {
  const compiler = await createServer({ configFile: false, logLevel: 'silent', appType: 'custom', ssr: { noExternal: ['@panzoom/panzoom'] }, server: { middlewareMode: true, hmr: false, watch: null } });
  try {
    const { StationOverview } = await compiler.ssrLoadModule('/src/exhibition/StationOverview.jsx');
    const stations = [0, 1, 5, 6, 12].map((count, index) => ({
      id: `station-${index}`, title: `Sammlung ${index + 1}`,
      spatial: { wallBackground: { url: '/wall.jpg' } },
      items: Array.from({ length: count }, (_, itemIndex) => ({ id: `item-${itemIndex}`, title: `Objekt ${itemIndex + 1}`, thumbnailUrl: `/thumb-${index}-${itemIndex}.jpg` }))
    }));
    const render = (saved) => renderToStaticMarkup(React.createElement(StationOverview, {
      title: 'Ausstellung', stations, mapViewRef: { current: saved }
    }));
    const html = render(null);
    assert.equal((html.match(/class="topic-cluster-tile"/g) || []).length, 25);
    assert.match(html, /aria-label="Sammlung 1: Thema betreten"/);
    stations.forEach((station) => station.items.forEach((item) => {
      assert.ok(html.includes(`aria-label="${station.title}: ${item.title}"`));
    }));
    assert.doesNotMatch(html, /<canvas|<iframe|src="\/thumb-|src="\/wall.jpg"|NaN|Infinity/);
    assert.equal((html.match(/loading="lazy"/g) || []).length, 24);
    assert.match(html, /aria-label="Herauszoomen"/);
    assert.match(html, /aria-label="Hineinzoomen"/);
    assert.match(html, /aria-label="Ansicht zurücksetzen"/);
    const restored = render({ scale: 1.5, x: 30, y: 10 });
    assert.match(restored, />150 %<\/output>/);
    assert.equal((restored.match(/class="topic-cluster-tile"/g) || []).length, 25);
    // Hover and zoom don't replace or repartition any object's base rectangle.
    const rectangles = (markup) => [...markup.matchAll(/data-station-index="\d+"[^>]*style="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(rectangles(restored), rectangles(html));
  } finally {
    await compiler.close();
  }
});
