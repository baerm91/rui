import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronDown, Menu, MousePointer2, Save, X } from 'lucide-react';
import { getSketchfabModelUid } from '../utils/modelSource.js';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import './scrollingStory.css';

const stationCopy = (station) => station.introduction ?? station.description ?? '';
const stationItems = (station) => Array.isArray(station.items) ? station.items : [];

function ObjectCard({ item, stationNumber, index, onOpen }) {
  const image = resolveSpatialThumbnailUrl(item);
  return <article className="scroll-object-card">
    <button type="button" className="scroll-object-media" onClick={() => onOpen(item)} aria-label={`${item.title || `Objekt ${index + 1}`} öffnen`}>
      {image ? <img src={image} alt="" loading="lazy" /> : <span className="scroll-object-placeholder">{String(stationNumber).padStart(2, '0')} / {String(index + 1).padStart(2, '0')}</span>}
      <i><ArrowUpRight size={18} /></i>
    </button>
    <div className="scroll-object-copy">
      <span>Objekt {String(index + 1).padStart(2, '0')}</span>
      <h3>{item.title || `Objekt ${index + 1}`}</h3>
      {item.description && <p>{item.description}</p>}
    </div>
  </article>;
}

function ObjectDialog({ item, onClose }) {
  const uid = getSketchfabModelUid(item?.modelUrl);
  const image = resolveSpatialThumbnailUrl(item);
  useEffect(() => {
    if (!item) return undefined;
    const close = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    document.body.classList.add('scroll-dialog-open');
    return () => { document.removeEventListener('keydown', close); document.body.classList.remove('scroll-dialog-open'); };
  }, [item, onClose]);
  if (!item) return null;
  return <div className="scroll-object-dialog" role="dialog" aria-modal="true" aria-label={item.title || 'Objektansicht'} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="scroll-object-dialog-panel">
      <button type="button" className="scroll-dialog-close" onClick={onClose} aria-label="Schließen"><X /></button>
      <div className="scroll-dialog-media">
        {uid ? <iframe title={`3D-Ansicht: ${item.title || 'Objekt'}`} src={`https://sketchfab.com/models/${uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_watermark=0`} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen /> : image ? <img src={image} alt="" /> : <div className="scroll-dialog-placeholder">Keine Medienvorschau vorhanden</div>}
      </div>
      <div className="scroll-dialog-copy">
        <span>Objekt im Fokus</span>
        <h2>{item.title || 'Unbenanntes Objekt'}</h2>
        {item.description && <p>{item.description}</p>}
        {(item.attribution || item.license) && <small>{[item.attribution, item.license].filter(Boolean).join(' · ')}</small>}
      </div>
    </div>
  </div>;
}

function EditorPanel({ station, index, onChange, onSave, saved, onClose }) {
  if (!station) return null;
  return <aside className="scroll-editor" aria-label="Kapitel bearbeiten">
    <div className="scroll-editor-heading"><div><span>Editor</span><strong>Station {String(index + 1).padStart(2, '0')}</strong></div><button onClick={onClose} aria-label="Editor schließen"><X size={18} /></button></div>
    <label>Titel<input value={station.title || ''} onChange={(event) => onChange({ title: event.target.value })} /></label>
    <label>Einleitung<textarea rows="7" value={stationCopy(station)} onChange={(event) => onChange({ introduction: event.target.value, description: event.target.value })} /></label>
    <div className="scroll-editor-note"><MousePointer2 size={15} /><p>Du bearbeitest dieselbe Scrolling-Seite, die Besucher später sehen.</p></div>
    <button type="button" className="scroll-editor-save" onClick={onSave}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Gespeichert' : 'Änderungen speichern'}</button>
  </aside>;
}

export default function ScrollingStory({ story, initialMode = 'visitor', backHref = '/', onSaveStory }) {
  const [stations, setStations] = useState(() => (story?.stations || []).map((station) => ({ ...station })));
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(initialMode === 'editor');
  const [saved, setSaved] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const sectionRefs = useRef([]);
  const title = story?.branding?.title || story?.name || 'RIU Story';
  const subtitle = story?.branding?.subtitle || story?.description || '';
  const coverImage = story?.coverImage || resolveSpatialThumbnailUrl(stationItems(stations[0])[0]);
  const totalObjects = useMemo(() => stations.reduce((sum, station) => sum + stationItems(station).length, 0), [stations]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveIndex(Number(visible.target.dataset.index));
    }, { rootMargin: '-25% 0px -55%', threshold: [0, .2, .5] });
    sectionRefs.current.filter(Boolean).forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [stations.length]);

  const jumpTo = (index) => {
    sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };
  const updateStation = (patch) => setStations((current) => current.map((station, index) => index === activeIndex ? { ...station, ...patch } : station));
  const save = async () => {
    await onSaveStory?.({ ...story, stations });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return <main className={`scroll-story ${editorOpen ? 'has-editor' : ''}`}>
    <header className="scroll-header">
      <a href={backHref} className="scroll-brand" aria-label="Zurück"><span className="scroll-mark"><i /></span><b>RIU</b></a>
      <button className="scroll-chapter-trigger" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}><Menu size={15} /><span>Kapitel</span><b>{String(activeIndex + 1).padStart(2, '0')} / {String(stations.length).padStart(2, '0')}</b></button>
      {initialMode === 'editor' ? <button className={`scroll-edit-toggle ${editorOpen ? 'is-active' : ''}`} type="button" onClick={() => setEditorOpen((value) => !value)}><MousePointer2 size={14} />{editorOpen ? 'Editor ausblenden' : 'Bearbeiten'}</button> : <span className="scroll-progress"><i style={{ '--progress': `${((activeIndex + 1) / Math.max(stations.length, 1)) * 100}%` }} /></span>}
    </header>

    {menuOpen && <nav className="scroll-chapter-menu" aria-label="Kapitelübersicht"><div className="scroll-chapter-menu-head"><span>Inhalt</span><button onClick={() => setMenuOpen(false)} aria-label="Menü schließen"><X /></button></div>{stations.map((station, index) => <button key={station.id || index} className={index === activeIndex ? 'is-active' : ''} onClick={() => jumpTo(index)}><span>{String(index + 1).padStart(2, '0')}</span><b>{station.title || `Station ${index + 1}`}</b><small>{stationItems(station).length} Objekte</small></button>)}</nav>}

    <section className="scroll-hero">
      {coverImage && <div className="scroll-hero-image" style={{ backgroundImage: `linear-gradient(90deg, rgba(25,24,20,.88), rgba(25,24,20,.22)), url(${JSON.stringify(coverImage).slice(1, -1)})` }} />}
      <div className="scroll-hero-copy"><span>Eine digitale Erzählung</span><h1>{title}</h1><p>{subtitle}</p><div className="scroll-hero-facts"><span>{stations.length} Kapitel</span><i /><span>{totalObjects} Objekte</span></div><button type="button" onClick={() => jumpTo(0)}>Geschichte beginnen <ArrowDown size={17} /></button></div>
      <div className="scroll-hero-index" aria-hidden="true">01</div>
    </section>

    <div className="scroll-chapters">
      {stations.map((station, index) => {
        const items = stationItems(station);
        return <section key={station.id || index} className={`scroll-chapter ${index % 2 ? 'is-reversed' : ''}`} data-index={index} ref={(node) => { sectionRefs.current[index] = node; }}>
          <div className="scroll-chapter-heading"><div className="scroll-chapter-number"><span>{String(index + 1).padStart(2, '0')}</span><i /></div><div><span>Station {String(index + 1).padStart(2, '0')}</span><h2>{station.title || `Station ${index + 1}`}</h2><p>{stationCopy(station)}</p></div></div>
          {items.length ? <div className={`scroll-object-grid ${items.length === 1 ? 'is-single' : ''}`}>{items.map((item, itemIndex) => <ObjectCard key={item.id || itemIndex} item={item} stationNumber={index + 1} index={itemIndex} onOpen={setOpenItem} />)}</div> : <div className="scroll-empty">Dieses Kapitel wird noch kuratiert.</div>}
          {index < stations.length - 1 && <button className="scroll-next" type="button" onClick={() => jumpTo(index + 1)}><span>Nächstes Kapitel</span><b>{stations[index + 1]?.title}</b><ChevronDown /></button>}
        </section>;
      })}
    </div>

    <footer className="scroll-story-footer"><a href={backHref}><ArrowLeft size={15} /> Zurück zu den Stories</a><span>RIU — Räumliche Geschichten</span></footer>
    {editorOpen && <EditorPanel station={stations[activeIndex]} index={activeIndex} onChange={updateStation} onSave={save} saved={saved} onClose={() => setEditorOpen(false)} />}
    <ObjectDialog item={openItem} onClose={() => setOpenItem(null)} />
  </main>;
}
