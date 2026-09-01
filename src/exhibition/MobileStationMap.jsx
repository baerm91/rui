import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Minus, Plus, Scan } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createStationMapGesture, createStationMapZoomTarget, createStationMapLayout, createStationPreviewLayout, advanceStationMapZoom, STATION_MAP_CAPTION_HEIGHT } from '../utils/stationMapLayout.js';
import './mobileStationMap.css';

export function StationMap({ title, stations, stationIndex, onOpenStation, viewRef }) {
  const viewportRef = useRef(null);
  const headingRef = useRef(null);
  const localViewRef = useRef(null);
  const savedView = viewRef || localViewRef;
  const gestureRef = useRef(createStationMapGesture());
  const zoomTargetRef = useRef(createStationMapZoomTarget());
  const view = useRef({ focusIndex: savedView.current?.focusIndex ?? stationIndex ?? 0, progress: savedView.current?.progress || 0, imageFocusIndex: savedView.current?.imageFocusIndex ?? 0, imageProgress: savedView.current?.imageProgress || 0 });
  const [detail, setDetail] = useState(view.current);
  const candidateRef = useRef(view.current.focusIndex);
  const candidateImageRef = useRef(view.current.imageFocusIndex);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [imageRatios, setImageRatios] = useState({});
  const stationImages = useMemo(() => stations.map((station) => station.items.map((item) => ({ key: item.id, src: resolveSpatialThumbnailUrl(item) }))), [stations]);
  const baseTiles = useMemo(() => createStationMapLayout(stations, size.width, size.height), [stations, size]);
  const tiles = useMemo(() => createStationMapLayout(stations, size.width, size.height, detail).map((tile) => {
    const ratios = stationImages[tile.index].map((image) => imageRatios[image.src] || 1);
    const focused = tile.index === detail.focusIndex;
    return { ...tile, ...createStationPreviewLayout(ratios, tile.width, tile.height, { index: detail.imageFocusIndex, progress: focused ? detail.imageProgress : 0 }, baseTiles[tile.index]) };
  }), [stations, stationImages, imageRatios, size, detail, baseTiles]);
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;

  const zoomDetail = (current, amount, focusIndex, imageIndex, maximumOverride) => {
    const currentTiles = tilesRef.current;
    const tile = currentTiles[focusIndex];
    const totalArea = currentTiles.reduce((sum, entry) => sum + entry.width * entry.height, 0);
    return advanceStationMapZoom(current, amount, {
      stationIndex: focusIndex,
      imageIndex: Math.max(0, Math.min(imageIndex, (tile?.images.length || 1) - 1)),
      stationAtMaximum: maximumOverride ?? (!!tile && tile.width * tile.height / totalArea >= .78 - 1e-6),
      canZoomImages: (tile?.images.length || 0) > 1
    });
  };
  const commitDetail = (next) => {
    view.current = next;
    savedView.current = next;
    setDetail(next);
  };

  const changeDetail = (focusIndex, progress) => {
    zoomTargetRef.current.reset();
    commitDetail({ focusIndex, progress: Math.max(0, Math.min(1, progress)), imageFocusIndex: 0, imageProgress: 0 });
  };
  const zoomBy = (amount, focusIndex = candidateRef.current) => {
    commitDetail(zoomDetail(view.current, amount, focusIndex, candidateImageRef.current));
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
    const imageAt = (target) => {
      const image = target.closest?.('[data-image-index]');
      return image ? Number(image.dataset.imageIndex) : candidateImageRef.current;
    };
    const trackTarget = (event) => {
      const target = zoomTargetRef.current.resolve({ x: event.clientX, y: event.clientY, stationIndex: stationAt(event.target), imageIndex: imageAt(event.target) });
      candidateRef.current = target.stationIndex;
      candidateImageRef.current = target.imageIndex;
      return target;
    };
    const distance = () => {
      const [first, second] = [...pointers.values()];
      return Math.hypot(first.x - second.x, first.y - second.y);
    };
    const down = (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      gestureRef.current.start(event.pointerId, event.clientX, event.clientY);
      if (pointers.size === 1) { zoomTargetRef.current.reset(); trackTarget(event); }
      if (pointers.size === 2) {
        pinch = { distance: Math.max(1, distance()), focusIndex: candidateRef.current, imageIndex: candidateImageRef.current, detail: { ...view.current }, stationAtMaximum: zoomDetail(view.current, 0, candidateRef.current, candidateImageRef.current).progress === 1 };
      }
    };
    const move = (event) => {
      if (event.pointerType === 'mouse' && viewport.contains(event.target) && !pointers.size) trackTarget(event);
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      gestureRef.current.move(event.pointerId, event.clientX, event.clientY);
      if (pointers.size === 2 && pinch) {
        event.preventDefault();
        commitDetail(zoomDetail(pinch.detail, Math.log2(Math.max(1, distance()) / pinch.distance) * .65, pinch.focusIndex, pinch.imageIndex, pinch.stationAtMaximum));
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
      const target = trackTarget(event);
      const focusIndex = delta > 0 ? view.current.focusIndex : target.stationIndex;
      commitDetail(zoomDetail(view.current, -Math.max(-120, Math.min(120, delta)) * .0018, focusIndex, target.imageIndex));
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
    <header className="station-map-heading"><div><span>{title || 'Ihre Ausstellung'}</span><h1 id="station-map-title" ref={headingRef} tabIndex={-1}>Themenüberblick</h1></div><small>{stations.length} {stations.length === 1 ? 'Thema' : 'Themen'}</small></header>
    <div ref={viewportRef} className="station-map-viewport" role="region" aria-label="Themenüberblick: zuerst ein Thema vergrößern, danach über einem Bild weiterzoomen. Plus und Minus ändern die Detailstufe." tabIndex={0} onKeyDown={handleKey}>
      <div className="station-map-content">
        {tiles.map((tile) => {
          const station = stations[tile.index];
          return <button key={station.id} type="button" data-station-index={tile.index} className={`station-map-stone stone-${tile.index % 6} ${tile.index === detail.focusIndex && detail.progress > 0 ? 'is-focused' : ''}`}
            style={{ left: `${tile.x / size.width * 100}%`, top: `${tile.y / size.height * 100}%`, width: `${tile.width / size.width * 100}%`, height: `${tile.height / size.height * 100}%`, '--station-caption-height': `${STATION_MAP_CAPTION_HEIGHT}px` }}
            title={`Thema ${tile.index + 1}: ${station.title}`}
            aria-label={`Thema ${tile.index + 1}: ${station.title} öffnen`}
            onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) { candidateRef.current = tile.index; candidateImageRef.current = 0; zoomTargetRef.current.reset(); } }}
            onClick={(event) => { if (event.detail === 0 || gestureRef.current.canOpen()) onOpenStation(tile.index); else event.preventDefault(); }}>
            <span className="station-map-stone-face" data-preview-count={tile.images.length} aria-hidden="true">
              <span className="station-map-images">
              {!tile.images.length && <Box size={28} />}
              {tile.images.map((imageTile) => {
                const entry = stationImages[tile.index][imageTile.index];
                return <span key={entry.key} className={`station-map-image${tile.index === detail.focusIndex && detail.progress > 0 && imageTile.index === detail.imageFocusIndex ? ' is-zoom-target' : ''}`} data-image-index={imageTile.index} style={{ left: `${imageTile.x / tile.imageWidth * 100}%`, top: `${imageTile.y / tile.imageHeight * 100}%`, width: `${imageTile.width / tile.imageWidth * 100}%`, height: `${imageTile.height / tile.imageHeight * 100}%` }}><Box size={28} />{entry.src && <LazyImage key={entry.src} src={entry.src} onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (!naturalWidth || !naturalHeight) return;
                  const ratio = naturalWidth / naturalHeight;
                  setImageRatios((current) => current[entry.src] === ratio ? current : { ...current, [entry.src]: ratio });
                }} />}</span>;
              })}
              </span>
              <span className="station-map-station-name"><span className="station-map-station-number">{String(tile.index + 1).padStart(2, '0')} · </span>{station.title}</span>
            </span>
          </button>;
        })}
      </div>
    </div>
    <div className="station-map-navigation">
      <div className="station-map-tools" aria-label="Detailsteuerung"><button type="button" disabled={detail.progress === 0} onClick={() => zoomBy(-.2, view.current.focusIndex)} aria-label="Herauszoomen"><Minus size={18} /></button><button type="button" onClick={() => changeDetail(view.current.focusIndex, 0)} aria-label="Alle Themen anzeigen"><Scan size={17} /><span>Alle Themen</span></button><button type="button" onClick={() => zoomBy(.2)} aria-label="Heranzoomen"><Plus size={18} /></button></div>
      <select className="station-map-direct" aria-label="Thema direkt öffnen" value="" onChange={(event) => { if (event.target.value !== '') onOpenStation(Number(event.target.value)); }}><option value="">Thema direkt öffnen …</option>{stations.map((station, index) => <option key={station.id} value={index}>{String(index + 1).padStart(2, '0')} · {station.title}</option>)}</select>
    </div>
    <p className="station-map-zoom-hint">Thema vergrößern · Danach über einem Bild weiterzoomen · Anklicken zum Öffnen</p>
  </section>;
}
