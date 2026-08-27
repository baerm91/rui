import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { cpus, freemem, platform, release, tmpdir, totalmem } from 'node:os';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.RIU_PERF_PORT || 4173);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.RIU_PERF_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOCALE = process.env.RIU_PERF_LOCALE || 'de-AT';
const TIMEZONE = process.env.RIU_PERF_TIMEZONE || 'Europe/Berlin';
const DEFAULT_COLD = 5;
const DEFAULT_WARM = 10;
const TIMEOUT_MS = 15000;
const TARGET_MS = 50;

const HELP = `Verwendung: node scripts/performance-benchmark.mjs [Optionen]

Optionen:
  --output <datei>  JSON-Report (Standard: artifacts/performance/latest.json)
  --cold <anzahl>   HTTP-cache-kalte Wiederholungen (Standard: ${DEFAULT_COLD})
  --warm <anzahl>   Aufgewärmte Wiederholungen (Standard: ${DEFAULT_WARM})
  --only <text>     Nur Szenarien messen, deren Name den Text enthält
  --help, -h        Diese Hilfe anzeigen

Umgebung:
  RIU_PERF_PORT, RIU_PERF_CHROME, RIU_PERF_LOCALE, RIU_PERF_TIMEZONE`;

function parseArguments(values) {
  const parsed = { output: 'artifacts/performance/latest.json', cold: DEFAULT_COLD, warm: DEFAULT_WARM, only: '', help: false };
  const valueOptions = new Map([['--output', 'output'], ['--cold', 'cold'], ['--warm', 'warm'], ['--only', 'only']]);
  for (let index = 0; index < values.length; index += 1) {
    const option = values[index];
    if (option === '--help' || option === '-h') { parsed.help = true; continue; }
    const key = valueOptions.get(option);
    if (!key) throw new Error(`Unbekannte Option: ${option}\n\n${HELP}`);
    const value = values[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Wert fehlt für ${option}\n\n${HELP}`);
    parsed[key] = value;
    index += 1;
  }
  for (const key of ['cold', 'warm']) {
    const count = Number(parsed[key]);
    if (!Number.isInteger(count) || count < 1) throw new Error(`${key} muss eine positive ganze Zahl sein.`);
    parsed[key] = count;
  }
  return parsed;
}

let argumentError = null;
let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  argumentError = error;
  options = { output: 'artifacts/performance/latest.json', cold: DEFAULT_COLD, warm: DEFAULT_WARM, only: '', help: false };
}
const outputPath = resolve(ROOT, options.output);
const coldIterations = options.cold;
const warmIterations = options.warm;
const only = options.only;

const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const camera = { cameraPos: { x: 0, y: 3, z: 12 }, cameraTarget: { x: 0, y: 1.5, z: 0 }, cameraExplicitlySet: true };
const spatial = (x = 0) => ({
  position: [x, 0, 0], rotation: [0, 0, 0], movementRadius: 5,
  camera: { position: [x, 1.7, 5], target: [x, 1.4, 0], fov: 45 },
  lighting: { ambientIntensity: .55, keyLightColor: '#f2dfc3', keyLightIntensity: 1.2, keyLightPosition: [2, 4, 3], keyLightTarget: [0, 1.3, 0] },
  audio: { url: '', volume: .6, spatial: true, range: 8, autoplay: false }
});
const localItem = { id: 'local-object', modelUrl: `${ORIGIN}/__perf__/model.gltf`, sourceType: 'gltf', title: 'Lokales Objekt', description: 'Deterministisches Benchmark-Modell' };
const sketchfabItem = { id: 'sketchfab-object', modelUrl: 'https://sketchfab.com/3d-models/roman-bust-7w7pAfrCfjovwykkEeRFLGw5SXS', sourceType: 'sketchfab', title: 'Sketchfab Objekt' };

const users = [
  { id: 'perf-admin', name: 'Performance Admin', username: 'perf-admin', email: 'admin@example.test', role: 'admin', isBlocked: false },
  { id: 'perf-pro', name: 'Performance Pro', username: 'perf-pro', email: 'pro@example.test', role: 'pro-user', isBlocked: false },
  { id: 'perf-light', name: 'Performance Light', username: 'perf-light', email: 'light@example.test', role: 'light-user', isBlocked: false },
  { id: 'perf-viewer', name: 'Performance Viewer', username: 'perf-viewer', email: 'viewer@example.test', role: 'light-user', isBlocked: false }
];

const baseStory = {
  ownerId: 'perf-admin', authorName: 'Performance Admin', status: 'published', publishedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', coverImage: '', location: 'Benchmark',
  metadata: { language: 'de', category: 'Kulturerbe', categories: ['Kulturerbe'] }, stats: { views: 0, lastViewedAt: null }, collaborators: []
};
const roomStory = {
  ...baseStory, id: 'perf-room', slug: 'perf-room', name: 'Performance Raum', description: 'Lokale Raumstory',
  metadata: { language: 'de', category: 'Architektur', categories: ['Architektur'] },
  branding: { title: 'Performance Raum', subtitle: 'Benchmark', watermark: 'PERFORMANCE' }, models: { primary: '', reconstruction: '' },
  settings: { experienceType: 'room', scrollSpeed: 1 }, alignment: null, annotations: [],
  stations: [
    { id: 'room-one', title: 'Raum Eins', introduction: 'Erste Station', description: 'Erste Station', spatial: spatial(0), items: [localItem, sketchfabItem], selectedItemId: 'local-object', initialItemId: 'local-object' },
    { id: 'room-two', title: 'Raum Zwei', introduction: 'Zweite Station', description: 'Zweite Station', spatial: spatial(9), items: [localItem] }
  ]
};
const modelStory = {
  ...baseStory, id: 'perf-model', slug: 'perf-model', name: 'Performance Modell', description: 'Lokale Modellstory',
  branding: { title: 'Performance Modell', subtitle: 'Benchmark', watermark: 'PERFORMANCE' },
  models: { primary: `${ORIGIN}/__perf__/model.gltf`, reconstruction: '', primaryName: 'Benchmark-Dreieck' },
  settings: { experienceType: 'model', scrollSpeed: 1, presentation: { showStoryTitle: true } }, alignment: { reconstructionMatrix: identityMatrix },
  annotations: [{ id: 'perf-annotation', title: 'Messpunkt', text: 'Benchmark-Annotation', position: { x: 0, y: 1, z: 0 }, cameraPos: camera.cameraPos, cameraTarget: camera.cameraTarget, visibleStationIds: ['model-one', 'model-two'] }],
  stations: [
    { id: 'model-one', title: 'Modell Eins', description: 'Erste Station', viewMode: 'ruin', ...camera, freeNavigation: false },
    { id: 'model-two', title: 'Freie Ansicht', description: 'Zweite Station', viewMode: 'reveal', ...camera, freeNavigation: true }
  ]
};
const sketchfabStory = {
  ...modelStory, id: 'perf-sketchfab', slug: 'perf-sketchfab', name: 'Performance Sketchfab',
  metadata: { language: 'de', category: 'Kunst', categories: ['Kunst'] },
  models: { primary: sketchfabItem.modelUrl, reconstruction: '', primaryName: 'Sketchfab Benchmark' }
};
const draftStory = {
  ...modelStory,
  id: 'perf-draft', slug: 'perf-draft', name: 'Performance Entwurf', status: 'draft', publishedAt: null,
  collaborators: [
    { userId: 'perf-pro', username: 'perf-pro', name: 'Performance Pro', role: 'editor', status: 'accepted' },
    { userId: 'perf-viewer', username: 'perf-viewer', name: 'Performance Viewer', role: 'viewer', status: 'accepted' }
  ]
};
const stories = [roomStory, modelStory, sketchfabStory, draftStory];

const personas = {
  anonymous: null,
  admin: 'perf-admin',
  pro: 'perf-pro',
  light: 'perf-light',
  viewer: 'perf-viewer'
};

const routes = [
  ['home-anonymous', '/', 'anonymous', '.riu-hero'],
  ['discover', '/discover', 'anonymous', '.discover-page'],
  ['discover-author', '/discover?author=perf-admin', 'anonymous', '.discover-page'],
  ['login', '/login', 'anonymous', '.auth-page'],
  ['register', '/register', 'anonymous', '.auth-page'],
  ['reset-password', '/reset-password', 'anonymous', '.auth-page'],
  ['dashboard-owner', '/dashboard', 'admin', '.dashboard-page'],
  ['dashboard-guest-gate', '/dashboard', 'anonymous', '.auth-page'],
  ['account', '/account', 'admin', '.account-page'],
  ['account-guest-gate', '/account', 'anonymous', '.auth-page'],
  ['admin', '/admin', 'admin', '.admin-page'],
  ['admin-denied', '/admin', 'light', '.not-found'],
  ['new-story', '/stories/new', 'pro', '.create-page'],
  ['new-story-light-gate', '/stories/new', 'light', '.dashboard-page'],
  ['new-story-guest-gate', '/stories/new', 'anonymous', '.auth-page'],
  ['analytics-owner', '/analytics/perf-room', 'admin', '.analytics-page'],
  ['analytics-denied', '/analytics/perf-room', 'light', '.not-found'],
  ['not-found', '/does-not-exist', 'anonymous', '.not-found'],
  ['legacy-edits-404', '/edits', 'anonymous', '.not-found'],
  ['room-visitor', '/stories/perf-room', 'anonymous', '.exhibition-shell.mode-visitor'],
  ['room-studio', '/studio/perf-room', 'admin', '.exhibition-shell.mode-editor'],
  ['model-visitor', '/stories/perf-model', 'anonymous', '.visitor-top-controls'],
  ['model-studio', '/studio/perf-model', 'admin', '.editor-viewport-frame'],
  ['model-studio-guest-gate', '/studio/perf-model', 'anonymous', '.auth-page'],
  ['model-studio-viewer-denied', '/studio/perf-model', 'viewer', '.riu-hero'],
  ['model-draft-owner', '/stories/perf-draft', 'admin', '.visitor-top-controls'],
  ['model-draft-editor', '/stories/perf-draft', 'pro', '.visitor-top-controls'],
  ['model-draft-viewer', '/stories/perf-draft', 'viewer', '.visitor-top-controls'],
  ['model-draft-anonymous-denied', '/stories/perf-draft', 'anonymous', '.riu-hero'],
  ['model-draft-editor-studio', '/studio/perf-draft', 'pro', '.editor-viewport-frame'],
  ['model-draft-viewer-studio-denied', '/studio/perf-draft', 'viewer', '.riu-hero'],
  ['sketchfab-visitor', '/stories/perf-sketchfab', 'anonymous', '.visitor-top-controls'],
  ['login-auth-gate', '/login', 'admin', '.dashboard-page'],
  ['register-auth-gate', '/register', 'admin', '.dashboard-page'],
  ['reset-password-auth-gate', '/reset-password', 'admin', '.dashboard-page']
].map(([name, path, persona, selector]) => ({ name, path, persona, selector, kind: 'route' }));

const interactions = [
  { name: 'header-guest-account-menu', path: '/', persona: 'anonymous', base: '.riu-hero', action: clickText('button', 'Einloggen oder registrieren'), selector: '.riu-auth-dropdown' },
  { name: 'header-auth-account-menu', path: '/dashboard', persona: 'admin', base: '.dashboard-page', action: clickText('button', 'Performance Admin'), selector: '.riu-account-dropdown' },
  { name: 'mobile-navigation', path: '/', persona: 'anonymous', base: '.riu-hero', viewport: { width: 390, height: 844, mobile: true }, action: clickLabel('Menü öffnen'), selector: '.riu-header nav.is-open' },
  { name: 'discover-search-filter', path: '/discover', persona: 'anonymous', base: '.discover-page', action: setInputByPlaceholder('Stories, Autor:innen oder Epochen suchen …', 'Performance Raum'), selector: '.discover-results', condition: "document.querySelector('.discover-results')?.textContent.includes('1 Story')" },
  { name: 'discover-category-filter', path: '/discover', persona: 'anonymous', base: '.discover-page', action: clickExactText('button', 'Architektur'), selector: '.discover-category-tabs button.is-active', condition: "document.querySelector('.discover-category-tabs button.is-active')?.textContent.trim() === 'Architektur' && document.querySelector('.discover-results')?.textContent.includes('1 Story')" },
  { name: 'discover-empty-result', path: '/discover', persona: 'anonymous', base: '.discover-page', action: setInputByPlaceholder('Stories, Autor:innen oder Epochen suchen …', 'keine-benchmark-story'), selector: '.discover-page .empty-state' },
  { name: 'dashboard-metadata-dialog', path: '/dashboard', persona: 'admin', base: '.dashboard-page', action: clickText('button', 'Metadaten'), selector: '.metadata-dialog[aria-modal="true"]' },
  { name: 'dashboard-collaboration-dialog', path: '/dashboard', persona: 'admin', base: '.dashboard-page', action: clickText('button', 'Team'), selector: '.collaboration-dialog[aria-modal="true"]' },
  { name: 'dashboard-version-dialog', path: '/dashboard', persona: 'admin', base: '.dashboard-page', action: clickText('button', 'Versionen'), selector: '.version-dialog[aria-modal="true"]' },
  { name: 'model-story-info', path: '/stories/perf-model', persona: 'anonymous', base: '.visitor-top-controls', action: clickLabel('Informationen zur Story'), selector: '.visitor-story-info' },
  { name: 'model-annotation-dialog', path: '/stories/perf-model', persona: 'anonymous', base: '.annotation-marker', action: clickSelector('.annotation-marker'), selector: '.annotation-popover[role="dialog"]' },
  { name: 'model-station-two', path: '/stories/perf-model', persona: 'anonymous', base: '.visitor-top-controls', action: clickLabel('Zu Station 2: Freie Ansicht'), selector: '[aria-label="Freie Ansicht aktivieren"]' },
  { name: 'model-free-navigation', path: '/stories/perf-model', persona: 'anonymous', base: '.visitor-top-controls', prepare: clickLabel('Zu Station 2: Freie Ansicht'), prepareWaitMs: 1400, action: clickLabel('Freie Ansicht aktivieren'), selector: '.annotation-navigation' },
  { name: 'model-studio-import-export', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', action: clickText('button', 'Import / Export'), selector: '.fixed.inset-0.pointer-events-auto' },
  { name: 'model-studio-models-panel', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', action: clickText('button', 'Modelle'), selector: 'input[aria-label="Basismodell URL"]' },
  { name: 'model-studio-project-panel', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', action: clickText('button', 'Projekteinstellungen'), selector: '[role="tablist"][aria-label="Bereiche der Projekteinstellungen"]' },
  { name: 'model-studio-project-sounds', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', prepare: clickText('button', 'Projekteinstellungen'), action: clickExactText('button', 'Sounds'), selector: 'input[aria-label^="Lautstärke von"]' },
  { name: 'model-studio-project-annotations', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', prepare: clickText('button', 'Projekteinstellungen'), action: clickExactText('button', 'Annotationen'), selector: '[data-annotation-card]' },
  { name: 'model-studio-project-lighting', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', prepare: clickText('button', 'Projekteinstellungen'), action: clickExactText('button', 'Beleuchtung'), selector: '.editor-sidebar', condition: "document.querySelector('.editor-sidebar')?.textContent.includes('Lichtintensität')" },
  { name: 'model-studio-project-origin', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', prepare: clickText('button', 'Projekteinstellungen'), action: clickExactText('button', 'Nullpunkt'), selector: '.editor-sidebar', condition: "[...document.querySelectorAll('.editor-sidebar button')].some((button) => button.textContent.trim() === 'Im Modell setzen')" },
  { name: 'model-studio-station-scene-tab', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', action: clickExactText('button', 'Szene'), selector: '[role="tab"][aria-selected="true"]', condition: "[...document.querySelectorAll('[role=\"tab\"][aria-selected=\"true\"]')].some((tab) => tab.textContent.trim() === 'Szene')" },
  { name: 'model-studio-station-media-tab', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', action: clickExactText('button', 'Medien'), selector: '[role="tab"][aria-selected="true"]', condition: "[...document.querySelectorAll('[role=\"tab\"][aria-selected=\"true\"]')].some((tab) => tab.textContent.trim() === 'Medien')" },
  { name: 'model-studio-demo', path: '/studio/perf-model', persona: 'admin', base: '.editor-viewport-frame', action: clickExactText('button', 'Demo'), selector: '.fixed.top-4.right-4', condition: "document.body.textContent.includes('Demo · Scroll-Vorschau')" },
  { name: 'room-enter-station', path: '/stories/perf-room', persona: 'anonymous', base: '.exhibition-shell.is-overview', action: clickText('button', 'Zur Station'), selector: '.spatial-station-content' },
  { name: 'room-open-local-object', path: '/stories/perf-room', persona: 'anonymous', base: '.exhibition-shell.is-overview', prepare: clickText('button', 'Zur Station'), action: clickText('button', 'Lokales Objekt'), selector: '.spatial-object-caption' },
  { name: 'room-open-sketchfab-object', path: '/stories/perf-room', persona: 'anonymous', base: '.exhibition-shell.is-overview', prepare: clickText('button', 'Zur Station'), action: clickText('button', 'Sketchfab Objekt'), selector: '.spatial-sketchfab' },
  { name: 'room-return-overview', path: '/stories/perf-room', persona: 'anonymous', base: '.exhibition-shell.is-overview', prepare: clickText('button', 'Zur Station'), prepareWaitMs: 2100, action: clickText('button', 'Raumübersicht'), selector: '.spatial-overview-hint' },
  { name: 'room-second-station', path: '/stories/perf-room', persona: 'anonymous', base: '.exhibition-shell.is-overview', action: clickSelector('.station-stepper button:last-of-type'), selector: '.spatial-station-content', condition: "document.querySelector('.spatial-story-copy h1')?.textContent.trim() === 'Raum Zwei'" },
  { name: 'room-studio-visitor-mode', path: '/studio/perf-room', persona: 'admin', base: '.exhibition-shell.mode-editor', action: clickText('button', 'Besucher'), selector: '.exhibition-shell.mode-visitor.is-overview' },
  { name: 'room-studio-editor-mode', path: '/studio/perf-room', persona: 'admin', base: '.exhibition-shell.mode-editor', prepare: clickText('button', 'Besucher'), action: clickText('button', 'Editor'), selector: '.exhibition-shell.mode-editor' },
  { name: 'room-studio-demo', path: '/studio/perf-room', persona: 'admin', base: '.exhibition-shell.mode-editor', action: clickExactText('button', 'Demo'), selector: '.exhibition-shell.mode-visitor:not(.is-overview)' },
  { name: 'room-studio-second-station', path: '/studio/perf-room', persona: 'admin', base: '.exhibition-shell.mode-editor', action: clickSelector('.station-stepper button:last-of-type'), selector: '.exhibition-shell.mode-editor', condition: "document.querySelector('.spatial-story-copy h1')?.textContent.trim() === 'Raum Zwei'" },
  { name: 'room-studio-sketchfab-object', path: '/studio/perf-room', persona: 'admin', base: '.exhibition-shell.mode-editor', action: clickText('button', 'Sketchfab Objekt'), selector: '.spatial-sketchfab' }
].map((scenario) => ({ ...scenario, kind: 'interaction' }));

function clickText(tag, text) {
  return `(() => { const target = [...document.querySelectorAll('${tag}')].find((element) => element.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)})); if (!target) throw new Error('Trigger not found: ${text}'); target.click(); })()`;
}

function clickExactText(tag, text) {
  return `(() => { const target = [...document.querySelectorAll('${tag}')].find((element) => element.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)}); if (!target) throw new Error('Trigger not found: ${text}'); target.click(); })()`;
}

function clickSelector(selector) {
  return `(() => { const target = document.querySelector(${JSON.stringify(selector)}); if (!target) throw new Error('Trigger not found: ${selector}'); target.click(); })()`;
}

function setInputByPlaceholder(placeholder, value) {
  return `(() => { const target = document.querySelector(${JSON.stringify(`input[placeholder="${placeholder}"]`)}); if (!target) throw new Error('Input not found: ${placeholder}'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(target, ${JSON.stringify(value)}); target.dispatchEvent(new Event('input', { bubbles: true })); })()`;
}

function clickLabel(label) {
  return `(() => { const target = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!target) throw new Error('Trigger not found: ${label}'); target.click(); })()`;
}

const scenarios = [...routes, ...interactions].filter((scenario) => !only || scenario.name.includes(only));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const triangleGltf = JSON.stringify({
  asset: { version: '2.0', generator: 'RIU performance benchmark' },
  scenes: [{ nodes: [0] }], scene: 0, nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  buffers: [{ uri: 'data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAAAAABAAIA', byteLength: 42 }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }, { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }]
});

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      if (request.url?.split('?')[0] === '/__perf__/model.gltf') {
        response.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' });
        response.end(triangleGltf);
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url || '/', ORIGIN).pathname);
      const relative = normalize(pathname).replace(/^([/\\])+/, '');
      const candidate = join(DIST, relative || 'index.html');
      const file = candidate.startsWith(DIST) && existsSync(candidate) && (await stat(candidate)).isFile() ? candidate : join(DIST, 'index.html');
      response.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' });
      createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(500); response.end(error.message);
    }
  });
  await new Promise((resolvePromise, reject) => server.listen(PORT, '127.0.0.1', resolvePromise).once('error', reject));
  return server;
}

class CdpClient {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    webSocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.webSocket.send(JSON.stringify(payload));
    });
  }
  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

async function waitForFile(file, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (existsSync(file)) return readFile(file, 'utf8');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`Timed out waiting for ${file}`);
}

function runProcess(command, processArguments) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, processArguments, { cwd: ROOT, windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout));
      else reject(new Error(`${command} ${processArguments.join(' ')} schlug fehl (${code}): ${Buffer.concat(stderr).toString('utf8').trim()}`));
    });
  });
}

async function hashDirectory(directory) {
  const hash = createHash('sha256');
  const files = [];
  async function collect(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await collect(directory);
  files.sort((left, right) => left.localeCompare(right, 'en'));
  for (const file of files) {
    const name = relative(directory, file).split(sep).join('/');
    hash.update(name); hash.update('\0'); hash.update(await readFile(file)); hash.update('\0');
  }
  return { sha256: hash.digest('hex'), files: files.length };
}

async function readProvenance() {
  const [head, diff, status, build] = await Promise.all([
    runProcess('git', ['rev-parse', 'HEAD']),
    runProcess('git', ['diff', '--binary', 'HEAD', '--', '.']),
    runProcess('git', ['status', '--short']),
    hashDirectory(DIST)
  ]);
  return {
    gitHead: head.toString('utf8').trim(),
    gitStatus: status.toString('utf8').trim(),
    gitDiffSha256: createHash('sha256').update(diff).digest('hex'),
    gitDiffBytes: diff.length,
    buildSha256: build.sha256,
    buildFiles: build.files
  };
}

async function launchChrome() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  const profile = await mkdtemp(join(tmpdir(), 'riu-perf-'));
  const process = spawn(CHROME, [
    `--user-data-dir=${profile}`, '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-component-update', '--disable-background-networking', '--disable-default-apps',
    '--disable-features=Translate,MediaRouter', '--window-size=1440,1000', `--lang=${LOCALE}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  const [port, path] = (await waitForFile(join(profile, 'DevToolsActivePort'))).trim().split(/\r?\n/);
  const webSocket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolvePromise, reject) => {
    webSocket.addEventListener('open', resolvePromise, { once: true });
    webSocket.addEventListener('error', reject, { once: true });
  });
  return { client: new CdpClient(webSocket), process, profile, webSocket };
}

function seedScript(persona, readySelector) {
  const sessionId = personas[persona];
  return `(() => {
    localStorage.setItem('riu_users_v1', ${JSON.stringify(JSON.stringify(users))});
    localStorage.setItem('three_story_projects_v1', ${JSON.stringify(JSON.stringify(stories))});
    ${sessionId ? `localStorage.setItem('riu_session_v1', ${JSON.stringify(JSON.stringify({ userId: sessionId }))});` : "localStorage.removeItem('riu_session_v1');"}
    globalThis.__riuPerf = { readyAt: null, errors: [] };
    addEventListener('error', (event) => globalThis.__riuPerf.errors.push(String(event.error || event.message)));
    addEventListener('unhandledrejection', (event) => globalThis.__riuPerf.errors.push(String(event.reason)));
    const selector = ${JSON.stringify(readySelector)};
    let scheduled = false;
    const check = () => {
      if (globalThis.__riuPerf.readyAt !== null || scheduled) return;
      const element = document.querySelector(selector);
      if (!element || !element.getClientRects().length) return;
      const loader = document.querySelector('#loading-screen');
      if (loader && loader.getClientRects().length && Number.parseFloat(getComputedStyle(loader).opacity || '1') > .01) return;
      scheduled = true;
      Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => setTimeout(() => requestAnimationFrame(() => {
        globalThis.__riuPerf.readyAt = performance.now();
      }), 0)));
    };
    new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
    addEventListener('DOMContentLoaded', check);
  })();`;
}

async function createPage(client, scenario, cacheDisabled) {
  const { browserContextId } = await client.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
  const viewport = scenario.viewport || { width: 1440, height: 1000, mobile: false };
  await Promise.all([
    client.send('Page.enable', {}, sessionId), client.send('Runtime.enable', {}, sessionId),
    client.send('Network.enable', {}, sessionId), client.send('Performance.enable', {}, sessionId),
    client.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1 }, sessionId),
    client.send('Emulation.setLocaleOverride', { locale: LOCALE }, sessionId),
    client.send('Emulation.setTimezoneOverride', { timezoneId: TIMEZONE }, sessionId),
    client.send('Network.setCacheDisabled', { cacheDisabled }, sessionId),
    client.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript(scenario.persona, scenario.base || scenario.selector) }, sessionId)
  ]);
  return { browserContextId, targetId, sessionId };
}

async function evaluate(client, sessionId, expression, awaitPromise = true) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function waitUntil(client, sessionId, expression, timeout = TIMEOUT_MS) {
  return evaluate(client, sessionId, `new Promise((resolve, reject) => { const started = performance.now(); const poll = () => { try { const value = (${expression}); if (value) return resolve(value); if (performance.now() - started > ${timeout}) return reject(new Error('Timeout: ${expression.replaceAll("'", "\\'")}')); requestAnimationFrame(poll); } catch (error) { reject(error); } }; poll(); })`);
}

async function waitAcrossNavigations(client, sessionId, expression, timeout = TIMEOUT_MS) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await waitUntil(client, sessionId, expression, Math.max(1, deadline - Date.now()));
    } catch (error) {
      lastError = error;
      if (!/navigated|execution context|context.*destroyed|Cannot find context/i.test(error.message)) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
  }
  throw lastError || new Error(`Timeout: ${expression}`);
}

function bounded(promise, timeout, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${timeout} ms`)), timeout))
  ]);
}

async function navigateAndMeasure(client, page, scenario) {
  await bounded(client.send('Page.navigate', { url: `${ORIGIN}${scenario.path}` }, page.sessionId), TIMEOUT_MS, `Navigation ${scenario.path}`);
  const readyAt = await waitAcrossNavigations(client, page.sessionId, 'globalThis.__riuPerf?.readyAt');
  if (scenario.kind === 'interaction') {
    if (scenario.prepare) {
      await evaluate(client, page.sessionId, scenario.prepare);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, scenario.prepareWaitMs || 700));
    }
    return evaluate(client, page.sessionId, `new Promise((resolve, reject) => {
      const selector = ${JSON.stringify(scenario.selector)};
      const condition = () => (${scenario.condition || 'true'});
      let start;
      const finish = () => {
        const element = document.querySelector(selector);
        if (!element || !element.getClientRects().length || !condition()) return false;
        requestAnimationFrame(() => setTimeout(() => requestAnimationFrame(() => resolve(performance.now() - start)), 0));
        return true;
      };
      const observer = new MutationObserver(() => { if (finish()) observer.disconnect(); });
      observer.observe(document, { subtree: true, childList: true, attributes: true });
      start = performance.now();
      try { ${scenario.action} } catch (error) { observer.disconnect(); reject(error); return; }
      finish();
      setTimeout(() => reject(new Error('Interaction timeout: ${scenario.name}')), ${TIMEOUT_MS});
    })`);
  }
  return readyAt;
}

async function diagnostics(client, sessionId) {
  return evaluate(client, sessionId, `(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]));
    return {
      domContentLoadedMs: navigation?.domContentLoadedEventEnd || null,
      loadMs: navigation?.loadEventEnd || null,
      firstPaintMs: paints['first-paint'] || null,
      firstContentfulPaintMs: paints['first-contentful-paint'] || null,
      requestCount: resources.length,
      transferredBytes: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
      decodedBytes: resources.reduce((sum, resource) => sum + (resource.decodedBodySize || 0), 0),
      external: resources.filter((resource) => !resource.name.startsWith(${JSON.stringify(ORIGIN)})).map((resource) => ({ name: resource.name, duration: resource.duration, transferSize: resource.transferSize })),
      errors: globalThis.__riuPerf?.errors || [],
      finalPath: location.pathname + location.search
    };
  })()`);
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(samples) {
  const values = samples.filter((sample) => sample.ok).map((sample) => sample.durationMs);
  return {
    samples: samples.length, failures: samples.length - values.length,
    minMs: values.length ? Math.min(...values) : null,
    medianMs: percentile(values, .5), p75Ms: percentile(values, .75), p95Ms: percentile(values, .95), maxMs: values.length ? Math.max(...values) : null,
    pass: values.length === samples.length && percentile(values, .95) < TARGET_MS
  };
}

async function sample(client, scenario, cacheDisabled, prime = false) {
  const page = await createPage(client, scenario, cacheDisabled);
  try {
    if (prime) await navigateAndMeasure(client, page, scenario);
    const durationMs = await navigateAndMeasure(client, page, scenario);
    const details = await diagnostics(client, page.sessionId);
    return { ok: true, durationMs, details };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    await bounded(client.send('Target.disposeBrowserContext', { browserContextId: page.browserContextId }), 5000, 'Browser context disposal').catch(() => {});
  }
}

async function run() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist is missing. Run npm run build first.');
  if (!scenarios.length) throw new Error(`Kein Szenario entspricht --only ${JSON.stringify(only)}.`);
  const provenance = await readProvenance();
  const server = await startServer();
  const chrome = await launchChrome();
  try {
    const version = await chrome.client.send('Browser.getVersion');
    const results = [];
    for (const scenario of scenarios) {
      const cold = [];
      const warm = [];
      for (let index = 0; index < coldIterations; index += 1) cold.push(await sample(chrome.client, scenario, true));
      for (let index = 0; index < warmIterations; index += 1) warm.push(await sample(chrome.client, scenario, false, true));
      const result = { name: scenario.name, kind: scenario.kind, path: scenario.path, persona: scenario.persona, selector: scenario.selector, viewport: scenario.viewport || { width: 1440, height: 1000, mobile: false }, cold: summarize(cold), warm: summarize(warm), coldSamples: cold, warmSamples: warm };
      results.push(result);
      process.stdout.write(`${scenario.name.padEnd(34)} cold p95=${String(result.cold.p95Ms?.toFixed(1) ?? 'FAIL').padStart(7)} ms  warm p95=${String(result.warm.p95Ms?.toFixed(1) ?? 'FAIL').padStart(7)} ms\n`);
    }
    const report = {
      schemaVersion: 2, createdAt: new Date().toISOString(), targetMs: TARGET_MS,
      method: { route: 'navigationStart to visible route-specific render-ready selector, unobscured loading screen, document.fonts.ready, and a post-paint opportunity', interaction: 'in-page click start to visible target state and a post-paint opportunity', cold: 'fresh browser context with real IndexedDB and HTTP cache disabled; browser process, OS file cache, and JIT may be warm', warm: 'fresh browser context with real IndexedDB and cache enabled; the same page is primed once before measurement' },
      provenance,
      environment: { platform: `${platform()} ${release()}`, cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(), freeMemoryBytes: freemem(), node: process.version, chrome: version.product, chromePath: CHROME, viewport: '1440x1000@1x default; per-scenario overrides are recorded with each result', locale: LOCALE, timezone: TIMEZONE, origin: ORIGIN, coldIterations, warmIterations, gitDirty: provenance.gitStatus },
      exclusions: ['OAuth provider page', 'OS file picker', 'development-only /__spatial-preview (production build returns 404)'],
      results,
      passed: results.every((result) => result.cold.pass && result.warm.pass)
    };
    await mkdir(resolve(outputPath, '..'), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Report: ${outputPath}\nOverall: ${report.passed ? 'PASS' : 'FAIL'}\n`);
    if (!report.passed) process.exitCode = 2;
  } finally {
    chrome.webSocket.close();
    await new Promise((resolvePromise) => {
      const taskkill = spawn('taskkill', ['/PID', String(chrome.process.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      taskkill.on('close', resolvePromise);
      taskkill.on('error', resolvePromise);
    });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { await rm(chrome.profile, { recursive: true, force: true }); break; }
      catch { await new Promise((resolvePromise) => setTimeout(resolvePromise, 200)); }
    }
  }
}

async function main() {
  if (argumentError) throw argumentError;
  if (options.help) { process.stdout.write(`${HELP}\n`); return; }
  await run();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
