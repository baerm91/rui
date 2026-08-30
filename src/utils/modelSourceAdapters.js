import { getSketchfabEmbedUrl, getSketchfabModelUid } from './modelSource.js';
import { getSpatialSourceType } from './spatialStory.js';

export const MODEL_SOURCE_ADAPTERS = {
  sketchfab: {
    type: 'sketchfab',
    transparentViewer: true,
    getViewerUrl: (url) => `${getSketchfabEmbedUrl(url)}&transparent=1&ui_infos=0&ui_controls=0&ui_watermark=0`,
    async resolveMetadata(url) {
      const uid = getSketchfabModelUid(url);
      const response = await fetch(uid ? `https://api.sketchfab.com/v3/models/${uid}` : `https://sketchfab.com/oembed?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Sketchfab-Metadaten konnten nicht geladen werden.');
      const data = await response.json();
      const thumbnails = Array.isArray(data.thumbnails?.images) ? data.thumbnails.images : [];
      const thumbnail = thumbnails.reduce((best, candidate) => Number(candidate?.width || 0) > Number(best?.width || 0) ? candidate : best, null);
      return {
        title: data.name || data.title || '',
        providerThumbnailUrl: thumbnail?.url || data.thumbnail_url || '',
        attribution: data.user?.displayName || data.user?.username || data.author_name || '',
        license: data.license?.label || data.license?.name || '',
        licenseUrl: data.license?.url || ''
      };
    }
  },
  gltf: {
    type: 'gltf',
    transparentViewer: false,
    getViewerUrl: (url) => url,
    async resolveMetadata() { return {}; }
  }
};

const metadataRequests = new Map();

export function getModelSourceAdapter(urlOrType) {
  const type = MODEL_SOURCE_ADAPTERS[urlOrType] ? urlOrType : getSpatialSourceType(urlOrType);
  return MODEL_SOURCE_ADAPTERS[type] || null;
}

export function resolveModelSourceMetadata(url) {
  const adapter = getModelSourceAdapter(url);
  if (!adapter) return Promise.resolve({});
  const key = `${adapter.type}:${url}`;
  if (!metadataRequests.has(key)) {
    const request = Promise.resolve(adapter.resolveMetadata(url))
      .catch((error) => {
        metadataRequests.delete(key);
        throw error;
      });
    metadataRequests.set(key, request);
  }
  return metadataRequests.get(key);
}
