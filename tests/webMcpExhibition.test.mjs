import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWebMcpExhibition, normalizeWebMcpStations, toWebMcpExhibition } from '../src/platform/webMcpExhibition.js';

test('WebMCP normalizes a complete exhibition into the room story format', () => {
  const exhibition = normalizeWebMcpExhibition({
    name: 'Erinnerung in Bewegung',
    description: 'Eine Ausstellung über digitale Erinnerung.',
    location: 'Wien',
    language: 'de',
    categories: ['Kunst', 'Kulturerbe'],
    license: 'CC BY 4.0',
    subtitle: 'Drei Perspektiven',
    stations: [{
      id: 'auftakt',
      title: 'Auftakt',
      introduction: 'Der Rundgang beginnt mit einem Fundstück.',
      thumbnailLayout: 'carousel',
      thumbnailGridSpacing: 130,
      spatial: {
        position: [2, 0, -1],
        movementRadius: 7,
        surfaceMaterials: {
          wall: { materialId: 'marble-01', tileSize: 1.5 },
          floor: { materialId: 'wood-floor' }
        },
        wallBackground: { url: 'https://example.org/wall.jpg', opacity: .5 },
        camera: { position: [2, 1.8, 6], target: [2, 1.4, 0], fov: 48 },
        lighting: { ambientIntensity: .8, keyLightColor: '#ffeecc', keyLightIntensity: 2 },
        audio: { url: 'https://example.org/ambient.mp3', volume: .4, spatial: true, range: 12 }
      },
      items: [{
        id: 'fundstueck',
        title: 'Fundstück',
        description: 'Ein digitalisiertes Objekt.',
        modelUrl: 'https://example.org/object.glb',
        thumbnailUrl: 'https://example.org/object.jpg',
        attribution: 'Museum',
        license: 'CC BY 4.0',
        modelTransform: { position: [1, .2, .5], rotation: [0, .5, 0], scale: .8 }
      }]
    }]
  });

  assert.equal(exhibition.name, 'Erinnerung in Bewegung');
  assert.deepEqual(exhibition.categories, ['Kunst', 'Kulturerbe']);
  assert.equal(exhibition.stations[0].thumbnailLayout, 'carousel');
  assert.equal(exhibition.stations[0].spatial.surfaceMaterials.wall.materialId, 'marble-01');
  assert.equal(exhibition.stations[0].spatial.audio.url, 'https://example.org/ambient.mp3');
  assert.equal(exhibition.stations[0].items[0].sourceType, 'gltf');
  assert.deepEqual(exhibition.stations[0].items[0].modelTransform.rotation, [0, .5, 0]);
  assert.equal(exhibition.stations[0].selectedItemId, 'fundstueck');
});

test('WebMCP creates ordered stations without authored room coordinates', () => {
  const stations = normalizeWebMcpStations([
    { title: 'Auftakt', introduction: 'Erste Station', items: [] },
    { title: 'Vertiefung', introduction: 'Zweite Station', items: [] }
  ]);
  assert.deepEqual(stations.map((station) => station.title), ['Auftakt', 'Vertiefung']);
  assert.deepEqual(stations[0].spatial.position, [0, 0, 0]);
  assert.deepEqual(stations[1].spatial.position, [9, 0, 0]);
});

test('WebMCP rejects unsupported model URLs and unsafe media schemes', () => {
  const station = {
    title: 'Station',
    introduction: 'Beschreibung',
    spatial: {},
    items: [{ title: 'Objekt', modelUrl: 'https://example.org/object.obj' }]
  };
  assert.throws(() => normalizeWebMcpStations([station]), /nicht unterstützt/);
  assert.throws(() => normalizeWebMcpStations([{
    ...station,
    items: [],
    spatial: { audio: { url: 'javascript:alert(1)' } }
  }]), /HTTP\(S\)-URL/);
});

test('WebMCP draft updates preserve omitted exhibition fields', () => {
  const existing = {
    id: 'story-1',
    name: 'Bestehend',
    description: 'Bestehendes Konzept',
    location: 'Graz',
    coverImage: '',
    status: 'draft',
    metadata: { language: 'de', category: 'Kunst', categories: ['Kunst'], license: 'CC0' },
    branding: { subtitle: 'Untertitel', watermark: 'RIU' },
    stations: [{ id: 'station-1', title: 'Station', introduction: 'Text', items: [] }]
  };
  const updated = normalizeWebMcpExhibition({
    description: 'Neues Konzept',
    location: null,
    coverImage: null,
    watermark: ''
  }, existing);
  assert.equal(updated.name, 'Bestehend');
  assert.equal(updated.description, 'Neues Konzept');
  assert.equal(updated.location, 'Graz');
  assert.equal(updated.coverImage, '');
  assert.equal(updated.watermark, '');
  assert.equal(updated.stations, existing.stations);
});

test('WebMCP exhibition output exposes editor context without account data', () => {
  const result = toWebMcpExhibition({
    id: 'story-1',
    slug: 'story-1',
    ownerId: 'secret-user-id',
    name: 'Ausstellung',
    description: 'Konzept',
    status: 'draft',
    metadata: { language: 'de', categories: ['Kunst'] },
    branding: {},
    stations: []
  });
  assert.equal(result.editorUrl, '/studio/story-1');
  assert.equal(result.ownerId, undefined);
});
