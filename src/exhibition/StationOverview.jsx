import React, { useEffect, useRef } from 'react';
import { ArrowUpRight, Box } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import './stationOverview.css';

export function StationOverview({ title, stations, stationIndex, onOpenStation, onOpenItem }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);

  return <section className="station-overview" aria-labelledby="station-overview-title">
    <div className="station-overview-intro">
      <div><span className="station-overview-eyebrow">{title || 'Ihre Ausstellung'}</span>
        <h1 id="station-overview-title" ref={headingRef} tabIndex={-1}>Raumübersicht</h1>
        <p>Wählen Sie eine Station oder entdecken Sie ein Objekt direkt.</p>
      </div>
      <span className="station-overview-total">{stations.length} {stations.length === 1 ? 'Station' : 'Stationen'}</span>
    </div>
    <div className="station-overview-grid">
      {stations.map((station, index) => {
        const count = station.items.length;
        const size = count >= 7 ? 'expansive' : count >= 4 ? 'large' : count >= 2 ? 'wide' : 'compact';
        const previewItems = station.items.slice(0, 9);
        return <article key={station.id} className={`station-overview-tile is-${size}`} aria-labelledby={`overview-station-${index}`}>
          <div className="station-overview-meta"><span>Station {String(index + 1).padStart(2, '0')}</span><span>{count} {count === 1 ? 'Objekt' : 'Objekte'}</span></div>
          <h2 id={`overview-station-${index}`}>
            <button type="button" className="station-overview-open" onClick={() => onOpenStation(index)} aria-label={`Station ${index + 1}: ${station.title} öffnen`}>
              {station.title}<ArrowUpRight size={22} aria-hidden="true" />
            </button>
          </h2>
          {count ? <div className="station-overview-objects" style={{ '--preview-columns': Math.min(count, size === 'compact' ? 1 : 3) }}>
            {previewItems.map((item) => {
              const src = resolveSpatialThumbnailUrl(item);
              return <button type="button" className="station-overview-object" key={item.id} onClick={() => onOpenItem(index, item.id)} aria-label={`${item.title} öffnen`}>
                <span className="station-overview-image"><Box size={28} aria-hidden="true" />{src && <LazyImage key={src} src={src} />}</span>
                <span className="station-overview-object-title">{item.title}</span>
              </button>;
            })}
          </div> : <p className="station-overview-empty"><Box size={32} aria-hidden="true" />Diese Station wird noch kuratiert.</p>}
          <div className="station-overview-tile-footer" aria-hidden="true"><span>{count > previewItems.length ? `+ ${count - previewItems.length} weitere Objekte` : index === stationIndex ? 'Aktuelle Station' : 'Entdecken'}</span><span>Station öffnen <ArrowUpRight size={15} /></span></div>
        </article>;
      })}
    </div>
  </section>;
}
