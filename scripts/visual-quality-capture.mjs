import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const ORIGIN = process.env.RIU_VISUAL_ORIGIN || 'http://localhost:3005';
const CHROME = process.env.RIU_VISUAL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const label = valueOf('--label', 'current');
const outputDir = resolve(ROOT, valueOf('--output', `artifacts/visual-quality/${label}`));
const only = valueOf('--only', '');
const timeoutMs = 45000;

const viewports = {
  desktop: { width: 1440, height: 1000, mobile: false, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, mobile: true, deviceScaleFactor: 1 }
};

const cases = [
  { name: 'starhemberg-initial', path: '/stories/starhemberg', ready: "window.appState?.baseModelStatus === 'ready'" },
  ...[
    ['starhemberg-way', 2, 'Weg zur Kernburg'],
    ['starhemberg-core', 3, 'Kernburg'],
    ['starhemberg-courtyard', 4, 'Mittelpunkt des Burglebens'],
    ['starhemberg-layout', 5, 'Aufteilung'],
    ['starhemberg-outer-bailey', 6, 'Vorburg'],
    ['starhemberg-free-view', 7, 'Freie Ansicht']
  ].map(([name, station, title]) => ({
    name,
    path: '/stories/starhemberg',
    ready: "window.appState?.baseModelStatus === 'ready'",
    actions: [
      { clickSelector: `[aria-label="Zu Station ${station}: ${title}"]`, wait: 1900 },
      { waitFor: `document.querySelector('.station-title')?.textContent.includes(${JSON.stringify(title)})` }
    ]
  })),
  {
    name: 'starhemberg-annotation', path: '/stories/starhemberg', ready: "window.appState?.baseModelStatus === 'ready'",
    actions: [
      { clickSelector: '[aria-label="Zu Station 7: Freie Ansicht"]', wait: 1900 },
      { clickSelector: 'button[aria-label="Burgtor"]', wait: 1300 },
      { waitFor: "document.querySelector('[role=\"dialog\"]')?.textContent.includes('Burgtor')" }
    ]
  },
  {
    name: 'starhemberg-annotation-keyboard-return', path: '/stories/starhemberg', ready: "window.appState?.baseModelStatus === 'ready'",
    actions: [
      { clickSelector: '[aria-label="Zu Station 7: Freie Ansicht"]', wait: 1900 },
      { clickSelector: 'button[aria-label="Burgtor"]', wait: 700 },
      { waitFor: "document.querySelector('[role=\"dialog\"]') && document.activeElement?.getAttribute('aria-label') === 'Annotation schließen'" },
      { expression: "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))", wait: 500 },
      { waitFor: "!document.querySelector('[role=\"dialog\"]') && (document.activeElement?.getAttribute('aria-label') === 'Burgtor' || document.activeElement?.getAttribute('aria-label')?.startsWith('Annotationsliste'))" }
    ]
  },
  ...[
    ['starhemberg-detail-context-return', false, 1800],
    ['starhemberg-detail-context-reduced-motion', true, 120]
  ].map(([name, reducedMotion, returnWait]) => ({
    name, path: '/stories/starhemberg', ready: "window.appState?.baseModelStatus === 'ready'", reducedMotion,
    actions: [
      { clickSelector: '[aria-label="Zu Station 7: Freie Ansicht"]', wait: 1900 },
      { clickSelector: 'button[aria-label="Burgtor"]', wait: reducedMotion ? 120 : 1400 },
      { expression: clickText('button', 'Zur Stationsansicht'), wait: returnWait },
      { waitFor: "!document.querySelector('[role=\"dialog\"]') && window.appState?.hasUserManipulatedCamera === false" }
    ]
  })),
  { name: 'heidentor-initial', path: '/stories/heidentor', ready: "window.appState?.baseModelStatus === 'ready'" },
  ...[
    ['heidentor-decay', 2, 'Der Zahn der Zeit'],
    ['heidentor-twin-it', 3, 'TWIN-IT'],
    ['heidentor-visible-change', 4, 'Der sichtbare Wandel']
  ].map(([name, station, title]) => ({
    name,
    path: '/stories/heidentor',
    ready: "window.appState?.baseModelStatus === 'ready'",
    actions: [
      { clickSelector: `[aria-label="Zu Station ${station}: ${title}"]`, wait: 1900 },
      { waitFor: `document.querySelector('.station-title')?.textContent.includes(${JSON.stringify(title)})` }
    ]
  })),
  {
    name: 'heidentor-reveal-hover', path: '/stories/heidentor', ready: "window.appState?.baseModelStatus === 'ready'",
    actions: [
      { clickSelector: '[aria-label="Zu Station 4: Der sichtbare Wandel"]', wait: 1900 },
      { move: [.63, .55], wait: 900 }
    ]
  },
  ...[
    ['heidentor-comparison-evidence', 'Erhaltener Befund', 'ruin'],
    ['heidentor-comparison-reconstruction', 'Rekonstruktion', 'recon']
  ].map(([name, label, mode]) => ({
    name, path: '/stories/heidentor', ready: "window.appState?.baseModelStatus === 'ready'",
    actions: [
      { clickSelector: '[aria-label="Zu Station 4: Der sichtbare Wandel"]', wait: 1900 },
      { expression: clickText('button', label), wait: 1000 },
      { waitFor: `(() => { const render = window.appState?.captureModelRenderState?.(); return window.appState?.viewMode === ${JSON.stringify(mode)} && render && render.ruinVisible === ${mode === 'ruin'} && render.reconstructionVisible === ${mode === 'recon'} && Math.abs(render.ruinOpacity - ${mode === 'ruin' ? 1 : 0}) < .001 && Math.abs(render.reconstructionOpacity - ${mode === 'recon' ? 1 : 0}) < .001 && [...document.querySelectorAll('button')].some((button) => button.textContent.includes(${JSON.stringify(label)}) && button.getAttribute('aria-pressed') === 'true'); })()` }
    ]
  })),
  {
    name: 'heidentor-comparison-explanation', path: '/stories/heidentor', ready: "window.appState?.baseModelStatus === 'ready'",
    actions: [
      { clickSelector: '[aria-label="Zu Station 4: Der sichtbare Wandel"]', wait: 1900 },
      { expression: clickText('button', 'Warum so rekonstruiert?'), wait: 300 },
      { waitFor: "document.querySelector('#interpretation-explanation[role=\"dialog\"]') && document.activeElement?.textContent.includes('Schließen')" }
    ]
  },
  {
    name: 'starhemberg-loading-fallback', path: '/stories/starhemberg',
    blockUrls: ['*starhemberg.vercel.app/model/scene.gltf*'],
    allowLoadingFailure: true,
    expectedErrorIncludes: 'Initialization failed:',
    ready: "!document.querySelector('#loading-failure')?.hidden && document.activeElement?.id === 'loading-failure-heading'"
  },
  { name: 'room-overview', path: '/__spatial-preview?mode=visitor', ready: "document.querySelector('.exhibition-shell.is-overview')" },
  ...[false, true].map((reducedMotion) => ({
    name: `room-cluster-focus${reducedMotion ? '-reduced-motion' : ''}`,
    path: '/__spatial-preview?mode=visitor', reducedMotion,
    ready: "document.querySelector('.topic-cluster-tile')",
    actions: [
      { expression: "document.querySelector('.topic-cluster-tile').focus()", wait: 700 },
      { waitFor: "document.activeElement.matches('.topic-cluster-tile.is-active') && getComputedStyle(document.activeElement.querySelector('.topic-cluster-caption')).opacity === '1'" },
      { waitFor: "!matchMedia('(hover: hover) and (pointer: fine)').matches || [...document.querySelectorAll('.topic-cluster-caption')].filter(el => getComputedStyle(el).opacity === '1').length === 1" },
      ...(reducedMotion ? [{ waitFor: "getComputedStyle(document.activeElement).transform === 'none' && getComputedStyle(document.activeElement).transitionDuration === '0s'" }] : [])
    ]
  })),
  {
    name: 'room-cluster-open-object', path: '/__spatial-preview?mode=visitor',
    ready: "document.querySelector('.topic-cluster-tile')",
    actions: [
      { clickSelector: '.topic-cluster-tile', wait: 1800 },
      { waitFor: "document.querySelector('dialog[open]')?.textContent.includes('Beschädigter Helm')" }
    ]
  },
  {
    name: 'room-station-one', path: '/__spatial-preview?mode=visitor', ready: "document.querySelector('.exhibition-shell.is-overview')",
    actions: [
      { expression: clickText('button', 'Zur Station'), wait: 2300 },
      { waitFor: "document.querySelector('.spatial-station-content')" }
    ]
  },
  {
    name: 'room-station-two', path: '/__spatial-preview?mode=visitor', ready: "document.querySelector('.exhibition-shell.is-overview')",
    actions: [
      { expression: "document.querySelectorAll('.station-stepper button')[1]?.click()", wait: 2300 },
      { waitFor: "document.querySelector('.spatial-story-copy h1')?.textContent.includes('Form in Bewegung')" }
    ]
  },
  {
    name: 'room-station-three', path: '/__spatial-preview?mode=visitor', ready: "document.querySelector('.exhibition-shell.is-overview')",
    actions: [
      { expression: "document.querySelectorAll('.station-stepper button')[1]?.click()", wait: 1400 },
      { expression: "document.querySelectorAll('.station-stepper button')[1]?.click()", wait: 2300 },
      { waitFor: "document.querySelector('.spatial-story-copy h1')?.textContent.includes('Bewahren und Weitergeben')" }
    ]
  },
  {
    name: 'room-model-loading', path: '/__spatial-preview?mode=visitor', ready: "document.querySelector('.exhibition-shell.is-overview')",
    actions: [
      { network: { offline: false, latency: 250, downloadThroughput: 16000, uploadThroughput: 16000, connectionType: 'cellular3g' } },
      { expression: clickText('button', 'Zur Station'), wait: 2300 },
      { waitFor: "document.querySelector('.spatial-model-status.is-loading')" }
    ]
  },
  {
    name: 'room-exploration', path: '/__spatial-preview?mode=visitor', ready: "document.querySelector('.exhibition-shell.is-overview')",
    actions: [
      { expression: clickText('button', 'Zur Station'), wait: 2300 },
      { waitFor: buttonEnabledText('Frei erkunden') },
      { expression: clickText('button', 'Frei erkunden'), wait: 1700 },
      { drag: { from: [.72, .52], to: [.55, .43] }, wait: 700 },
      { waitFor: "document.querySelector('.exhibition-shell.is-exploring')" }
    ]
  },
  {
    name: 'room-restored', path: '/__spatial-preview?mode=visitor', ready: "document.querySelector('.exhibition-shell.is-overview')",
    actions: [
      { expression: clickText('button', 'Zur Station'), wait: 2300 },
      { waitFor: buttonEnabledText('Frei erkunden') },
      { expression: clickText('button', 'Frei erkunden'), wait: 1700 },
      { drag: { from: [.72, .52], to: [.55, .43] }, wait: 500 },
      { expression: clickText('button', 'Komposition wiederherstellen'), wait: 1800 },
      { waitFor: "document.querySelector('.exhibition-shell.is-curated')" }
    ]
  },
  { name: 'room-editor', path: '/__spatial-preview?mode=editor', ready: "document.querySelector('.exhibition-shell.mode-editor')" }
  ,{
    name: 'room-editor-story-check', path: '/__spatial-preview?mode=editor', ready: "document.querySelector('.exhibition-shell.mode-editor')",
    actions: [
      { expression: clickText('button', 'Story-Check'), wait: 300 },
      { waitFor: "document.querySelector('[aria-label=\"Story-Check (Prototyp)\"] button')?.getAttribute('aria-expanded') === 'true'" }
    ]
  }
].flatMap((scene) => Object.keys(viewports).map((viewport) => ({ ...scene, viewport })));

function clickText(tag, text) {
  return `(() => { const target = [...document.querySelectorAll('${tag}')].find((element) => element.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)})); if (!target) throw new Error(${JSON.stringify(`Trigger not found: ${text}`)}); target.click(); })()`;
}

function buttonEnabledText(label) {
  return `[...document.querySelectorAll('button')].some((element) => !element.disabled && element.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(label)}))`;
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
        return;
      }
      this.listeners.forEach((listener) => listener(message));
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.id++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

async function waitForFile(path, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      try { return await readFile(path, 'utf8'); } catch {}
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function launchChrome() {
  const profile = await mkdtemp(join(tmpdir(), 'riu-visual-'));
  const process = spawn(CHROME, [
    `--user-data-dir=${profile}`, '--headless=new', '--remote-debugging-port=0', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--use-angle=default',
    '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1440,1000', 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  const [port, path] = (await waitForFile(join(profile, 'DevToolsActivePort'))).trim().split(/\r?\n/);
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return { client: new CdpClient(socket), process, profile, socket };
}

async function evaluate(client, sessionId, expression) {
  const result = await Promise.race([
    client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId),
    new Promise((_, reject) => setTimeout(() => reject(new Error('CDP evaluation timed out')), timeoutMs + 5000))
  ]);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function waitUntil(client, sessionId, expression, timeout = timeoutMs) {
  return evaluate(client, sessionId, `new Promise((resolve, reject) => {
    const deadline = performance.now() + ${timeout};
    const check = () => {
      try {
        const result = (${expression});
        if (result) return resolve(true);
        if (performance.now() > deadline) return reject(new Error('Timed out: ${expression.replaceAll("'", "\\'")}'));
        setTimeout(check, 50);
      } catch (error) { reject(error); }
    };
    check();
  })`);
}

async function captureCase(chrome, scene) {
  const viewport = viewports[scene.viewport];
  const { browserContextId } = await chrome.client.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await chrome.client.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await chrome.client.send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  const stopListening = chrome.client.on((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) errors.push(message.params.entry.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
  });
  try {
    await Promise.all([
      chrome.client.send('Page.enable', {}, sessionId),
      chrome.client.send('Runtime.enable', {}, sessionId),
      chrome.client.send('Log.enable', {}, sessionId),
      chrome.client.send('Network.enable', {}, sessionId),
      chrome.client.send('Emulation.setDeviceMetricsOverride', viewport, sessionId),
      chrome.client.send('Emulation.setTouchEmulationEnabled', { enabled: viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 1 }, sessionId),
      ...(scene.reducedMotion ? [chrome.client.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
      }, sessionId)] : []),
      chrome.client.send('Page.addScriptToEvaluateOnNewDocument', { source: "Math.random = () => 0.17; globalThis.__riuVisualErrors = []; addEventListener('error', e => __riuVisualErrors.push(String(e.error || e.message))); addEventListener('unhandledrejection', e => __riuVisualErrors.push(String(e.reason)));" }, sessionId)
    ]);
    if (scene.blockUrls?.length) {
      await chrome.client.send('Network.setBlockedURLs', { urls: scene.blockUrls }, sessionId);
    }
    await chrome.client.send('Page.bringToFront', {}, sessionId);
    await chrome.client.send('Page.navigate', { url: `${ORIGIN}${scene.path}` }, sessionId);
    await waitUntil(chrome.client, sessionId, scene.ready);
    if (!scene.allowLoadingFailure) {
      await waitUntil(chrome.client, sessionId, "!document.querySelector('#loading-screen')?.getClientRects().length || Number.parseFloat(getComputedStyle(document.querySelector('#loading-screen')).opacity) < .01");
    }
    for (const action of scene.actions || []) {
      if (action.expression) await evaluate(chrome.client, sessionId, action.expression);
      if (action.focusSelector) await evaluate(chrome.client, sessionId, `document.querySelector(${JSON.stringify(action.focusSelector)})?.focus()`);
      if (action.key) {
        const keyCode = action.key === 'Enter' ? 13 : action.key === 'Escape' ? 27 : 0;
        await chrome.client.send('Input.dispatchKeyEvent', {
          type: 'keyDown', key: action.key, code: action.key, keyIdentifier: `U+${keyCode.toString(16).padStart(4, '0').toUpperCase()}`,
          windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode
        }, sessionId);
        if (action.key === 'Enter') {
          await chrome.client.send('Input.dispatchKeyEvent', {
            type: 'char', key: action.key, code: action.key, text: '\r', windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode
          }, sessionId);
        }
        await chrome.client.send('Input.dispatchKeyEvent', {
          type: 'keyUp', key: action.key, code: action.key, keyIdentifier: `U+${keyCode.toString(16).padStart(4, '0').toUpperCase()}`,
          windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode
        }, sessionId);
      }
      if (action.clickSelector) {
        const bounds = await evaluate(chrome.client, sessionId, `(() => {
          const element = document.querySelector(${JSON.stringify(action.clickSelector)});
          if (!element) throw new Error(${JSON.stringify('Click target not found')});
          const rect = element.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()`);
        await chrome.client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...bounds, button: 'none', buttons: 0 }, sessionId);
        await chrome.client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...bounds, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
        await chrome.client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...bounds, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      }
      if (action.waitFor) await waitUntil(chrome.client, sessionId, action.waitFor);
      if (action.network) await chrome.client.send('Network.emulateNetworkConditions', action.network, sessionId);
      if (action.drag) {
        const [fromX, fromY] = action.drag.from;
        const [toX, toY] = action.drag.to;
        const startX = Math.round(viewport.width * fromX);
        const startY = Math.round(viewport.height * fromY);
        const endX = Math.round(viewport.width * toX);
        const endY = Math.round(viewport.height * toY);
        await chrome.client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
        await chrome.client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: endX, y: endY, button: 'left', buttons: 1 }, sessionId);
        await chrome.client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: endY, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      }
      if (action.move) {
        const [moveX, moveY] = action.move;
        await chrome.client.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: Math.round(viewport.width * moveX), y: Math.round(viewport.height * moveY),
          button: 'none', buttons: 0
        }, sessionId);
      }
      if (action.wait) await new Promise((resolvePromise) => setTimeout(resolvePromise, action.wait));
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1200));
    const state = await evaluate(chrome.client, sessionId, `(() => ({
      path: location.pathname + location.search,
      title: document.title,
      bodyClass: document.body.className,
      camera: window.appState?.captureCamera?.() || null,
      modelRenderState: window.appState?.captureModelRenderState?.() || null,
      baseModelStatus: window.appState?.baseModelStatus || null,
      externalViewerStatus: window.appState?.externalViewerStatus || null,
      activeElement: document.activeElement ? {
        tag: document.activeElement.tagName,
        label: document.activeElement.getAttribute('aria-label'),
        text: document.activeElement.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 120)
      } : null,
      roomCamera: document.querySelector('.exhibition-room-canvas') ? {
        position: document.querySelector('.exhibition-room-canvas').dataset.cameraPosition || null,
        target: document.querySelector('.exhibition-room-canvas').dataset.cameraTarget || null
      } : null,
      webglCanvases: [...document.querySelectorAll('canvas')].map((canvas) => ({ width: canvas.width, height: canvas.height, label: canvas.getAttribute('aria-label') })),
      runtimeErrors: globalThis.__riuVisualErrors || []
    }))()`);
    errors.push(...state.runtimeErrors);
    const distinctErrors = [...new Set(errors.filter(Boolean))];
    const expectedErrors = scene.expectedErrorIncludes
      ? distinctErrors.filter((error) => error.includes(scene.expectedErrorIncludes))
      : [];
    const unexpectedErrors = distinctErrors.filter((error) => !expectedErrors.includes(error));
    if (scene.expectedErrorIncludes && !expectedErrors.length) {
      throw new Error(`Expected injected failure was not observed: ${scene.expectedErrorIncludes}`);
    }
    const screenshot = await chrome.client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
    const file = join(outputDir, `${scene.name}-${scene.viewport}.png`);
    await writeFile(file, Buffer.from(screenshot.data, 'base64'));
    return { ...scene, viewport: { name: scene.viewport, ...viewport }, file, state, expectedErrors, errors: unexpectedErrors };
  } finally {
    stopListening();
    await chrome.client.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
}

async function run() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  await mkdir(outputDir, { recursive: true });
  const chrome = await launchChrome();
  const results = [];
  try {
    for (const scene of cases.filter((entry) => !only || entry.name.includes(only))) {
      process.stdout.write(`Capture ${scene.name} / ${scene.viewport} ... `);
      try {
        const result = await captureCase(chrome, scene);
        results.push({ ok: true, ...result });
        process.stdout.write(`${result.errors.length ? `WARN ${result.errors.length}` : 'OK'}\n`);
      } catch (error) {
        results.push({ ok: false, name: scene.name, path: scene.path, viewport: scene.viewport, error: error.message });
        process.stdout.write(`FAIL ${error.message}\n`);
      }
    }
    await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify({ label, origin: ORIGIN, createdAt: new Date().toISOString(), results }, null, 2)}\n`);
  } finally {
    chrome.socket.close();
    chrome.process.kill('SIGTERM');
    await Promise.race([
      rm(chrome.profile, { recursive: true, force: true, maxRetries: 1 }).catch(() => {}),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 1500))
    ]);
  }
  if (results.some((result) => !result.ok || result.errors?.length)) process.exitCode = 1;
}

run()
  .then(() => process.exit(process.exitCode || 0))
  .catch((error) => { console.error(error.message); process.exit(1); });
