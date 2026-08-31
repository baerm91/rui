import React, { useEffect, useMemo, useRef, useState } from 'react';
import Panzoom from '@panzoom/panzoom/dist/panzoom.es.js';
import { ArrowUpRight, Box, Minus, Plus, Scan } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createStationMapGesture, createStationMapLayout, getStationMapMaxZoom, getStationPreviewCapacity, projectStationTile } from '../utils/stationMapLayout.js';
import './mobileStationMap.css';

export function StationMap({ title, stations, stationIndex, onOpenStation, viewRef }) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const headingRef = useRef(null);
  const zoomLabelRef = useRef(null);
  const zoomOutRef = useRef(null);
  const zoomInRef = useRef(null);
  const tileRefs = useRef([]);
  const controllerRef = useRef(null);
  const animationRef = useRef(null);
  const localViewRef = useRef(null);
  const savedView = viewRef || localViewRef;
  const gestureRef = useRef(createStationMapGesture());
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [previewCounts, setPreviewCounts] = useState([]);
  const tiles = useMemo(() => createStationMapLayout(stations, size.width, size.height), [stations, size]);
  const maxZoom = useMemo(() => getStationMapMaxZoom(tiles, size.width, size.height), [tiles, size]);

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const { width, height } = viewportRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) setSize((current) => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    let active = true;
    let previousCounts = '';
    const controller = Panzoom(world, {
      canvas: true, contain: 'outside', minScale: 1, maxScale: maxZoom,
      startScale: Math.min(maxZoom, savedView.current?.scale || 1),
      startX: savedView.current?.x || 0, startY: savedView.current?.y || 0,
      step: .25, animate: false,
      setTransform(element, view) {
        if (!active) return;
        const { scale, x, y } = view;
        element.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
        savedView.current = { scale, x, y };
        // Keep content in the visible part of each station, in screen pixels.
        // Panning never pushes a station's title or entry point off its tile.
        const counts = tiles.map((tile) => {
          const rect = projectStationTile(tile, size.width, size.height, view);
          const button = tileRefs.current[tile.index];
          const hidden = rect.width < 2 || rect.height < 2;
          const compact = rect.width < 110 || rect.height < 140;
          const count = hidden || compact ? 0 : getStationPreviewCapacity(Math.min(size.width, tile.width * scale), Math.min(size.height, tile.height * scale), stations[tile.index].items.length);
          const columns = Math.min(count || 1, Math.max(1, Math.floor(rect.width / 160)));
          if (button) {
            if (hidden && document.activeElement === button) viewport.focus({ preventScroll: true });
            button.hidden = hidden;
            button.style.left = `${rect.x}px`;
            button.style.top = `${rect.y}px`;
            button.style.width = `${rect.width}px`;
            button.style.height = `${rect.height}px`;
            button.dataset.compact = String(compact);
            button.style.setProperty('--preview-columns', columns);
            button.style.setProperty('--last-span', count % columns ? columns - count % columns + 1 : 1);
          }
          // Detail density follows zoom, not the constantly changing crop while
          // dragging. Offscreen stations still mount no images.
          return count;
        });
        const signature = counts.join(',');
        if (signature !== previousCounts) { previousCounts = signature; setPreviewCounts(counts); }
        if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(scale * 100)} %`;
        if (zoomOutRef.current) zoomOutRef.current.disabled = scale <= 1.001;
        if (zoomInRef.current) zoomInRef.current.disabled = scale >= maxZoom - .001;
      }
    });
    controllerRef.current = controller;
    const stopAnimation = () => cancelAnimationFrame(animationRef.current);
    const down = (event) => { stopAnimation(); gestureRef.current.start(event.pointerId, event.clientX, event.clientY); };
    const move = (event) => gestureRef.current.move(event.pointerId, event.clientX, event.clientY);
    const up = (event) => gestureRef.current.end(event.pointerId);
    const cancel = () => gestureRef.current.cancel();
    const wheel = (event) => { stopAnimation(); controller.zoomWithWheel(event); };
    viewport.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => {
      active = false;
      stopAnimation();
      controller.destroy();
      controllerRef.current = null;
      viewport.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
      viewport.removeEventListener('wheel', wheel);
    };
  }, [savedView, tiles, size, maxZoom, stations]);

  const zoomTo = (target) => {
    const controller = controllerRef.current;
    if (!controller) return;
    cancelAnimationFrame(animationRef.current);
    const from = controller.getScale();
    const to = Math.max(1, Math.min(maxZoom, target));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { controller.zoom(to); return; }
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 220);
      controller.zoom(from + (to - from) * (1 - (1 - progress) ** 3));
      if (progress < 1) animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  };
  const handleKey = (event) => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (event.key === '+' || event.key === '=') zoomTo(controller.getScale() * 1.3);
    else if (event.key === '-') zoomTo(controller.getScale() / 1.3);
    else if (event.key === '0' || event.key === 'Escape') zoomTo(1);
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const { x, y } = controller.getPan();
      const step = 60 / controller.getScale();
      controller.pan(x + (event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0), y + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0));
    } else return;
    event.preventDefault();
  };

  return <section className="station-map" aria-labelledby="station-map-title">
    <header className="station-map-heading"><div><span>{title || 'Ihre Ausstellung'}</span><h1 id="station-map-title" ref={headingRef} tabIndex={-1}>Raumübersicht</h1><p>Wählen Sie eine Station und entdecken Sie ihre Objekte.</p></div><small>{stations.length} {stations.length === 1 ? 'Station' : 'Stationen'}</small></header>
    <div ref={viewportRef} className="station-map-viewport" role="region" aria-label="Stationskarte, mit Plus und Minus zoomen und mit Pfeiltasten verschieben" tabIndex={0} onKeyDown={handleKey}>
      <div ref={worldRef} className="station-map-world" aria-hidden="true" />
      <div className="station-map-content">
        {tiles.map((tile) => {
          const station = stations[tile.index];
          const count = previewCounts[tile.index] ?? getStationPreviewCapacity(tile.width, tile.height, station.items.length);
          const items = station.items.slice(0, count);
          return <button key={station.id} ref={(element) => { tileRefs.current[tile.index] = element; }} type="button" className={`station-map-stone stone-${tile.index % 6} ${tile.index === stationIndex ? 'is-current' : ''}`}
            style={{ left: `${tile.x / size.width * 100}%`, top: `${tile.y / size.height * 100}%`, width: `${tile.width / size.width * 100}%`, height: `${tile.height / size.height * 100}%` }}
            aria-label={`Station ${tile.index + 1}: ${station.title} öffnen, ${station.items.length} ${station.items.length === 1 ? 'Objekt' : 'Objekte'}`}
            onClick={(event) => { if (event.detail === 0 || gestureRef.current.canOpen()) onOpenStation(tile.index); else event.preventDefault(); }}>
            <span className="station-map-stone-face" aria-hidden="true">
              <span className="station-map-tile-heading"><span className="station-map-number">Station {String(tile.index + 1).padStart(2, '0')}</span><span className="station-map-stone-title">{station.title}</span></span>
              {items.length > 0 && <span className="station-map-previews" data-count={items.length}>
                {items.map((item) => {
                  const src = resolveSpatialThumbnailUrl(item);
                  return <span key={item.id} className="station-map-preview"><span className="station-map-preview-image"><Box aria-hidden="true" />{src && <LazyImage key={src} src={src} />}</span><span className="station-map-preview-caption">{item.title}</span></span>;
                })}
              </span>}
              {!station.items.length && <span className="station-map-empty">Diese Station wird noch kuratiert.</span>}
              <span className="station-map-tile-footer"><span>{station.items.length} {station.items.length === 1 ? 'Objekt' : 'Objekte'}{station.items.length > count && count > 0 ? ` · ${count} gezeigt` : ''}</span><span className="station-map-open">Station öffnen <ArrowUpRight size={16} /></span></span>
            </span>
          </button>;
        })}
      </div>
    </div>
    <div className="station-map-navigation">
      <div className="station-map-tools" aria-label="Zoomsteuerung"><button ref={zoomOutRef} type="button" onClick={() => zoomTo((controllerRef.current?.getScale() || 1) / 1.3)} aria-label="Herauszoomen"><Minus size={18} /></button><button type="button" onClick={() => zoomTo(1)} aria-label="Alle Stationen anzeigen"><Scan size={17} /><span>Alle Stationen</span><small ref={zoomLabelRef}>100 %</small></button><button ref={zoomInRef} type="button" onClick={() => zoomTo((controllerRef.current?.getScale() || 1) * 1.3)} aria-label="Heranzoomen"><Plus size={18} /></button></div>
      <select className="station-map-direct" aria-label="Station direkt öffnen" value="" onChange={(event) => { if (event.target.value !== '') onOpenStation(Number(event.target.value)); }}><option value="">Station direkt öffnen …</option>{stations.map((station, index) => <option key={station.id} value={index}>{String(index + 1).padStart(2, '0')} · {station.title}</option>)}</select>
    </div>
    <p className="station-map-instructions">Kachel anklicken zum Öffnen · Ziehen zum Verschieben · Mausrad oder zwei Finger zum Zoomen</p>
  </section>;
}
