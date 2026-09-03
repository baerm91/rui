import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Box, Minimize2 } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { createStationMapLayout, createStationPreviewLayout, STATION_MAP_CAPTION_HEIGHT } from '../utils/stationMapLayout.js';
import './mobileStationMap.css';

export const resolveStationMapOpenItemId = (target, images = []) => {
  const imageElement = target?.closest?.('[data-image-index]');
  const imageIndex = Number(imageElement?.dataset?.imageIndex);
  return Number.isInteger(imageIndex) ? images[imageIndex]?.key || null : null;
};

export function StationMap({ title, stations, stationIndex, onOpenStation, onOpenItem, viewRef }) {
  const viewportRef = useRef(null);
  const headingRef = useRef(null);
  const localViewRef = useRef(null);
  const savedView = viewRef || localViewRef;
  const view = useRef({ focusIndex: savedView.current?.focusIndex ?? stationIndex ?? 0, progress: savedView.current?.progress ? 1 : 0, imageFocusIndex: 0, imageProgress: 0 });
  const [detail, setDetail] = useState(view.current);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [imageRatios, setImageRatios] = useState({});
  const stationImages = useMemo(() => stations.map((station) => station.items.map((item) => ({ key: item.id, src: resolveSpatialThumbnailUrl(item) }))), [stations]);
  const stationBackgrounds = useMemo(() => stations.map((station) => station.spatial?.wallBackground?.url?.trim?.() || ''), [stations]);
  const baseTiles = useMemo(() => createStationMapLayout(stations, size.width, size.height), [stations, size]);
  const expandedTiles = useMemo(() => createStationMapLayout(stations, size.width, size.height, { ...detail, progress: 1 }), [stations, size, detail]);
  const tiles = useMemo(() => baseTiles.map((baseTile) => {
    const tile = detail.progress > 0 && baseTile.index === detail.focusIndex ? expandedTiles[baseTile.index] : baseTile;
    const ratios = stationImages[tile.index].map((image) => imageRatios[image.src] || 1);
    const focused = tile.index === detail.focusIndex;
    return { ...tile, ...createStationPreviewLayout(ratios, tile.width, tile.height, { index: 0, progress: 0 }, baseTiles[tile.index]), isFocused: focused && detail.progress > 0 };
  }), [baseTiles, detail, expandedTiles, stationImages, imageRatios]);
  const commitDetail = (next) => {
    view.current = next;
    savedView.current = next;
    setDetail(next);
  };

  const changeDetail = (focusIndex, progress) => commitDetail({ focusIndex, progress, imageFocusIndex: 0, imageProgress: 0 });

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const { width, height } = viewportRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) setSize((current) => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  const handleKey = (event) => {
    if (event.key === 'Escape' && view.current.progress > 0) {
      changeDetail(view.current.focusIndex, 0);
      event.preventDefault();
    }
  };

  return <section className="station-map" aria-labelledby="station-map-title">
    <header className="station-map-heading"><div><span>{title || 'Ihre Ausstellung'}</span><h1 id="station-map-title" ref={headingRef} tabIndex={-1}>Themenüberblick</h1></div><small>{stations.length} {stations.length === 1 ? 'Thema' : 'Themen'}</small></header>
    <div ref={viewportRef} className="station-map-viewport" role="region" aria-label="Themenüberblick: Kachel auswählen, um sie zu vergrößern." tabIndex={0} onKeyDown={handleKey}>
      <div className="station-map-content">
        {tiles.map((tile) => {
          const station = stations[tile.index];
          const backgroundSrc = stationBackgrounds[tile.index];
          const previewProgress = tile.isFocused ? 1 : 0;
          const coverTitleOpacity = 1 - Math.min(1, previewProgress * 1.8);
          const captionOpacity = Math.max(0, (previewProgress - .45) / .55);
          return <div key={station.id} data-station-index={tile.index} className={`station-map-stone stone-${tile.index % 6}${tile.isFocused ? ' is-focused' : ''}`}
            style={{ left: `${tile.x / size.width * 100}%`, top: `${tile.y / size.height * 100}%`, width: `${tile.width / size.width * 100}%`, height: `${tile.height / size.height * 100}%`, '--station-caption-height': `${STATION_MAP_CAPTION_HEIGHT}px` }}
            title={`Thema ${tile.index + 1}: ${station.title}`}
            role={tile.isFocused ? undefined : 'button'}
            tabIndex={tile.isFocused ? -1 : 0}
            aria-label={tile.isFocused ? undefined : `Thema ${tile.index + 1}: ${station.title} vergrößern`}
            onClick={(event) => {
              if (!tile.isFocused) changeDetail(tile.index, 1);
            }}
            onKeyDown={(event) => {
              if (!tile.isFocused && (event.key === 'Enter' || event.key === ' ')) {
                changeDetail(tile.index, 1);
                event.preventDefault();
              }
            }}>
            <span className={`station-map-stone-face${backgroundSrc ? ' has-background' : ''}`} data-preview-count={tile.images.length} aria-hidden="true">
              <span className={`station-map-background${backgroundSrc ? '' : ' is-fallback'}`} style={{ opacity: 1 - previewProgress }}>{backgroundSrc && <LazyImage src={backgroundSrc} />}</span>
              <span className="station-map-cover-border" style={{ opacity: 1 - previewProgress }} aria-hidden="true">
                <i className="is-top-left" /><i className="is-top-right" />
                <i className="is-bottom-left" /><i className="is-bottom-right" />
              </span>
              <span className="station-map-cover-title" style={{ opacity: coverTitleOpacity }}>
                <span className="station-map-cover-number">{String(tile.index + 1).padStart(2, '0')}</span>
                <span className="station-map-cover-rule" />
                <b>{station.title}</b>
              </span>
              <span className="station-map-cover-cta" style={{ opacity: coverTitleOpacity }}><ArrowUpRight aria-hidden="true" /></span>
              <span className="station-map-visual">
              <span className="station-map-images" style={backgroundSrc ? { opacity: previewProgress } : undefined}>
              {!tile.images.length && <Box size={28} />}
              {tile.images.map((imageTile) => {
                const entry = stationImages[tile.index][imageTile.index];
                return <span key={entry.key} className="station-map-image" data-image-index={imageTile.index} style={{ left: `${imageTile.x / tile.imageWidth * 100}%`, top: `${imageTile.y / tile.imageHeight * 100}%`, width: `${imageTile.width / tile.imageWidth * 100}%`, height: `${imageTile.height / tile.imageHeight * 100}%` }}><Box size={28} />{entry.src && <LazyImage key={entry.src} src={entry.src} onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (!naturalWidth || !naturalHeight) return;
                  const ratio = naturalWidth / naturalHeight;
                  setImageRatios((current) => current[entry.src] === ratio ? current : { ...current, [entry.src]: ratio });
                }} />}</span>;
              })}
              </span>
              </span>
              <span className="station-map-station-name" style={{ opacity: captionOpacity }}><span className="station-map-station-number">{String(tile.index + 1).padStart(2, '0')} · </span>{station.title}</span>
            </span>
            {tile.isFocused && <div className="station-map-actions" aria-label={`Aktionen für ${station.title}`}>
              <button type="button" className="is-primary" onClick={(event) => { event.stopPropagation(); onOpenStation(tile.index); }}><ArrowUpRight size={17} />Thema betreten</button>
              <button type="button" onClick={(event) => { event.stopPropagation(); changeDetail(tile.index, 0); }}><Minimize2 size={17} />Kachel verkleinern</button>
            </div>}
          </div>;
        })}
      </div>
    </div>
    <p className="station-map-zoom-hint">Kachel auswählen, um das Thema anzusehen</p>
  </section>;
}
