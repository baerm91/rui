import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('room editor explicitly disables shared model-story controls', async () => {
  const [roomSource, sidebarSource, projectBarSource] = await Promise.all([
    readSource('../src/exhibition/ExhibitionRoom.jsx'),
    readSource('../src/components/editor/EditorSidebar.jsx'),
    readSource('../src/components/editor/ProjectBar.jsx')
  ]);

  assert.match(roomSource, /projectControlsAvailable=\{false\}/);
  assert.match(sidebarSource, /disabled=\{!projectControlsAvailable\}/);
  assert.match(sidebarSource, /Licht, Atmosphäre, Sound, Kamera und Modelle werden in Raumstories pro Station oder Objekt konfiguriert/);
  assert.match(projectBarSource, /Globale Modellrollen gelten nur für Modellstories/);
  assert.match(projectBarSource, /projectControlsAvailable && modelsAreOpen && activeProject/);
});

test('visitor room renderer yields the GPU while Sketchfab renders the active model', async () => {
  const roomSource = await readSource('../src/exhibition/ExhibitionRoom.jsx');

  assert.match(roomSource, /largePresentationRef\.current && !overviewModeRef\.current && selectedItemRef\.current\?\.sourceType === 'sketchfab'/);
  assert.match(roomSource, /if \(!sketchfabOverlayActive \|\| runtimeRef\.current\?\.cameraTransitionFrame\)/);
});

test('room demo keeps the editor return control mounted', async () => {
  const roomSource = await readSource('../src/exhibition/ExhibitionRoom.jsx');

  assert.match(roomSource, /initialMode === 'editor' && <EditorSidebar/);
  assert.match(roomSource, /isPreviewMode=\{mode === 'visitor'\}/);
  assert.match(roomSource, /previewStationIndex=\{stationIndex\}/);
});

test('Sketchfab camera pauses do not end an interaction while the pointer may still be held', async () => {
  const roomSource = await readSource('../src/exhibition/ExhibitionRoom.jsx');

  assert.doesNotMatch(roomSource, /addEventListener\('camerastop',[^\n]+interactionRef\.current\?\.\(false\)/);
  assert.match(roomSource, /addEventListener\('click',[^\n]+interactionRef\.current\?\.\(false\)/);
  assert.match(roomSource, /className="spatial-sketchfab" onPointerLeave=\{\(\) => interactionRef\.current\?\.\(false\)\}/);
});
