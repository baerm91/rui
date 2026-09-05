import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Box } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createCobblestoneLayout } from '../utils/cobblestoneLayout.js';
import './stationOverview.css';

export function StationOverview({ title, stations, onOpenStation, onOpenItem }) {
  const viewportRef = useRef(null);
  const headingRef = useRef(null);
  const leaveTimer = useRef(null);
  const [active, setActive] = useState(null);
  const [width, setWidth] = useState(1200);
  const tiles = useMemo(() => createCobblestoneLayout(stations, width), [stations, width]);
  const contentHeight = Math.max(0, ...tiles.map((tile) => tile.y + tile.height)) + 24;
  const activate = (index) => { clearTimeout(leaveTimer.current); setActive(index); };
  const release = () => { clearTimeout(leaveTimer.current); leaveTimer.current = setTimeout(() => setActive(null), 100); };

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    const viewport = viewportRef.current;
    const observer = new ResizeObserver(() => {
      if (viewport.clientWidth) setWidth(viewport.clientWidth);
    });
    observer.observe(viewport);
    return () => { observer.disconnect(); clearTimeout(leaveTimer.current); };
  }, []);

  return <section className="topic-cluster" aria-labelledby="topic-cluster-title">
    <header className="topic-cluster-heading">
      <div><span>{title || 'Ihre Ausstellung'}</span><h1 id="topic-cluster-title" ref={headingRef} tabIndex={-1}>Themenüberblick</h1></div>
      <small>{stations.length} Themen · {stations.reduce((sum, station) => sum + station.items.length, 0)} Modelle</small>
    </header>
    <nav className="topic-cluster-index" aria-label="Themen auswählen" onPointerLeave={release} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) release(); }}>
      <button type="button" className={active === null ? 'is-active' : ''} onPointerEnter={() => activate(null)} onFocus={() => activate(null)} onClick={() => activate(null)}>Alle Modelle</button>
      {stations.map((station, index) => <button type="button" key={station.id} className={active === index ? 'is-active' : ''}
        onPointerEnter={() => activate(index)} onFocus={() => activate(index)} onClick={() => onOpenStation(index)}>
        <span>{String(index + 1).padStart(2, '0')}</span>{station.title}<small>{station.items.length}</small>
      </button>)}
    </nav>
    <div ref={viewportRef} className="topic-cluster-viewport" role="region" aria-label="Modelle der Ausstellung" tabIndex={0}
      onPointerLeave={release} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) release(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') activate(null); }}>
      <div className="topic-cluster-canvas" style={{ height: contentHeight }}>
        {tiles.map((tile) => {
          const station = stations[tile.stationIndex];
          const item = station.items[tile.itemIndex];
          const src = item && resolveSpatialThumbnailUrl(item);
          const focused = active === tile.stationIndex;
          return <button type="button" key={`${station.id}:${item?.id || 'empty'}`} data-station-index={tile.stationIndex}
            className={`topic-cluster-tile${focused ? ' is-active' : ''}${active !== null && !focused ? ' is-muted' : ''}`}
            style={{ left: tile.x, top: tile.y, width: tile.width, height: tile.height }}
            aria-label={`${station.title}: ${item?.title || item?.name || 'Thema betreten'}`} aria-haspopup="dialog"
            onPointerEnter={(event) => { if (event.pointerType !== 'touch') activate(tile.stationIndex); }}
            onFocus={() => activate(tile.stationIndex)}
            onClick={() => { if (item && onOpenItem) onOpenItem(tile.stationIndex, item.id); else onOpenStation(tile.stationIndex); }}>
            <span className="topic-cluster-image"><Box className="topic-cluster-placeholder" size={30} aria-hidden="true" />{src && <LazyImage key={src} src={src} />}</span>
            <span className="topic-cluster-number" aria-hidden="true">{String(tile.stationIndex + 1).padStart(2, '0')}</span>
            <span className="topic-cluster-caption"><span><small>{station.title}</small><strong>{item?.title || item?.name || station.title}</strong></span><ArrowUpRight size={16} aria-hidden="true" /></span>
          </button>;
        })}
      </div>
      {!tiles.length && <p className="topic-cluster-empty">Diese Ausstellung enthält noch keine Themen.</p>}
    </div>
    <p className="topic-cluster-hint">Ein Objekt oder Thema auswählen, um die Sammlung zu öffnen.</p>
  </section>;
}
