import test from 'node:test';
import assert from 'node:assert/strict';
import { auditStoryReadiness } from '../src/utils/storyReadiness.js';

test('story readiness reports missing narrative and media foundations without blocking on warnings', () => {
  const report = auditStoryReadiness({
    project: { name: 'Heidentor', description: '' },
    stations: [{
      title: 'TWIN-IT', description: 'Projektkontext', cameraPos: { x: 1, y: 2, z: 3 },
      videoUrl: 'https://example.test/video'
    }],
    annotations: [{ title: 'Annotation 1', text: 'blablabla' }]
  });

  assert.equal(report.errors, 0);
  assert.equal(report.ready, true);
  assert.deepEqual(report.findings.map((finding) => finding.code), [
    'story-description', 'video-transcript', 'annotation-title', 'annotation-text'
  ]);
});

test('story readiness finds broken room stations and incomplete object rights', () => {
  const report = auditStoryReadiness({
    project: { name: 'Material und Erinnerung', description: 'Eine räumliche Story.' },
    spatialMode: true,
    stations: [
      { title: 'Leer', introduction: '', spatial: { camera: { position: [0, 1, 4] } }, items: [] },
      { title: 'Objekt', introduction: 'Ein Objekt.', spatial: { camera: { position: [0, 1, 4] } }, items: [{ modelUrl: 'object.glb', description: '', attribution: '', license: '' }] }
    ]
  });

  assert.equal(report.errors, 1);
  assert.equal(report.ready, false);
  assert.ok(report.findings.some((finding) => finding.code === 'station-items'));
  assert.ok(report.findings.some((finding) => finding.code === 'item-rights'));
});
