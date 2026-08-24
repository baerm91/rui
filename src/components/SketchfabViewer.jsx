import React from 'react';
import { getSketchfabEmbedUrl } from '../utils/modelSource.js';

export function SketchfabViewer({ modelUrl, title }) {
  const embedUrl = getSketchfabEmbedUrl(modelUrl);
  if (!embedUrl) return null;

  return (
    <div className="sketchfab-viewer" data-testid="sketchfab-viewer">
      <iframe
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        src={embedUrl}
        title={`Sketchfab-Modell: ${title || '3D-Modell'}`}
      />
    </div>
  );
}
