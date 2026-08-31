import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Minus, Plus, Scan } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createStationMapGesture, createStationMapLayout, createImageMosaicLayout, getSemanticPreviewCount } from '../utils/stationMapLayout.js';
import './mobileStationMap.css';

export function StationMap({ title, stations, stationIndex, onOpenStation, viewRef }) {
  const viewportRef = useRef(null);
  const headingRef = useRef(null);
  const localViewRef = useRef(null);
  const savedView = viewRef || localViewRef;
  const gestureRef = useRef(createStationMapGesture());
  const view = useRef({ focusIndex: savedView.current?.focusIndex ?? stationIndex ?? 0, progress: savedView.current?.progress || 0 });
  const [detail, setDetail] = useState(view.current);
  const candidateRef = useRef(view.current.focusIndex);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [imageRatios, setImageRatios] = useState({});
  const stationImages = useMemo(() => stations.map((station) => station.items.map((item) => ({ key: item.id, src: resolveSpatialThumbnailUrl(item) }))), [stations]);
  const tiles = useMemo(() => createStationMapLayout(stations, size.width, size.height, detail).map((tile) => {
    const count = getSemanticPreviewCount(stationImages[tile.index].length, tile.index === detail.focusIndex ? detail.progress : 0);
    return { ...tile, images: createImageMosaicLayout(stationImages[tile.index].slice(0, count).map((image) => imageRatios[image.src] || 1), tile.width, tile.height) };
  }), [stations, stationImages, imageRatios, size, detail]);

  const changeDetail = (focusIndex, progress) => {
    const next = { focusIndex, progress: Math.max(0, Math.min(1, progress)) };
    view.current = next;
    savedView.current = next;
    setDetail(next);
  };
  const zoomBy = (amount, focusIndex = candidateRef.current) => {
    const current = view.current;
    changeDetail(focusIndex, (focusIndex === current.focusIndex ? current.progress : 0) + amount);
  };

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
    const pointers = new Map();
    let pinch = null;
    const stationAt = (target) => {
      const button = target.closest?.('[data-station-index]');
      return button ? Number(button.dataset.stationIndex) : candidateRef.current;
    };
    const distance = () => {
      const [first, second] = [...pointers.values()];
      return Math.hypot(first.x - second.x, first.y - second.y);
    };
    const update = (focusIndex, progress) => {
      const next = { focusIndex, progress: Math.max(0, Math.min(1, progress)) };
      view.current = next;
      savedView.current = next;
      setDetail(next);
    };
    const down = (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      gestureRef.current.start(event.pointerId, event.clientX, event.clientY);
      if (pointers.size === 1) candidateRef.current = stationAt(event.target);
      if (pointers.size === 2) {
        pinch = { distance: Math.max(1, distance()), focusIndex: candidateRef.current, progress: candidateRef.current === view.current.focusIndex ? view.current.progress : 0 };
      }
    };
    const move = (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      gestureRef.current.move(event.pointerId, event.clientX, event.clientY);
      if (pointers.size === 2 && pinch) {
        event.preventDefault();
        update(pinch.focusIndex, pinch.progress + Math.log2(Math.max(1, distance()) / pinch.distance) * .65);
      }
    };
    const up = (event) => {
      pointers.delete(event.pointerId);
      gestureRef.current.end(event.pointerId);
      if (pointers.size < 2) pinch = null;
    };
    const cancel = () => { pointers.clear(); pinch = null; gestureRef.current.cancel(); };
    const wheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      const focusIndex = delta > 0 ? view.current.focusIndex : stationAt(event.target);
      candidateRef.current = focusIndex;
      const start = focusIndex === view.current.focusIndex ? view.current.progress : 0;
      // Wheel/trackpad changes the station's share of the layout, never a CSS scale.
      update(focusIndex, start - Math.max(-120, Math.min(120, delta)) * .0018);
    };
    viewport.addEventListener('pointerdown', down, true);
    viewport.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    return () => {
      viewport.removeEventListener('pointerdown', down, true);
      viewport.removeEventListener('wheel', wheel);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
    };
  }, [savedView]);

  const handleKey = (event) => {
    if (event.key === '+' || event.key === '=') zoomBy(.2);
    else if (event.key === '-') zoomBy(-.2, view.current.focusIndex);
    else if (event.key === '0' || event.key === 'Escape') changeDetail(view.current.focusIndex, 0);
    else return;
    event.preventDefault();
  };

  return <section className="station-map" aria-labelledby="station-map-title">
    <header className="station-map-heading"><div><span>{title || 'Ihre Ausstellung'}</span><h1 id="station-map-title" ref={headingRef} tabIndex={-1}>Raumübersicht</h1></div><small>{stations.length} {stations.length === 1 ? 'Station' : 'Stationen'}</small></header>
    <div ref={viewportRef} className="station-map-viewport" role="region" aria-label="Stationskarte: über einer Station zoomen, um mehr Objekte zu entdecken. Plus und Minus ändern die Detailstufe." tabIndex={0} onKeyDown={handleKey}>
      <div className="station-map-content">
        {tiles.map((tile) => {
          const station = stations[tile.index];
          return <button key={station.id} type="button" data-station-index={tile.index} data-station-number={String(tile.index + 1).padStart(2, '0')} className={`station-map-stone stone-${tile.index % 6} ${tile.index === detail.focusIndex && detail.progress > 0 ? 'is-focused' : ''}`}
            style={{ left: `${tile.x / size.width * 100}%`, top: `${tile.y / size.height * 100}%`, width: `${tile.width / size.width * 100}%`, height: `${tile.height / size.height * 100}%` }}
            aria-label={`Station ${tile.index + 1}: ${station.title} öffnen`}
            onFocus={() => { candidateRef.current = tile.index; }}
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') candidateRef.current = tile.index; }}
            onClick={(event) => { if (event.detail === 0 || gestureRef.current.canOpen()) onOpenStation(tile.index); else event.preventDefault(); }}>
            <span className="station-map-stone-face" data-preview-count={tile.images.length} aria-hidden="true">
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
      <div className="station-map-tools" aria-label="Detailsteuerung"><button type="button" disabled={detail.progress === 0} onClick={() => zoomBy(-.2, view.current.focusIndex)} aria-label="Herauszoomen"><Minus size={18} /></button><button type="button" onClick={() => changeDetail(view.current.focusIndex, 0)} aria-label="Alle Stationen anzeigen"><Scan size={17} /><span>Alle Stationen</span></button><button type="button" onClick={() => zoomBy(.2)} aria-label="Heranzoomen"><Plus size={18} /></button></div>
      <select className="station-map-direct" aria-label="Station direkt öffnen" value="" onChange={(event) => { if (event.target.value !== '') onOpenStation(Number(event.target.value)); }}><option value="">Station direkt öffnen …</option>{stations.map((station, index) => <option key={station.id} value={index}>{String(index + 1).padStart(2, '0')} · {station.title}</option>)}</select>
    </div>
    <p className="station-map-zoom-hint">Über einer Station zoomen, um mehr Bilder zu entdecken · Anklicken zum Öffnen</p>
  </section>;
}
