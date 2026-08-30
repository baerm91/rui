import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoStories,
  findCrossStoryStationSource,
  migrateHeidentorPreviewImage,
  migrateHeidentorRevealStation,
  restoreOwnedLocalCoverImages
} from '../src/platform/platformStore.js';

test('cross-story station contamination is detected by station ids', () => {
  const starhemberg = demoStories.find((story) => story.id === 'demo-starhemberg');
  const heidentor = demoStories.find((story) => story.id === 'demo-heidentor');

  assert.equal(
    findCrossStoryStationSource(starhemberg.stations, heidentor.id, demoStories),
    starhemberg.id
  );
  assert.equal(findCrossStoryStationSource(heidentor.stations, heidentor.id, demoStories), null);
});

test('Heidentor seed data ships with a shared model preview instead of a browser-local fallback', () => {
  const heidentor = demoStories.find((story) => story.id === 'demo-heidentor');

  assert.equal(heidentor.coverImage, '/heidentor-cover.jpg');
  assert.equal(heidentor.previewImageSource, 'bundled');
});

test('Heidentor cover migration replaces missing and automatic previews but preserves manual covers', () => {
  const missing = migrateHeidentorPreviewImage({ id: 'demo-heidentor', coverImage: '' });
  const automatic = migrateHeidentorPreviewImage({
    id: 'demo-heidentor',
    coverImage: 'data:image/svg+xml,old-placeholder',
    previewImageSource: 'automatic'
  });
  const manual = {
    id: 'demo-heidentor',
    coverImage: 'https://example.org/custom-cover.jpg',
    previewImageSource: 'manual'
  };

  assert.equal(missing.coverImage, '/heidentor-cover.jpg');
  assert.equal(automatic.coverImage, '/heidentor-cover.jpg');
  assert.equal(automatic.previewImageSource, 'bundled');
  assert.equal(migrateHeidentorPreviewImage(manual), manual);
});

test('an owned local cover repairs an empty public copy without overriding authored remote covers', () => {
  const local = [{
    id: 'story-1', ownerId: 'owner-1', coverImage: 'data:image/jpeg;base64,local-model-preview'
  }];
  const emptyRemote = [{ id: 'story-1', ownerId: 'owner-1', coverImage: '' }];
  const automaticRemote = [{
    id: 'story-1', ownerId: 'owner-1', coverImage: 'data:image/svg+xml,automatic', previewImageSource: 'automatic'
  }];
  const manualRemote = [{
    id: 'story-1', ownerId: 'owner-1', coverImage: 'https://example.org/public.jpg', previewImageSource: 'manual'
  }];
  const bundledRemote = [{
    id: 'story-1', ownerId: 'owner-1', coverImage: '/fallback.jpg', previewImageSource: 'bundled'
  }];

  assert.equal(restoreOwnedLocalCoverImages(emptyRemote, local, 'owner-1')[0].coverImage, local[0].coverImage);
  assert.equal(restoreOwnedLocalCoverImages(automaticRemote, local, 'owner-1')[0].coverImage, local[0].coverImage);
  assert.equal(restoreOwnedLocalCoverImages(bundledRemote, local, 'owner-1')[0].coverImage, local[0].coverImage);
  assert.equal(restoreOwnedLocalCoverImages(manualRemote, local, 'owner-1')[0], manualRemote[0]);
  assert.equal(restoreOwnedLocalCoverImages(emptyRemote, local, 'another-owner')[0], emptyRemote[0]);
});

test('Heidentor reveal migration repairs only the legacy interaction copy and missing comparison', () => {
  const saved = demoStories.find((story) => story.id === 'demo-heidentor').stations.map((station) => ({ ...station }));
  saved[3] = {
    ...saved[3],
    description: 'Bewegen Sie die Maus über die Ruine, um verborgene Bauteile des ursprünglichen Heidentors sichtbar zu machen. Die Ansicht zeigt, was vom Bau des 4. Jahrhunderts n. Chr. einst vorhanden war — und was davon bis heute erhalten blieb.',
    interpretationComparison: null,
    title: 'Redaktioneller Titel'
  };
  const migrated = migrateHeidentorRevealStation(saved);

  assert.match(migrated[3].description, /^Untersuchen Sie die Ruine mit dem Reveal/);
  assert.ok(migrated[3].interpretationComparison);
  assert.equal(migrated[3].title, 'Redaktioneller Titel');
  assert.deepEqual(migrated.slice(0, 3), saved.slice(0, 3));
});
