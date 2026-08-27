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
