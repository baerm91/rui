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
import { moveSpatialItem, normalizeSpatialItems, normalizeSpatialStation, normalizeThumbnailGridSpacing, normalizeThumbnailLayout, resolveSpatialInitialItemId, resolveSpatialOverviewCamera, resolveSpatialOverviewThumbnailLayout } from '../utils/spatialStory.js';
import './exhibitionRoom.css';

const materialColors = { 'warm-white': '#ded9cd', limestone: '#c9c0ae', 'soft-grey': '#c9cbc7' };
const disposeObject = (root) => root?.traverse((object) => {
  object.geometry?.dispose?.();
  (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach((material) => {
    material.map?.dispose?.();
    material.dispose?.();
  });
});
const smootherStep = (value) => value * value * value * (value * (value * 6 - 15) + 10);
const drawWrappedText = (context, text, x, startY, maxWidth, lineHeight, maxLines) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length) visibleLines[visibleLines.length - 1] = `${visibleLines.at(-1).replace(/[.,;:]?$/, '')}…`;
  visibleLines.forEach((entry, lineIndex) => context.fillText(entry, x, startY + lineIndex * lineHeight));
  return startY + visibleLines.length * lineHeight;
};
const createStationPlaqueTexture = (station, index) => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 960;
  const context = canvas.getContext('2d');
  context.fillStyle = '#e9e4da';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(77, 68, 57, .2)';
  context.lineWidth = 3;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  context.fillStyle = '#a65331';
  context.font = '700 28px Arial, sans-serif';
  context.letterSpacing = '5px';
  context.fillText(`STATION ${String(index + 1).padStart(2, '0')}`, 58, 92);
  context.fillStyle = '#282823';
  context.font = '600 55px Georgia, serif';
  const titleEnd = drawWrappedText(context, station.title || `Station ${index + 1}`, 58, 182, 520, 60, 4);
  context.fillStyle = '#5b5b54';
  context.font = '400 25px Arial, sans-serif';
  drawWrappedText(context, station.introduction, 58, titleEnd + 48, 510, 39, 10);
  context.fillStyle = '#8a7567';
  context.font = '600 22px Arial, sans-serif';
  context.fillText(`${station.items.length} ${station.items.length === 1 ? 'OBJEKT' : 'OBJEKTE'}`, 58, 882);
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

function SpatialRoomCanvas({ stations, stationIndex, selectedItem, editorMode, overviewMode, largePresentation, onCameraReady, onSelectStation, onSelectItem }) {
  const canvasRef = useRef(null);
  const overviewOverlayRef = useRef(null);
  const modelRootRef = useRef(null);
  const runtimeRef = useRef(null);
  const overviewModeRef = useRef(overviewMode);
  const selectStationRef = useRef(onSelectStation);
  const selectItemRef = useRef(onSelectItem);
  overviewModeRef.current = overviewMode;
  selectStationRef.current = onSelectStation;
  selectItemRef.current = onSelectItem;
  const activeSpatial = stations[stationIndex]?.spatial;
  useEffect(() => {
    const canvas = canvasRef.current;
    const overviewOverlay = overviewOverlayRef.current;
    const overlayEntries = [];
    const stationVisuals = [];
    let overviewHoverKey = '';
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const textureLoader = new THREE.TextureLoader();
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
    key.position.set(5.5, 8.5, 8);
    key.target.position.set(0, 2.1, -4.8);
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.near = .5;
    key.shadow.camera.far = 45;
    key.shadow.bias = -.00018;
    key.shadow.normalBias = .035;
    key.shadow.radius = 5;
    scene.add(key, key.target);
    const rebuildStations = (nextStations = [], activeIndex = 0, showOverview = false) => {
      world.userData.stationBuildVersion = (world.userData.stationBuildVersion || 0) + 1;
      world.userData.showOverview = showOverview;
      const stationXs = nextStations.map((entry) => entry.spatial.position[0]);
      const stationZs = nextStations.map((entry) => entry.spatial.position[2]);
      const overviewCenterX = stationXs.length ? (Math.min(...stationXs) + Math.max(...stationXs)) / 2 : 0;
      const overviewCenterZ = stationZs.length ? (Math.min(...stationZs) + Math.max(...stationZs)) / 2 : 0;
      overlayEntries.splice(0);
      stationVisuals.splice(0);
      overviewHoverKey = '';
      overviewOverlay?.replaceChildren();
      [...world.children].filter((child) => child !== floor).forEach((child) => { world.remove(child); disposeObject(child); });
      if (showOverview) {
        const stationSpan = Math.max(7.2, nextStations.length * 7.2);
        const backWall = new THREE.Mesh(
          new THREE.BoxGeometry(stationSpan + 1.25, 5.65, .18),
          new THREE.MeshStandardMaterial({ color: '#aaa18f', roughness: .96 })
        );
        backWall.position.set(overviewCenterX, 2.825, overviewCenterZ - 5.24);
        backWall.receiveShadow = true;
        world.add(backWall);
      }
      if (nextStations.length > 1 && !showOverview) {
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
        if (showOverview) {
          const overviewOffset = index - (nextStations.length - 1) / 2;
          group.position.set(overviewCenterX + overviewOffset * 7.2, 0, overviewCenterZ - 5.08);
          group.rotation.set(0, 0, 0);
        } else {
          group.position.fromArray(spatial.position);
          group.rotation.fromArray(spatial.rotation);
        }
        const wallMat = new THREE.MeshStandardMaterial({
          color: materialColors[spatial.wallMaterial] || materialColors['warm-white'],
          roughness: .9,
          emissive: showOverview ? '#30261d' : index === activeIndex ? '#24130b' : '#000000',
          emissiveIntensity: showOverview ? .08 : index === activeIndex ? .08 : 0,
          side: showOverview ? THREE.DoubleSide : THREE.FrontSide
        });
        const wallWidth = showOverview ? 6.72 : 7.4;
        const wallHeight = showOverview ? 4.8 : 4.5;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, wallHeight, showOverview ? .14 : .18), wallMat);
        wall.position.set(0, showOverview ? 2.4 : 2.25, 0);
        wall.receiveShadow = true;
        wall.castShadow = !showOverview;
        wall.userData.stationIndex = index;
        group.add(wall);
        const wallBackgroundUrl = spatial.wallBackground?.url;
        if (wallBackgroundUrl) {
          const backgroundMaterial = new THREE.MeshStandardMaterial({
            color: '#ffffff',
            roughness: .94,
            metalness: 0,
            transparent: true,
            opacity: spatial.wallBackground.opacity,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
          });
          const background = new THREE.Mesh(new THREE.PlaneGeometry(wallWidth - .08, wallHeight - .08), backgroundMaterial);
          background.position.set(0, showOverview ? 2.4 : 2.25, showOverview ? .076 : .096);
          background.visible = false;
          background.receiveShadow = true;
          background.userData.stationIndex = index;
          group.add(background);
          const buildVersion = world.userData.stationBuildVersion;
          textureLoader.load(wallBackgroundUrl, (texture) => {
            if (world.userData.stationBuildVersion !== buildVersion || !background.parent) { texture.dispose(); return; }
            const imageWidth = texture.image?.naturalWidth || texture.image?.width || 1;
            const imageHeight = texture.image?.naturalHeight || texture.image?.height || 1;
            const imageAspect = imageWidth / Math.max(1, imageHeight);
            const wallAspect = wallWidth / wallHeight;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.repeat.set(1, 1);
            texture.offset.set(0, 0);
            if (imageAspect > wallAspect) {
              texture.repeat.x = wallAspect / imageAspect;
              texture.offset.x = (1 - texture.repeat.x) / 2;
            } else {
              texture.repeat.y = imageAspect / wallAspect;
              texture.offset.y = (1 - texture.repeat.y) / 2;
            }
            texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            backgroundMaterial.map = texture;
            backgroundMaterial.needsUpdate = true;
            background.visible = true;
          });
        }
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(showOverview ? 6.5 : 7.18, .15, .7),
          new THREE.MeshStandardMaterial({ color: showOverview ? '#b8ae9d' : '#c7c0b2', roughness: .92 })
        );
        step.position.set(0, .075, .38);
        step.castShadow = true;
        step.receiveShadow = true;
        group.add(step);

        let baseGlow = null;
        let wash = null;
        const ledWidth = showOverview ? 6.34 : 7.02;
        const ledColor = index === activeIndex ? '#ffc18c' : '#ffe0b5';
        baseGlow = new THREE.Mesh(
          new THREE.BoxGeometry(ledWidth, .038, .055),
          new THREE.MeshBasicMaterial({ color: ledColor, transparent: true, opacity: .96, toneMapped: false })
        );
        baseGlow.position.set(0, .175, .095);
        group.add(baseGlow);
        const stepGlow = new THREE.Mesh(
          new THREE.BoxGeometry(ledWidth + .1, .032, .045),
          new THREE.MeshBasicMaterial({ color: '#fff0cf', transparent: true, opacity: .88, toneMapped: false })
        );
        stepGlow.position.set(0, .035, .745);
        group.add(stepGlow);
        const floorBloom = new THREE.Mesh(
          new THREE.PlaneGeometry(ledWidth + .35, .92),
          new THREE.MeshBasicMaterial({ color: '#ffdca9', transparent: true, opacity: showOverview ? .11 : .14, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        floorBloom.rotation.x = -Math.PI / 2;
        floorBloom.position.set(0, .024, 1.03);
        group.add(floorBloom);

        if (showOverview) {
          wash = new THREE.PointLight(0xffdfb1, index === activeIndex ? 2.8 : 2.1, 7, 2);
          wash.position.set(0, .38, 1.08);
          group.add(wash);
        } else {
          const pad = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 5.2), new THREE.MeshStandardMaterial({ color: '#bcb5a6', roughness: 1 }));
          pad.rotation.x = -Math.PI / 2;
          pad.position.set(0, .018, 1.65);
          pad.receiveShadow = true;
          group.add(pad);
          wash = new THREE.PointLight(0xffdfb1, index === activeIndex ? 2.4 : 1.8, 7.5, 2);
          wash.position.set(0, .42, 1.18);
          group.add(wash);
        }

        const previewItems = station.items.filter((item) => item.thumbnailUrl).slice(0, 6);
        const stationPreviewEntries = [];
        const layoutStationPreviews = () => {
          if (!stationPreviewEntries.length) return;
          const layout = resolveSpatialOverviewThumbnailLayout(stationPreviewEntries.map((entry) => entry.aspect));
          stationPreviewEntries.forEach((entry, entryIndex) => {
            Object.assign(entry, layout[entryIndex]);
            entry.frame.geometry.dispose();
            entry.frame.geometry = new THREE.BoxGeometry(entry.cardWidth, entry.cardHeight, .018);
            entry.frame.position.set(entry.x, entry.y, .23);
          });
        };
        previewItems.forEach((item) => {
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, .018),
            new THREE.MeshPhysicalMaterial({
              color: '#f8f4ea',
              roughness: .16,
              metalness: 0,
              transmission: .3,
              transparent: true,
              opacity: .72,
              thickness: .06,
              clearcoat: 1,
              clearcoatRoughness: .12
            })
          );
          frame.visible = showOverview;
          frame.castShadow = true;
          frame.receiveShadow = true;
          frame.userData.stationIndex = index;
          frame.userData.itemId = item.id;
          const objectGlow = new THREE.PointLight(0xffebcf, .34, 2.35, 2);
          objectGlow.position.set(0, .08, .68);
          frame.add(objectGlow);
          group.add(frame);
          if (showOverview && overviewOverlay) {
            const image = document.createElement('img');
            image.className = 'overview-wall-thumbnail';
            image.alt = '';
            image.draggable = false;
            const entry = { element: image, frame, stationIndex: index, itemId: item.id, aspect: 1, imageWidth: .82, imageHeight: .82, cardWidth: 1, cardHeight: 1, sourceWidth: 512, sourceHeight: 512 };
            image.addEventListener('load', () => {
              entry.aspect = Math.max(.58, Math.min(1.9, image.naturalWidth / Math.max(1, image.naturalHeight)));
              entry.sourceWidth = 512 * entry.aspect;
              image.style.width = `${entry.sourceWidth}px`;
              layoutStationPreviews();
            }, { once: true });
            image.src = item.thumbnailUrl;
            overviewOverlay.append(image);
            stationPreviewEntries.push(entry);
            overlayEntries.push(entry);
          }
        });
        layoutStationPreviews();
        if (showOverview) {
          const plaqueTexture = createStationPlaqueTexture(station, index);
          const plaque = new THREE.Mesh(
            new THREE.BoxGeometry(1.35, 2.65, .022),
            new THREE.MeshPhysicalMaterial({ color: '#f6f1e8', roughness: .18, transmission: .22, transparent: true, opacity: .76, thickness: .08, clearcoat: 1, clearcoatRoughness: .14 })
          );
          plaque.position.set(-2.45, 2.35, .23);
          plaque.castShadow = true;
          plaque.receiveShadow = true;
          plaque.userData.stationIndex = index;
          group.add(plaque);
          const plaqueFace = new THREE.Mesh(
            new THREE.PlaneGeometry(1.24, 2.54),
            new THREE.MeshBasicMaterial({ map: plaqueTexture, toneMapped: false })
          );
          plaqueFace.position.set(-2.45, 2.35, .243);
          plaqueFace.userData.stationIndex = index;
          group.add(plaqueFace);
        }
        if (showOverview) stationVisuals.push({ index, active: index === activeIndex, group, wall, baseGlow, wash });
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
    const pointerStart = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const resolveOverviewHit = (event) => {
      if (!overviewModeRef.current) return null;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(world.children, true)
        .find((hit) => Number.isInteger(hit.object.userData.stationIndex)) || null;
    };
    const applyOverviewHover = (hit) => {
      const hoveredStationIndex = hit?.object.userData.stationIndex;
      const hoveredItemId = hit?.object.userData.itemId || null;
      const nextKey = Number.isInteger(hoveredStationIndex) ? `${hoveredStationIndex}:${hoveredItemId || ''}` : '';
      if (nextKey === overviewHoverKey) return;
      overviewHoverKey = nextKey;
      stationVisuals.forEach(({ index, active, group, wall, baseGlow, wash }) => {
        const stationHovered = index === hoveredStationIndex;
        group.scale.setScalar(1);
        wall.material.emissive.set(stationHovered ? '#79513a' : '#30261d');
        wall.material.emissiveIntensity = stationHovered ? .22 : .08;
        baseGlow.material.color.set(stationHovered ? '#ffc08a' : active ? '#d88455' : '#f0d5ae');
        baseGlow.material.opacity = stationHovered ? 1 : .86;
        wash.intensity = stationHovered ? 3.5 : active ? 2.8 : 2.1;
      });
      overlayEntries.forEach(({ element, frame, stationIndex: entryStationIndex, itemId: entryItemId }) => {
        const itemHovered = entryStationIndex === hoveredStationIndex && entryItemId === hoveredItemId;
        element.classList.toggle('is-station-hovered', entryStationIndex === hoveredStationIndex);
        element.classList.toggle('is-hovered', itemHovered);
        frame.scale.setScalar(1);
        frame.castShadow = !itemHovered;
        frame.material.emissive.set(itemHovered ? '#fff0cf' : '#000000');
        frame.material.emissiveIntensity = itemHovered ? .6 : 0;
      });
    };
    const handlePointerDown = (event) => {
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
    };
    const handlePointerMove = (event) => applyOverviewHover(resolveOverviewHit(event));
    const handlePointerLeave = () => applyOverviewHover(null);
    const handlePointerUp = (event) => {
      if (!overviewModeRef.current || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) return;
      const stationHit = resolveOverviewHit(event);
      if (!stationHit) return;
      const { stationIndex: hitStationIndex, itemId } = stationHit.object.userData;
      if (itemId) selectItemRef.current?.(hitStationIndex, itemId);
      else selectStationRef.current?.(hitStationIndex);
    };
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('pointerup', handlePointerUp);
    resize();
    rebuildStations(stations, stationIndex, overviewMode);
    runtimeRef.current = { camera, controls, renderer, hemi, key, rebuildStations, renderedOverviewMode: overviewMode, cameraTransitionFrame: null, hasCameraView: false };
    onCameraReady?.(() => ({ position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov }));
    const projectPoint = (point, rect) => {
      const projected = point.project(camera);
      return {
        x: (projected.x * .5 + .5) * rect.width,
        y: (-projected.y * .5 + .5) * rect.height,
        z: projected.z
      };
    };
    const applyQuadProjection = (element, [topLeft, topRight, bottomRight, bottomLeft], sourceWidth, sourceHeight) => {
      const dx1 = topRight.x - bottomRight.x;
      const dx2 = bottomLeft.x - bottomRight.x;
      const dx3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
      const dy1 = topRight.y - bottomRight.y;
      const dy2 = bottomLeft.y - bottomRight.y;
      const dy3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
      const denominator = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(denominator) < .0001) return false;
      const perspectiveX = (dx3 * dy2 - dx2 * dy3) / denominator;
      const perspectiveY = (dx1 * dy3 - dx3 * dy1) / denominator;
      const scaleX = topRight.x - topLeft.x + perspectiveX * topRight.x;
      const skewX = bottomLeft.x - topLeft.x + perspectiveY * bottomLeft.x;
      const scaleY = topRight.y - topLeft.y + perspectiveX * topRight.y;
      const skewY = bottomLeft.y - topLeft.y + perspectiveY * bottomLeft.y;
      element.style.transform = `matrix3d(${scaleX / sourceWidth},${scaleY / sourceWidth},0,${perspectiveX / sourceWidth},${skewX / sourceHeight},${skewY / sourceHeight},0,${perspectiveY / sourceHeight},0,0,1,0,${topLeft.x},${topLeft.y},0,1)`;
      return true;
    };
    const updateOverviewOverlay = () => {
      if (!overviewOverlay || !overlayEntries.length) return;
      const rect = canvas.getBoundingClientRect();
      overlayEntries.forEach(({ element, frame: thumbnailFrame, imageWidth, imageHeight, sourceWidth, sourceHeight }) => {
        thumbnailFrame.updateWorldMatrix(true, false);
        const surfaceZ = .013;
        const worldCenter = thumbnailFrame.localToWorld(new THREE.Vector3(0, 0, surfaceZ));
        const center = projectPoint(worldCenter.clone(), rect);
        const topLeft = projectPoint(thumbnailFrame.localToWorld(new THREE.Vector3(-imageWidth / 2, imageHeight / 2, surfaceZ)), rect);
        const topRight = projectPoint(thumbnailFrame.localToWorld(new THREE.Vector3(imageWidth / 2, imageHeight / 2, surfaceZ)), rect);
        const bottomRight = projectPoint(thumbnailFrame.localToWorld(new THREE.Vector3(imageWidth / 2, -imageHeight / 2, surfaceZ)), rect);
        const bottomLeft = projectPoint(thumbnailFrame.localToWorld(new THREE.Vector3(-imageWidth / 2, -imageHeight / 2, surfaceZ)), rect);
        const width = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
        const height = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);
        const frameNormal = new THREE.Vector3(0, 0, 1).transformDirection(thumbnailFrame.matrixWorld);
        const toCamera = camera.position.clone().sub(worldCenter).normalize();
        raycaster.set(camera.position, worldCenter.clone().sub(camera.position).normalize());
        const firstStationHit = raycaster.intersectObjects(world.children, true)
          .find((hit) => Number.isInteger(hit.object.userData.stationIndex));
        const facesCamera = frameNormal.dot(toCamera) > .02;
        const isUnoccluded = firstStationHit?.object.userData.stationIndex === thumbnailFrame.userData.stationIndex;
        const visible = world.userData.showOverview && facesCamera && isUnoccluded && center.z > -1 && center.z < 1 && width > 2 && height > 2;
        element.style.display = visible ? 'block' : 'none';
        if (!visible) return;
        element.style.zIndex = String(Math.round((1 - center.z) * 100000));
        if (!applyQuadProjection(element, [topLeft, topRight, bottomRight, bottomLeft], sourceWidth, sourceHeight)) element.style.display = 'none';
      });
    };
    let frame;
    const animate = () => { controls.update(); renderer.render(scene, camera); updateOverviewOverlay(); frame = requestAnimationFrame(animate); };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(runtimeRef.current?.cameraTransitionFrame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('pointerup', handlePointerUp);
      overviewOverlay?.replaceChildren();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, []);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return undefined;
    const layoutChanges = runtime.renderedOverviewMode !== overviewMode;
    if (layoutChanges && runtime.hasCameraView && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    runtime.rebuildStations(stations, stationIndex, overviewMode);
    runtime.renderedOverviewMode = overviewMode;
    return undefined;
  }, [stations, stationIndex, overviewMode]);
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
    const layoutChanges = runtime.renderedOverviewMode !== overviewMode;
    runtime.hasCameraView = true;
    cancelAnimationFrame(runtime.cameraTransitionFrame);
    runtime.controls.enabled = immediate;
    runtime.controls.enableDamping = immediate;
    runtime.controls.maxDistance = overviewMode ? 36 : activeSpatial.movementRadius;
    const applyPose = (position, target, fov) => {
      runtime.camera.position.copy(position);
      runtime.controls.target.copy(target);
      runtime.camera.fov = fov;
      runtime.camera.updateProjectionMatrix();
      runtime.controls.update();
    };
    const applyView = (progress) => applyPose(
      new THREE.Vector3().lerpVectors(fromPosition, toPosition, progress),
      new THREE.Vector3().lerpVectors(fromTarget, toTarget, progress),
      THREE.MathUtils.lerp(fromFov, config.fov, progress)
    );
    if (immediate) {
      applyView(1);
    } else if (layoutChanges) {
      const stationXs = stations.map((entry) => entry.spatial.position[0]);
      const stationZs = stations.map((entry) => entry.spatial.position[2]);
      const overviewCenterX = stationXs.length ? (Math.min(...stationXs) + Math.max(...stationXs)) / 2 : 0;
      const overviewCenterZ = stationZs.length ? (Math.min(...stationZs) + Math.max(...stationZs)) / 2 : 0;
      const overviewOffset = stationIndex - (stations.length - 1) / 2;
      const overviewFocusTarget = new THREE.Vector3(overviewCenterX + overviewOffset * 7.2, 2.4, overviewCenterZ - 5.08);
      const overviewFocusPosition = overviewFocusTarget.clone().add(new THREE.Vector3(0, .25, 8.6));
      const stationOrigin = new THREE.Vector3().fromArray(activeSpatial.position);
      const stationWallCenter = new THREE.Vector3(0, 2.25, 0)
        .applyEuler(new THREE.Euler().fromArray(activeSpatial.rotation))
        .add(stationOrigin);
      const finalViewDirection = new THREE.Vector3().fromArray(activeSpatial.camera.position)
        .sub(new THREE.Vector3().fromArray(activeSpatial.camera.target))
        .normalize();
      const stationFocusPosition = stationWallCenter.clone().addScaledVector(finalViewDirection, 8.6);
      const focusFov = 46;
      const firstPosition = overviewMode ? stationFocusPosition : overviewFocusPosition;
      const firstTarget = overviewMode ? stationWallCenter : overviewFocusTarget;
      const secondPosition = overviewMode ? overviewFocusPosition : stationFocusPosition;
      const secondTarget = overviewMode ? overviewFocusTarget : stationWallCenter;
      const startedAt = performance.now();
      const duration = 1400;
      const split = .52;
      let swapped = false;
      const animateLayoutTransition = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        if (progress < split) {
          const phaseProgress = smootherStep(progress / split);
          const targetProgress = overviewMode ? phaseProgress : smootherStep(Math.min(1, (progress / split) * 1.35));
          applyPose(
            new THREE.Vector3().lerpVectors(fromPosition, firstPosition, phaseProgress),
            new THREE.Vector3().lerpVectors(fromTarget, firstTarget, targetProgress),
            THREE.MathUtils.lerp(fromFov, focusFov, phaseProgress)
          );
        } else {
          if (!swapped) {
            runtime.rebuildStations(stations, stationIndex, overviewMode);
            runtime.renderedOverviewMode = overviewMode;
            swapped = true;
          }
          const phaseProgress = smootherStep((progress - split) / (1 - split));
          applyPose(
            new THREE.Vector3().lerpVectors(secondPosition, toPosition, phaseProgress),
            new THREE.Vector3().lerpVectors(secondTarget, toTarget, phaseProgress),
            THREE.MathUtils.lerp(focusFov, config.fov, phaseProgress)
          );
        }
        if (progress < 1) {
          runtime.cameraTransitionFrame = requestAnimationFrame(animateLayoutTransition);
        } else {
          runtime.cameraTransitionFrame = null;
          runtime.controls.enabled = true;
          runtime.controls.enableDamping = true;
        }
      };
      runtime.cameraTransitionFrame = requestAnimationFrame(animateLayoutTransition);
    } else {
      const startedAt = performance.now();
      const duration = overviewMode ? 1100 : 1450;
      const animateTransition = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        applyView(smootherStep(progress));
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
  return <><canvas ref={canvasRef} className={`exhibition-room-canvas ${editorMode ? 'is-editor' : ''}`} aria-label="Begehbarer 3D-Ausstellungsraum" /><div ref={overviewOverlayRef} className="overview-wall-thumbnails" aria-hidden="true" /></>;
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
  const [openItemId, setOpenItemId] = useState(() => initialMode === 'visitor' ? null : undefined);
  const [overviewMode, setOverviewMode] = useState(() => initialMode === 'visitor');
  const [viewTransitioning, setViewTransitioning] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedThumbnailIds, setSelectedThumbnailIds] = useState([]);
  const captureCameraRef = useRef(null);
  const viewTransitionRef = useRef({ active: false, changeTimer: null, midTimer: null, endTimer: null });
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
  const transitionSpatialView = (applyChange, onComplete, onMidpoint) => {
    const transition = viewTransitionRef.current;
    if (transition.active) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyChange();
      onMidpoint?.();
      onComplete?.();
      return;
    }
    transition.active = true;
    setViewTransitioning(true);
    transition.changeTimer = setTimeout(applyChange, 170);
    transition.midTimer = onMidpoint ? setTimeout(onMidpoint, 900) : null;
    transition.endTimer = setTimeout(() => {
      transition.active = false;
      transition.changeTimer = null;
      transition.midTimer = null;
      transition.endTimer = null;
      setViewTransitioning(false);
      onComplete?.();
    }, 1580);
  };
  const enterStation = (index) => {
    const applyChange = () => {
      setStationIndex(index);
      setOverviewMode(false);
      setOpenItemId(overviewMode ? null : undefined);
      setAudioPlaying(false);
    };
    if (overviewMode) transitionSpatialView(applyChange, () => setOpenItemId(undefined));
    else applyChange();
  };
  const enterItem = (index, itemId) => {
    const applyChange = () => {
      setStationIndex(index);
      setOverviewMode(false);
      setOpenItemId(overviewMode ? null : itemId);
      setAudioPlaying(false);
    };
    if (overviewMode) transitionSpatialView(applyChange, () => setOpenItemId(itemId));
    else applyChange();
  };
  const toggleOverview = () => {
    const nextOverviewMode = !overviewMode;
    transitionSpatialView(() => {
      setOverviewMode(nextOverviewMode);
      if (!nextOverviewMode) setOpenItemId(null);
      setAudioPlaying(false);
    }, nextOverviewMode ? undefined : () => setOpenItemId(undefined), nextOverviewMode ? () => setOpenItemId(null) : undefined);
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
  useEffect(() => () => {
    clearTimeout(viewTransitionRef.current.changeTimer);
    clearTimeout(viewTransitionRef.current.midTimer);
    clearTimeout(viewTransitionRef.current.endTimer);
  }, []);
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
  return <main className={`exhibition-shell mode-${mode} thumbnail-layout-${station.thumbnailLayout} ${overviewMode ? 'is-overview' : ''} ${viewTransitioning ? 'is-view-transitioning' : ''}`}>
    <SpatialRoomCanvas stations={stations} stationIndex={stationIndex} selectedItem={selectedItem} editorMode={mode === 'editor'} overviewMode={overviewMode} largePresentation={mode === 'visitor'} onCameraReady={(capture) => { captureCameraRef.current = capture; }} onSelectStation={enterStation} onSelectItem={enterItem} />
    <div className="spatial-view-wash" aria-hidden="true" />
    <header className="exhibition-header"><a href={backHref} className="exhibition-brand" title="Zurück zu den Stories" aria-label="Zurück zu den Stories"><span className="exhibition-mark"><i /></span><b>RIU</b></a><div className="exhibition-mode-switch"><button className={mode === 'visitor' ? 'is-active' : ''} onClick={() => { setMode('visitor'); setOpenItemId(null); setOverviewMode(true); }}><Footprints size={14} /> Besucher</button>{initialMode === 'editor' && <button className={mode === 'editor' ? 'is-active' : ''} onClick={() => { setMode('editor'); setOverviewMode(false); }}><MousePointer2 size={13} /> Editor</button>}</div><div className="exhibition-progress"><span>{String(stationIndex + 1).padStart(2, '0')}</span><i /><span>{String(stations.length).padStart(2, '0')}</span></div></header>
    {overviewMode && <div className="spatial-overview-hint"><MousePointer2 size={14} /><span><b>Story betreten</b> Station oder Objekt direkt auswählen</span></div>}
    <section className="spatial-station-content"><div className="spatial-story-copy"><span>Station {String(stationIndex + 1).padStart(2, '0')}</span><h1>{station.title}</h1><p>{station.introduction}</p></div><div className="spatial-thumbnails">{station.items.map((item) => <SpatialThumbnail key={item.id} item={item} selected={item.id === selectedItem?.id} multiSelected={mode === 'editor' && selectedThumbnailIds.includes(item.id)} editorMode={mode === 'editor'} onSelect={(event) => { if (mode === 'editor') selectThumbnailItem(item.id, event); else setOpenItemId(item.id); }} onMove={(position) => updateItem(stationIndex, item.id, { thumbnailTransform: { ...item.thumbnailTransform, position } })} />)}{mode === 'visitor' && !selectedItem && station.items.length > 0 && <div className="spatial-open-hint">Objekt auswählen, um es räumlich zu öffnen</div>}{!station.items.length && <div className="spatial-empty-objects"><Box size={25} /><span>{mode === 'editor' ? 'Fügen Sie in der Seitenleiste das erste Modell hinzu.' : 'Diese Station wird noch kuratiert.'}</span></div>}</div>
      {selectedItem?.sourceType === 'sketchfab' && <div className="spatial-sketchfab"><iframe src={adapter.getViewerUrl(selectedItem.modelUrl)} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen title={selectedItem.title} /></div>}
      {selectedItem && <div className="spatial-object-caption"><b>{selectedItem.title}</b><span>{selectedItem.description}</span>{(selectedItem.attribution || selectedItem.license) && <small>{[selectedItem.attribution, selectedItem.license].filter(Boolean).join(' · ')}</small>}</div>}
      {selectedItem && <div className="model-interaction-hint"><Rotate3D size={14} /> Ziehen zum Drehen <i /> Scrollen zum Zoomen</div>}
    </section>
    <footer className="exhibition-footer"><a href={backHref} className="exhibition-back"><ArrowLeft size={14} /> Meine Stories</a><div className="station-stepper"><button disabled={stationIndex === 0} onClick={() => enterStation(stationIndex - 1)}><ChevronLeft /></button><span><b>{String(stationIndex + 1).padStart(2, '0')}</b> / {String(stations.length).padStart(2, '0')}</span><button disabled={stationIndex === stations.length - 1} onClick={() => enterStation(stationIndex + 1)}><ChevronRight /></button></div><div className="exhibition-footer-actions">{mode === 'visitor' && station.spatial.audio.url && !station.spatial.audio.autoplay && <button className="walk-hint" type="button" onClick={() => setAudioPlaying((value) => !value)}>{audioPlaying ? <VolumeX size={15} /> : <Volume2 size={15} />} {audioPlaying ? 'Ton stoppen' : 'Ton starten'}</button>}<button className={`walk-hint ${overviewMode ? 'is-active' : ''}`} type="button" onClick={toggleOverview}><Footprints size={15} /> {overviewMode ? 'Zur Station' : 'Raumübersicht'}</button></div></footer>
    {mode === 'editor' && <EditorSidebar editingStations={stations} editingAnnotations={[]} editingIndex={stationIndex} activeAccordionIndex={null} activeImageAccordion={null} configFile={{ showImportExport: false, openDialog() {} }} onSetActiveAccordion={() => {}} onSetActiveImageAccordion={() => {}} onTestStation={(index) => setStationIndex(index)} onMoveStation={moveStation} onDeleteStation={deleteStation} onCaptureCamera={captureCamera} onPlaceOriginPoint={() => {}} onUpdateText={() => {}} onUpdateImage={() => {}} onUploadImage={() => {}} onAddAnnotation={() => {}} onDeleteAnnotation={() => {}} onMoveAnnotation={() => {}} onUpdateAnnotation={() => {}} onCaptureAnnotation={() => {}} onPlaceAnnotationInScene={() => {}} onUploadAnnotationImages={() => {}} onLocalBgUpload={() => {}} getBgSelectValue={() => ''} onCancel={() => { location.href = backHref; }} onSave={save} onRealign={() => {}} onRestoreDefaults={() => setStations(normalizeStoryStations(story))} onAddStation={addStation} onPreviewModeChange={(preview) => { setMode(preview ? 'visitor' : 'editor'); setOpenItemId(preview ? undefined : null); setOverviewMode(false); }} projects={[editorProject]} activeProject={editorProject} saveStatus={saved ? 'saved' : 'idle'} onUpdateProject={() => {}} canCreateProjects={false} spatialMode selectedSpatialItemIds={selectedThumbnailIds} onSelectSpatialItem={selectThumbnailItem} onUpdateSpatialStation={updateStation} onUpdateSpatialItem={updateItem} onUpdateSpatialItemPositions={updateItemPositions} onMoveSpatialItem={moveItem} onAddSpatialItem={addItem} onRemoveSpatialItem={removeItem} />}
    {saved && <div className="spatial-save-toast"><Check size={14} /> Story gespeichert</div>}
  </main>;
}
