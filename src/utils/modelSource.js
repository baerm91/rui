const SKETCHFAB_HOSTS = new Set(['sketchfab.com', 'www.sketchfab.com']);
const SKETCHFAB_UID_PATTERN = /^[a-z0-9]{20,40}$/i;

function parseHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function getSketchfabModelUid(value) {
  const url = parseHttpUrl(value);
  if (!url || !SKETCHFAB_HOSTS.has(url.hostname.toLowerCase())) return '';

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() === 'models' && SKETCHFAB_UID_PATTERN.test(parts[1] || '')) {
    return parts[1].toLowerCase();
  }

  if (parts[0]?.toLowerCase() === '3d-models') {
    const match = parts[1]?.match(/-([a-z0-9]{20,40})$/i);
    return match?.[1]?.toLowerCase() || '';
  }

  return '';
}

export function isSketchfabModelUrl(value) {
  return Boolean(getSketchfabModelUid(value));
}

export function isDirectModelUrl(value) {
  const url = parseHttpUrl(value);
  return Boolean(url && /\.(?:fbx|glb|gltf)$/i.test(url.pathname));
}

export function isSupportedModelUrl(value) {
  return isDirectModelUrl(value) || isSketchfabModelUrl(value);
}

export function extractModelUrl(value) {
  const text = String(value || '').replaceAll('&amp;', '&').trim();
  if (isSupportedModelUrl(text)) return text;
  const candidates = text.match(/https?:\/\/[^\s"'<>()[\]]+/gi) || [];
  return candidates
    .map((candidate) => candidate.replace(/[),.;]+$/, ''))
    .find((candidate) => isSupportedModelUrl(candidate)) || '';
}

export function normalizeModelUrl(value) {
  const trimmed = String(value || '').trim();
  const uid = getSketchfabModelUid(trimmed);
  return uid ? `https://sketchfab.com/models/${uid}` : trimmed;
}

export function getSketchfabEmbedUrl(value) {
  const uid = getSketchfabModelUid(value);
  if (!uid) return '';
  const params = new URLSearchParams({ autostart: '1', autospin: '0.1', dnt: '1', ui_infos: '0', ui_stop: '0' });
  return `https://sketchfab.com/models/${uid}/embed?${params}`;
}
