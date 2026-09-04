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
  const copyRef = useRef(null);
  const stripRef = useRef(null);
  const closeTimer = useRef(null);
  const releaseTimer = useRef(null);
  const [closing, setClosing] = useState(false);
  const [hiddenModel, setHiddenModel] = useState(null);
  const [interacting, setInteracting] = useState(false);
  const [edges, setEdges] = useState({ before: false, after: false });
  const background = station.spatial?.wallBackground;
  const item = station.items.find((entry) => entry.id === itemId)
    || station.items.find((entry) => entry.id === station.initialItemId) || station.items[0];
  const modelKey = `${station.id}:${item?.id}`;
  const modelVisible = Boolean(item) && hiddenModel !== modelKey;
  const updateEdges = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const horizontal = matchMedia('(max-width:720px)').matches;
    const position = horizontal ? strip.scrollLeft : strip.scrollTop;
    const size = horizontal ? strip.clientWidth : strip.clientHeight;
    const total = horizontal ? strip.scrollWidth : strip.scrollHeight;
    setEdges({ before: position > 2, after: position + size < total - 2 });
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
    const dialog = dialogRef.current;
    // Keep the theme scrollable while its visual layer is behind the model.
    const scrollCopy = (event) => {
      const copy = copyRef.current;
      const rect = copy.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      event.preventDefault();
      event.stopPropagation();
      copy.scrollTop += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? copy.clientHeight : 1);
    };
    dialog.addEventListener('wheel', scrollCopy, { capture: true, passive: false });
    return () => dialog.removeEventListener('wheel', scrollCopy, true);
  }, []);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const strip = stripRef.current;
    strip.scrollTop = 0;
    strip.scrollLeft = 0;
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
      const horizontal = matchMedia('(max-width:720px)').matches;
      const position = horizontal ? 'scrollLeft' : 'scrollTop';
      const size = horizontal ? strip.clientWidth : strip.clientHeight;
      const start = horizontal ? button.offsetLeft : button.offsetTop;
      const length = horizontal ? button.offsetWidth : button.offsetHeight;
      if (start < strip[position]) strip[position] = start;
      else if (start + length > strip[position] + size) strip[position] = start + length - size;
    }
    updateEdges();
  }, [item?.id, updateEdges]);

  const close = () => {
    if (closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 180);
  };
  const hideModel = () => {
    setHiddenModel(modelKey);
    clearTimeout(releaseTimer.current);
    setInteracting(false);
  };
  const scrollObjects = (direction) => {
    const strip = stripRef.current;
    const horizontal = matchMedia('(max-width:720px)').matches;
    strip?.scrollBy({ [horizontal ? 'left' : 'top']: direction * (horizontal ? strip.clientWidth : strip.clientHeight), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return createPortal(<dialog ref={dialogRef} className={`topic-dialog${closing ? ' is-closing' : ''}${interacting ? ' is-interacting' : ''}${!modelVisible ? ' is-model-hidden' : ''}`} aria-labelledby="topic-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (modelVisible) hideModel(); else close(); }}>
    {background?.url && <img key={background.url} className="topic-dialog-background" src={background.url} alt="" style={{ opacity: background.opacity ?? .72 }} />}
    {modelVisible && <div className="topic-dialog-stage" key={item?.id || 'empty'}>
      {item?.sourceType === 'gltf' ? <MobileGltfModel item={item} onInteractionChange={changeInteraction} />
        : item?.sourceType === 'sketchfab' ? renderSketchfab?.(item, changeInteraction)
          : <p className="topic-dialog-empty">{item ? 'Für dieses Objekt ist noch keine 3D-Ansicht verfügbar.' : 'Dieses Thema wird noch kuratiert.'}</p>}
    </div>}
    <header className="topic-dialog-header">
      <button type="button" className="topic-dialog-back" onClick={close}><ChevronLeft size={18} />Zur Übersicht</button>
      <span>THEMA {String(stationIndex + 1).padStart(2, '0')} / {String(stationCount).padStart(2, '0')}</span>
      <div className="topic-dialog-navigation">
        <button type="button" aria-label="Vorheriges Thema" disabled={stationIndex === 0} onClick={() => onNavigate(stationIndex - 1)}><ChevronLeft size={20} /></button>
        <button type="button" aria-label="Nächstes Thema" disabled={stationIndex === stationCount - 1} onClick={() => onNavigate(stationIndex + 1)}><ChevronRight size={20} /></button>
        <button ref={closeRef} type="button" className="topic-dialog-close" aria-label="3D-Modell schließen" disabled={!modelVisible} onClick={hideModel} autoFocus><X size={22} /><span>Modell schließen</span></button>
      </div>
    </header>
    <aside ref={copyRef} className="topic-dialog-copy" tabIndex={0} aria-label="Themenbeschreibung">
      <span className="topic-dialog-eyebrow">{station.items.length} {station.items.length === 1 ? 'Objekt' : 'Objekte'}</span>
      <h1 id="topic-dialog-title">{station.title}</h1>
      {station.introduction && <p className="topic-dialog-introduction">{station.introduction}</p>}
      {station.spatial?.audio?.url && <audio key={station.id} controls preload="none" src={station.spatial.audio.url} aria-label={`Audiobeitrag: ${station.title}`} />}
    </aside>
    {modelVisible && <>
      <div className="topic-dialog-object-info"><SpatialObjectDetails item={item} className="topic-dialog-details" showRights={false} showSource={false} /></div>
      <div className="topic-dialog-credits" aria-label="Verfasser, Lizenz und Quelle"><SpatialObjectDetails item={item} className="topic-dialog-details" showTitle={false} showDescription={false} /></div>
    </>}
    <aside className="topic-dialog-rail" aria-label="Objekte dieses Themas">
      <button className="topic-dialog-scroll" type="button" disabled={!edges.before} onClick={() => scrollObjects(-1)} aria-label="Vorherige Objekte"><ChevronUp size={18} /></button>
      <div ref={stripRef} onScroll={updateEdges} className={`topic-dialog-filmstrip${edges.before ? ' has-before' : ''}${edges.after ? ' has-after' : ''}`}>
        {station.items.map((entry) => <button key={entry.id} type="button" data-item-id={entry.id} aria-label={entry.title} aria-pressed={modelVisible && entry.id === item?.id} onClick={() => { setHiddenModel(null); onSelectItem(entry.id); }}>
          <span className="topic-dialog-thumb"><Box size={24} aria-hidden="true" /><LazyImage key={resolveSpatialThumbnailUrl(entry)} src={resolveSpatialThumbnailUrl(entry)} /></span><span>{entry.title}</span>
        </button>)}
      </div>
      <button className="topic-dialog-scroll" type="button" disabled={!edges.after} onClick={() => scrollObjects(1)} aria-label="Weitere Objekte"><ChevronDown size={18} /><span>{edges.after ? 'Weitere Objekte' : `${station.items.length} Objekte`}</span></button>
    </aside>
    <p className="topic-dialog-model-hint">Ziehen zum Drehen · Scrollen oder zwei Finger zum Zoomen</p>
  </dialog>, document.body);
}
