import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronDown, Crosshair, GitCompare, Link2, Menu, MousePointer2, Palette, Plus, Save, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { getSketchfabModelUid } from '../utils/modelSource.js';
import { resolveModelSourceMetadata } from '../utils/modelSourceAdapters.js';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { normalizeStationBehavior, STATION_BEHAVIOR_OPTIONS } from '../utils/stationBehavior.js';
import ScrollStationStage from './ScrollStationStage.jsx';
import './scrollingStory.css';

const stationCopy = (station) => station?.introduction ?? station?.description ?? '';
const stationItems = (station) => Array.isArray(station?.items) ? station.items.filter(Boolean) : [];
const factLabels = { material: 'Material', date: 'Datierung', dimensions: 'Maße', findspot: 'Fundort', collection: 'Sammlung' };

function ObjectCard({ item, stationNumber, index, onOpen }) {
  const image = resolveSpatialThumbnailUrl(item);
  return <article className="scroll-object-card">
    <button type="button" className="scroll-object-media" style={{ viewTransitionName: `riu-object-${item.id || index}` }} onClick={(event) => onOpen(item, event.currentTarget)} aria-label={`${item.title || `Objekt ${index + 1}`} öffnen`}>
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

function HotspotLayer({ hotspots = [] }) {
  const [activeId, setActiveId] = useState('');
  const active = hotspots.find((hotspot) => hotspot.id === activeId);
  if (!hotspots.length) return null;
  return <div className="scroll-hotspots">
    {hotspots.map((hotspot, index) => <button key={hotspot.id || index} type="button" className={activeId === hotspot.id ? 'is-active' : ''} style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }} onClick={() => setActiveId((current) => current === hotspot.id ? '' : hotspot.id)} aria-label={`${hotspot.label} anzeigen`}><span>{index + 1}</span></button>)}
    {active && <div className="scroll-hotspot-note"><span><Crosshair size={13} /> Detail</span><b>{active.label}</b><p>{active.description}</p></div>}
  </div>;
}

function ObjectFacts({ facts }) {
  const entries = Object.entries(facts || {}).filter(([, value]) => value);
  if (!entries.length) return null;
  return <dl className="scroll-object-facts">{entries.map(([key, value]) => <div key={key}><dt>{factLabels[key] || key}</dt><dd>{value}</dd></div>)}</dl>;
}

function HiddenLayers({ layers = [] }) {
  const [openId, setOpenId] = useState('');
  if (!layers.length) return null;
  return <div className="scroll-hidden-layers"><span>Verborgene Ebenen</span>{layers.map((layer, index) => <button key={layer.id || index} type="button" className={openId === layer.id ? 'is-open' : ''} onClick={() => setOpenId((current) => current === layer.id ? '' : layer.id)}><b>{layer.label || `Ebene ${index + 1}`}</b><i>{openId === layer.id ? '−' : '+'}</i>{openId === layer.id && <span><strong>{layer.title}</strong><p>{layer.text}</p></span>}</button>)}</div>;
}

function ObjectDialog({ item, onClose, onCompare, compareSelected, transition = 'fade', origin = '50% 50%' }) {
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
      <div className={`scroll-dialog-media transition-${transition}`} style={{ '--viewer-origin': origin, viewTransitionName: item?.id ? `riu-object-${item.id}` : 'none' }}>
        {uid ? <iframe title={`3D-Ansicht: ${item.title || 'Objekt'}`} src={`https://sketchfab.com/models/${uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_watermark=0`} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen /> : image ? <img src={image} alt="" /> : <div className="scroll-dialog-placeholder">Keine Medienvorschau vorhanden</div>}
        <HotspotLayer key={item.id} hotspots={item.hotspots} />
      </div>
      <div className="scroll-dialog-copy">
        <span>Objekt im Fokus</span>
        <h2>{item.title || 'Unbenanntes Objekt'}</h2>
        {item.description && <p>{item.description}</p>}
        <ObjectFacts facts={item.facts} />
        <HiddenLayers key={item.id} layers={item.hiddenLayers} />
        {(item.attribution || item.license) && <small>{[item.attribution, item.license].filter(Boolean).join(' · ')}</small>}
        <button type="button" className={`scroll-compare-add ${compareSelected ? 'is-selected' : ''}`} onClick={() => onCompare(item)}><GitCompare size={15} />{compareSelected ? 'Aus Vergleich entfernen' : 'Zum Vergleich merken'}</button>
      </div>
    </div>
  </div>;
}

function ComparisonView({ items, onClose, onRemove }) {
  if (items.length < 2) return null;
  return <div className="scroll-comparison" role="dialog" aria-modal="true" aria-label="Objekte vergleichen"><header><span>Vergleichsansicht</span><button onClick={onClose} aria-label="Vergleich schließen"><X /></button></header><div className="scroll-comparison-grid">{items.map((item) => { const image = resolveSpatialThumbnailUrl(item); return <article key={item.id}><div>{image ? <img src={image} alt="" /> : <span>Keine Vorschau</span>}</div><small>Sammlungsobjekt</small><h2>{item.title}</h2><p>{item.description || 'Keine Beschreibung vorhanden.'}</p><dl>{Object.entries(item.facts || {}).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{factLabels[key] || key}</dt><dd>{value}</dd></div>)}<div><dt>Quelle</dt><dd>{item.attribution || 'Nicht angegeben'}</dd></div><div><dt>Lizenz</dt><dd>{item.license || 'Nicht angegeben'}</dd></div><div><dt>Format</dt><dd>{item.sourceType || '3D-Modell'}</dd></div></dl><button onClick={() => onRemove(item.id)}><Trash2 size={13} /> Entfernen</button></article>; })}</div></div>;
}

function StoryTrail({ stations, activeIndex, onJump }) {
  return <nav className="scroll-object-trail" aria-label="Gesehene Stationen">{stations.map((station, index) => { const image = resolveSpatialThumbnailUrl(stationItems(station)[0]); return <button key={station.id || index} className={index === activeIndex ? 'is-active' : index < activeIndex ? 'is-seen' : ''} onClick={() => onJump(index)} aria-label={`Zu Station ${index + 1}: ${station.title}`}><span>{image ? <img src={image} alt="" /> : String(index + 1).padStart(2, '0')}</span><i /></button>; })}</nav>;
}

function RelationsEditor({ station, onChange }) {
  const items = stationItems(station);
  const [fromItemId, setFromItemId] = useState(items[0]?.id || '');
  const [toItemId, setToItemId] = useState(items[1]?.id || '');
  const [label, setLabel] = useState('');
  const relations = Array.isArray(station?.relations) ? station.relations : [];
  if (items.length < 2) return null;
  const add = () => {
    if (!fromItemId || !toItemId || fromItemId === toItemId) return;
    onChange({ relations: [...relations, { id: `relation_${Date.now()}`, fromItemId, toItemId, label: label.trim(), description: '' }] });
    setLabel('');
  };
  return <div className="scroll-editor-relations">
    <div><span><Link2 size={13} /> Objektbeziehungen</span><small>Kuratorische Verbindungen erscheinen in der Bühne und über WebMCP.</small></div>
    <div className="scroll-relation-form"><select value={fromItemId} onChange={(event) => setFromItemId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><span>↔</span><select value={toItemId} onChange={(event) => setToItemId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
    <div className="scroll-relation-label"><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Beziehung, z. B. gleicher Fundort" /><button type="button" onClick={add} disabled={fromItemId === toItemId}><Plus size={13} /></button></div>
    {relations.map((relation, relationIndex) => <div className="scroll-relation-row" key={relation.id || relationIndex}><span><b>{items.find((item) => item.id === relation.fromItemId)?.title || 'Objekt'}</b> ↔ <b>{items.find((item) => item.id === relation.toItemId)?.title || 'Objekt'}</b><small>{relation.label || 'Ohne Bezeichnung'}</small></span><button type="button" onClick={() => onChange({ relations: relations.filter((_, index) => index !== relationIndex) })} aria-label="Beziehung entfernen"><Trash2 size={12} /></button></div>)}
  </div>;
}

function NarrativeEditor({ station, onChange }) {
  const steps = Array.isArray(station?.narrativeSteps) ? station.narrativeSteps : [];
  const items = stationItems(station);
  const update = (index, patch) => onChange({ narrativeSteps: steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) });
  return <div className="scroll-editor-narrative">
    <div><span>Scroll-Dramaturgie</span><small>Bis zu fünf Textmomente begleiten die Objektkonstellation.</small></div>
    {steps.map((step, index) => <div className="scroll-narrative-row" key={step.id || index}>
      <input value={step.title || ''} onChange={(event) => update(index, { title: event.target.value })} placeholder={`Moment ${index + 1}`} />
      <textarea rows="2" value={step.text || ''} onChange={(event) => update(index, { text: event.target.value })} placeholder="Kuratorischer Text" />
      <select value={step.itemId || ''} onChange={(event) => update(index, { itemId: event.target.value })}><option value="">Kein Objektfokus</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <button type="button" onClick={() => onChange({ narrativeSteps: steps.filter((_, stepIndex) => stepIndex !== index) })} aria-label="Moment entfernen"><Trash2 size={12} /></button>
    </div>)}
    {steps.length < 5 && <button type="button" className="scroll-narrative-add" onClick={() => onChange({ narrativeSteps: [...steps, { id: `step_${Date.now()}`, eyebrow: '', title: `Moment ${steps.length + 1}`, text: '', itemId: '' }] })}><Plus size={13} /> Moment hinzufügen</button>}
  </div>;
}

function EditorPanel({ station, index, onChange, onSave, saved, onClose }) {
  if (!station) return null;
  const behavior = normalizeStationBehavior(station.behavior);
  const updateBehavior = (patch) => onChange({ behavior: normalizeStationBehavior({ ...behavior, ...patch }) });
  const updateInteraction = (name, checked) => updateBehavior({ interactions: { ...behavior.interactions, [name]: checked } });
  const updateAtmosphere = (patch) => updateBehavior({ atmosphere: { ...behavior.atmosphere, ...patch } });
  const updateMotion = (name, checked) => updateBehavior({ motion: { ...behavior.motion, [name]: checked } });
  const labels = {
    grid: 'Raster', cluster: 'Cluster', orbit: 'Orbit', timeline: 'Zeitleiste', freeform: 'Freie Komposition',
    fade: 'Einblenden', rise: 'Aufsteigen', scatter: 'Streuen', 'from-darkness': 'Aus der Dunkelheit', assemble: 'Zusammensetzen',
    normal: 'Normal', pinned: 'Gepinnte Bühne', horizontal: 'Horizontal', zoom: 'Zoom', 'camera-motion': 'Kamerabewegung',
    morph: 'Morph', zoomViewer: 'Zoom', fadeViewer: 'Überblenden',
    ritual: 'Rituell & warm', daylight: 'Helles Archiv', nocturne: 'Nachtstück', archive: 'Papier & Sammlung', network: 'Verknüpft & digital'
  };
  return <aside className="scroll-editor" aria-label="Kapitel bearbeiten">
    <div className="scroll-editor-heading"><div><span>Editor</span><strong>Station {String(index + 1).padStart(2, '0')}</strong></div><button onClick={onClose} aria-label="Editor schließen"><X size={18} /></button></div>
    <label>Titel<input value={station.title || ''} onChange={(event) => onChange({ title: event.target.value })} /></label>
    <label>Einleitung<textarea rows="7" value={stationCopy(station)} onChange={(event) => onChange({ introduction: event.target.value, description: event.target.value })} /></label>
    <div className="scroll-editor-behavior">
      <div><span>Stationsverhalten</span><small>Die Effekt-Sprache ist auch über WebMCP verfügbar.</small></div>
      <label>Layout<select value={behavior.layout} onChange={(event) => updateBehavior({ layout: event.target.value })}>{STATION_BEHAVIOR_OPTIONS.layout.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Eintritt<select value={behavior.entrance} onChange={(event) => updateBehavior({ entrance: event.target.value })}>{STATION_BEHAVIOR_OPTIONS.entrance.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Scroll-Verhalten<select value={behavior.scroll} onChange={(event) => updateBehavior({ scroll: event.target.value })}>{STATION_BEHAVIOR_OPTIONS.scroll.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Übergang zum Viewer<select value={behavior.viewerTransition} onChange={(event) => updateBehavior({ viewerTransition: event.target.value })}>{STATION_BEHAVIOR_OPTIONS.viewerTransition.map((value) => <option key={value} value={value}>{value === 'morph' ? 'Morph' : value === 'zoom' ? 'Zoom' : 'Überblenden'}</option>)}</select></label>
      <label>Stationswechsel<select value={behavior.stationTransition} onChange={(event) => updateBehavior({ stationTransition: event.target.value })}>{STATION_BEHAVIOR_OPTIONS.stationTransition.map((value) => <option key={value} value={value}>{value === 'veil' ? 'Vorhang' : value === 'crossfade' ? 'Überblenden' : value === 'light-shift' ? 'Lichtwechsel' : 'Ohne Effekt'}</option>)}</select></label>
      <div className="scroll-atmosphere-editor"><span><Palette size={13} /> Atmosphäre</span><label>Stimmung<select value={behavior.atmosphere.theme} onChange={(event) => updateAtmosphere({ theme: event.target.value })}>{STATION_BEHAVIOR_OPTIONS.atmosphere.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label><label>Akzent<input type="color" value={behavior.atmosphere.accent} onChange={(event) => updateAtmosphere({ accent: event.target.value })} /></label></div>
      <div className="scroll-editor-checks">
        {[['hoverTilt', 'Hover-Tilt'], ['objectFocus', 'Objektfokus'], ['connections', 'Verbindungen'], ['spotlight', 'Spotlight'], ['discoveryMode', 'Entdeckungsmodus']].map(([name, label]) => <label key={name}><input type="checkbox" checked={behavior.interactions[name]} onChange={(event) => updateInteraction(name, event.target.checked)} /><span>{label}</span></label>)}
      </div>
      <div className="scroll-editor-checks">{[['particles', 'Schwebeteilchen'], ['grain', 'Filmstruktur']].map(([name, label]) => <label key={name}><input type="checkbox" checked={behavior.atmosphere[name]} onChange={(event) => updateAtmosphere({ [name]: event.target.checked })} /><span>{label}</span></label>)}</div>
      <div className="scroll-editor-checks">{[['parallax', 'Parallax'], ['floating', 'Schweben'], ['magneticCursor', 'Magnetischer Cursor'], ['depthOfField', 'Tiefenschärfe'], ['clusterExplode', 'Cluster auflösen'], ['progressiveText', 'Text progressiv']].map(([name, label]) => <label key={name}><input type="checkbox" checked={behavior.motion[name]} onChange={(event) => updateMotion(name, event.target.checked)} /><span>{label}</span></label>)}</div>
    </div>
    <div className="scroll-editor-sound"><span>Soundscape</span><label>Audio-URL<input value={station.spatial?.audio?.url || ''} onChange={(event) => onChange({ spatial: { ...station.spatial, audio: { ...station.spatial?.audio, url: event.target.value } } })} placeholder="https://…/atmosphere.mp3" /></label><label>Lautstärke<input type="range" min="0" max="1" step="0.05" value={station.spatial?.audio?.volume ?? .6} onChange={(event) => onChange({ spatial: { ...station.spatial, audio: { ...station.spatial?.audio, volume: Number(event.target.value) } } })} /></label></div>
    <NarrativeEditor station={station} onChange={onChange} />
    <RelationsEditor station={station} onChange={onChange} />
    <div className="scroll-editor-note"><MousePointer2 size={15} /><p>Du bearbeitest dieselbe Scrolling-Seite, die Besucher später sehen.</p></div>
    <button type="button" className="scroll-editor-save" onClick={onSave}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Gespeichert' : 'Änderungen speichern'}</button>
  </aside>;
}

export default function ScrollingStory({ story, initialMode = 'visitor', backHref = '/', onSaveStory }) {
  const [stations, setStations] = useState(() => (Array.isArray(story?.stations) ? story.stations : []).filter(Boolean).map((station) => ({ ...station, behavior: normalizeStationBehavior(station.behavior) })));
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(initialMode === 'editor');
  const [saved, setSaved] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [viewerTransition, setViewerTransition] = useState('fade');
  const [viewerOrigin, setViewerOrigin] = useState('50% 50%');
  const [compareItems, setCompareItems] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef(null);
  const sectionRefs = useRef([]);
  const title = story?.branding?.title || story?.name || 'RIU Story';
  const subtitle = story?.branding?.subtitle || story?.description || '';
  const firstObject = stationItems(stations[0])[0] || null;
  const coverImage = story?.coverImage || (firstObject ? resolveSpatialThumbnailUrl(firstObject) : '');
  const totalObjects = useMemo(() => stations.reduce((sum, station) => sum + stationItems(station).length, 0), [stations]);
  const activeAudio = stations[activeIndex]?.spatial?.audio;

  useEffect(() => {
    const missing = stations.flatMap((station, stationIndex) => stationItems(station)
      .filter((item) => item.sourceType === 'sketchfab' && !resolveSpatialThumbnailUrl(item) && item.modelUrl)
      .map((item) => ({ stationIndex, itemId: item.id, modelUrl: item.modelUrl })));
    if (!missing.length) return undefined;
    let cancelled = false;
    Promise.all(missing.map(async (entry) => {
      try {
        const metadata = await resolveModelSourceMetadata(entry.modelUrl);
        return { ...entry, providerThumbnailUrl: String(metadata.providerThumbnailUrl || '').trim() };
      } catch { return { ...entry, providerThumbnailUrl: '' }; }
    })).then((resolved) => {
      if (cancelled) return;
      const available = resolved.filter((entry) => entry.providerThumbnailUrl);
      if (!available.length) return;
      setStations((current) => current.map((station, stationIndex) => ({ ...station, items: stationItems(station).map((item) => {
        const match = available.find((entry) => entry.stationIndex === stationIndex && entry.itemId === item.id && entry.modelUrl === item.modelUrl);
        return match && !resolveSpatialThumbnailUrl(item) ? { ...item, providerThumbnailUrl: match.providerThumbnailUrl } : item;
      }) })));
    });
    return () => { cancelled = true; };
  }, [stations]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveIndex(Number(visible.target.dataset.index));
    }, { rootMargin: '-25% 0px -55%', threshold: [0, .2, .5] });
    sectionRefs.current.filter(Boolean).forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [stations.length]);

  useEffect(() => {
    const previous = audioRef.current;
    if (!audioEnabled || !activeAudio?.url) {
      if (previous) { const fade = setInterval(() => { previous.volume = Math.max(0, previous.volume - .06); if (previous.volume <= 0) { clearInterval(fade); previous.pause(); previous.src = ''; } }, 45); audioRef.current = null; }
      return;
    }
    if (previous?.src === activeAudio.url) { previous.volume = Math.max(0, Math.min(1, Number(activeAudio.volume) || .5)); return; }
    const next = new Audio(activeAudio.url);
    const targetVolume = Math.max(0, Math.min(1, Number(activeAudio.volume) || .5));
    next.loop = true; next.volume = 0;
    next.play().catch(() => setAudioEnabled(false));
    audioRef.current = next;
    let step = 0;
    const fade = setInterval(() => { step += 1; next.volume = Math.min(targetVolume, targetVolume * step / 16); if (previous) previous.volume = Math.max(0, previous.volume * .82); if (step >= 16) { clearInterval(fade); if (previous) { previous.pause(); previous.src = ''; } } }, 45);
  }, [activeAudio?.url, activeAudio?.volume, audioEnabled]);
  useEffect(() => () => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.src = ''; }, []);

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
  const changeViewer = (callback, transition) => {
    if (transition === 'morph' && document.startViewTransition) document.startViewTransition(() => flushSync(callback));
    else callback();
  };
  const openObject = (item, transition = 'fade', sourceElement = null) => {
    setViewerTransition(transition);
    if (sourceElement) { const bounds = sourceElement.getBoundingClientRect(); setViewerOrigin(`${bounds.left + bounds.width / 2}px ${bounds.top + bounds.height / 2}px`); }
    else setViewerOrigin('50% 50%');
    changeViewer(() => setOpenItem(item), transition);
  };
  const closeObject = () => changeViewer(() => setOpenItem(null), viewerTransition);
  const toggleCompare = (item) => setCompareItems((current) => current.some((entry) => entry.id === item.id) ? current.filter((entry) => entry.id !== item.id) : [...current.slice(-1), item]);
  const removeCompare = (itemId) => { setCompareItems((current) => current.filter((item) => item.id !== itemId)); setCompareOpen(false); };

  return <main className={`scroll-story ${editorOpen ? 'has-editor' : ''}`}>
    <header className="scroll-header">
      <a href={backHref} className="scroll-brand" aria-label="Zurück"><span className="scroll-mark"><i /></span><b>RIU</b></a>
      <button className="scroll-chapter-trigger" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}><Menu size={15} /><span>Kapitel</span><b>{String(activeIndex + 1).padStart(2, '0')} / {String(stations.length).padStart(2, '0')}</b></button>
      {initialMode === 'editor' ? <button className={`scroll-edit-toggle ${editorOpen ? 'is-active' : ''}`} type="button" onClick={() => setEditorOpen((value) => !value)}><MousePointer2 size={14} />{editorOpen ? 'Editor ausblenden' : 'Bearbeiten'}</button> : <div className="scroll-header-actions">{activeAudio?.url && <button type="button" className={audioEnabled ? 'is-active' : ''} onClick={() => setAudioEnabled((value) => !value)} aria-label={audioEnabled ? 'Atmosphäre ausschalten' : 'Atmosphäre einschalten'}>{audioEnabled ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>}<span className="scroll-progress"><i style={{ '--progress': `${((activeIndex + 1) / Math.max(stations.length, 1)) * 100}%` }} /></span></div>}
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
        const stationBehavior = normalizeStationBehavior(station.behavior);
        return <section key={station.id || index} className={`scroll-chapter ${index % 2 ? 'is-reversed' : ''} ${index === activeIndex ? 'is-active' : ''} transition-${stationBehavior.stationTransition}`} data-index={index} ref={(node) => { sectionRefs.current[index] = node; }}>
          <div className="scroll-chapter-heading"><div className="scroll-chapter-number"><span>{String(index + 1).padStart(2, '0')}</span><i /></div><div><span>Station {String(index + 1).padStart(2, '0')}</span><h2>{station.title || `Station ${index + 1}`}</h2><p>{stationCopy(station)}</p></div></div>
          {items.length > 1 ? <ScrollStationStage station={station} stationIndex={index} onOpen={openObject} openItemId={openItem?.id} /> : items.length === 1 ? <div className="scroll-object-grid is-single"><ObjectCard item={items[0]} stationNumber={index + 1} index={0} onOpen={(item, source) => openObject(item, normalizeStationBehavior(station.behavior).viewerTransition, source)} /></div> : <div className="scroll-empty">Dieses Kapitel wird noch kuratiert.</div>}
          {index < stations.length - 1 && <button className="scroll-next" type="button" onClick={() => jumpTo(index + 1)}><span>Nächstes Kapitel</span><b>{stations[index + 1]?.title}</b><ChevronDown /></button>}
        </section>;
      })}
    </div>

    <StoryTrail stations={stations} activeIndex={activeIndex} onJump={jumpTo} />
    {compareItems.length > 0 && <div className="scroll-compare-tray"><GitCompare size={16} /><span>{compareItems.length === 1 ? 'Noch ein Objekt für den Vergleich wählen' : `${compareItems[0].title} × ${compareItems[1].title}`}</span>{compareItems.length === 2 && <button onClick={() => { setCompareOpen(true); setOpenItem(null); }}>Vergleichen</button>}<button onClick={() => setCompareItems([])} aria-label="Vergleich leeren"><X size={15} /></button></div>}

    <footer className="scroll-story-footer"><a href={backHref}><ArrowLeft size={15} /> Zurück zu den Stories</a><span>RIU — Räumliche Geschichten</span></footer>
    {editorOpen && <EditorPanel station={stations[activeIndex]} index={activeIndex} onChange={updateStation} onSave={save} saved={saved} onClose={() => setEditorOpen(false)} />}
    <ObjectDialog item={openItem} onClose={closeObject} onCompare={toggleCompare} compareSelected={compareItems.some((item) => item.id === openItem?.id)} transition={viewerTransition} origin={viewerOrigin} />
    {compareOpen && <ComparisonView items={compareItems} onClose={() => setCompareOpen(false)} onRemove={removeCompare} />}
  </main>;
}
