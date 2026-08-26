import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ArrowLeft, Box, Check, ChevronLeft, ChevronRight, Footprints, ImagePlus, Maximize2, MousePointer2, Pencil, Plus, Rotate3D, Save, X } from 'lucide-react';
import { DEFAULT_EXHIBITION, EXHIBITION_STORAGE_KEY, MODEL_LIBRARY, normalizeExhibition } from './exhibitionData.js';
import './exhibitionRoom.css';

const modelById = (id) => MODEL_LIBRARY.find((model) => model.id === id) || MODEL_LIBRARY[0];

function createArtifact(modelId) {
  const group = new THREE.Group();
  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .08, ...extra });
  if (modelId === 'vessel') {
    const points = [
      [0, -2.1], [.82, -1.96], [1.12, -1.3], [1.22, -.15], [.92, .76], [.66, 1.32], [.63, 1.8], [.84, 2.02]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const vessel = new THREE.Mesh(new THREE.LatheGeometry(points, 64), standard('#b76f48'));
    vessel.castShadow = true;
    group.add(vessel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.74, .11, 18, 64), standard('#875039'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 2.02;
    group.add(rim);
  } else if (modelId === 'fragment') {
    const stone = standard('#c9c1ae', { roughness: .9 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.83, 1.05, 3.55, 10), stone);
    shaft.castShadow = true;
    shaft.rotation.z = -.08;
    group.add(shaft);
    const capital = new THREE.Mesh(new THREE.BoxGeometry(2.3, .58, 1.7, 4, 2, 3), stone);
    capital.position.set(.08, 1.95, 0);
    capital.rotation.set(.04, .12, -.05);
    capital.castShadow = true;
    group.add(capital);
    for (let index = -1; index <= 1; index += 1) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.8, 1.74), standard('#a8a08e'));
      groove.position.set(index * .4, -.08, 0);
      group.add(groove);
    }
  } else {
    const bronze = standard('#527c72', { metalness: .48, roughness: .42 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, .34, 64), bronze);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    group.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, .13, 18, 64), standard('#92a99a', { metalness: .55 }));
    ring.position.z = .2;
    group.add(ring);
    const center = new THREE.Mesh(new THREE.SphereGeometry(.42, 32, 20), standard('#a78651', { metalness: .55 }));
    center.position.z = .32;
    group.add(center);
    for (let index = 0; index < 8; index += 1) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(.11, 18, 12), standard('#b8a678', { metalness: .6 }));
      const angle = index / 8 * Math.PI * 2;
      stud.position.set(Math.cos(angle) * 1.48, Math.sin(angle) * 1.48, .29);
      group.add(stud);
    }
  }
  group.rotation.y = -.35;
  return group;
}

function ArtifactCanvas({ modelId, resetToken }) {
  const canvasRef = useRef(null);
  const artifactRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
    camera.position.set(0, .3, 10);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    scene.add(new THREE.HemisphereLight(0xfffbef, 0x6f756f, 2.8));
    const key = new THREE.DirectionalLight(0xffe9cf, 5.2);
    key.position.set(-4, 6, 5);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8d4cf, 3.2);
    rim.position.set(5, 2, -3);
    scene.add(rim);
    const artifact = createArtifact(modelId);
    artifactRef.current = artifact;
    scene.add(artifact);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 6.5;
    controls.maxDistance = 14;
    controls.autoRotate = true;
    controls.autoRotateSpeed = .55;
    controlsRef.current = controls;
    let frame;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      artifact.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose?.();
      });
      renderer.dispose();
    };
  }, [modelId]);

  useEffect(() => {
    if (!controlsRef.current || !artifactRef.current) return;
    controlsRef.current.reset();
    artifactRef.current.rotation.set(0, -.35, 0);
  }, [resetToken]);

  return <canvas ref={canvasRef} className="exhibition-artifact-canvas" aria-label={`${modelById(modelId).name} als interaktives 3D-Modell`} />;
}

function RoomBackdrop() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#d8d5cc');
    scene.fog = new THREE.Fog('#d8d5cc', 12, 30);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 60);
    camera.position.set(0, 3.4, 12);
    camera.lookAt(0, 2.7, 0);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const roomMaterial = new THREE.MeshStandardMaterial({ color: '#dad7ce', roughness: .94, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), new THREE.MeshStandardMaterial({ color: '#c8c3b8', roughness: .88 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(34, 12), roomMaterial);
    back.position.set(0, 6, -4);
    scene.add(back);
    [-9.8, 9.8].forEach((x) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), roomMaterial);
      wall.rotation.y = Math.PI / 2;
      wall.position.set(x, 6, 2);
      scene.add(wall);
    });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.5, .22, 1.05), new THREE.MeshStandardMaterial({ color: '#8f887a', roughness: .85 }));
    bench.position.set(-5.2, .95, 4.5);
    scene.add(bench);
    [-6.8, -3.6].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.18, .9, .75), bench.material);
      leg.position.set(x, .45, 4.5);
      scene.add(leg);
    });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x756f62, 2.6));
    const light = new THREE.DirectionalLight(0xfff4df, 3.2);
    light.position.set(-6, 11, 7);
    scene.add(light);
    let frame;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const animate = () => { renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
    animate();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); };
  }, []);
  return <canvas ref={canvasRef} className="exhibition-room-canvas" aria-hidden="true" />;
}

function EditableThumbnail({ thumbnail, model, selected, onActivate, onSelect, onChange, onRemove, editorMode, stationRef }) {
  const beginPointerAction = (event, type) => {
    if (!editorMode) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = stationRef.current?.getBoundingClientRect();
    if (!rect) return;
    const start = { x: event.clientX, y: event.clientY, itemX: thumbnail.x, itemY: thumbnail.y, width: thumbnail.width };
    const move = (moveEvent) => {
      if (type === 'move') {
        onChange({
          x: Math.max(0, Math.min(100 - thumbnail.width, start.itemX + ((moveEvent.clientX - start.x) / rect.width) * 100)),
          y: Math.max(0, Math.min(76, start.itemY + ((moveEvent.clientY - start.y) / rect.height) * 100))
        });
      } else {
        onChange({ width: Math.max(16, Math.min(42, start.width + ((moveEvent.clientX - start.x) / rect.width) * 100)) });
      }
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  return (
    <article
      className={`exhibition-thumbnail ${selected ? 'is-selected' : ''} ${editorMode ? 'is-editable' : ''}`}
      style={{ left: `${thumbnail.x}%`, top: `${thumbnail.y}%`, width: `${thumbnail.width}%` }}
      onClick={() => editorMode ? onSelect() : onActivate()}
      onPointerDown={(event) => { if (editorMode) onSelect(); beginPointerAction(event, 'move'); }}
      role={editorMode ? undefined : 'button'}
      tabIndex={editorMode ? -1 : 0}
      onKeyDown={(event) => { if (!editorMode && (event.key === 'Enter' || event.key === ' ')) onActivate(); }}
    >
      <div className="exhibition-thumbnail-image"><img src={thumbnail.image} alt="" /></div>
      <div className="exhibition-thumbnail-copy"><span>{model.name}</span><small>{model.detail}</small></div>
      {!editorMode && <span className="exhibition-thumbnail-index">{selected ? <Check size={13} /> : String(MODEL_LIBRARY.findIndex((item) => item.id === model.id) + 1).padStart(2, '0')}</span>}
      {editorMode && <>
        <button className="thumbnail-remove" type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} aria-label="Bild entfernen"><X size={13} /></button>
        <button className="thumbnail-resize" type="button" onPointerDown={(event) => beginPointerAction(event, 'resize')} aria-label="Bildgröße ändern"><Maximize2 size={12} /></button>
      </>}
    </article>
  );
}

export default function ExhibitionRoom({ storyId = '', storyTitle = '', storyDescription = '', initialMode = 'visitor', backHref = '/' }) {
  const storageKey = storyId ? `${EXHIBITION_STORAGE_KEY}:${storyId}` : EXHIBITION_STORAGE_KEY;
  const [exhibition, setExhibition] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return normalizeExhibition(JSON.parse(saved));
      const initial = structuredClone(DEFAULT_EXHIBITION);
      if (storyId) initial.id = storyId;
      if (storyTitle) initial.title = storyTitle;
      if (storyTitle) initial.stations[0].title = storyTitle;
      if (storyDescription) initial.stations[0].introduction = storyDescription;
      return initial;
    } catch { return structuredClone(DEFAULT_EXHIBITION); }
  });
  const [mode, setMode] = useState(initialMode);
  const [editorSelection, setEditorSelection] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [resetToken, setResetToken] = useState(0);
  const stationRef = useRef(null);
  const fileRef = useRef(null);
  const station = exhibition.stations.find((item) => item.id === exhibition.activeStationId) || exhibition.stations[0];
  const activeModel = modelById(station.activeModelId);
  const selectedThumbnail = station.thumbnails.find((thumbnail) => thumbnail.id === editorSelection);

  const updateStation = useCallback((changes) => {
    setExhibition((current) => ({
      ...current,
      stations: current.stations.map((item) => item.id === station.id ? { ...item, ...changes } : item)
    }));
  }, [station.id]);

  const updateThumbnail = (id, changes) => updateStation({
    thumbnails: station.thumbnails.map((thumbnail) => thumbnail.id === id ? { ...thumbnail, ...changes } : thumbnail)
  });

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(exhibition));
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 1800);
  };

  const addImage = (file) => {
    if (!file?.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const index = station.thumbnails.length;
      const thumbnail = {
        id: `thumb-${Date.now()}`,
        modelId: MODEL_LIBRARY[index % MODEL_LIBRARY.length].id,
        image: reader.result,
        x: 5 + (index % 3) * 30,
        y: index < 3 ? 8 : 45,
        width: 25
      };
      updateStation({ thumbnails: [...station.thumbnails, thumbnail] });
      setEditorSelection(thumbnail.id);
    };
    reader.readAsDataURL(file);
  };

  const stationNumber = useMemo(() => String(station.order).padStart(2, '0'), [station.order]);
  useEffect(() => {
    document.title = 'RIU — Interaktiver 3D-Ausstellungsraum';
  }, []);
  return (
    <main className={`exhibition-shell mode-${mode}`}>
      <RoomBackdrop />
      <div className="exhibition-noise" />
      <header className="exhibition-header">
        <a href={backHref} className="exhibition-brand" aria-label="Zurück zu RIU"><span className="exhibition-mark"><i /></span><b>RIU</b><small>Räumliche Geschichten</small></a>
        <div className="exhibition-mode-switch" aria-label="Ansicht wechseln">
          <button className={mode === 'visitor' ? 'is-active' : ''} onClick={() => { setMode('visitor'); setEditorSelection(null); }}><Footprints size={14} /> Besucher</button>
          <button className={mode === 'editor' ? 'is-active' : ''} onClick={() => setMode('editor')}><Pencil size={13} /> Editor</button>
        </div>
        <div className="exhibition-progress"><span>{stationNumber}</span><i /><span>{String(exhibition.stations.length).padStart(2, '0')}</span></div>
      </header>

      <section className="exhibition-station" ref={stationRef}>
        <div className="exhibition-copy">
          <span className="exhibition-eyebrow">{station.eyebrow}</span>
          {mode === 'editor' ? <>
            <textarea className="exhibition-title-input" value={station.title} onChange={(event) => updateStation({ title: event.target.value })} aria-label="Stationstitel" />
            <textarea className="exhibition-intro-input" value={station.introduction} onChange={(event) => updateStation({ introduction: event.target.value })} aria-label="Einführungstext" />
          </> : <>
            <h1>{station.title.split('\n').map((line) => <React.Fragment key={line}>{line}<br /></React.Fragment>)}</h1>
            <p>{station.introduction}</p>
          </>}
        </div>

        <div className="exhibition-model-stage">
          <div className="model-stage-rule"><span>Ausgewähltes Objekt</span><i /><span>{activeModel.name}</span></div>
          <ArtifactCanvas modelId={station.activeModelId} resetToken={resetToken} />
          <button className="model-reset" type="button" onClick={() => setResetToken((value) => value + 1)}><Rotate3D size={15} /> Ansicht zurücksetzen</button>
          <div className="model-interaction-hint"><MousePointer2 size={14} /><span>Ziehen zum Drehen</span><i />Scrollen zum Zoomen</div>
        </div>

        <div className="exhibition-thumbnail-field" aria-label="Objektauswahl">
          {station.thumbnails.map((thumbnail) => (
            <EditableThumbnail
              key={thumbnail.id}
              thumbnail={thumbnail}
              model={modelById(thumbnail.modelId)}
              selected={mode === 'editor' ? editorSelection === thumbnail.id : station.activeModelId === thumbnail.modelId}
              editorMode={mode === 'editor'}
              stationRef={stationRef}
              onActivate={() => updateStation({ activeModelId: thumbnail.modelId })}
              onSelect={() => setEditorSelection(thumbnail.id)}
              onChange={(changes) => { updateThumbnail(thumbnail.id, changes); setEditorSelection(thumbnail.id); }}
              onRemove={() => { updateStation({ thumbnails: station.thumbnails.filter((item) => item.id !== thumbnail.id) }); setEditorSelection(null); }}
            />
          ))}
        </div>
      </section>

      <footer className="exhibition-footer">
        <a href={backHref} className="exhibition-back"><ArrowLeft size={14} /> {storyId ? 'Meine Stories' : 'Galerie'}</a>
        <div className="station-stepper"><button disabled aria-label="Vorherige Station"><ChevronLeft /></button><span><b>{stationNumber}</b> / {String(exhibition.stations.length).padStart(2, '0')}</span><button disabled aria-label="Nächste Station"><ChevronRight /></button></div>
        <span className="walk-hint"><Footprints size={15} /> Rundgang · Station {stationNumber}</span>
      </footer>

      {mode === 'editor' && <aside className="exhibition-editor-panel">
        <div className="editor-panel-heading"><div><span>Stationseditor</span><strong>{stationNumber} · Ursprung</strong></div><button onClick={() => setMode('visitor')} aria-label="Editor schließen"><X /></button></div>
        <div className="editor-tip"><MousePointer2 size={16} /><p><strong>Direkt auf der Fläche bearbeiten</strong>Bildkarten ziehen und an der unteren Ecke skalieren.</p></div>
        <button className="editor-add-image" type="button" onClick={() => fileRef.current?.click()}><ImagePlus size={17} /><span><strong>Thumbnail hinzufügen</strong><small>JPG, PNG oder WebP</small></span><Plus size={15} /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { addImage(event.target.files?.[0]); event.target.value = ''; }} />
        <div className="editor-field">
          <label>Ausgewählte Bildkarte</label>
          {selectedThumbnail ? <>
            <select value={selectedThumbnail.modelId} onChange={(event) => updateThumbnail(selectedThumbnail.id, { modelId: event.target.value })}>
              {MODEL_LIBRARY.map((model) => <option value={model.id} key={model.id}>{model.name} — {model.detail}</option>)}
            </select>
            <div className="editor-position-grid"><span>X <b>{Math.round(selectedThumbnail.x)}%</b></span><span>Y <b>{Math.round(selectedThumbnail.y)}%</b></span><span>Breite <b>{Math.round(selectedThumbnail.width)}%</b></span></div>
          </> : <p>Wählen Sie eine Bildkarte auf der Stationsfläche aus.</p>}
        </div>
        <div className="editor-architecture"><Box size={17} /><p><strong>Bereit für den Ausbau</strong>Stationen, Modellquellen und Layoutdaten sind getrennt gespeichert. Sketchfab kann als weiterer Modell-Adapter ergänzt werden.</p></div>
        <button className="editor-save" type="button" onClick={save}>{saveState === 'saved' ? <Check size={16} /> : <Save size={16} />}{saveState === 'saved' ? 'Lokal gespeichert' : 'Ausstellung speichern'}</button>
      </aside>}
    </main>
  );
}
