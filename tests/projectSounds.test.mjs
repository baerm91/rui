import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_PROJECT_SOUNDS, getActiveProjectSounds, normalizeProjectAudio } from '../src/audio/projectSounds.js';

test('built-in atmosphere catalog contains the requested sounds', () => {
  const names = BUILTIN_PROJECT_SOUNDS.map((sound) => sound.name);
  assert.ok(names.includes('Wind'));
  assert.ok(names.includes('Regen'));
  assert.ok(names.includes('Knarzendes Holz'));
  assert.ok(names.includes('Schneesturm'));
  assert.ok(names.includes('Gewitter mit Blitzen'));
});

test('sound matrix combines global and station-specific assignments', () => {
  const audio = normalizeProjectAudio({
    assignments: {
      'builtin-wind': { all: true },
      'builtin-rain': { stationIds: ['station-b'], intensity: 165, dynamics: 140 },
      'builtin-fire': { stationIds: ['station-a'] }
    }
  });
  assert.deepEqual(getActiveProjectSounds(audio, 'station-a').map((sound) => sound.id), ['builtin-wind', 'builtin-fire']);
  assert.deepEqual(getActiveProjectSounds(audio, 'station-b').map((sound) => sound.id), ['builtin-wind', 'builtin-rain']);
  assert.equal(getActiveProjectSounds(audio, 'station-b').find((sound) => sound.id === 'builtin-rain').intensity, 165);
  assert.equal(getActiveProjectSounds(audio, 'station-b').find((sound) => sound.id === 'builtin-rain').dynamics, 140);
});

test('sound intensity defaults to 100 percent and is clamped to 200 percent', () => {
  const audio = normalizeProjectAudio({
    assignments: {
      'builtin-wind': { all: true },
      'builtin-rain': { all: true, intensity: 900 }
    }
  });
  assert.equal(audio.assignments['builtin-wind'].intensity, 100);
  assert.equal(audio.assignments['builtin-rain'].intensity, 200);
  assert.equal(audio.assignments['builtin-wind'].dynamics, 100);
});

test('sound dynamics is kept within the supported 0 to 200 percent range', () => {
  const audio = normalizeProjectAudio({
    assignments: {
      'builtin-wind': { all: true, dynamics: 0 },
      'builtin-rain': { all: true, dynamics: 900 }
    }
  });
  assert.equal(audio.assignments['builtin-wind'].dynamics, 0);
  assert.equal(audio.assignments['builtin-rain'].dynamics, 200);
});

test('custom IndexedDB sound references survive normalization', () => {
  const audio = normalizeProjectAudio({
    customSounds: [{ id: 'custom-1', name: 'Glocke', storageKey: 'project:custom-1', mimeType: 'audio/mpeg' }],
    assignments: { 'custom-1': { stationIds: ['station-a', 'station-a'] } }
  });
  assert.equal(audio.customSounds[0].storageKey, 'project:custom-1');
  assert.deepEqual(audio.assignments['custom-1'].stationIds, ['station-a']);
});
