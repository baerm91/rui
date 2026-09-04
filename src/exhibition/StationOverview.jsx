import React, { useEffect, useMemo, useRef, useState } from 'react';
import Panzoom from '@panzoom/panzoom';
import { ArrowUpRight, Box, Minus, Plus, RotateCcw } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createStationMapGesture } from '../utils/stationMapLayout.js';
import { createCobblestoneLayout } from '../utils/cobblestoneLayout.js';
import './stationOverview.css';

export function StationOverview({ title, stations, onOpenStation, onOpenItem, mapViewRef }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const headingRef = useRef(null);
  const panzoomRef = useRef(null);
  const gesture = useRef(createStationMapGesture());
  const leaveTimer = useRef(null);
  const [active, setActive] = useState(null);
  const [zoom, setZoom] = useState(mapViewRef?.current?.scale || 1);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const tiles = useMemo(() => createCobblestoneLayout(stations, size.width, size.height), [stations, size]);
  const activate = (index) => { clearTimeout(leaveTimer.current); setActive(index); };
  const release = () => { clearTimeout(leaveTimer.current); leaveTimer.current = setTimeout(() => setActive(null), 100); };

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    const viewport = viewportRef.current;
    const observer = new ResizeObserver(() => {
      const { width, height } = viewport.getBoundingClientRect();
      if (width && height) setSize({ width, height });
    });
    observer.observe(viewport);
    return () => { observer.disconnect(); clearTimeout(leaveTimer.current); };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saved = mapViewRef?.current;
    const panzoom = Panzoom(canvas, {
      canvas: true, minScale: .75, maxScale: 2, startScale: saved?.scale || 1,
      startX: saved?.x || 0, startY: saved?.y || 0,
      duration: 240, easing: 'ease-out', panOnlyWhenZoomed: true,
      handleStartEvent: (event) => event.preventDefault(),
    });
    panzoomRef.current = panzoom;
    const wheel = (event) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const delta = (event.deltaY || event.deltaX) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
      const scale = Math.max(.75, Math.min(2, panzoom.getScale() * Math.exp(-Math.max(-120, Math.min(120, delta)) * .002)));
      panzoom.zoom(scale, {
        animate: !reducedMotion.matches,
        focal: { x: (event.clientX - bounds.left - bounds.width / 2) * scale, y: (event.clientY - bounds.top - bounds.height / 2) * scale },
      });
    };
    const change = (event) => {
      const { scale, x, y } = event.detail;
      setZoom(scale);
      if (mapViewRef) mapViewRef.current = { scale, x, y };
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('panzoomchange', change);
    return () => {
      viewport.removeEventListener('wheel', wheel);
      canvas.removeEventListener('panzoomchange', change);
      panzoom.destroy();
      panzoomRef.current = null;
    };
  }, [mapViewRef]);

  const adjustZoom = (amount) => {
    const options = { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches };
    if (!amount) { panzoomRef.current?.zoom(1, options); panzoomRef.current?.pan(0, 0, { ...options, force: true }); }
    else panzoomRef.current?.zoom(panzoomRef.current.getScale() + amount, options);
  };

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
    <div ref={viewportRef} className="topic-cluster-viewport" role="region" aria-label="Modelle der Ausstellung. Mausrad zum Zoomen, Ziehen zum Verschieben." tabIndex={0}
      onPointerLeave={release} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) release(); }}
      onPointerDownCapture={(event) => gesture.current.start(event.pointerId, event.clientX, event.clientY)}
      onPointerMoveCapture={(event) => gesture.current.move(event.pointerId, event.clientX, event.clientY)}
      onPointerUpCapture={(event) => gesture.current.end(event.pointerId)} onPointerCancel={() => gesture.current.cancel()}
      onKeyDown={(event) => {
        if (['+', '=', '-', '0', 'Escape'].includes(event.key)) {
          event.preventDefault();
          if (event.key === 'Escape') activate(null);
          else adjustZoom(event.key === '-' ? -.15 : event.key === '0' ? 0 : .15);
        }
      }}>
      <div ref={canvasRef} className="topic-cluster-canvas">
        {tiles.map((tile) => {
          const station = stations[tile.stationIndex];
          const item = station.items[tile.itemIndex];
          const src = item && resolveSpatialThumbnailUrl(item);
          const focused = active === tile.stationIndex;
          return <button type="button" key={`${station.id}:${item?.id || 'empty'}`} data-station-index={tile.stationIndex}
            className={`topic-cluster-tile${focused ? ' is-active' : ''}${active !== null && !focused ? ' is-muted' : ''}`}
            style={{ left: tile.x, top: tile.y, width: tile.width, height: tile.height }}
            aria-label={`${station.title}: ${item?.title || item?.name || 'Thema betreten'}`}
            onPointerEnter={(event) => { if (event.pointerType !== 'touch' && !event.buttons) activate(tile.stationIndex); }}
            onFocus={() => activate(tile.stationIndex)}
            onClick={(event) => {
              if (!gesture.current.canOpen() && event.detail !== 0) return;
              if (event.nativeEvent.pointerType === 'touch' && !focused) { activate(tile.stationIndex); return; }
              if (item && onOpenItem) onOpenItem(tile.stationIndex, item.id);
              else onOpenStation(tile.stationIndex);
            }}>
            <Box className="topic-cluster-placeholder" size={30} aria-hidden="true" />
            {src && <LazyImage key={src} src={src} />}
            <span className="topic-cluster-caption"><small>THEMA {String(tile.stationIndex + 1).padStart(2, '0')}</small><strong>{station.title}</strong><ArrowUpRight size={18} aria-hidden="true" /></span>
          </button>;
        })}
      </div>
      {!tiles.length && <p className="topic-cluster-empty">Diese Ausstellung enthält noch keine Themen.</p>}
    </div>
    <footer className="topic-cluster-footer">
      <p>Über ein Modell fahren, um sein Thema zu entdecken <span>· Mausrad zum Zoomen · Ziehen zum Verschieben</span></p>
      <div className="topic-cluster-zoom" role="group" aria-label="Ansicht zoomen">
        <button type="button" aria-label="Herauszoomen" disabled={zoom <= .751} onClick={() => adjustZoom(-.15)}><Minus size={16} /></button>
        <output aria-label="Zoomstufe">{Math.round(zoom * 100)} %</output>
        <button type="button" aria-label="Hineinzoomen" disabled={zoom >= 1.999} onClick={() => adjustZoom(.15)}><Plus size={16} /></button>
        <button type="button" aria-label="Ansicht zurücksetzen" onClick={() => adjustZoom(0)}><RotateCcw size={15} /></button>
      </div>
    </footer>
  </section>;
}
