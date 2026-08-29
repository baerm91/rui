import React from 'react';
import { ExternalLink, Layers3 } from 'lucide-react';
import { getMaterialsForSurface, getSpatialMaterial, SPATIAL_SURFACES } from '../../utils/spatialMaterials.js';

const RangeControl = ({ label, value, min, max, step, suffix = '', onChange }) => (
  <label className="spatial-range-field">
    <span>{label}<b>{value}{suffix}</b></span>
    <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

export function SpatialMaterialPicker({ surfaceMaterials, selectedSurface, onSelectSurface, onChange }) {
  const surface = surfaceMaterials[selectedSurface];
  const selectedMaterial = getSpatialMaterial(surface.materialId);
  const selectMaterial = (material) => onChange(selectedSurface, {
    ...surface,
    materialId: material.id,
    tileSize: material.tileSize,
    roughness: material.roughness,
    normalStrength: material.normalStrength ?? 0
  });

  return <div className="spatial-material-picker">
    <div className="spatial-material-heading">
      <span><Layers3 size={14} /> Oberflächenmaterial</span>
      <small>Fläche im Raum oder hier auswählen</small>
    </div>
    <div className="spatial-surface-tabs" role="tablist" aria-label="Zu bearbeitende Fläche">
      {SPATIAL_SURFACES.map((entry) => <button
        key={entry.id}
        type="button"
        role="tab"
        aria-selected={selectedSurface === entry.id}
        className={selectedSurface === entry.id ? 'is-active' : ''}
        onClick={() => onSelectSurface(entry.id)}
      >{entry.label}</button>)}
    </div>
    <div className="spatial-material-grid" role="listbox" aria-label={`Material für ${SPATIAL_SURFACES.find((entry) => entry.id === selectedSurface)?.label}`}>
      {getMaterialsForSurface(selectedSurface).map((material) => <button
        key={material.id}
        type="button"
        role="option"
        aria-selected={surface.materialId === material.id}
        className={surface.materialId === material.id ? 'is-active' : ''}
        onClick={() => selectMaterial(material)}
      >
        <span className="spatial-material-preview" style={material.preview ? { backgroundImage: `url(${material.preview})` } : { backgroundColor: material.color }} />
        <b>{material.name}</b>
        <small>{material.maps ? 'PBR · 1K' : 'Matt'}</small>
      </button>)}
    </div>
    <div className="spatial-material-controls">
      <RangeControl label="Kachelgröße" value={surface.tileSize} min={.25} max={12} step={.05} suffix=" m" onChange={(tileSize) => onChange(selectedSurface, { ...surface, tileSize })} />
      <RangeControl label="Drehung" value={surface.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => onChange(selectedSurface, { ...surface, rotation })} />
      <RangeControl label="Rauheit" value={surface.roughness} min={.15} max={1} step={.01} onChange={(roughness) => onChange(selectedSurface, { ...surface, roughness })} />
      <RangeControl label="Strukturwirkung" value={surface.normalStrength} min={0} max={2} step={.05} onChange={(normalStrength) => onChange(selectedSurface, { ...surface, normalStrength })} />
    </div>
    {selectedMaterial.sourceUrl && <a className="spatial-material-source" href={selectedMaterial.sourceUrl} target="_blank" rel="noreferrer">
      {selectedMaterial.source} · {selectedMaterial.license} <ExternalLink size={11} />
    </a>}
  </div>;
}
