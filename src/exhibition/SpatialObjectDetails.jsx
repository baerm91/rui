import React from 'react';
import { ExternalLink } from 'lucide-react';

const safeExternalUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

export function SpatialObjectDetails({ item, className = '', showTitle = true, showDescription = true, showRights = true, showSource = true }) {
  if (!item) return null;
  const sourceUrl = safeExternalUrl(item.sourceType === 'sketchfab' ? (item.sourceUrl || item.modelUrl) : item.sourceUrl);
  const attributionUrl = safeExternalUrl(item.attributionUrl);
  const licenseUrl = safeExternalUrl(item.licenseUrl);

  return <div className={className}>
    {showTitle && <b>{item.title}</b>}
    {showDescription && item.description && <p className="spatial-object-description">{item.description}</p>}
    {showRights && (item.attribution || item.license) && <div className="spatial-object-rights" aria-label="Urheber und Lizenz">
      {item.attribution && (attributionUrl
        ? <a href={attributionUrl} target="_blank" rel="noreferrer">{item.attribution}</a>
        : <span>{item.attribution}</span>)}
      {item.license && (licenseUrl
        ? <a href={licenseUrl} target="_blank" rel="noreferrer">{item.license}</a>
        : <span>{item.license}</span>)}
    </div>}
    {showSource && sourceUrl && <a className="spatial-object-source" href={sourceUrl} target="_blank" rel="noreferrer">
      {item.sourceType === 'sketchfab' ? 'Auf Sketchfab ansehen' : 'Originalquelle öffnen'}
      <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
    </a>}
  </div>;
}
