import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('cluster overview exposes every object and empty topic while deferring image and 3D loading', async () => {
  const compiler = await createServer({ configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null } });
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
    assert.doesNotMatch(html, /Herauszoomen|Hineinzoomen|Zoomstufe/);
    assert.match(html, /<strong>Objekt 1<\/strong>/);
    assert.equal((html.match(/aria-haspopup="dialog"/g) || []).length, 25);
    // Populated cards label their objects; the theme appears once in navigation.
    assert.doesNotMatch(html, /<strong>Sammlung [2-5]<\/strong>/);
  } finally {
    await compiler.close();
  }
});
