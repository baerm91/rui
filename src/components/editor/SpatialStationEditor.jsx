import React, { useRef, useState } from 'react';
import { Box, Camera, Check, ImagePlus, Lightbulb, Link2, Music2, Play, Plus, Trash2 } from 'lucide-react';
import { createSpatialItem, isValidSpatialModelUrl } from '../../utils/spatialStory.js';
import { getModelSourceAdapter } from '../../utils/modelSourceAdapters.js';

const VectorFields = ({ label, value = [0, 0, 0], onChange, step = .1 }) => <label className="spatial-vector-field"><span>{label}</span><span>{['X', 'Y', 'Z'].map((axis, index) => <input key={axis} type="number" step={step} value={value[index] ?? 0} aria-label={`${label} ${axis}`} onChange={(event) => { const next = [...value]; next[index] = Number(event.target.value); onChange(next); }} />)}</span></label>;
const RangeField = ({ label, value, min, max, step, onChange, suffix = '' }) => <label className="spatial-range-field"><span>{label}<b>{value}{suffix}</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;

export function SpatialStationEditor({ station, index, onUpdateStation, onUpdateItem, onAddItem, onRemoveItem, onCaptureCamera }) {
  const [tab, setTab] = useState('content');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [resolving, setResolving] = useState(false);
  const fileRef = useRef(null);
  const selectedItem = station.items?.find((item) => item.id === station.selectedItemId) || station.items?.[0];
  const updateSpatial = (section, patch) => onUpdateStation(index, { spatial: { ...station.spatial, [section]: { ...station.spatial?.[section], ...patch } } });
  const addModel = async () => {
    const trimmed = url.trim();
    if (!isValidSpatialModelUrl(trimmed)) { setUrlError('Bitte eine Sketchfab-, GLB- oder glTF-URL eingeben.'); return; }
    setResolving(true); setUrlError('');
    const adapter = getModelSourceAdapter(trimmed);
    let metadata = {};
    try { metadata = await adapter?.resolveMetadata(trimmed) || {}; } catch { /* URL remains usable without metadata. */ }
    const item = createSpatialItem({ modelUrl: trimmed, ...metadata }, station.items?.length || 0);
    onAddItem(index, item);
    setUrl(''); setResolving(false);
  };
  const uploadThumbnail = (file) => {
    if (!file?.type?.startsWith('image/') || !selectedItem) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateItem(index, selectedItem.id, { thumbnailUrl: reader.result });
    reader.readAsDataURL(file);
  };
  const tabs = [['content', 'Inhalt', Box], ['camera', 'Kamera', Camera], ['light', 'Licht', Lightbulb], ['audio', 'Audio', Music2]];
  return <section className="spatial-editor-card">
    <div className="spatial-editor-tabs">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><Icon size={13} />{label}</button>)}</div>
    {tab === 'content' && <div className="spatial-editor-section">
      <label>Stationstitel<input value={station.title || ''} onChange={(event) => onUpdateStation(index, { title: event.target.value })} /></label>
      <label>Einführungstext<textarea rows="4" value={station.introduction ?? station.description ?? ''} onChange={(event) => onUpdateStation(index, { introduction: event.target.value, description: event.target.value })} /></label>
      <div className="spatial-add-model"><span><Link2 size={14} /> Modell über URL hinzufügen</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Sketchfab, .glb oder .gltf" /><button onClick={addModel} disabled={resolving}><Plus size={13} />{resolving ? 'Prüfen …' : 'Hinzufügen'}</button>{urlError && <small>{urlError}</small>}</div>
      <div className="spatial-item-list">{(station.items || []).map((item) => <button key={item.id} className={item.id === selectedItem?.id ? 'is-active' : ''} onClick={() => onUpdateStation(index, { selectedItemId: item.id })}><span>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <Box size={18} />}</span><b>{item.title}</b><small>{item.id === station.initialItemId ? `Startmodell · ${item.sourceType}` : item.sourceType}</small></button>)}</div>
      {selectedItem && <div className="spatial-item-settings">
        <div className="spatial-item-heading"><strong>Ausgewähltes Objekt</strong><button onClick={() => onRemoveItem(index, selectedItem.id)}><Trash2 size={13} /> Entfernen</button></div>
        <button className={`spatial-start-model ${station.initialItemId === selectedItem.id ? 'is-active' : ''}`} type="button" onClick={() => onUpdateStation(index, { initialItemId: selectedItem.id })} disabled={station.initialItemId === selectedItem.id}>{station.initialItemId === selectedItem.id ? <Check size={13} /> : <Play size={13} />}{station.initialItemId === selectedItem.id ? 'Startmodell dieser Station' : 'Als Startmodell festlegen'}</button>
        <label>Titel<input value={selectedItem.title} onChange={(event) => onUpdateItem(index, selectedItem.id, { title: event.target.value })} /></label>
        <label>Beschreibung<textarea rows="2" value={selectedItem.description} onChange={(event) => onUpdateItem(index, selectedItem.id, { description: event.target.value })} /></label>
        <label>Thumbnail-URL<input value={selectedItem.thumbnailUrl} onChange={(event) => onUpdateItem(index, selectedItem.id, { thumbnailUrl: event.target.value })} /></label>
        <button className="spatial-upload" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> Eigenes Thumbnail hochladen</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => uploadThumbnail(event.target.files?.[0])} />
        <VectorFields label="Thumbnail-Position" value={selectedItem.thumbnailTransform.position} onChange={(position) => onUpdateItem(index, selectedItem.id, { thumbnailTransform: { ...selectedItem.thumbnailTransform, position } })} />
        <RangeField label="Thumbnail-Größe" value={selectedItem.thumbnailTransform.scale} min={.35} max={2.5} step={.05} onChange={(scale) => onUpdateItem(index, selectedItem.id, { thumbnailTransform: { ...selectedItem.thumbnailTransform, scale } })} />
        <VectorFields label="Modell-Position" value={selectedItem.modelTransform.position} onChange={(position) => onUpdateItem(index, selectedItem.id, { modelTransform: { ...selectedItem.modelTransform, position } })} />
        <VectorFields label="Modell-Rotation" value={selectedItem.modelTransform.rotation} onChange={(rotation) => onUpdateItem(index, selectedItem.id, { modelTransform: { ...selectedItem.modelTransform, rotation } })} />
        <RangeField label="Modell-Skalierung" value={selectedItem.modelTransform.scale} min={.02} max={10} step={.02} onChange={(scale) => onUpdateItem(index, selectedItem.id, { modelTransform: { ...selectedItem.modelTransform, scale } })} />
        <div className="grid grid-cols-2 gap-2"><label>Quelle<input value={selectedItem.attribution} onChange={(event) => onUpdateItem(index, selectedItem.id, { attribution: event.target.value })} /></label><label>Lizenz<input value={selectedItem.license} onChange={(event) => onUpdateItem(index, selectedItem.id, { license: event.target.value })} /></label></div>
      </div>}
    </div>}
    {tab === 'camera' && <div className="spatial-editor-section">
      <VectorFields label="Stationsposition" value={station.spatial.position} onChange={(position) => onUpdateStation(index, { spatial: { ...station.spatial, position } })} />
      <VectorFields label="Stationsausrichtung" value={station.spatial.rotation} onChange={(rotation) => onUpdateStation(index, { spatial: { ...station.spatial, rotation } })} />
      <VectorFields label="Kameraposition" value={station.spatial.camera.position} onChange={(position) => updateSpatial('camera', { position })} />
      <VectorFields label="Kamera-Zielpunkt" value={station.spatial.camera.target} onChange={(target) => updateSpatial('camera', { target })} />
      <RangeField label="Blickwinkel" value={station.spatial.camera.fov} min={25} max={100} step={1} suffix="°" onChange={(fov) => updateSpatial('camera', { fov })} />
      <RangeField label="Bewegungsradius" value={station.spatial.movementRadius} min={1} max={30} step={.5} suffix=" m" onChange={(movementRadius) => onUpdateStation(index, { spatial: { ...station.spatial, movementRadius } })} />
      <button className="spatial-capture" onClick={() => onCaptureCamera(index)}><Camera size={14} /> Aktuelle Ansicht als Eintrittsperspektive übernehmen</button>
    </div>}
    {tab === 'light' && <div className="spatial-editor-section">
      <label>Lichtfarbe<input type="color" value={station.spatial.lighting.keyLightColor} onChange={(event) => updateSpatial('lighting', { keyLightColor: event.target.value })} /></label>
      <RangeField label="Hauptlicht" value={station.spatial.lighting.keyLightIntensity} min={0} max={8} step={.1} onChange={(keyLightIntensity) => updateSpatial('lighting', { keyLightIntensity })} />
      <RangeField label="Umgebungslicht" value={station.spatial.lighting.ambientIntensity} min={0} max={3} step={.05} onChange={(ambientIntensity) => updateSpatial('lighting', { ambientIntensity })} />
      <VectorFields label="Lichtposition" value={station.spatial.lighting.keyLightPosition} onChange={(keyLightPosition) => updateSpatial('lighting', { keyLightPosition })} />
      <VectorFields label="Lichtrichtung / Ziel" value={station.spatial.lighting.keyLightTarget} onChange={(keyLightTarget) => updateSpatial('lighting', { keyLightTarget })} />
      <label>Stationsmaterial<select value={station.spatial.wallMaterial} onChange={(event) => onUpdateStation(index, { spatial: { ...station.spatial, wallMaterial: event.target.value } })}><option value="warm-white">Warmweiß</option><option value="limestone">Kalkstein</option><option value="soft-grey">Hellgrau</option></select></label>
    </div>}
    {tab === 'audio' && <div className="spatial-editor-section">
      <label>Audiodatei oder Audio-URL<input value={station.spatial.audio.url} onChange={(event) => updateSpatial('audio', { url: event.target.value })} placeholder="https://…/atmosphäre.ogg" /></label>
      <RangeField label="Lautstärke" value={station.spatial.audio.volume} min={0} max={1} step={.05} onChange={(volume) => updateSpatial('audio', { volume })} />
      <RangeField label="Räumliche Reichweite" value={station.spatial.audio.range} min={1} max={50} step={1} suffix=" m" onChange={(range) => updateSpatial('audio', { range })} />
      <label className="spatial-check"><input type="checkbox" checked={station.spatial.audio.spatial} onChange={(event) => updateSpatial('audio', { spatial: event.target.checked })} /> Räumlichen Klang verwenden</label>
      <label className="spatial-check"><input type="checkbox" checked={station.spatial.audio.autoplay} onChange={(event) => updateSpatial('audio', { autoplay: event.target.checked })} /> Beim Betreten automatisch starten</label>
    </div>}
  </section>;
}
