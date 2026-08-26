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
import { moveSpatialItem, normalizeSpatialItems, normalizeSpatialStation, normalizeThumbnailGridSpacing, normalizeThumbnailLayout, resolveSpatialInitialItemId, resolveSpatialOverviewCamera } from '../utils/spatialStory.js';
import './exhibitionRoom.css';

const materialColors = { 'warm-white': '#ded9cd', limestone: '#c9c0ae', 'soft-grey': '#c9cbc7' };
const disposeObject = (root) => root?.traverse((object) => {
  object.geometry?.dispose?.();
  (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach((material) => {
    material.map?.dispose?.();
    material.dispose?.();
  });
});
const easeInOutCubic = (value) => (value < .5 ? 4 * value * value * value : 1 - ((-2 * value + 2) ** 3) / 2);
const createStationLabelTexture = (station, index, active) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 240;
  const context = canvas.getContext('2d');
  context.fillStyle = active ? 'rgba(30, 29, 26, .98)' : 'rgba(55, 53, 48, .96)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#c35f32';
  context.fillRect(0, 0, 18, canvas.height);
  context.fillStyle = active ? '#e6b993' : '#d9c9b7';
  context.font = '600 30px Arial, sans-serif';
  context.letterSpacing = '5px';
  context.fillText(`STATION ${String(index + 1).padStart(2, '0')}`, 66, 72);
  context.fillStyle = '#fffaf0';
  context.font = '600 58px Georgia, serif';
  const title = station.title || `Station ${index + 1}`;
  const shortTitle = title.length > 31 ? `${title.slice(0, 30)}…` : title;
  context.fillText(shortTitle, 66, 158);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
const normalizeStoryStations = (story) => (story?.stations || []).map((station, index) => {
  const items = normalizeSpatialItems(station.items);
  const selectedItemId = items.some((item) => item.id === station.selectedItemId) ? station.selectedItemId : items[0]?.id || null;
  return {
    ...station,
    introduction: station.introduction ?? station.description ?? '',
    spatial: normalizeSpatialStation(station, index),
    items,
    thumbnailLayout: normalizeThumbnailLayout(station.thumbnailLayout),
    thumbnailGridSpacing: normalizeThumbnailGridSpacing(station.thumbnailGridSpacing),
    selectedItemId,
    initialItemId: resolveSpatialInitialItemId(station, items)
  };
});

function SpatialRoomCanvas({ stations, stationIndex, selectedItem, editorMode, overviewMode, largePresentation, onCameraReady }) {
  const canvasRef = useRef(null);
  const modelRootRef = useRef(null);
  const runtimeRef = useRef(null);
  const activeSpatial = stations[stationIndex]?.spatial;
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
    const rebuildStations = (nextStations = [], activeIndex = 0, showOverview = false) => {
      [...world.children].filter((child) => child !== floor).forEach((child) => { world.remove(child); disposeObject(child); });
      if (nextStations.length > 1) {
        const guidePoints = nextStations.map((station) => new THREE.Vector3(station.spatial.position[0], .035, station.spatial.position[2] + 1.75));
        const guideGeometry = new THREE.BufferGeometry().setFromPoints(guidePoints);
        const guide = new THREE.Line(guideGeometry, new THREE.LineBasicMaterial({ color: '#b2643c', transparent: true, opacity: showOverview ? .72 : .22 }));
        world.add(guide);
        guidePoints.forEach((point, index) => {
          const marker = new THREE.Mesh(
            new THREE.CircleGeometry(index === activeIndex ? .17 : .11, 32),
            new THREE.MeshBasicMaterial({ color: index === activeIndex ? '#c35f32' : '#8f887b', side: THREE.DoubleSide })
          );
          marker.rotation.x = -Math.PI / 2;
          marker.position.copy(point);
          marker.position.y += .008;
          world.add(marker);
        });
      }
      nextStations.forEach((station, index) => {
        const spatial = station.spatial;
        const group = new THREE.Group();
        group.position.fromArray(spatial.position);
        group.rotation.fromArray(spatial.rotation);
        const wallMat = new THREE.MeshStandardMaterial({
          color: materialColors[spatial.wallMaterial] || materialColors['warm-white'],
          roughness: .96,
          emissive: index === activeIndex ? '#24130b' : '#000000',
          emissiveIntensity: index === activeIndex ? .08 : 0
        });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(7.4, 4.5, .18), wallMat);
        wall.position.y = 2.25;
        wall.receiveShadow = true;
        wall.castShadow = true;
        group.add(wall);
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 5.2), new THREE.MeshStandardMaterial({ color: '#bcb5a6', roughness: 1 }));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(0, .018, 1.65);
        pad.receiveShadow = true;
        group.add(pad);
        const glow = new THREE.Mesh(new THREE.BoxGeometry(7.1, .055, .08), new THREE.MeshBasicMaterial({ color: index === activeIndex ? '#c35f32' : '#e6dfd2' }));
        glow.position.set(0, 4.24, .14);
        group.add(glow);
        world.add(group);

        const label = new THREE.Sprite(new THREE.SpriteMaterial({
          map: createStationLabelTexture(station, index, index === activeIndex),
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false
        }));
        label.position.set(spatial.position[0], spatial.position[1] + 4.95, spatial.position[2] + .45);
        label.scale.set(4.8, 1.125, 1);
        label.visible = showOverview;
        label.renderOrder = 20;
        world.add(label);
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
    rebuildStations(stations, stationIndex, overviewMode);
    runtimeRef.current = { camera, controls, renderer, hemi, key, rebuildStations, cameraTransitionFrame: null, hasCameraView: false };
    onCameraReady?.(() => ({ position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov }));
    let frame;
    const animate = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(runtimeRef.current?.cameraTransitionFrame);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, []);
  useEffect(() => { runtimeRef.current?.rebuildStations(stations, stationIndex, overviewMode); }, [stations, stationIndex, overviewMode]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !activeSpatial) return;
    const config = overviewMode ? resolveSpatialOverviewCamera(stations) : activeSpatial.camera;
    const toPosition = new THREE.Vector3().fromArray(config.position);
    const toTarget = new THREE.Vector3().fromArray(config.target);
    const fromPosition = runtime.camera.position.clone();
    const fromTarget = runtime.controls.target.clone();
    const fromFov = runtime.camera.fov;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const immediate = !runtime.hasCameraView || reducedMotion;
    runtime.hasCameraView = true;
    cancelAnimationFrame(runtime.cameraTransitionFrame);
    runtime.controls.enabled = immediate;
    runtime.controls.enableDamping = immediate;
    runtime.controls.maxDistance = overviewMode ? 36 : activeSpatial.movementRadius;
    const applyView = (progress) => {
      runtime.camera.position.lerpVectors(fromPosition, toPosition, progress);
      runtime.controls.target.lerpVectors(fromTarget, toTarget, progress);
      runtime.camera.fov = THREE.MathUtils.lerp(fromFov, config.fov, progress);
      runtime.camera.updateProjectionMatrix();
      runtime.controls.update();
    };
    if (immediate) {
      applyView(1);
    } else {
      const startedAt = performance.now();
      const duration = overviewMode ? 1100 : 1450;
      const animateTransition = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        applyView(easeInOutCubic(progress));
        if (progress < 1) {
          runtime.cameraTransitionFrame = requestAnimationFrame(animateTransition);
        } else {
          runtime.cameraTransitionFrame = null;
          runtime.controls.enabled = true;
          runtime.controls.enableDamping = true;
        }
      };
      runtime.cameraTransitionFrame = requestAnimationFrame(animateTransition);
    }
    if (overviewMode) return;
    runtime.hemi.intensity = activeSpatial.lighting.ambientIntensity;
    runtime.key.color.set(activeSpatial.lighting.keyLightColor);
    runtime.key.intensity = activeSpatial.lighting.keyLightIntensity;
    const origin = new THREE.Vector3().fromArray(activeSpatial.position);
    runtime.key.position.fromArray(activeSpatial.lighting.keyLightPosition).add(origin);
    runtime.key.target.position.fromArray(activeSpatial.lighting.keyLightTarget).add(origin);
  }, [activeSpatial, overviewMode, stationIndex, stations]);
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
      object.position.sub(center);
      object.scale.setScalar(fit * selectedItem.modelTransform.scale * (largePresentation ? 1.35 : 1));
      const pivot = new THREE.Group();
      pivot.position.add(new THREE.Vector3().fromArray(activeSpatial.position)).add(new THREE.Vector3().fromArray(selectedItem.modelTransform.position));
      pivot.rotation.fromArray(selectedItem.modelTransform.rotation);
      object.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
      pivot.add(object);
      root.add(pivot);
    }, undefined, () => {});
    return () => { cancelled = true; draco.dispose(); ktx2.dispose(); };
  }, [activeSpatial?.position, largePresentation, selectedItem?.id, selectedItem?.modelTransform, selectedItem?.modelUrl, selectedItem?.sourceType, stationIndex]);
  return <canvas ref={canvasRef} className={`exhibition-room-canvas ${editorMode ? 'is-editor' : ''}`} aria-label="Begehbarer 3D-Ausstellungsraum" />;
}

function SpatialThumbnail({ item, selected, multiSelected, editorMode, onSelect, onMove }) {
  const buttonRef = useRef(null);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [draftPosition, setDraftPosition] = useState(null);
  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const listeners = dragRef.current?.listeners;
    if (listeners) {
      removeEventListener('pointermove', listeners.move);
      removeEventListener('pointerup', listeners.end);
      removeEventListener('pointercancel', listeners.end);
    }
    document.body.classList.remove('spatial-thumbnail-dragging');
  }, []);
  useEffect(() => {
    if (!selected || editorMode) return;
    buttonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [editorMode, selected]);
  const startDrag = (event) => {
    if (!editorMode || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, original: [...item.thumbnailTransform.position], next: null, moved: false, target, listeners: { move: moveDrag, end: endDrag } };
    addEventListener('pointermove', moveDrag);
    addEventListener('pointerup', endDrag);
    addEventListener('pointercancel', endDrag);
    document.body.classList.add('spatial-thumbnail-dragging');
    setDragging(true);
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    drag.moved ||= Math.abs(deltaX) + Math.abs(deltaY) > 3;
    drag.next = [
      Math.max(-3.5, Math.min(3.5, drag.original[0] + deltaX / 130)),
      Math.max(-2.2, Math.min(2.4, drag.original[1] - deltaY / 130)),
      drag.original[2]
    ];
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (dragRef.current?.next) setDraftPosition(dragRef.current.next);
    });
  };
  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (drag.next) onMove(drag.next);
    removeEventListener('pointermove', drag.listeners.move);
    removeEventListener('pointerup', drag.listeners.end);
    removeEventListener('pointercancel', drag.listeners.end);
    if (drag.target.hasPointerCapture(event.pointerId)) drag.target.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    document.body.classList.remove('spatial-thumbnail-dragging');
    setDragging(false);
    setDraftPosition(null);
    if (drag.moved) {
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
  };
  const position = draftPosition || item.thumbnailTransform.position;
  const left = Math.max(5, Math.min(95, 50 + position[0] * 13));
  const top = Math.max(10, Math.min(90, 52 - position[1] * 20));
  const width = 118 * item.thumbnailTransform.scale;
  return <button ref={buttonRef} className={`spatial-thumbnail ${selected ? 'is-selected' : ''} ${multiSelected ? 'is-multi-selected' : ''} ${editorMode ? 'is-editable' : ''} ${dragging ? 'is-dragging' : ''}`} style={{ left: `${left}%`, top: `${top}%`, width }} onClick={(event) => { if (suppressClickRef.current) event.preventDefault(); else onSelect(event); }} onPointerDown={startDrag}><span>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" draggable="false" /> : <Box size={24} />}</span><b>{item.title}</b><small>{item.sourceType === 'sketchfab' ? 'Sketchfab' : '3D-Modell'}</small></button>;
}

export default function ExhibitionRoom({ story, initialMode = 'visitor', backHref = '/', onSaveStory }) {
  const [stations, setStations] = useState(() => normalizeStoryStations(story));
  const [stationIndex, setStationIndex] = useState(0);
  const [mode, setMode] = useState(initialMode);
  const [openItemId, setOpenItemId] = useState(undefined);
  const [overviewMode, setOverviewMode] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedThumbnailIds, setSelectedThumbnailIds] = useState([]);
  const captureCameraRef = useRef(null);
  const station = stations[stationIndex];
  const editorItem = station?.items.find((item) => item.id === station.selectedItemId) || station?.items[0] || null;
  const visitorItemId = openItemId === undefined ? station?.initialItemId : openItemId;
  const selectedItem = mode === 'editor' ? editorItem : station?.items.find((item) => item.id === visitorItemId) || null;
  const editorProject = {
    ...story,
    models: {
      ...story.models,
      additional: stations.flatMap((entry) => entry.items.map((item) => ({ id: item.id, name: item.title, url: item.modelUrl, thumbnailUrl: item.thumbnailUrl })))
    }
  };
  const adapter = selectedItem ? getModelSourceAdapter(selectedItem.sourceType) : null;
  const updateStation = (index, patch) => setStations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateItem = (index, id, patch) => setStations((current) => current.map((entry, itemIndex) => itemIndex !== index ? entry : { ...entry, items: entry.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateItemPositions = (index, positions) => setStations((current) => current.map((entry, itemIndex) => itemIndex !== index ? entry : {
    ...entry,
    items: entry.items.map((item) => positions[item.id] ? { ...item, thumbnailTransform: { ...item.thumbnailTransform, position: positions[item.id] } } : item)
  }));
  const moveItem = (index, id, direction) => setStations((current) => current.map((entry, itemIndex) => itemIndex === index
    ? { ...entry, items: moveSpatialItem(entry.items, id, direction) }
    : entry));
  const addItem = (index, item) => {
    setStations((current) => current.map((entry, itemIndex) => itemIndex !== index ? entry : { ...entry, items: [...entry.items, item], selectedItemId: item.id, initialItemId: entry.initialItemId || item.id }));
    setSelectedThumbnailIds([item.id]);
  };
  const removeItem = (index, id) => {
    setStations((current) => current.map((entry, itemIndex) => {
      if (itemIndex !== index) return entry;
      const items = entry.items.filter((item) => item.id !== id);
      const fallbackItemId = items[0]?.id || null;
      return {
        ...entry,
        items,
        selectedItemId: entry.selectedItemId === id ? fallbackItemId : entry.selectedItemId,
        initialItemId: entry.initialItemId === id ? fallbackItemId : entry.initialItemId
      };
    }));
    setSelectedThumbnailIds((current) => current.filter((itemId) => itemId !== id));
  };
  const addStation = () => {
    const index = stations.length;
    const next = { id: `station_${Date.now()}`, title: `Station ${index + 1}`, description: '', introduction: '', items: [], thumbnailLayout: 'tiles', thumbnailGridSpacing: 100, selectedItemId: null, initialItemId: null, spatial: normalizeSpatialStation({}, index) };
    setStations((current) => [...current, next]);
    setStationIndex(index);
  };
  const moveStation = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= stations.length || to >= stations.length) return;
    const activeStationId = stations[stationIndex]?.id;
    const next = [...stations];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry);
    setStations(next);
    setStationIndex(Math.max(0, next.findIndex((item) => item.id === activeStationId)));
  };
  const deleteStation = (index) => {
    if (stations.length <= 1 || index < 0 || index >= stations.length) return;
    const activeStationId = stations[stationIndex]?.id;
    const next = stations.filter((_, itemIndex) => itemIndex !== index);
    const nextActiveIndex = next.findIndex((item) => item.id === activeStationId);
    setStations(next);
    setStationIndex(nextActiveIndex >= 0 ? nextActiveIndex : Math.min(index, next.length - 1));
  };
  const captureCamera = (index) => {
    const camera = captureCameraRef.current?.();
    if (camera) updateStation(index, { spatial: { ...stations[index].spatial, camera } });
  };
  const selectThumbnailItem = (id, event) => {
    const additive = mode === 'editor' && (event?.shiftKey || event?.ctrlKey || event?.metaKey);
    if (!additive) {
      setSelectedThumbnailIds([id]);
      updateStation(stationIndex, { selectedItemId: id });
      return;
    }
    const next = selectedThumbnailIds.includes(id) && selectedThumbnailIds.length > 1
      ? selectedThumbnailIds.filter((itemId) => itemId !== id)
      : [...new Set([...selectedThumbnailIds, id])];
    setSelectedThumbnailIds(next);
    updateStation(stationIndex, { selectedItemId: next.includes(id) ? id : next[0] });
  };
  const save = async () => { await onSaveStory?.({ ...story, stations }); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  useEffect(() => { document.body.classList.toggle('spatial-editor-mode', mode === 'editor'); return () => document.body.classList.remove('spatial-editor-mode'); }, [mode]);
  useEffect(() => { setOpenItemId(undefined); setOverviewMode(false); setAudioPlaying(false); }, [stationIndex]);
  useEffect(() => {
    if (mode !== 'editor') return;
    const active = stations[stationIndex];
    const itemId = active?.selectedItemId || active?.items[0]?.id;
    setSelectedThumbnailIds(itemId ? [itemId] : []);
  }, [mode, stationIndex]);
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
  }, [audioPlaying, stationIndex, mode, station?.spatial]);
  if (!station) return null;
  return <main className={`exhibition-shell mode-${mode} thumbnail-layout-${station.thumbnailLayout} ${overviewMode ? 'is-overview' : ''}`}>
    <SpatialRoomCanvas stations={stations} stationIndex={stationIndex} selectedItem={selectedItem} editorMode={mode === 'editor'} overviewMode={overviewMode} largePresentation={mode === 'visitor'} onCameraReady={(capture) => { captureCameraRef.current = capture; }} />
    <header className="exhibition-header"><a href={backHref} className="exhibition-brand" title="Zurück zu den Stories" aria-label="Zurück zu den Stories"><span className="exhibition-mark"><i /></span><b>RIU</b></a><div className="exhibition-mode-switch"><button className={mode === 'visitor' ? 'is-active' : ''} onClick={() => { setMode('visitor'); setOpenItemId(undefined); setOverviewMode(false); }}><Footprints size={14} /> Besucher</button>{initialMode === 'editor' && <button className={mode === 'editor' ? 'is-active' : ''} onClick={() => { setMode('editor'); setOverviewMode(false); }}><MousePointer2 size={13} /> Editor</button>}</div><div className="exhibition-progress"><span>{String(stationIndex + 1).padStart(2, '0')}</span><i /><span>{String(stations.length).padStart(2, '0')}</span></div></header>
    <section className="spatial-station-content"><div className="spatial-story-copy"><span>Station {String(stationIndex + 1).padStart(2, '0')}</span><h1>{station.title}</h1><p>{station.introduction}</p></div><div className="spatial-thumbnails">{station.items.map((item) => <SpatialThumbnail key={item.id} item={item} selected={item.id === selectedItem?.id} multiSelected={mode === 'editor' && selectedThumbnailIds.includes(item.id)} editorMode={mode === 'editor'} onSelect={(event) => { if (mode === 'editor') selectThumbnailItem(item.id, event); else setOpenItemId(item.id); }} onMove={(position) => updateItem(stationIndex, item.id, { thumbnailTransform: { ...item.thumbnailTransform, position } })} />)}{mode === 'visitor' && !selectedItem && station.items.length > 0 && <div className="spatial-open-hint">Objekt auswählen, um es räumlich zu öffnen</div>}{!station.items.length && <div className="spatial-empty-objects"><Box size={25} /><span>{mode === 'editor' ? 'Fügen Sie in der Seitenleiste das erste Modell hinzu.' : 'Diese Station wird noch kuratiert.'}</span></div>}</div>
      {selectedItem?.sourceType === 'sketchfab' && <div className="spatial-sketchfab"><iframe src={adapter.getViewerUrl(selectedItem.modelUrl)} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen title={selectedItem.title} /></div>}
      {selectedItem && <div className="spatial-object-caption"><b>{selectedItem.title}</b><span>{selectedItem.description}</span>{(selectedItem.attribution || selectedItem.license) && <small>{[selectedItem.attribution, selectedItem.license].filter(Boolean).join(' · ')}</small>}</div>}
      {selectedItem && <div className="model-interaction-hint"><Rotate3D size={14} /> Ziehen zum Drehen <i /> Scrollen zum Zoomen</div>}
    </section>
    <footer className="exhibition-footer"><a href={backHref} className="exhibition-back"><ArrowLeft size={14} /> Meine Stories</a><div className="station-stepper"><button disabled={stationIndex === 0} onClick={() => setStationIndex((value) => value - 1)}><ChevronLeft /></button><span><b>{String(stationIndex + 1).padStart(2, '0')}</b> / {String(stations.length).padStart(2, '0')}</span><button disabled={stationIndex === stations.length - 1} onClick={() => setStationIndex((value) => value + 1)}><ChevronRight /></button></div><div className="exhibition-footer-actions">{mode === 'visitor' && station.spatial.audio.url && !station.spatial.audio.autoplay && <button className="walk-hint" type="button" onClick={() => setAudioPlaying((value) => !value)}>{audioPlaying ? <VolumeX size={15} /> : <Volume2 size={15} />} {audioPlaying ? 'Ton stoppen' : 'Ton starten'}</button>}<button className={`walk-hint ${overviewMode ? 'is-active' : ''}`} type="button" onClick={() => { const nextOverviewMode = !overviewMode; setOverviewMode(nextOverviewMode); setOpenItemId(nextOverviewMode ? null : undefined); }}><Footprints size={15} /> {overviewMode ? 'Zur Station' : 'Raumübersicht'}</button></div></footer>
    {mode === 'editor' && <EditorSidebar editingStations={stations} editingAnnotations={[]} editingIndex={stationIndex} activeAccordionIndex={null} activeImageAccordion={null} configFile={{ showImportExport: false, openDialog() {} }} onSetActiveAccordion={() => {}} onSetActiveImageAccordion={() => {}} onTestStation={(index) => setStationIndex(index)} onMoveStation={moveStation} onDeleteStation={deleteStation} onCaptureCamera={captureCamera} onPlaceOriginPoint={() => {}} onUpdateText={() => {}} onUpdateImage={() => {}} onUploadImage={() => {}} onAddAnnotation={() => {}} onDeleteAnnotation={() => {}} onMoveAnnotation={() => {}} onUpdateAnnotation={() => {}} onCaptureAnnotation={() => {}} onPlaceAnnotationInScene={() => {}} onUploadAnnotationImages={() => {}} onLocalBgUpload={() => {}} getBgSelectValue={() => ''} onCancel={() => { location.href = backHref; }} onSave={save} onRealign={() => {}} onRestoreDefaults={() => setStations(normalizeStoryStations(story))} onAddStation={addStation} onPreviewModeChange={(preview) => { setMode(preview ? 'visitor' : 'editor'); setOpenItemId(preview ? undefined : null); setOverviewMode(false); }} projects={[editorProject]} activeProject={editorProject} saveStatus={saved ? 'saved' : 'idle'} onUpdateProject={() => {}} canCreateProjects={false} spatialMode selectedSpatialItemIds={selectedThumbnailIds} onSelectSpatialItem={selectThumbnailItem} onUpdateSpatialStation={updateStation} onUpdateSpatialItem={updateItem} onUpdateSpatialItemPositions={updateItemPositions} onMoveSpatialItem={moveItem} onAddSpatialItem={addItem} onRemoveSpatialItem={removeItem} />}
    {saved && <div className="spatial-save-toast"><Check size={14} /> Story gespeichert</div>}
  </main>;
}
