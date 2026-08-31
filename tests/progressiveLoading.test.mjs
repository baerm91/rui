import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('public UI renders while storage is pending, private content stays gated, and images defer URLs', async () => {
  const compiler = await createServer({
    configFile: false, logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null }
  });
  const originalGlobals = new Map(['window', 'document', 'localStorage', 'indexedDB'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    globalThis.window = { location: { pathname: '/', search: '', hash: '' }, localStorage: globalThis.localStorage, matchMedia: () => ({ matches: false }) };
    globalThis.document = { documentElement: { dataset: {} } };
    // Never complete the initial database request: this reproduces a stalled
    // data dependency without giving the renderer cached authenticated state.
    globalThis.indexedDB = { open: () => ({}) };
    const { default: PlatformApp } = await compiler.ssrLoadModule('/src/platform/PlatformApp.jsx');
    const { LazyImage } = await compiler.ssrLoadModule('/src/platform/LazyImage.jsx');

    const home = renderToStaticMarkup(React.createElement(PlatformApp));
    assert.match(home, /Modelle zeigen/);
    assert.match(home, /href="\/discover"/);
    assert.match(home, /Stories werden geladen/);
    assert.doesNotMatch(home, /story-preview-poster/);

    window.location.pathname = '/discover';
    const discover = renderToStaticMarkup(React.createElement(PlatformApp));
    assert.match(discover, /Stories, Autor:innen oder Epochen suchen/);
    assert.match(discover, /Sortierung/);
    assert.doesNotMatch(discover, /Keine Stories gefunden/);

    for (const path of ['/dashboard', '/account', '/admin', '/stories/new', '/analytics/private']) {
      window.location.pathname = path;
      const protectedPage = renderToStaticMarkup(React.createElement(PlatformApp));
      assert.match(protectedPage, /Anmeldung und Stories werden geladen/);
      assert.doesNotMatch(protectedPage, /dashboard-card|account-form|admin-user|create-form|analytics-kpis/);
    }

    const deferred = renderToStaticMarkup(React.createElement(LazyImage, { src: '/cover.jpg' }));
    assert.match(deferred, /loading="lazy"/);
    assert.doesNotMatch(deferred, /src=|href=/);
    const hero = renderToStaticMarkup(React.createElement(LazyImage, { src: '/cover.jpg', priority: true }));
    assert.match(hero, /src="\/cover.jpg"/);
    assert.match(hero, /fetchPriority="high"/);
    assert.match(hero, /decoding="async"/);
  } finally {
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    await compiler.close();
  }
});
