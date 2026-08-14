import assert from 'node:assert/strict';
import test from 'node:test';
import { getStationsUsingModel, getStationsUsingModelId } from '../src/utils/modelAssignments.js';

const stations = [
  { id: 'ruin', viewMode: 'ruin' },
  { id: 'recon', viewMode: 'recon' },
  { id: 'portal', viewMode: 'portal' },
  { id: 'reveal', viewMode: 'reveal' }
];

test('primary model usage includes ruin and combined model stations', () => {
  assert.deepEqual(getStationsUsingModel(stations, 'primary').map(({ id }) => id), ['ruin', 'portal', 'reveal']);
});

test('reconstruction model usage includes reconstruction and combined model stations', () => {
  assert.deepEqual(getStationsUsingModel(stations, 'reconstruction').map(({ id }) => id), ['recon', 'portal', 'reveal']);
});

test('additional model usage recognizes all supported station assignment fields', () => {
  const assigned = [
    { id: 'primary-choice', modelId: 'model-x' },
    { id: 'secondary-choice', secondaryModelId: 'model-x' },
    { id: 'multi-choice', modelIds: ['model-a', 'model-x'] },
    { id: 'other', modelId: 'model-y' }
  ];
  assert.deepEqual(getStationsUsingModelId(assigned, 'model-x').map(({ id }) => id), ['primary-choice', 'secondary-choice', 'multi-choice']);
});
