import React, { useEffect, useMemo, useRef, useState } from 'react';
import Panzoom from '@panzoom/panzoom/dist/panzoom.es.js';
import { Box, Minus, Plus, Scan } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createStationMapGesture, createStationMapLayout, createImageMosaicLayout, getStationMapMaxZoom, projectStationTile } from '../utils/stationMapLayout.js';
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
  const [imageRatios, setImageRatios] = useState({});
  const stationImages = useMemo(() => stations.map((station) => station.items.map((item) => ({ key: item.id, src: resolveSpatialThumbnailUrl(item) }))), [stations]);
  const tiles = useMemo(() => createStationMapLayout(stations, size.width, size.height).map((tile) => ({
    ...tile,
    images: createImageMosaicLayout(stationImages[tile.index].map((image) => imageRatios[image.src] || 1), tile.width, tile.height)
  })), [stations, stationImages, imageRatios, size]);
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
        // Images keep their geometry while panning; the viewport clips the
        // mosaic instead of stretching each image into its visible remainder.
        tiles.forEach((tile) => {
          const rect = projectStationTile(tile, size.width, size.height, view);
          const button = tileRefs.current[tile.index];
          if (!button) return;
          const hidden = rect.width < 2 || rect.height < 2;
          if (hidden && document.activeElement === button) viewport.focus({ preventScroll: true });
          button.hidden = hidden;
          button.style.left = `${size.width / 2 + (tile.x - size.width / 2 + x) * scale}px`;
          button.style.top = `${size.height / 2 + (tile.y - size.height / 2 + y) * scale}px`;
          button.style.width = `${tile.width * scale}px`;
          button.style.height = `${tile.height * scale}px`;
          // Anchor the station name to the visible part of its image group.
          // Unlike the images, it must not disappear offscreen while panning.
          const left = size.width / 2 + (tile.x - size.width / 2 + x) * scale;
          const top = size.height / 2 + (tile.y - size.height / 2 + y) * scale;
          button.style.setProperty('--label-left', `${rect.x - left + 8}px`);
          button.style.setProperty('--label-top', `${rect.y - top + 8}px`);
          button.style.setProperty('--label-width', `${Math.max(0, rect.width - 16)}px`);
        });
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
    <header className="station-map-heading"><div><span>{title || 'Ihre Ausstellung'}</span><h1 id="station-map-title" ref={headingRef} tabIndex={-1}>Raumübersicht</h1></div><small>{stations.length} {stations.length === 1 ? 'Station' : 'Stationen'}</small></header>
    <div ref={viewportRef} className="station-map-viewport" role="region" aria-label="Stationskarte, mit Plus und Minus zoomen und mit Pfeiltasten verschieben" tabIndex={0} onKeyDown={handleKey}>
      <div ref={worldRef} className="station-map-world" aria-hidden="true" />
      <div className="station-map-content">
        {tiles.map((tile) => {
          const station = stations[tile.index];
          return <button key={station.id} ref={(element) => { tileRefs.current[tile.index] = element; }} type="button" className={`station-map-stone stone-${tile.index % 6} ${tile.index === stationIndex ? 'is-current' : ''}`}
            style={{ left: `${tile.x / size.width * 100}%`, top: `${tile.y / size.height * 100}%`, width: `${tile.width / size.width * 100}%`, height: `${tile.height / size.height * 100}%` }}
            aria-label={`Station ${tile.index + 1}: ${station.title} öffnen`}
            onClick={(event) => { if (event.detail === 0 || gestureRef.current.canOpen()) onOpenStation(tile.index); else event.preventDefault(); }}>
            <span className="station-map-stone-face" aria-hidden="true">
              {!tile.images.length && <Box size={28} />}
              {tile.images.map((imageTile) => {
                const entry = stationImages[tile.index][imageTile.index];
                return <span key={entry.key} className="station-map-image" style={{ left: `${imageTile.x / tile.width * 100}%`, top: `${imageTile.y / tile.height * 100}%`, width: `${imageTile.width / tile.width * 100}%`, height: `${imageTile.height / tile.height * 100}%` }}><Box size={28} />{entry.src && <LazyImage key={entry.src} src={entry.src} onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (!naturalWidth || !naturalHeight) return;
                  const ratio = naturalWidth / naturalHeight;
                  setImageRatios((current) => current[entry.src] === ratio ? current : { ...current, [entry.src]: ratio });
                }} />}</span>;
              })}
              <span className="station-map-station-name">{station.title}</span>
            </span>
          </button>;
        })}
      </div>
    </div>
    <div className="station-map-navigation">
      <div className="station-map-tools" aria-label="Zoomsteuerung"><button ref={zoomOutRef} type="button" onClick={() => zoomTo((controllerRef.current?.getScale() || 1) / 1.3)} aria-label="Herauszoomen"><Minus size={18} /></button><button type="button" onClick={() => zoomTo(1)} aria-label="Alle Stationen anzeigen"><Scan size={17} /><span>Alle Stationen</span><small ref={zoomLabelRef}>100 %</small></button><button ref={zoomInRef} type="button" onClick={() => zoomTo((controllerRef.current?.getScale() || 1) * 1.3)} aria-label="Heranzoomen"><Plus size={18} /></button></div>
      <select className="station-map-direct" aria-label="Station direkt öffnen" value="" onChange={(event) => { if (event.target.value !== '') onOpenStation(Number(event.target.value)); }}><option value="">Station direkt öffnen …</option>{stations.map((station, index) => <option key={station.id} value={index}>{String(index + 1).padStart(2, '0')} · {station.title}</option>)}</select>
    </div>

  </section>;
}
