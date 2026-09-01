import { getSketchfabEmbedUrl, getSketchfabModelUid } from './modelSource.js';
import { getSpatialSourceType } from './spatialStory.js';

export const MODEL_SOURCE_ADAPTERS = {
  sketchfab: {
    type: 'sketchfab',
    transparentViewer: true,
    getViewerUrl: (url) => `${getSketchfabEmbedUrl(url)}&transparent=1&ui_infos=0&ui_controls=0&ui_watermark=0`,
    async resolveMetadata(url) {
      const uid = getSketchfabModelUid(url);
      const [oembedResponse, modelResponse] = await Promise.all([
        fetch(`https://sketchfab.com/oembed?url=${encodeURIComponent(url)}`).catch(() => null),
        uid ? fetch(`https://api.sketchfab.com/v3/models/${uid}`).catch(() => null) : Promise.resolve(null)
      ]);
      if (!oembedResponse?.ok && !modelResponse?.ok) throw new Error('Sketchfab-Metadaten konnten nicht geladen werden.');
      const [oembed, model] = await Promise.all([
        oembedResponse?.ok ? oembedResponse.json().catch(() => ({})) : {},
        modelResponse?.ok ? modelResponse.json().catch(() => ({})) : {}
      ]);
      const providerThumbnail = (model.thumbnails?.images || []).reduce((largest, candidate) => (
        Number(candidate.width || 0) > Number(largest.width || 0) ? candidate : largest
      ), {});
      return {
        title: model.name || oembed.title || '',
        providerThumbnailUrl: oembed.thumbnail_url || providerThumbnail.url || '',
        attribution: model.user?.displayName || oembed.author_name || '',
        attributionUrl: model.user?.profileUrl || oembed.author_url || '',
        license: model.license?.label || '',
        licenseUrl: String(model.license?.url || '').replace(/^http:/, 'https:'),
        sourceUrl: model.viewerUrl || url
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
