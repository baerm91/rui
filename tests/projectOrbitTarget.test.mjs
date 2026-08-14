import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import {
  normalizeProjectOrbitTarget,
  serializeProjectMetadata
} from '../src/projects/projectSettings.js';

test('project orbit target survives export, JSON roundtrip, and demo normalization', async () => {
  const projectDirectory = new URL('../project/', import.meta.url);
  const projectFiles = (await readdir(projectDirectory)).filter((name) => name.endsWith('.json'));
  assert.ok(projectFiles.length > 0, 'at least one project JSON is required');
  const candidates = await Promise.all(projectFiles.map(async (name) => ({
    name,
    modifiedAt: (await stat(new URL(name, projectDirectory))).mtimeMs
  })));
  candidates.sort((left, right) => (
    right.modifiedAt - left.modifiedAt
    || right.name.localeCompare(left.name)
  ));
  const raw = JSON.parse(await readFile(new URL(candidates[0].name, projectDirectory), 'utf8'));
  const expected = raw.project.settings.orbitTarget;
  assert.ok(expected && [expected.x, expected.y, expected.z].every(Number.isFinite));

  const exported = {
    project: serializeProjectMetadata(raw.project),
    alignment: raw.alignment,
    annotations: raw.annotations,
    stations: raw.stations
  };
  const loaded = JSON.parse(JSON.stringify(exported));

  assert.deepEqual(loaded.project.settings.orbitTarget, expected);
  assert.deepEqual(
    normalizeProjectOrbitTarget(loaded.project.settings.orbitTarget, loaded.stations),
    expected
  );
});

test('legacy station targets migrate once when a project target is missing', () => {
  const stations = [{
    freeNavigation: true,
    cameraTarget: { x: 3, y: 4, z: 5 },
    freeNavigationTargetOffsetY: 1.5
  }];
  assert.deepEqual(normalizeProjectOrbitTarget(null, stations), { x: 3, y: 5.5, z: 5 });
});
