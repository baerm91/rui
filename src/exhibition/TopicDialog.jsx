import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowUpRight, Box, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { LazyImage } from '../platform/LazyImage.jsx';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { MobileGltfModel } from './MobileModelDialog.jsx';
import { SpatialObjectDetails } from './SpatialObjectDetails.jsx';
import './topicDialog.css';

export function TopicDialog({ station, stationIndex, stationCount, itemId, onSelectItem, onNavigate, onClose, renderSketchfab }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const backRef = useRef(null);
  const closeTimer = useRef(null);
  const [closing, setClosing] = useState(false);
  const item = station.items.find((entry) => entry.id === itemId);
  const hasItem = Boolean(item);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      clearTimeout(closeTimer.current);
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    (hasItem ? backRef : closeRef).current?.focus({ preventScroll: true });
  }, [hasItem, station.id]);

  const close = () => {
    if (closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 180);
  };
  const backToObjects = () => {
    onSelectItem(null);
    closeRef.current?.focus({ preventScroll: true });
  };

  return createPortal(<dialog ref={dialogRef} className={`topic-dialog${closing ? ' is-closing' : ''}`} aria-labelledby="topic-dialog-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="topic-dialog-header">
      <span>THEMA {String(stationIndex + 1).padStart(2, '0')} / {String(stationCount).padStart(2, '0')}</span>
      <div className="topic-dialog-navigation">
        <button type="button" aria-label="Vorheriges Thema" disabled={stationIndex === 0} onClick={() => onNavigate(stationIndex - 1)}><ChevronLeft size={20} /></button>
        <button type="button" aria-label="Nächstes Thema" disabled={stationIndex === stationCount - 1} onClick={() => onNavigate(stationIndex + 1)}><ChevronRight size={20} /></button>
        <button ref={closeRef} type="button" className="topic-dialog-close" aria-label="Thema schließen" onClick={close} autoFocus><X size={22} /><span>Schließen</span></button>
      </div>
    </header>
    <div className={`topic-dialog-body${item ? ' has-model' : ''}`}>
      <aside className="topic-dialog-copy">
        <span className="topic-dialog-eyebrow">{station.items.length} {station.items.length === 1 ? 'Objekt' : 'Objekte'}</span>
        <h1 id="topic-dialog-title">{station.title}</h1>
        {station.introduction && <p className="topic-dialog-introduction">{station.introduction}</p>}
        {station.spatial?.audio?.url && <audio key={station.id} className="topic-dialog-audio" controls preload="none" src={station.spatial.audio.url} aria-label={`Audiobeitrag: ${station.title}`} />}
        {item && <div className="topic-dialog-object-info"><span className="topic-dialog-eyebrow">AUSGEWÄHLTES OBJEKT</span><SpatialObjectDetails item={item} className="topic-dialog-details" /></div>}
      </aside>
      <section className="topic-dialog-collection" aria-label={item ? item.title : 'Objekte dieses Themas'}>
        {item ? <>
          <button ref={backRef} type="button" className="topic-dialog-back" onClick={backToObjects}><ArrowLeft size={17} />Alle Objekte des Themas</button>
          <div className="topic-dialog-stage" key={item.id}>
            {item.sourceType === 'gltf' ? <MobileGltfModel item={item} /> : item.sourceType === 'sketchfab' ? renderSketchfab?.(item) : <p>Für dieses Objekt ist noch keine 3D-Ansicht verfügbar.</p>}
          </div>
          <p className="topic-dialog-model-hint">Ziehen zum Drehen · Scrollen oder zwei Finger zum Zoomen</p>
          <div className="topic-dialog-filmstrip" aria-label="Weiteres Objekt auswählen">
            {station.items.map((entry) => <button key={entry.id} type="button" aria-label={entry.title} aria-pressed={entry.id === item.id} onClick={() => onSelectItem(entry.id)}>
              <LazyImage key={resolveSpatialThumbnailUrl(entry)} src={resolveSpatialThumbnailUrl(entry)} /><span>{entry.title}</span>
            </button>)}
          </div>
        </> : <div className="topic-dialog-grid">
          {station.items.map((entry) => <button key={entry.id} type="button" onClick={() => onSelectItem(entry.id)}>
            <span className="topic-dialog-preview"><Box size={28} aria-hidden="true" /><LazyImage key={resolveSpatialThumbnailUrl(entry)} src={resolveSpatialThumbnailUrl(entry)} /></span>
            <span className="topic-dialog-object-title">{entry.title}<ArrowUpRight size={17} aria-hidden="true" /></span>
          </button>)}
          {!station.items.length && <p>Dieses Thema wird noch kuratiert.</p>}
        </div>}
      </section>
    </div>
  </dialog>, document.body);
}
