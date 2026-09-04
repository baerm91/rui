import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { MobileGltfModel } from './MobileModelDialog.jsx';
import { SpatialObjectDetails } from './SpatialObjectDetails.jsx';
import './topicDialog.css';

export function TopicDialog({ station, stationIndex, stationCount, itemId, onSelectItem, onNavigate, onClose, renderSketchfab }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const stripRef = useRef(null);
  const closeTimer = useRef(null);
  const releaseTimer = useRef(null);
  const [closing, setClosing] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [edges, setEdges] = useState({ before: false, after: false });
  const background = station.spatial?.wallBackground;
  const item = station.items.find((entry) => entry.id === itemId)
    || station.items.find((entry) => entry.id === station.initialItemId) || station.items[0];
  const updateEdges = useCallback(() => {
    const strip = stripRef.current;
    if (strip) setEdges({ before: strip.scrollTop > 2, after: strip.scrollTop + strip.clientHeight < strip.scrollHeight - 2 });
  }, []);
  const changeInteraction = useCallback((active) => {
    clearTimeout(releaseTimer.current);
    if (active) setInteracting(true);
    else releaseTimer.current = setTimeout(() => setInteracting(false), 1000);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      clearTimeout(closeTimer.current);
      clearTimeout(releaseTimer.current);
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const strip = stripRef.current;
    strip.scrollTop = 0;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(strip);
    updateEdges();
    return () => observer.disconnect();
  }, [station.id, station.items.length, updateEdges]);
  useEffect(() => {
    clearTimeout(releaseTimer.current);
    setInteracting(false);
    const button = [...stripRef.current.querySelectorAll('button')].find((entry) => entry.dataset.itemId === item?.id);
    if (button) {
      const strip = stripRef.current;
      const top = button.offsetTop;
      if (top < strip.scrollTop) strip.scrollTop = top;
      else if (top + button.offsetHeight > strip.scrollTop + strip.clientHeight) strip.scrollTop = top + button.offsetHeight - strip.clientHeight;
    }
    updateEdges();
  }, [item?.id, updateEdges]);

  const close = () => {
    if (closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 180);
  };
  const scrollObjects = (direction) => stripRef.current?.scrollBy({ top: direction * stripRef.current.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return createPortal(<dialog ref={dialogRef} className={`topic-dialog${closing ? ' is-closing' : ''}${interacting ? ' is-interacting' : ''}`} aria-labelledby="topic-dialog-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    {background?.url && <img key={background.url} className="topic-dialog-background" src={background.url} alt="" style={{ opacity: background.opacity ?? .72 }} />}
    <div className="topic-dialog-stage" key={item?.id || 'empty'}>
      {item?.sourceType === 'gltf' ? <MobileGltfModel item={item} onInteractionChange={changeInteraction} />
        : item?.sourceType === 'sketchfab' ? renderSketchfab?.(item, changeInteraction)
          : <p className="topic-dialog-empty">{item ? 'Für dieses Objekt ist noch keine 3D-Ansicht verfügbar.' : 'Dieses Thema wird noch kuratiert.'}</p>}
    </div>
    <header className="topic-dialog-header">
      <span>THEMA {String(stationIndex + 1).padStart(2, '0')} / {String(stationCount).padStart(2, '0')}</span>
      <div className="topic-dialog-navigation">
        <button type="button" aria-label="Vorheriges Thema" disabled={stationIndex === 0} onClick={() => onNavigate(stationIndex - 1)}><ChevronLeft size={20} /></button>
        <button type="button" aria-label="Nächstes Thema" disabled={stationIndex === stationCount - 1} onClick={() => onNavigate(stationIndex + 1)}><ChevronRight size={20} /></button>
        <button ref={closeRef} type="button" className="topic-dialog-close" aria-label="Thema schließen" onClick={close} autoFocus><X size={22} /><span>Schließen</span></button>
      </div>
    </header>
    <aside className="topic-dialog-copy">
      <span className="topic-dialog-eyebrow">{station.items.length} {station.items.length === 1 ? 'Objekt' : 'Objekte'}</span>
      <h1 id="topic-dialog-title">{station.title}</h1>
      {station.introduction && <p className="topic-dialog-introduction">{station.introduction}</p>}
      {station.spatial?.audio?.url && <audio key={station.id} controls preload="none" src={station.spatial.audio.url} aria-label={`Audiobeitrag: ${station.title}`} />}
    </aside>
    {item && <>
      <div className="topic-dialog-object-info"><SpatialObjectDetails item={item} className="topic-dialog-details" showRights={false} showSource={false} /></div>
      <div className="topic-dialog-credits" aria-label="Verfasser, Lizenz und Quelle"><SpatialObjectDetails item={item} className="topic-dialog-details" showTitle={false} showDescription={false} /></div>
    </>}
    <aside className="topic-dialog-rail" aria-label="Objekte dieses Themas">
      <button className="topic-dialog-scroll" type="button" disabled={!edges.before} onClick={() => scrollObjects(-1)} aria-label="Vorherige Objekte"><ChevronUp size={18} /></button>
      <div ref={stripRef} onScroll={updateEdges} className={`topic-dialog-filmstrip${edges.before ? ' has-before' : ''}${edges.after ? ' has-after' : ''}`}>
        {station.items.map((entry) => <button key={entry.id} type="button" data-item-id={entry.id} aria-label={entry.title} aria-pressed={entry.id === item?.id} onClick={() => onSelectItem(entry.id)}>
          <span className="topic-dialog-thumb"><Box size={24} aria-hidden="true" /><LazyImage key={resolveSpatialThumbnailUrl(entry)} src={resolveSpatialThumbnailUrl(entry)} /></span><span>{entry.title}</span>
        </button>)}
      </div>
      <button className="topic-dialog-scroll" type="button" disabled={!edges.after} onClick={() => scrollObjects(1)} aria-label="Weitere Objekte"><ChevronDown size={18} /><span>{edges.after ? 'Weitere Objekte' : `${station.items.length} Objekte`}</span></button>
    </aside>
    <p className="topic-dialog-model-hint">Ziehen zum Drehen · Scrollen oder zwei Finger zum Zoomen</p>
  </dialog>, document.body);
}
