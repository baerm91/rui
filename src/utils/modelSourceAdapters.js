import { getSketchfabEmbedUrl } from './modelSource.js';
import { getSpatialSourceType } from './spatialStory.js';

export const MODEL_SOURCE_ADAPTERS = {
  sketchfab: {
    type: 'sketchfab',
    transparentViewer: true,
    getViewerUrl: (url) => `${getSketchfabEmbedUrl(url)}&transparent=1&ui_infos=0&ui_controls=0&ui_watermark=0`,
    async resolveMetadata(url) {
      const response = await fetch(`https://sketchfab.com/oembed?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Sketchfab-Metadaten konnten nicht geladen werden.');
      const data = await response.json();
      return { title: data.title || '', thumbnailUrl: data.thumbnail_url || '', attribution: data.author_name || '' };
    }
  },
  gltf: {
    type: 'gltf',
    transparentViewer: false,
    getViewerUrl: (url) => url,
    async resolveMetadata() { return {}; }
  }
};

export function getModelSourceAdapter(urlOrType) {
  const type = MODEL_SOURCE_ADAPTERS[urlOrType] ? urlOrType : getSpatialSourceType(urlOrType);
  return MODEL_SOURCE_ADAPTERS[type] || null;
}

