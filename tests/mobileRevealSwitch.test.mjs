import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('legacy mobile reveal renders its model switch without comparison metadata', async () => {
  const compiler = await createServer({
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null }
  });
  try {
    const { VisitorControls } = await compiler.ssrLoadModule('/src/components/VisitorControls.jsx');
    const station = { id: 'station_3', title: 'Der sichtbare Wandel', viewMode: 'reveal' };
    const html = renderToStaticMarkup(React.createElement(VisitorControls, {
      activeStation: station,
      appState: {
        stationMode: 'scroll',
        viewMode: 'reveal',
        currentStationIndex: 0,
        stations: [station],
        freeNavigationActive: true,
        freeNavigationStationId: station.id,
        scrollProgress: 1
      },
      canEnterFreeView: true
    }));

    assert.match(html, /class="mobile-reveal-model-switch"/);
    assert.match(html, /aria-label="Ruine an der aktuellen Position anzeigen"/);
    assert.match(html, /class="mobile-reveal-model-switch"[\s\S]* Ruine<\/button>/);
    assert.match(html, / Fertig<\/button>/);
  } finally {
    await compiler.close();
  }
});
