const SESSION_PREFIX = 'riu_analytics_session:';

export function getDeviceClass(width = globalThis.innerWidth, userAgent = globalThis.navigator?.userAgent || '') {
  const viewportWidth = Number(width) || 1280;
  const touchTablet = /ipad|tablet|kindle|silk|playbook/i.test(String(userAgent));
  if (touchTablet || (viewportWidth >= 600 && viewportWidth < 1024)) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(String(userAgent)) || viewportWidth < 600) return 'mobile';
  return 'desktop';
}

export function getAnalyticsSessionId(storyId, storage = globalThis.sessionStorage) {
  const key = `${SESSION_PREFIX}${storyId}`;
  const stored = storage?.getItem(key);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored || '')) {
    return stored;
  }
  const sessionId = globalThis.crypto?.randomUUID?.() || '';
  if (sessionId) storage?.setItem(key, sessionId);
  return sessionId;
}

export function normalizeAnalyticsResult(data) {
  const summary = data?.summary || {};
  return {
    summary: {
      views: Number(summary.views) || 0,
      completed: Number(summary.completed) || 0,
      completionRate: Number(summary.completionRate) || 0,
      averageDurationSeconds: Number(summary.averageDurationSeconds) || 0,
      annotationOpens: Number(summary.annotationOpens) || 0,
      averageLoadMs: Number(summary.averageLoadMs) || 0
    },
    stations: Array.isArray(data?.stations) ? data.stations.map((station) => ({
      stationId: String(station.stationId || ''),
      title: String(station.title || 'Station'),
      position: Number(station.position) || 0,
      views: Number(station.views) || 0
    })) : [],
    daily: Array.isArray(data?.daily) ? data.daily.map((day) => ({
      day: String(day.day || ''),
      views: Number(day.views) || 0
    })) : [],
    devices: Array.isArray(data?.devices) ? data.devices.map((device) => ({
      device: String(device.device || 'desktop'),
      views: Number(device.views) || 0
    })) : []
  };
}

export function formatAnalyticsDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return minutes ? `${minutes}:${String(remainder).padStart(2, '0')} Min.` : `${remainder} Sek.`;
}

