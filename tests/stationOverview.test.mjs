import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('station overview keeps every station accessible and defers thumbnails and 3D content', async () => {
  const compiler = await createServer({ configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null } });
  try {
    const { StationOverview } = await compiler.ssrLoadModule('/src/exhibition/StationOverview.jsx');
    const { resolveStationMapOpenItemId } = await compiler.ssrLoadModule('/src/exhibition/MobileStationMap.jsx');
    const stations = [0, 1, 3, 6, 12].map((count, index) => ({
      id: `station-${index}`, title: `Sammlung ${index + 1}`,
      spatial: { wallBackground: { url: index === 3 ? '/wall-3.jpg' : '' } },
      items: Array.from({ length: count }, (_, itemIndex) => ({ id: `item-${itemIndex}`, title: `Objekt ${itemIndex + 1}`, thumbnailUrl: `/thumb-${index}-${itemIndex}.jpg` }))
    }));
    const html = renderToStaticMarkup(React.createElement(StationOverview, { title: 'Ausstellung', stations, stationIndex: 1 }));
    assert.equal((html.match(/class="station-map-stone stone-/g) || []).length, 5);
    for (let index = 0; index < stations.length; index++) {
      assert.ok(html.includes(`Thema ${index + 1}: Sammlung ${index + 1} öffnen`));
      assert.ok(html.includes(`<span class="station-map-station-name" style="opacity:0"><span class="station-map-station-number">${String(index + 1).padStart(2, '0')} · </span>Sammlung ${index + 1}</span>`));
    }
    assert.match(html, /Heranzoomen/);
    assert.match(html, /Alle Themen anzeigen/);
    assert.doesNotMatch(html, /<canvas|<iframe|src="\/thumb-/);
    assert.match(html, /Thema direkt öffnen/);
    assert.match(html, /loading="lazy"/);
    assert.doesNotMatch(html, /station-map-tile-heading|station-map-tile-footer|station-map-preview-caption|station-map-stone-title/);
    assert.equal((html.match(/class="station-map-station-name"/g) || []).length, 5);
    assert.equal((html.match(/class="station-map-station-number"/g) || []).length, 5);
    assert.doesNotMatch(html, /data-station-number=/);
    // Every station exposes its complete collection before any zooming.
    assert.equal((html.match(/class="station-map-image(?: is-zoom-target)?"/g) || []).length, 22);
    assert.deepEqual([...html.matchAll(/data-preview-count="(\d+)"/g)].map((match) => Number(match[1])), [0, 1, 3, 6, 12]);
    assert.doesNotMatch(html, /transform:|station-map-world/);
    const focusedHtml = renderToStaticMarkup(React.createElement(StationOverview, {
      title: 'Ausstellung', stations, stationIndex: 3,
      mapViewRef: { current: { focusIndex: 3, progress: 1 } }
    }));
    const fallbackFocusedHtml = renderToStaticMarkup(React.createElement(StationOverview, {
      title: 'Ausstellung', stations, stationIndex: 1,
      mapViewRef: { current: { focusIndex: 1, progress: 1 } }
    }));
    // Zoom changes the space distribution, never the number of previews.
    assert.equal((focusedHtml.match(/class="station-map-image(?: is-zoom-target)?"/g) || []).length, 22);
    assert.equal((focusedHtml.match(/class="station-map-image is-zoom-target"/g) || []).length, 1);
    assert.deepEqual([...focusedHtml.matchAll(/data-preview-count="(\d+)"/g)].map((match) => Number(match[1])), [0, 1, 3, 6, 12]);
    assert.equal((html.match(/class="station-map-images"/g) || []).length, 5);
    assert.equal((html.match(/class="station-map-stone-face has-background"/g) || []).length, 1);
    assert.equal((html.match(/class="station-map-background is-fallback"/g) || []).length, 4);
    assert.equal((html.match(/class="station-map-cover-border"/g) || []).length, 5);
    assert.equal((html.match(/class="station-map-cover-title"/g) || []).length, 5);
    assert.match(html, /class="station-map-stone-face has-background"[^>]*>[\s\S]*?class="station-map-background" style="opacity:1"[\s\S]*?class="station-map-cover-border" style="opacity:1"[\s\S]*?class="station-map-cover-title" style="opacity:1"[\s\S]*?class="station-map-cover-number">04<\/span>[\s\S]*?class="station-map-cover-rule"[\s\S]*?<b>Sammlung 4<\/b>[\s\S]*?class="station-map-cover-cta" style="opacity:1"[\s\S]*?class="station-map-images" style="opacity:0"/);
    assert.match(html, /class="station-map-stone-face"[^>]*>[\s\S]*?class="station-map-background is-fallback" style="opacity:1"[\s\S]*?class="station-map-cover-number">01<\/span>[\s\S]*?<b>Sammlung 1<\/b>/);
    assert.doesNotMatch(html, /Thema ansehen/);
    assert.match(focusedHtml, /class="station-map-stone-face has-background"[^>]*>[\s\S]*?class="station-map-background" style="opacity:0"[\s\S]*?class="station-map-cover-title" style="opacity:0"[\s\S]*?class="station-map-images" style="opacity:1"/);
    assert.match(fallbackFocusedHtml, /class="station-map-stone-face"[^>]*>[\s\S]*?class="station-map-background is-fallback" style="opacity:0"[\s\S]*?class="station-map-cover-title" style="opacity:0"[\s\S]*?class="station-map-station-name" style="opacity:1"/);
    assert.doesNotMatch(html, />Objekt \d+</);
    assert.doesNotMatch(html, /NaN|Infinity|station-overview-grid/);
    assert.equal(resolveStationMapOpenItemId({ closest: () => ({ dataset: { imageIndex: '2' } }) }, [
      { key: 'object-1' }, { key: 'object-2' }, { key: 'object-3' }
    ]), 'object-3');
    assert.equal(resolveStationMapOpenItemId({ closest: () => null }, [{ key: 'object-1' }]), null);
  } finally {
    await compiler.close();
  }
});
