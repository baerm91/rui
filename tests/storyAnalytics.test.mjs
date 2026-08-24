import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatAnalyticsDuration, getAnalyticsSessionId, getDeviceClass, normalizeAnalyticsResult
} from '../src/platform/storyAnalytics.js';

test('device class uses viewport and user agent without storing personal data', () => {
  assert.equal(getDeviceClass(390, 'Mozilla/5.0 (iPhone) Mobile'), 'mobile');
  assert.equal(getDeviceClass(820, 'Mozilla/5.0 (iPad) Tablet'), 'tablet');
  assert.equal(getDeviceClass(1440, 'Mozilla/5.0'), 'desktop');
});

test('analytics session remains stable inside one browser tab', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
  const first = getAnalyticsSessionId('story-1', storage);
  const second = getAnalyticsSessionId('story-1', storage);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.equal(second, first);
});

test('analytics response is normalized for the owner dashboard', () => {
  const result = normalizeAnalyticsResult({
    summary: { views: '12', completionRate: '37.5', averageDurationSeconds: '91' },
    stations: [{ stationId: 's1', title: 'Auftakt', position: '1', views: '10' }],
    devices: [{ device: 'mobile', views: '8' }]
  });
  assert.equal(result.summary.views, 12);
  assert.equal(result.summary.completionRate, 37.5);
  assert.equal(result.stations[0].views, 10);
  assert.equal(formatAnalyticsDuration(result.summary.averageDurationSeconds), '1:31 Min.');
});

