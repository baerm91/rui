import React, { useEffect, useMemo, useRef, useState } from 'react';
import Panzoom from '@panzoom/panzoom/dist/panzoom.es.js';
import { Box, Minus, Plus, Scan } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createStationMapGesture, createStationMapLayout, getStationMapDetail } from '../utils/stationMapLayout.js';
import './mobileStationMap.css';

const MAX_ZOOM = 8;

export function MobileStationMap({ title, stations, stationIndex, onOpenStation, viewRef }) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const headingRef = useRef(null);
  const zoomLabelRef = useRef(null);
  const controllerRef = useRef(null);
  const animationRef = useRef(null);
  const localViewRef = useRef(null);
  const savedView = viewRef || localViewRef;
  const gestureRef = useRef(createStationMapGesture());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [previewCount, setPreviewCount] = useState(0);
  const tiles = useMemo(() => createStationMapLayout(stations, size.width, size.height), [stations, size]);

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    let active = true;
    let lastPreviewCount = -1;
    const updateDetail = (scale) => {
      const detail = getStationMapDetail(scale);
      world.style.setProperty('--map-scale', scale);
      world.style.setProperty('--map-title-opacity', detail.titleOpacity);
      const titleMove = Math.max(0, Math.min(1, (scale - 1.7) / .3));
      world.style.setProperty('--map-title-position', `${50 * (1 - titleMove)}%`);
      world.style.setProperty('--map-title-offset', `${(12 + 23 * titleMove) / scale}px`);
      world.style.setProperty('--map-title-shift', `${-50 * (1 - titleMove)}%`);
      world.style.setProperty('--map-grid-progress', Math.max(0, Math.min(1, (scale - 2.85) / .6)));
      detail.previewOpacities.forEach((opacity, index) => world.style.setProperty(`--map-object-${index}`, opacity));
      if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(scale * 100)} %`;
      if (detail.previewCount !== lastPreviewCount) {
        lastPreviewCount = detail.previewCount;
        setPreviewCount(detail.previewCount);
      }
    };
    const controller = Panzoom(world, {
      canvas: true, contain: 'outside', minScale: 1, maxScale: MAX_ZOOM,
      startScale: savedView.current?.scale || 1,
      startX: savedView.current?.x || 0, startY: savedView.current?.y || 0,
      step: .45, animate: false,
      setTransform(element, { scale, x, y }) {
        if (!active) return;
        element.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
        savedView.current = { scale, x, y };
        updateDetail(scale);
      }
    });
    controllerRef.current = controller;
    const observer = new ResizeObserver(() => {
      const { width, height } = viewport.getBoundingClientRect();
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
      const { x, y } = controller.getPan();
      controller.pan(x, y, { force: true });
    });
    observer.observe(viewport);
    const stopAnimation = () => cancelAnimationFrame(animationRef.current);
    const down = (event) => {
      stopAnimation();
      gestureRef.current.start(event.pointerId, event.clientX, event.clientY);
    };
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
      observer.disconnect();
      controller.destroy();
      controllerRef.current = null;
      viewport.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
      viewport.removeEventListener('wheel', wheel);
    };
  }, [savedView]);

  const zoomTo = (target) => {
    const controller = controllerRef.current;
    if (!controller) return;
    cancelAnimationFrame(animationRef.current);
    const from = controller.getScale();
    const to = Math.max(1, Math.min(MAX_ZOOM, target));
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
    if (event.key === '+' || event.key === '=') zoomTo(controller.getScale() * 1.4);
    else if (event.key === '-') zoomTo(controller.getScale() / 1.4);
    else if (event.key === '0') zoomTo(1);
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const { x, y } = controller.getPan();
      const step = 60 / controller.getScale();
      controller.pan(x + (event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0), y + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0));
    } else return;
    event.preventDefault();
  };
  const focusTile = (event, tile) => {
    if (!event.currentTarget.matches(':focus-visible')) return;
    const controller = controllerRef.current;
    if (!controller) return;
    cancelAnimationFrame(animationRef.current);
    controller.zoom(Math.min(MAX_ZOOM, Math.max(2, Math.min(size.width * .8 / tile.width, size.height * .8 / tile.height))));
    // Pan after the new scale has painted, as required by Panzoom containment.
    animationRef.current = requestAnimationFrame(() => controller.pan(size.width / 2 - tile.x - tile.width / 2, size.height / 2 - tile.y - tile.height / 2));
  };

  return <section className="station-map" aria-labelledby="station-map-title">
    <header className="station-map-heading"><div><span>{title || 'Ihre Ausstellung'}</span><h1 id="station-map-title" ref={headingRef} tabIndex={-1}>Raumübersicht</h1></div><small>{stations.length} {stations.length === 1 ? 'Station' : 'Stationen'}</small></header>
    <div ref={viewportRef} className="station-map-viewport" role="region" aria-label="Stationskarte, mit Plus und Minus zoomen und mit Pfeiltasten verschieben" tabIndex={0} onKeyDown={handleKey}>
      <div ref={worldRef} className="station-map-world">
        {tiles.map((tile) => {
          const station = stations[tile.index];
          const items = station.items.slice(0, 6);
          const columns = Math.min(2, Math.max(1, items.length));
          const rows = Math.ceil(items.length / columns) || 1;
          return <button key={station.id} type="button" className={`station-map-stone stone-${tile.index % 6} ${tile.index === stationIndex ? 'is-current' : ''}`}
            style={{ left: `${tile.x / size.width * 100}%`, top: `${tile.y / size.height * 100}%`, width: `${tile.width / size.width * 100}%`, height: `${tile.height / size.height * 100}%` }}
            aria-label={`Station ${tile.index + 1}: ${station.title} öffnen, ${station.items.length} ${station.items.length === 1 ? 'Objekt' : 'Objekte'}`}
            onFocus={(event) => focusTile(event, tile)}
            onClick={(event) => { if (event.detail === 0 || gestureRef.current.canOpen()) onOpenStation(tile.index); else event.preventDefault(); }}>
            <span className="station-map-stone-face" aria-hidden="true">
              <span className="station-map-number">{String(tile.index + 1).padStart(2, '0')}</span>
              <span className="station-map-stone-title">{station.title}</span>
              <span className="station-map-previews">
                {items.map((item, index) => {
                  const src = resolveSpatialThumbnailUrl(item);
                  return <span key={item.id} className="station-map-preview" style={{
                    opacity: `var(--map-object-${index}, 0)`,
                    left: `${index % columns / columns * 100}%`, top: `${Math.floor(index / columns) / rows * 100}%`,
                    width: index === 0 ? `calc(100% - ${100 - 100 / columns}% * var(--map-grid-progress, 0))` : `${100 / columns}%`,
                    height: index === 0 ? `calc(100% - ${100 - 100 / rows}% * var(--map-grid-progress, 0))` : `${100 / rows}%`
                  }}>
                    <span className="station-map-preview-image"><Box aria-hidden="true" />{previewCount > index && src && <LazyImage key={src} src={src} />}</span>
                    <span>{item.title}</span>
                  </span>;
                })}
              </span>
              <span className="station-map-count">{station.items.length ? `${station.items.length} ${station.items.length === 1 ? 'Objekt' : 'Objekte'} · Station öffnen` : 'Station öffnen'}</span>
            </span>
          </button>;
        })}
      </div>
    </div>
    <div className="station-map-tools" aria-label="Zoomsteuerung"><button type="button" onClick={() => zoomTo((controllerRef.current?.getScale() || 1) / 1.4)} aria-label="Herauszoomen"><Minus size={20} /></button><button type="button" onClick={() => zoomTo(1)} aria-label="Alle Stationen anzeigen"><Scan size={17} /><span ref={zoomLabelRef}>100 %</span></button><button type="button" onClick={() => zoomTo((controllerRef.current?.getScale() || 1) * 1.4)} aria-label="Heranzoomen"><Plus size={20} /></button></div>
    <p className="station-map-instructions">Ziehen zum Verschieben · Zwei Finger zum Zoomen<br /><span>Eine Kachel antippen, um die Station zu öffnen</span></p>
  </section>;
}
