import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneProject, createProjectRecord } from '../src/projects/projectStore.js';

test('project cover images survive project creation and duplication', () => {
  const coverImage = 'data:image/jpeg;base64,thumbnail';
  const project = createProjectRecord({
    name: 'Vorschaubild-Test',
    coverImage,
    stations: [{
      id: 'station-cover',
      title: 'Ansicht',
      description: '',
      cameraPos: { x: 0, y: 2, z: 8 },
      cameraTarget: { x: 0, y: 1, z: 0 }
    }]
  });

  assert.equal(project.coverImage, coverImage);
  assert.equal(cloneProject(project, 'Kopie').coverImage, coverImage);
});

test('project presentation and connected model labels survive normalization and duplication', () => {
  const project = createProjectRecord({
    name: 'Animierte Story',
    models: {
      primary: 'https://example.org/current.glb',
      reconstruction: 'https://example.org/reconstructed.glb',
      primaryName: 'Heute',
      reconstructionName: 'Damals',
      additional: [{ id: 'model-detail', name: 'Detailmodell', url: 'https://example.org/detail.glb' }]
    },
    settings: {
      presentation: { showStoryTitle: true, textAnimation: 'soft' },
      cameraFov: 120
    }
  });

  assert.deepEqual(project.settings.presentation, { showStoryTitle: true, textAnimation: 'soft' });
  assert.equal(project.settings.cameraFov, 120);
  assert.equal(project.models.primaryName, 'Heute');
  assert.equal(project.models.reconstructionName, 'Damals');
  assert.deepEqual(project.models.additional, [{ id: 'model-detail', name: 'Detailmodell', url: 'https://example.org/detail.glb' }]);
  assert.deepEqual(cloneProject(project, 'Kopie').settings.presentation, project.settings.presentation);
  assert.equal(cloneProject(project, 'Kopie').settings.cameraFov, 120);
  assert.deepEqual(cloneProject(project, 'Kopie').models.additional, project.models.additional);
});
