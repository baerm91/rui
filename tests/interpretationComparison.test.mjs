import test from 'node:test';
import assert from 'node:assert/strict';
import heidentorConfig from '../heidentor-stations.json' with { type: 'json' };
import { normalizeStationConfig, prepareStationsForStorage } from '../src/stations.js';
import {
  createInterpretationViewOverride,
  getInterpretationState,
  getNextInterpretationState,
  normalizeInterpretationComparison,
  resolveInterpretationStation
} from '../src/utils/interpretationComparison.js';

test('Heidentor comparison survives normalization and storage', () => {
  const normalized = normalizeStationConfig(heidentorConfig);
  const comparison = normalized.stations[3].interpretationComparison;

  assert.equal(comparison.states.length, 2);
  assert.equal(comparison.states[0].label, 'Erhaltener Befund');
  assert.equal(comparison.states[0].viewMode, 'ruin');
  assert.equal(comparison.states[1].label, 'Rekonstruktion');
  assert.equal(comparison.explanation.label, 'Warum so rekonstruiert?');
  assert.equal(comparison.experimentalMode.viewMode, 'reveal');

  const stored = prepareStationsForStorage(normalized.stations);
  assert.deepEqual(stored[3].interpretationComparison, comparison);
});

test('comparison schema rejects incomplete and unsupported view states', () => {
  assert.equal(normalizeInterpretationComparison(null), null);
  assert.equal(normalizeInterpretationComparison({ states: [{ viewMode: 'portal' }] }), null);
});

test('active interpretation state follows the rendered Three.js view mode', () => {
  const comparison = normalizeInterpretationComparison({
    states: [
      { id: 'evidence', viewMode: 'ruin', label: 'Befund' },
      { id: 'reconstruction', viewMode: 'recon', label: 'Rekonstruktion' }
    ],
    experimentalMode: { viewMode: 'reveal', label: 'Vergleich' }
  });

  assert.equal(getInterpretationState(comparison, 'ruin').id, 'evidence');
  assert.equal(getInterpretationState(comparison, 'recon').id, 'reconstruction');
  assert.equal(getInterpretationState(comparison, 'reveal').label, 'Vergleich');
  assert.equal(getNextInterpretationState(comparison, 'reveal').viewMode, 'ruin');
  assert.equal(getNextInterpretationState(comparison, 'ruin').viewMode, 'recon');
  assert.equal(getNextInterpretationState(comparison, 'recon').viewMode, 'ruin');
});

test('session override resolves an effective station without mutating authored data', () => {
  const station = normalizeStationConfig(heidentorConfig).stations[3];
  const override = createInterpretationViewOverride(station, 'ruin');
  const effectiveStation = resolveInterpretationStation(station, override);

  assert.deepEqual(override, { stationId: 'station_3', viewMode: 'ruin' });
  assert.equal(effectiveStation.viewMode, 'ruin');
  assert.equal(station.viewMode, 'reveal');
  assert.notEqual(effectiveStation, station);
});

test('session override cannot activate unsupported modes or affect another station', () => {
  const stations = normalizeStationConfig(heidentorConfig).stations;
  assert.equal(createInterpretationViewOverride(stations[3], 'portal'), null);
  assert.equal(resolveInterpretationStation(stations[2], { stationId: 'station_3', viewMode: 'ruin' }), stations[2]);
});
