import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ArrowLeft, Box, Check, ChevronLeft, ChevronRight, Footprints, MousePointer2, Rotate3D, Volume2, VolumeX } from 'lucide-react';
import { EditorSidebar } from '../components/editor/EditorSidebar.jsx';
import { getModelSourceAdapter } from '../utils/modelSourceAdapters.js';
import { normalizeSpatialItems, normalizeSpatialStation } from '../utils/spatialStory.js';
import './exhibitionRoom.css';

const materialColors = { 'warm-white': '#ded9cd', limestone: '#c9c0ae', 'soft-grey': '#c9cbc7' };
const disposeObject = (root) => root?.traverse((object) => {
  object.geometry?.dispose?.();
  (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach((material) => material.dispose?.());
});
const normalizeStoryStations = (story) => (story?.stations || []).map((station, index) => ({
  ...station,
  introduction: station.introduction ?? station.description ?? '',
  spatial: normalizeSpatialStation(station, index),
  items: normalizeSpatialItems(station.items),
  selectedItemId: station.selectedItemId || station.items?.[0]?.id || null
}));

function SpatialRoomCanvas({ stations, stationIndex, selectedItem, editorMode, overviewMode, onCameraReady }) {
  const canvasRef = useRef(null);
  const modelRootRef = useRef(null);
  const runtimeRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dedbd2');
    scene.fog = new THREE.Fog('#dedbd2', 13, 42);
    const camera = new THREE.PerspectiveCamera(45, 1, .05, 160);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 16;
    const world = new THREE.Group();
    scene.add(world);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), new THREE.MeshStandardMaterial({ color: '#c9c4b8', roughness: .9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    world.add(floor);
    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    modelRootRef.current = modelRoot;
    const hemi = new THREE.HemisphereLight(0xfff9ed, 0x77746c, 1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffead0, 1.2);
    key.castShadow = true;
    scene.add(key, key.target);
    const rebuildStations = () => {
      [...world.children].filter((child) => child !== floor).forEach((child) => { world.remove(child); disposeObject(child); });
      stations.forEach((station, index) => {
        const spatial = station.spatial;
        const group = new THREE.Group();
        group.position.fromArray(spatial.position);
        group.rotation.fromArray(spatial.rotation);
        const wallMat = new THREE.MeshStandardMaterial({ color: materialColors[spatial.wallMaterial] || materialColors['warm-white'], roughness: .96, side: THREE.DoubleSide });
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.5, 24, 10), wallMat);
        wall.position.y = 2.25;
        wall.receiveShadow = true;
        group.add(wall);
        [-1, 1].forEach((direction) => {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.5, 12, 8), wallMat);
          wing.position.set(direction * 4.6, 2.25, 1.1);
          wing.rotation.y = direction * -.55;
          group.add(wing);
        });
        const glow = new THREE.Mesh(new THREE.BoxGeometry(6, .06, .15), new THREE.MeshBasicMaterial({ color: index === stationIndex ? '#e6b993' : '#e6dfd2' }));
        glow.position.set(0, 4.28, .18);
        group.add(glow);
        world.add(group);
      });
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    rebuildStations();
    runtimeRef.current = { camera, controls, renderer, hemi, key, rebuildStations };
    onCameraReady?.(() => ({ position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov }));
    let frame;
    const animate = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, []);
  useEffect(() => { runtimeRef.current?.rebuildStations(); }, [stations, stationIndex]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    const station = stations[stationIndex];
    if (!runtime || !station) return;
    if (overviewMode) {
      const midpoint = Math.max(0, (stations.length - 1) * 4.5);
      runtime.camera.position.set(midpoint, 8.5, 19);
      runtime.controls.target.set(midpoint, 2, 0);
      runtime.camera.fov = 54;
      runtime.camera.updateProjectionMatrix();
      runtime.controls.maxDistance = 36;
      runtime.controls.update();
      return;
    }
    const config = station.spatial;
    runtime.camera.position.fromArray(config.camera.position);
    runtime.controls.target.fromArray(config.camera.target);
    runtime.camera.fov = config.camera.fov;
    runtime.camera.updateProjectionMatrix();
    runtime.controls.maxDistance = config.movementRadius;
    runtime.controls.update();
    runtime.hemi.intensity = config.lighting.ambientIntensity;
    runtime.key.color.set(config.lighting.keyLightColor);
    runtime.key.intensity = config.lighting.keyLightIntensity;
    const origin = new THREE.Vector3().fromArray(config.position);
    runtime.key.position.fromArray(config.lighting.keyLightPosition).add(origin);
    runtime.key.target.position.fromArray(config.lighting.keyLightTarget).add(origin);
  }, [overviewMode, stationIndex, stations]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    const root = modelRootRef.current;
    if (!runtime || !root) return undefined;
    while (root.children.length) { const child = root.children.pop(); disposeObject(child); }
    if (!selectedItem || selectedItem.sourceType !== 'gltf') return undefined;
    let cancelled = false;
    const manager = new THREE.LoadingManager();
    const loader = new GLTFLoader(manager);
    const draco = new DRACOLoader(manager).setDecoderPath('/three-codecs/draco/');
    const ktx2 = new KTX2Loader(manager).setTranscoderPath('/three-codecs/basis/').detectSupport(runtime.renderer);
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(selectedItem.modelUrl, (gltf) => {
      if (cancelled) { disposeObject(gltf.scene); return; }
      const object = gltf.scene;
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const fit = 1.65 / Math.max(size.x, size.y, size.z, .001);
      object.position.sub(center.multiplyScalar(fit));
      object.scale.setScalar(fit * selectedItem.modelTransform.scale);
      const station = stations[stationIndex];
      object.position.add(new THREE.Vector3().fromArray(station.spatial.position)).add(new THREE.Vector3().fromArray(selectedItem.modelTransform.position));
      object.rotation.fromArray(selectedItem.modelTransform.rotation);
      object.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
      root.add(object);
    }, undefined, () => {});
    return () => { cancelled = true; draco.dispose(); ktx2.dispose(); };
  }, [selectedItem, stationIndex]);
  return <canvas ref={canvasRef} className={`exhibition-room-canvas ${editorMode ? 'is-editor' : ''}`} aria-label="Begehbarer 3D-Ausstellungsraum" />;
}

function SpatialThumbnail({ item, selected, editorMode, onSelect, onMove }) {
  const startDrag = (event) => {
    if (!editorMode) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const original = item.thumbnailTransform.position;
    const move = (next) => onMove([original[0] + (next.clientX - startX) / 130, original[1] - (next.clientY - startY) / 130, original[2]]);
    const end = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', end); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
  };
  const left = 50 + item.thumbnailTransform.position[0] * 13;
  const top = 52 - item.thumbnailTransform.position[1] * 12;
  const width = 118 * item.thumbnailTransform.scale;
  return <button className={`spatial-thumbnail ${selected ? 'is-selected' : ''} ${editorMode ? 'is-editable' : ''}`} style={{ left: `${left}%`, top: `${top}%`, width }} onClick={onSelect} onPointerDown={startDrag}><span>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <Box size={24} />}</span><b>{item.title}</b><small>{item.sourceType === 'sketchfab' ? 'Sketchfab' : '3D-Modell'}</small></button>;
}

export default function ExhibitionRoom({ story, initialMode = 'visitor', backHref = '/', onSaveStory }) {
  const [stations, setStations] = useState(() => normalizeStoryStations(story));
  const [stationIndex, setStationIndex] = useState(0);
  const [mode, setMode] = useState(initialMode);
  const [openItemId, setOpenItemId] = useState(null);
  const [overviewMode, setOverviewMode] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const captureCameraRef = useRef(null);
  const station = stations[stationIndex];
  const editorItem = station?.items.find((item) => item.id === station.selectedItemId) || station?.items[0] || null;
  const selectedItem = mode === 'editor' ? editorItem : station?.items.find((item) => item.id === openItemId) || null;
  const editorProject = {
    ...story,
    models: {
      ...story.models,
      additional: stations.flatMap((entry) => entry.items.map((item) => ({ id: item.id, name: item.title, url: item.modelUrl })))
    }
  };
  const adapter = selectedItem ? getModelSourceAdapter(selectedItem.sourceType) : null;
  const updateStation = (index, patch) => setStations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateItem = (index, id, patch) => setStations((current) => current.map((entry, itemIndex) => itemIndex !== index ? entry : { ...entry, items: entry.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const addItem = (index, item) => setStations((current) => current.map((entry, itemIndex) => itemIndex !== index ? entry : { ...entry, items: [...entry.items, item], selectedItemId: item.id }));
  const removeItem = (index, id) => setStations((current) => current.map((entry, itemIndex) => itemIndex !== index ? entry : { ...entry, items: entry.items.filter((item) => item.id !== id), selectedItemId: entry.items.find((item) => item.id !== id)?.id || null }));
  const addStation = () => {
    const index = stations.length;
    const next = { id: `station_${Date.now()}`, title: `Station ${index + 1}`, description: '', introduction: '', items: [], selectedItemId: null, spatial: normalizeSpatialStation({}, index) };
    setStations((current) => [...current, next]);
    setStationIndex(index);
  };
  const captureCamera = (index) => {
    const camera = captureCameraRef.current?.();
    if (camera) updateStation(index, { spatial: { ...stations[index].spatial, camera } });
  };
  const save = async () => { await onSaveStory?.({ ...story, stations }); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  useEffect(() => { document.body.classList.toggle('spatial-editor-mode', mode === 'editor'); return () => document.body.classList.remove('spatial-editor-mode'); }, [mode]);
  useEffect(() => { setOpenItemId(null); setOverviewMode(false); setAudioPlaying(false); }, [stationIndex]);
  useEffect(() => {
    const audio = station?.spatial.audio;
    if (!audio?.url || (!audio.autoplay && !audioPlaying) || mode === 'editor') return undefined;
    const player = new Audio(audio.url);
    player.loop = true;
    const updateVolume = () => {
      const cameraPosition = captureCameraRef.current?.()?.position || station.spatial.camera.position;
      const distance = new THREE.Vector3().fromArray(cameraPosition).distanceTo(new THREE.Vector3().fromArray(station.spatial.position));
      const attenuation = audio.spatial ? Math.max(0, 1 - distance / Math.max(0.1, audio.range)) : 1;
      player.volume = Math.min(1, Math.max(0, audio.volume * attenuation));
    };
    updateVolume();
    const volumeTimer = setInterval(updateVolume, 180);
    player.play().catch(() => {});
    return () => { clearInterval(volumeTimer); player.pause(); player.src = ''; };
  }, [audioPlaying, stationIndex, mode, station]);
  if (!station) return null;
  return <main className={`exhibition-shell mode-${mode}`}>
    <SpatialRoomCanvas stations={stations} stationIndex={stationIndex} selectedItem={selectedItem} editorMode={mode === 'editor'} overviewMode={overviewMode} onCameraReady={(capture) => { captureCameraRef.current = capture; }} />
    <header className="exhibition-header"><a href={backHref} className="exhibition-brand"><span className="exhibition-mark"><i /></span><b>RIU</b><small>Räumliche Geschichten</small></a><div className="exhibition-mode-switch"><button className={mode === 'visitor' ? 'is-active' : ''} onClick={() => { setMode('visitor'); setOpenItemId(null); setOverviewMode(false); }}><Footprints size={14} /> Besucher</button>{initialMode === 'editor' && <button className={mode === 'editor' ? 'is-active' : ''} onClick={() => { setMode('editor'); setOverviewMode(false); }}><MousePointer2 size={13} /> Editor</button>}</div><div className="exhibition-progress"><span>{String(stationIndex + 1).padStart(2, '0')}</span><i /><span>{String(stations.length).padStart(2, '0')}</span></div></header>
    <section className="spatial-station-content"><div className="spatial-story-copy"><span>Station {String(stationIndex + 1).padStart(2, '0')}</span><h1>{station.title}</h1><p>{station.introduction}</p></div><div className="spatial-thumbnails">{station.items.map((item) => <SpatialThumbnail key={item.id} item={item} selected={item.id === selectedItem?.id} editorMode={mode === 'editor'} onSelect={() => mode === 'editor' ? updateStation(stationIndex, { selectedItemId: item.id }) : setOpenItemId(item.id)} onMove={(position) => updateItem(stationIndex, item.id, { thumbnailTransform: { ...item.thumbnailTransform, position } })} />)}{mode === 'visitor' && !selectedItem && station.items.length > 0 && <div className="spatial-open-hint">Objekt auswählen, um es räumlich zu öffnen</div>}{!station.items.length && <div className="spatial-empty-objects"><Box size={25} /><span>{mode === 'editor' ? 'Fügen Sie in der Seitenleiste das erste Modell hinzu.' : 'Diese Station wird noch kuratiert.'}</span></div>}</div>
      {selectedItem?.sourceType === 'sketchfab' && <div className="spatial-sketchfab"><iframe src={adapter.getViewerUrl(selectedItem.modelUrl)} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen title={selectedItem.title} /></div>}
      {selectedItem && <div className="spatial-object-caption"><b>{selectedItem.title}</b><span>{selectedItem.description}</span>{(selectedItem.attribution || selectedItem.license) && <small>{[selectedItem.attribution, selectedItem.license].filter(Boolean).join(' · ')}</small>}</div>}
      {selectedItem && <div className="model-interaction-hint"><Rotate3D size={14} /> Ziehen zum Drehen <i /> Scrollen zum Zoomen</div>}
    </section>
    <footer className="exhibition-footer"><a href={backHref} className="exhibition-back"><ArrowLeft size={14} /> Meine Stories</a><div className="station-stepper"><button disabled={stationIndex === 0} onClick={() => setStationIndex((value) => value - 1)}><ChevronLeft /></button><span><b>{String(stationIndex + 1).padStart(2, '0')}</b> / {String(stations.length).padStart(2, '0')}</span><button disabled={stationIndex === stations.length - 1} onClick={() => setStationIndex((value) => value + 1)}><ChevronRight /></button></div><div className="exhibition-footer-actions">{mode === 'visitor' && station.spatial.audio.url && !station.spatial.audio.autoplay && <button className="walk-hint" type="button" onClick={() => setAudioPlaying((value) => !value)}>{audioPlaying ? <VolumeX size={15} /> : <Volume2 size={15} />} {audioPlaying ? 'Ton stoppen' : 'Ton starten'}</button>}<button className={`walk-hint ${overviewMode ? 'is-active' : ''}`} type="button" onClick={() => { setOverviewMode((value) => !value); setOpenItemId(null); }}><Footprints size={15} /> {overviewMode ? 'Zur Station' : 'Raumübersicht'}</button></div></footer>
    {mode === 'editor' && <EditorSidebar editingStations={stations} editingAnnotations={[]} editingIndex={stationIndex} activeAccordionIndex={null} activeImageAccordion={null} configFile={{ showImportExport: false, openDialog() {} }} onSetActiveAccordion={() => {}} onSetActiveImageAccordion={() => {}} onTestStation={(index) => setStationIndex(index)} onMoveStation={(from, to) => setStations((current) => { const next = [...current]; const [entry] = next.splice(from, 1); next.splice(to, 0, entry); return next; })} onDeleteStation={(index) => setStations((current) => current.filter((_, itemIndex) => itemIndex !== index))} onCaptureCamera={captureCamera} onPlaceOriginPoint={() => {}} onUpdateText={() => {}} onUpdateImage={() => {}} onUploadImage={() => {}} onAddAnnotation={() => {}} onDeleteAnnotation={() => {}} onMoveAnnotation={() => {}} onUpdateAnnotation={() => {}} onCaptureAnnotation={() => {}} onPlaceAnnotationInScene={() => {}} onUploadAnnotationImages={() => {}} onLocalBgUpload={() => {}} getBgSelectValue={() => ''} onCancel={() => { location.href = backHref; }} onSave={save} onRealign={() => {}} onRestoreDefaults={() => setStations(normalizeStoryStations(story))} onAddStation={addStation} onPreviewModeChange={(preview) => { setMode(preview ? 'visitor' : 'editor'); setOpenItemId(null); setOverviewMode(false); }} projects={[editorProject]} activeProject={editorProject} saveStatus={saved ? 'saved' : 'idle'} onUpdateProject={() => {}} canCreateProjects={false} spatialMode onUpdateSpatialStation={updateStation} onUpdateSpatialItem={updateItem} onAddSpatialItem={addItem} onRemoveSpatialItem={removeItem} />}
    {saved && <div className="spatial-save-toast"><Check size={14} /> Story gespeichert</div>}
  </main>;
}
