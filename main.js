import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

import { createSkyDome, createGrassPlane, createLighting } from './src/environment.js';
import { loadModels, setupRevealMaterials } from './src/models.js';
import { computeAlignmentMatrix, saveAlignment, loadAlignment, clearAlignment, matrixToAlignment, alignmentToMatrix } from './src/alignment.js';
import { loadDraftStations, loadStationConfig } from './src/stations.js';

import { ctx } from './src/three/context.js';
import { setupStateBridge } from './src/three/stateBridge.js';
import { initStationImages, updateStationImages } from './src/three/imagePlanes.js';
import {
  getPortalTransitionConfig,
  computeTransitionState,
  isPortalRevealTransition,
  applyTransitionState,
  startPortalTransition,
  cancelPortalTransition,
  configureReconstructionDepth
} from './src/three/portalTransition.js';
import { playInitialIntro } from './src/three/introSequence.js';
import { animate } from './src/three/renderLoop.js';
import { disposeExperience } from './src/three/disposeExperience.js';
import { resolveStationCamera } from './src/three/stationCamera.js';
import {
  applyFreeOrbitRotation,
  applyFreeViewPan,
  createFreeNavigationActivationState,
  isFreeNavigationActiveState
} from './src/three/freeOrbit.js';
import { normalizeProjectCameraFov, normalizeProjectOrbitTarget } from './src/projects/projectSettings.js';
import { isSketchfabModelUrl } from './src/utils/modelSource.js';
import { interpolateCameraView } from './src/utils/cameraInterpolation.js';

// ─── DOM & CANVAS ─────────────────────────────────────
const canvas = document.getElementById('scene-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingPercent = document.getElementById('loading-percent');

let displayedLoadingProgress = 0;
let targetLoadingProgress = 0.03;
let loadingComplete = false;

function renderLoadingProgress(progress) {
  const pct = Math.round(THREE.MathUtils.clamp(progress, 0, 1) * 100);
  if (loadingBar) loadingBar.style.width = pct + '%';
  if (loadingPercent) loadingPercent.textContent = pct + '%';
}

const loadingProgressTimer = window.setInterval(() => {
  if (!loadingComplete) {
    targetLoadingProgress = Math.min(targetLoadingProgress + 0.006, 0.92);
  }
  displayedLoadingProgress = THREE.MathUtils.lerp(displayedLoadingProgress, targetLoadingProgress, 0.12);
  renderLoadingProgress(displayedLoadingProgress);
}, 100);

// ─── RENDERER ─────────────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} catch (error) {
  console.error("WebGL Initialization failed:", error);
  if (loadingPercent) {
    loadingPercent.innerHTML = '<span style="color: #ff5252; font-weight: 600; display: block; max-width: 400px; margin: 10px auto; line-height: 1.5; font-size: 13px;">WebGL-Fehler: Der WebGL-Kontext konnte nicht erstellt werden.<br>Grafikbeschleunigung wurde blockiert oder ist inaktiv. Bitte starten Sie Ihren Browser vollständig neu oder öffnen Sie diese Seite an einem anderen Port (z.B. localhost:3005).</span>';
  }
  const loadingSubtitle = document.querySelector('.loading-subtitle');
  if (loadingSubtitle) {
    loadingSubtitle.textContent = '3D-Engine konnte nicht gestartet werden.';
  }
  throw error;
}

// ─── SCENE & CAMERA ──────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x010101, 0.019);

const BASE_CAMERA_FOV = 45;
const camera = new THREE.PerspectiveCamera(BASE_CAMERA_FOV, (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight), 0.1, 1000);
camera.position.set(0, 10, 22);

// ─── CONTROLS ─────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
const firstPersonEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const firstPersonDirection = new THREE.Vector3();
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableRotate = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.screenSpacePanning = true;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.mouseButtons.RIGHT = null;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.minDistance = 0.5;
controls.maxDistance = 75;
controls.target.set(0, 3.5, 0);

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
const isTypingTarget = (target) => target instanceof HTMLElement && (
  target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
);

window.addEventListener('keydown', (event) => {
  if (!movementCodes.has(event.code) || isTypingTarget(event.target) || (!controls.enabled && !ctx.firstPerson.active)) return;
  ctx.movementKeys.add(event.code);
  if (event.code !== 'ShiftLeft' && event.code !== 'ShiftRight') {
    event.preventDefault();
    pauseAutoRotate();
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    if (!window.appState?.hasUserManipulatedCamera) {
      window.appState?.update({ hasUserManipulatedCamera: true });
    }
  }
});

window.addEventListener('keyup', (event) => {
  if (movementCodes.has(event.code)) ctx.movementKeys.delete(event.code);
});

window.addEventListener('blur', () => {
  ctx.movementKeys.clear();
  ctx.firstPerson.verticalMove = false;
});

document.addEventListener('pointerlockchange', () => {
  const isActive = document.pointerLockElement === canvas;
  ctx.firstPerson.active = isActive;
  ctx.firstPerson.verticalMove = false;
  ctx.movementKeys.clear();

  if (isActive) {
    firstPersonEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    ctx.firstPerson.pitch = firstPersonEuler.x;
    ctx.firstPerson.yaw = firstPersonEuler.y;
    ctx.firstPerson.lookDistance = Math.max(1, Math.min(10, camera.position.distanceTo(controls.target)));
    controls.enabled = false;
  } else if (window.appState?.stationMode === 'editor') {
    controls.enabled = true;
    camera.getWorldDirection(firstPersonDirection);
    controls.target.copy(camera.position).addScaledVector(firstPersonDirection, ctx.firstPerson.lookDistance);
    controls.update();
  }

  window.appState?.update({ firstPersonActive: isActive });
});

document.addEventListener('mousemove', (event) => {
  if (!ctx.firstPerson.active) return;

  if (ctx.firstPerson.verticalMove) {
    const verticalSpeed = Math.max(0.004, ctx.firstPerson.lookDistance * 0.0015);
    const verticalDelta = -event.movementY * verticalSpeed;
    camera.position.y += verticalDelta;
    controls.target.y += verticalDelta;
    ctx.targetCameraPos.copy(camera.position);
    ctx.targetCameraTarget.copy(controls.target);
    return;
  }

  const sensitivity = 0.0022;
  ctx.firstPerson.yaw -= event.movementX * sensitivity;
  ctx.firstPerson.pitch -= event.movementY * sensitivity;
  ctx.firstPerson.pitch = THREE.MathUtils.clamp(ctx.firstPerson.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);

  firstPersonEuler.set(ctx.firstPerson.pitch, ctx.firstPerson.yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(firstPersonEuler);
  camera.getWorldDirection(firstPersonDirection);
  controls.target.copy(camera.position).addScaledVector(firstPersonDirection, ctx.firstPerson.lookDistance);
  ctx.targetCameraPos.copy(camera.position);
  ctx.targetCameraTarget.copy(controls.target);
});

document.addEventListener('mousedown', (event) => {
  if (ctx.firstPerson.active && event.button === 2) {
    ctx.firstPerson.verticalMove = true;
  }
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 2) ctx.firstPerson.verticalMove = false;
});

let autoRotateTimer = null;
const freeOrbitDrag = { active: false, mode: null, x: 0, y: 0 };

function isFreeNavigationActive() {
  return isFreeNavigationActiveState(window.appState);
}

function pauseAutoRotate() {
  controls.autoRotate = false;
  clearTimeout(autoRotateTimer);
  autoRotateTimer = setTimeout(() => {
    if (
      ctx.isRevealMode
      && window.appState?.stationMode !== 'editor'
      && controls.enabled
      && !isFreeNavigationActive()
    ) {
      controls.autoRotate = true;
    }
  }, 5000);
}

canvas.addEventListener('pointerdown', (event) => {
  pauseAutoRotate();
  const activeStation = window.appState?.stations?.[window.appState.currentStationIndex];
  const freeNavigationNeedsActivation = window.appState?.stationMode === 'scroll'
    && activeStation?.freeNavigation
    && (!window.appState.freeNavigationActive
      || window.appState.freeNavigationStationId !== activeStation.id);
  if (event.button === 0 && freeNavigationNeedsActivation) {
    activateFreeNavigation();
    event.preventDefault();
    return;
  }
  if (
    event.button === 0
    && window.appState?.stationMode === 'editor'
    && !ctx.pendingAnnotationPlacement
    && document.pointerLockElement !== canvas
  ) {
    canvas.requestPointerLock?.();
  }
  if (controls.enabled && !window.appState?.hasUserManipulatedCamera) {
    window.appState?.update({ hasUserManipulatedCamera: true });
  }
});

canvas.addEventListener('pointerdown', (event) => {
  if (![0, 2].includes(event.button) || !isFreeNavigationActive()) return;
  freeOrbitDrag.active = true;
  freeOrbitDrag.mode = event.button === 2 ? 'pan' : 'rotate';
  freeOrbitDrag.x = event.clientX;
  freeOrbitDrag.y = event.clientY;
  canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  if (!freeOrbitDrag.active || !isFreeNavigationActive()) return;
  const deltaX = event.clientX - freeOrbitDrag.x;
  const deltaY = event.clientY - freeOrbitDrag.y;
  freeOrbitDrag.x = event.clientX;
  freeOrbitDrag.y = event.clientY;
  if (deltaX === 0 && deltaY === 0) return;

  if (freeOrbitDrag.mode === 'pan') {
    if (!applyFreeViewPan({
      camera,
      target: controls.target,
      deltaX,
      deltaY,
      viewportHeight: canvas.getBoundingClientRect().height
    })) return;
  } else {
    const pivot = window.appState.freeNavigationOrbitPivot ?? window.appState.projectOrbitTarget;
    if (!applyFreeOrbitRotation({
      camera,
      target: controls.target,
      pivot,
      deltaX,
      deltaY
    })) return;
  }

  ctx.targetCameraPos.copy(camera.position);
  ctx.targetCameraTarget.copy(controls.target);
  if (!window.appState.hasUserManipulatedCamera) {
    window.appState.update({ hasUserManipulatedCamera: true });
  }
  event.preventDefault();
});

const endFreeOrbitDrag = (event) => {
  if (!freeOrbitDrag.active) return;
  freeOrbitDrag.active = false;
  freeOrbitDrag.mode = null;
  if (event?.pointerId !== undefined && canvas.hasPointerCapture?.(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
};

canvas.addEventListener('pointerup', endFreeOrbitDrag);
canvas.addEventListener('pointercancel', endFreeOrbitDrag);

canvas.addEventListener('wheel', () => {
  pauseAutoRotate();
  if (controls.enabled && !window.appState?.hasUserManipulatedCamera) {
    window.appState?.update({ hasUserManipulatedCamera: true });
  }
});

// Bind to context
ctx.canvas = canvas;
ctx.renderer = renderer;
ctx.scene = scene;
ctx.camera = camera;
ctx.controls = controls;

window.appState.captureThumbnail = () => {
  if (!renderer || !camera || !scene || canvas.width < 1 || canvas.height < 1) {
    throw new Error('Die 3D-Ansicht ist noch nicht bereit.');
  }

  controls.update();
  renderer.render(scene, camera);

  const thumbnail = document.createElement('canvas');
  thumbnail.width = 960;
  thumbnail.height = 540;
  const context = thumbnail.getContext('2d');
  if (!context) throw new Error('Das Vorschaubild konnte nicht erzeugt werden.');

  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;
  const targetRatio = thumbnail.width / thumbnail.height;
  const sourceRatio = sourceWidth / sourceHeight;
  let sourceX = 0;
  let sourceY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    sourceX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetRatio;
    sourceY = (sourceHeight - cropHeight) / 2;
  }

  context.fillStyle = '#080907';
  context.fillRect(0, 0, thumbnail.width, thumbnail.height);
  context.drawImage(
    canvas,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    thumbnail.width,
    thumbnail.height
  );
  return thumbnail.toDataURL('image/jpeg', 0.82);
};

const nextAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

window.appState.captureStoryPreview = async ({
  durationMs = 3000,
  returnDurationMs = 3500,
  endStationIndex = 1,
  fps = 24
} = {}) => {
  const stations = window.appState?.stations || [];
  if (stations.length < 2) throw new Error('Für eine Preview werden mindestens zwei Stationen benötigt.');
  if (!renderer || !camera || !scene || canvas.width < 1 || canvas.height < 1) {
    throw new Error('Die 3D-Ansicht ist noch nicht bereit.');
  }
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
    throw new Error('Dieser Browser unterstützt die WebM-Aufnahme nicht.');
  }

  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('Dieser Browser stellt keinen WebM-Encoder bereit.');
  const lastPreviewStationIndex = Math.max(1, Math.min(stations.length - 1, endStationIndex));

  const previous = {
    stationMode: window.appState.stationMode,
    scrollProgress: window.appState.scrollProgress || 0,
    currentStationIndex: window.appState.currentStationIndex || 0
  };
  const previousRendererSize = renderer.getSize(new THREE.Vector2());
  const previousPixelRatio = renderer.getPixelRatio();
  const previousCameraAspect = camera.aspect;
  let recorder;
  let stream;

  document.body.classList.add('story-preview-capture');
  try {
    // 960×540 keeps the locally stored preview compact and matches the 16:9 cards.
    renderer.setPixelRatio(1);
    renderer.setSize(960, 540, false);
    camera.aspect = 16 / 9;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(ctx.revealUniforms.uViewportSize.value);
    window.appState.setStationMode?.('scroll');
    ctx.visualScrollProgress = 0;
    applyScrollProgress(0);
    updateScrollProgress(0);
    camera.position.copy(ctx.targetCameraPos);
    controls.target.copy(ctx.targetCameraTarget);
    controls.update();
    await nextAnimationFrame();
    await nextAnimationFrame();

    stream = canvas.captureStream(Math.max(1, Math.min(30, fps)));
    const chunks = [];
    // MediaRecorder exposes no portable keyframe-interval control. Short duration,
    // frequent chunks and VP8/VP9 are the most robust browser-native seekable option.
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_400_000 });
    const stopped = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => reject(recorder.error || new Error('Die Videoaufnahme ist fehlgeschlagen.'));
      recorder.onstop = resolve;
    });
    recorder.start(250);

    const captureTransition = (from, to, legDurationMs) => new Promise((resolve) => {
      const startedAt = performance.now();
      const advance = (timestamp) => {
        const legProgress = THREE.MathUtils.clamp((timestamp - startedAt) / legDurationMs, 0, 1);
        const transitionProgress = THREE.MathUtils.lerp(from, to, legProgress);
        // Der gewählte Ausschnitt nutzt dieselbe globale Story-Progress-Funktion
        // wie das reale Scrollen und endet exakt an der ausgewählten Station.
        const storyProgress = transitionProgress
          * lastPreviewStationIndex / Math.max(stations.length - 1, 1);
        ctx.visualScrollProgress = storyProgress;
        updateScrollProgress(storyProgress);
        applyScrollProgress(storyProgress);
        camera.position.copy(ctx.targetCameraPos);
        controls.target.copy(ctx.targetCameraTarget);
        controls.update();
        if (legProgress < 1) requestAnimationFrame(advance);
        else resolve();
      };
      requestAnimationFrame(advance);
    });
    await captureTransition(0, 1, durationMs);
    // Unsichtbarer Rückweg: Er wird in Cards normal vorwärts abgespielt und
    // zeigt dadurch Station 2 → 1 ohne ruckelige Rückwärts-Seeks.
    await captureTransition(1, 0, returnDurationMs);
    await nextAnimationFrame();
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
    if (!blob.size) throw new Error('Der Browser hat keine Videodaten erzeugt.');
    return blob;
  } finally {
    if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    document.body.classList.remove('story-preview-capture');
    renderer.setPixelRatio(previousPixelRatio);
    renderer.setSize(previousRendererSize.x, previousRendererSize.y, false);
    camera.aspect = previousCameraAspect;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(ctx.revealUniforms.uViewportSize.value);
    window.appState.setStationMode?.(previous.stationMode);
    updateScrollProgress(previous.scrollProgress);
    ctx.visualScrollProgress = previous.scrollProgress;
    applyScrollProgress(previous.scrollProgress);
    const previousStation = window.appState.stations?.[previous.currentStationIndex];
    if (previous.stationMode === 'editor' && previousStation) {
      window.appState.snapToStation?.(previousStation, previous.currentStationIndex);
    }
  }
};

ctx.skyMaterial = createSkyDome(scene);
ctx.grassObj = createGrassPlane(scene);
ctx.lights = createLighting(scene);
scene.add(ctx.lights.keyLight.target);
scene.add(ctx.lights.fillLight.target);

renderer.getDrawingBufferSize(ctx.revealUniforms.uViewportSize.value);

// Bind actions
ctx.actions.startAlignmentMode = startAlignmentMode;
ctx.actions.handleAlignClick = handleAlignClick;
ctx.actions.completeAlignment = completeAlignment;
ctx.actions.enterRevealMode = enterRevealMode;
ctx.actions.updateStationImages = updateStationImages;
ctx.actions.updateScrollProgress = updateScrollProgress;
ctx.actions.applyScrollProgress = applyScrollProgress;
ctx.actions.clearMarkers = clearMarkers;
ctx.actions.clearLines = clearLines;
ctx.actions.getPortalTransitionConfig = getPortalTransitionConfig;
ctx.actions.computeTransitionState = computeTransitionState;
ctx.actions.isPortalRevealTransition = isPortalRevealTransition;
ctx.actions.applyTransitionState = applyTransitionState;
ctx.actions.startPortalTransition = startPortalTransition;
ctx.actions.cancelPortalTransition = cancelPortalTransition;
ctx.actions.playInitialIntro = playInitialIntro;

// Bind editor/runtime actions before large model assets finish loading.
setupStateBridge();
window.appState.activateFreeNavigation = activateFreeNavigation;

initStationImages();

function syncScrollControlsForStation(station) {
  if (window.appState.stationMode !== 'scroll') return;

  const canNavigateFreely = !!station?.freeNavigation;
  const freeNavigationIsActive = canNavigateFreely
    && window.appState.freeNavigationActive
    && window.appState.freeNavigationStationId === station.id;
  controls.enabled = freeNavigationIsActive;
  controls.mouseButtons.RIGHT = null;
  controls.panSpeed = 1;
  // Timeline stations use the wheel for scrolling. A station explicitly
  // configured for free navigation owns the wheel only after explicit activation.
  controls.enableZoom = freeNavigationIsActive;
  controls.enablePan = false;
  controls.enableRotate = !freeNavigationIsActive;
  controls.autoRotate = false;

  if (freeNavigationIsActive) {
    window.appState.setFreeNavigationMaxDistance?.(station.freeNavigationMaxDistance);
  }

  if (!freeNavigationIsActive && window.appState.hasUserManipulatedCamera) {
    window.appState.update({ hasUserManipulatedCamera: false });
  }
}

function activateFreeNavigation() {
  if (window.appState.stationMode !== 'scroll') return;
  const stationIndex = window.appState.currentStationIndex;
  const station = window.appState.stations?.[stationIndex];
  if (!station?.freeNavigation) return;

  // Activation only releases the scroll camera and selects the independent
  // orbit pivot. Camera position and look direction remain untouched.
  const activationState = createFreeNavigationActivationState(
    station,
    window.appState.projectOrbitTarget
  );
  if (!activationState) return;
  window.appState.update(activationState);
  syncScrollControlsForStation(station);
}

function resolveScrollCamera(stations, stationIndex, station) {
  const resolvedCamera = resolveStationCamera(stations, stationIndex, station);
  return {
    cameraPos: resolvedCamera.cameraPos,
    cameraTarget: resolvedCamera.cameraTarget
  };
}

// ─── LOADING & INITIALIZATION ─────────────────────────
async function init() {
  const isEditPage = window.location.pathname === '/edits' || window.location.pathname.startsWith('/studio/');
  try {
    // Stations and editor controls are lightweight and should be available
    // independently from the potentially large 3D model download.
    const config = await loadStationConfig();
    const initialStations = isEditPage
      ? (loadDraftStations(config.project?.id) ?? config.stations)
      : config.stations;

    window.appState.update({
      stations: initialStations,
      annotations: config.annotations,
      projectConfig: config.project,
      projectOrbitTarget: normalizeProjectOrbitTarget(
        config.project?.settings?.orbitTarget,
        initialStations
      ),
      alignment: config.alignment,
      ...(isEditPage ? {
        mode: 'reveal',
        stationMode: 'editor',
        baseModelStatus: 'loading',
        baseModelError: '',
        introPhase: 'done'
      } : {})
    });
    window.appState.setCameraFov?.(normalizeProjectCameraFov(config.project?.settings?.cameraFov));

    if (isEditPage && loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.pointerEvents = 'none';
    }

    const usesSketchfabViewer = isSketchfabModelUrl(config.project?.models?.primary);
    const loadableModels = {
      ...config.project?.models,
      reconstruction: isSketchfabModelUrl(config.project?.models?.reconstruction)
        ? ''
        : config.project?.models?.reconstruction
    };
    const result = usesSketchfabViewer
      ? {
          ruinModel: new THREE.Group(),
          reconModel: new THREE.Group(),
          modelAnimations: []
        }
      : await loadModels(scene, (progress) => {
          targetLoadingProgress = Math.max(targetLoadingProgress, progress);
        }, loadableModels);

    if (usesSketchfabViewer) {
      scene.add(result.ruinModel, result.reconModel);
      document.body.classList.add('sketchfab-experience');
    } else {
      document.body.classList.remove('sketchfab-experience');
    }

    ctx.ruinModel = result.ruinModel;
    ctx.reconModel = result.reconModel;
    ctx.modelAnimationControllers = result.modelAnimations;
    ctx.activeModelAnimationStationId = null;

    // Capture artist-defined normalized height offsets
    ctx.ruinOffsetY = ctx.ruinModel.position.y;
    ctx.reconOffsetY = ctx.reconModel.position.y;

    // Enable shadows on models
    ctx.ruinModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    ctx.reconModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

    // Setup reveal materials & inject uniforms
    setupRevealMaterials(ctx.ruinModel, false, ctx.revealUniforms);
    setupRevealMaterials(ctx.reconModel, true, ctx.revealUniforms);

    // Warm up/pre-compile shaders and upload textures to the GPU during the loading phase
    // to prevent any stutter/lag when the models first become visible.
    ctx.ruinModel.visible = true;
    ctx.reconModel.visible = true;
    renderer.compile(scene, camera);
    ctx.ruinModel.visible = false;
    ctx.reconModel.visible = false;
    ctx.revealHitMeshes = collectRevealHitMeshes(ctx.reconModel);
    window.appState.update({ baseModelStatus: 'ready', baseModelError: '' });

    // Check for saved alignment with default config alignment as fallback
    const hasReconstruction = !usesSketchfabViewer && !!loadableModels.reconstruction;
    const savedMatrix = hasReconstruction ? loadAlignment(config.alignment) : null;
    if (savedMatrix) {
      ctx.reconModel.applyMatrix4(savedMatrix);
      ctx.reconModel.updateMatrixWorld(true);
      ctx.isModelAligned = true;
      window.appState.update({ alignment: matrixToAlignment(savedMatrix) });
      if (!isEditPage) finishLoading(false);
    } else if (!hasReconstruction) {
      if (!isEditPage) finishLoading(false);
    } else {
      if (!isEditPage) finishLoading(true);
    }

    if (isEditPage) {
      clearInterval(loadingProgressTimer);
      loadingComplete = true;
      enterRevealMode();
      window.appState.setStationMode('editor');
      window.appState.update({ baseModelStatus: 'ready', baseModelError: '' });
    }
  } catch (error) {
    console.error("Initialization failed:", error);
    clearInterval(loadingProgressTimer);
    if (isEditPage) {
      window.appState.update({
        mode: 'reveal',
        stationMode: 'editor',
        baseModelStatus: 'error',
        baseModelError: error.message,
        introPhase: 'done'
      });
      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.pointerEvents = 'none';
      }
      return;
    }
    if (loadingPercent) {
      loadingPercent.innerHTML = `<span style="color: #ff5252; font-weight: 600;">Fehler beim Laden der 3D-Modelle: ${error.message}</span>`;
    }
  }
}

function finishLoading(showAlignment) {
  loadingComplete = true;
  clearInterval(loadingProgressTimer);
  renderLoadingProgress(1.0);

  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.pointerEvents = 'none';
    }
    if (showAlignment) {
      startAlignmentMode();
    } else {
      enterRevealMode();
    }
  }, 400);
}

function collectRevealHitMeshes(model) {
  const modelBox = new THREE.Box3().setFromObject(model);
  const modelHeight = Math.max(modelBox.max.y - modelBox.min.y, 0.0001);
  const pickMeshes = [];

  model.traverse((child) => {
    if (!child.isMesh) return;
    const box = new THREE.Box3().setFromObject(child);
    const size = box.getSize(new THREE.Vector3());
    const relativeHeight = size.y / modelHeight;
    const bottomOffset = (box.max.y - modelBox.min.y) / modelHeight;

    if (relativeHeight < 0.04 || bottomOffset < 0.08) {
      return;
    }
    pickMeshes.push(child);
  });
  return pickMeshes;
}


// ─── ALIGNMENT MODE ──────────────────────────────────
function startAlignmentMode() {
  window.appState.update({
    mode: 'aligning',
    alignStep: 0,
    alignTarget: 'ruin'
  });

  ctx.isRevealMode = false;
  controls.autoRotate = false;

  ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
  ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);

  ctx.ruinModel.visible = true;
  ctx.reconModel.visible = false;

  ctx.revealUniforms.uRevealActive.value = false;
  ctx.revealUniforms.uShowAlways.value = true;

  controls.target.set(0, 3.5, 0);
  camera.position.set(10, 7.5, 14);

  window.appState.resetAlignment();
}

function handleAlignClick(event) {
  if (window.appState.mode !== 'aligning') return;

  const rect = canvas.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  ctx.raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

  const isRuinTurn = window.appState.alignTarget === 'ruin';
  const targetModel = isRuinTurn ? ctx.ruinModel : ctx.reconModel;
  const intersects = ctx.raycaster.intersectObject(targetModel, true);

  if (intersects.length === 0) return;

  const worldPoint = intersects[0].point.clone();
  const localPoint = targetModel.worldToLocal(worldPoint.clone());

  if (isRuinTurn) {
    ctx.alignPoints.ruin.push(localPoint);
    ctx.alignPoints.ruinWorld.push(worldPoint);
    addMarker(worldPoint, 'ruin');

    const nextStep = window.appState.alignStep + 1;
    if (nextStep === 3) {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'recon'
      });
      ctx.ruinModel.visible = false;
      ctx.alignMarkers.forEach(m => { if (m.userData.type === 'ruin') m.visible = false; });
      ctx.reconModel.visible = true;
    } else {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'ruin'
      });
    }
  } else {
    ctx.alignPoints.recon.push(localPoint);
    ctx.alignPoints.reconWorld.push(worldPoint);
    addMarker(worldPoint, 'recon');

    const nextStep = window.appState.alignStep + 1;
    if (nextStep === 6) {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'done'
      });
      setTimeout(completeAlignment, 700);
    } else {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'recon'
      });
    }
  }
}

function addMarker(worldPos, type) {
  const geo = new THREE.SphereGeometry(0.12, 16, 16);
  const color = type === 'ruin' ? 0xffa726 : 0x6ef0f5;
  const mat = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.9
  });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.renderOrder = 999;
  sphere.position.copy(worldPos);
  sphere.userData = { type };
  scene.add(sphere);
  ctx.alignMarkers.push(sphere);
}

function clearMarkers() {
  ctx.alignMarkers.forEach(m => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  ctx.alignMarkers.length = 0;
}

function clearLines() {
  ctx.alignLines.forEach(l => {
    scene.remove(l);
    l.geometry.dispose();
    l.material.dispose();
  });
  ctx.alignLines.length = 0;
}

function completeAlignment() {
  const matrix = computeAlignmentMatrix(ctx.alignPoints.reconWorld, ctx.alignPoints.ruinWorld);

  if (matrix) {
    ctx.reconModel.applyMatrix4(matrix);
    ctx.reconModel.updateMatrixWorld(true);
    saveAlignment(matrix);
    window.appState.update({ alignment: matrixToAlignment(matrix) });
    ctx.isModelAligned = true;
  }

  clearMarkers();

  const allowBaseModels = window.appState.showBaseModels !== false;
  ctx.ruinModel.visible = allowBaseModels;
  ctx.reconModel.visible = allowBaseModels;

  ctx.reconModel.traverse((child) => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.opacity = 1.0; m.transparent = true; m.needsUpdate = true; });
    }
  });

  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);

  ctx.revealUniforms.uRevealActive.value = true;
  ctx.revealUniforms.uCameraWorldPos.value.copy(camera.position);
  const modelCenter = new THREE.Vector3(0, ctx.ruinOffsetY, 0);
  ctx.revealUniforms.uRayDirection.value.subVectors(modelCenter, camera.position).normalize();
  ctx.revealUniforms.uRevealCenterWorld.value.copy(modelCenter);
  ctx.revealUniforms.uRevealHasHit.value = true;
  ctx.revealUniforms.uMouseNDC.value.set(0, 0);
  ctx.revealUniforms.uRevealRadius.value = 0.0;
  ctx.revealUniforms.uRevealSoftness.value = 0.15;

  const tl = gsap.timeline({
    onComplete: () => {
      enterRevealMode();
    }
  });

  tl.to(ctx.revealUniforms.uRevealRadius, {
    value: 1.8,
    duration: 2.5,
    ease: 'power2.inOut'
  });

  tl.to(ctx.revealUniforms.uRevealRadius, {
    value: 0.26,
    duration: 1.2,
    ease: 'power2.out'
  });

  tl.to(ctx.revealUniforms.uRevealSoftness, {
    value: 0.05,
    duration: 0.8
  }, '-=1.2');

  gsap.to(controls.target, {
    x: 0,
    y: 3.5,
    z: 0,
    duration: 2.2,
    ease: 'power3.inOut'
  });

  gsap.to(camera.position, {
    x: 11,
    y: 6.5,
    z: 14,
    duration: 2.2,
    ease: 'power3.inOut'
  });
}

// ─── REVEAL / EXPLORE MODE ──────────────────────────
function enterRevealMode() {
  ctx.isRevealMode = true;
  const shouldPlayIntro = !window.appState.hasIntroPlayed && window.location.pathname !== '/edits';

  if (shouldPlayIntro) {
    ctx.introModelOpacity.value = 0;
  } else {
    ctx.introModelOpacity.value = 1;
  }

  ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
  if (!ctx.isModelAligned) {
    ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);
  }

  ctx.revealUniforms.uRevealActive.value = true;
  ctx.revealUniforms.uShowAlways.value = false;
  ctx.revealUniforms.uRevealHasHit.value = false;
  ctx.revealUniforms.uRevealCenterWorld.value.set(9999, 9999, 9999);

  ctx.reconModel.traverse((child) => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.opacity = 1.0; m.transparent = true; m.needsUpdate = true; });
    }
  });

  const allowBaseModels = window.appState.showBaseModels !== false;
  ctx.ruinModel.visible = allowBaseModels;
  ctx.reconModel.visible = allowBaseModels;
  configureReconstructionDepth(false);

  if (window.appState.stations && window.appState.stations.length > 0) {
    const first = window.appState.stations[0];
    const firstCamera = resolveStationCamera(window.appState.stations, 0, first);
    camera.position.copy(firstCamera.cameraPos);
    controls.target.copy(firstCamera.cameraTarget);
    ctx.targetCameraPos.copy(camera.position);
    ctx.targetCameraTarget.copy(controls.target);
    
    ctx.revealUniforms.uRevealRadius.value = first.revealRadius;
    ctx.revealUniforms.uRevealSoftness.value = first.revealSoftness;
    ctx.targetRevealRadius = first.revealRadius;
    ctx.targetRevealSoftness = first.revealSoftness;

    // Project-wide lighting supersedes the legacy per-station values. Passing
    // the first station as a fallback migrates older configurations once.
    window.appState.applyProjectLighting(window.appState.projectConfig?.settings?.lighting ?? first);
    ctx.currentLightIntensity = ctx.targetLightIntensity;
    ctx.currentShadowDiffuse = ctx.targetShadowDiffuse;

    updateStationImages(first.images);

    ctx.lastIntervalIndex = 0;
    ctx.lastTargetP = 0.0;
    ctx.transitionProgress.value = 0.0;
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }

    window.appState.update({
      mode: 'reveal',
      stationMode: 'scroll',
      viewMode: first.viewMode,
      scrollProgress: 0,
      currentStationIndex: 0,
      lightIntensity: ctx.targetLightIntensity,
      shadowDiffuse: ctx.targetShadowDiffuse,
      introPhase: shouldPlayIntro ? 'title' : 'done'
    });
    window.appState.setViewMode(first.viewMode);
  } else {
    window.appState.update({
      mode: 'reveal',
      stationMode: 'scroll',
      viewMode: 'reveal',
      scrollProgress: 0,
      currentStationIndex: 0,
      introPhase: shouldPlayIntro ? 'title' : 'done'
    });
  }

  if (shouldPlayIntro) {
    ctx.revealUniforms.uOpacityRuin.value = 0;
    ctx.revealUniforms.uOpacityRecon.value = 0;
    ctx.revealUniforms.uPortalTint.value = 0;
  }

  syncScrollControlsForStation(window.appState.stations?.[0]);
  controls.autoRotate = false;

  if (shouldPlayIntro) {
    playInitialIntro();
  }
}

// ─── SCROLL PROGRESS LOGIC ────────────────────────────
function updateScrollProgress(progress) {
  const clampedProgress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  window.appState.update({ scrollProgress: clampedProgress });
}

function applyScrollProgress(progress) {
  const clampedProgress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const scrollingForward = clampedProgress >= ctx.previousScrollProgress;

  const stations = window.appState.stations || [];
  const N = stations.length;
  if (N === 0) return;
  if (N === 1) {
    const onlyStation = stations[0];
    const onlyStationCamera = resolveScrollCamera(stations, 0, onlyStation);
    ctx.targetCameraPos.copy(onlyStationCamera.cameraPos);
    ctx.targetCameraTarget.copy(onlyStationCamera.cameraTarget);
    ctx.targetRevealRadius = onlyStation.revealRadius;
    ctx.targetRevealSoftness = onlyStation.revealSoftness;
    if (window.appState.viewMode !== onlyStation.viewMode) {
      window.appState.setViewMode(onlyStation.viewMode);
    }
    if (window.appState.currentStationIndex !== 0) {
      window.appState.update({ currentStationIndex: 0 });
    }
    syncScrollControlsForStation(onlyStation);
    return;
  }

  const normProgress = clampedProgress;
  const totalIntervals = N - 1;
  const scaledProgress = normProgress * totalIntervals;
  const index = Math.min(Math.floor(scaledProgress), N - 2);
  const nextIndex = index + 1;
  const tRaw = THREE.MathUtils.clamp(scaledProgress - index, 0, 1);

  const t = THREE.MathUtils.smoothstep(tRaw, 0, 1);

  const currentStation = stations[index];
  const nextStation = stations[nextIndex];
  const currentCamera = resolveScrollCamera(stations, index, currentStation);
  const nextCamera = resolveScrollCamera(stations, nextIndex, nextStation);
  const transitionConfig = getPortalTransitionConfig(currentStation, nextStation);
  const portalRevealTransition = isPortalRevealTransition(currentStation.viewMode, nextStation.viewMode);
  const scrollDrivenPortalTransition =
    !portalRevealTransition &&
    (currentStation.viewMode === 'portal' || nextStation.viewMode === 'portal');

  const interpolatedCamera = interpolateCameraView(currentCamera, nextCamera, t);
  ctx.targetCameraPos.set(
    interpolatedCamera.cameraPos.x,
    interpolatedCamera.cameraPos.y,
    interpolatedCamera.cameraPos.z
  );
  ctx.targetCameraTarget.set(
    interpolatedCamera.cameraTarget.x,
    interpolatedCamera.cameraTarget.y,
    interpolatedCamera.cameraTarget.z
  );

  if (portalRevealTransition) {
    if (index !== ctx.lastIntervalIndex) {
      cancelPortalTransition();
      ctx.portalTransitionProgress.value = scrollingForward ? 0 : 1;
      ctx.lastIntervalIndex = index;
    }

    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }

    const targetPortalProgress = scrollingForward
      ? (tRaw > 0.02 ? 1 : 0)
      : (tRaw > 0.98 ? 1 : 0);

    startPortalTransition(
      currentStation.viewMode,
      nextStation.viewMode,
      currentStation.revealRadius,
      currentStation.revealSoftness,
      nextStation.revealRadius,
      nextStation.revealSoftness,
      targetPortalProgress,
      transitionConfig
    );

    if (!ctx.activePortalTransition) {
      applyTransitionState(computeTransitionState(
        currentStation.viewMode,
        nextStation.viewMode,
        currentStation.revealRadius,
        currentStation.revealSoftness,
        nextStation.revealRadius,
        nextStation.revealSoftness,
        ctx.portalTransitionProgress.value,
        transitionConfig
      ));
    }

    ctx.previousScrollProgress = clampedProgress;
    updateActiveStationUi(t, currentStation, nextStation, index, nextIndex);
    return;
  }

  cancelPortalTransition();

  if (index !== ctx.lastIntervalIndex) {
    ctx.transitionProgress.value = index > ctx.lastIntervalIndex ? 0.0 : 1.0;
    ctx.lastTargetP = ctx.transitionProgress.value;
    ctx.lastIntervalIndex = index;
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }
  }

  if (scrollDrivenPortalTransition) {
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }
    const portalProgress = nextStation.viewMode === 'portal'
      ? THREE.MathUtils.smoothstep(tRaw, transitionConfig.reconFadeStart, transitionConfig.reconFadeEnd)
      : t;
    ctx.transitionProgress.value = portalProgress;
    ctx.portalTransitionProgress.value = 0;
    ctx.lastTargetP = portalProgress;
  } else {
    let targetP = tRaw < 0.5 ? 0.0 : 1.0;
    let transitionDuration = 1.0;

    if (targetP !== ctx.lastTargetP) {
      ctx.lastTargetP = targetP;
      if (ctx.scrollTransitionTween) {
        ctx.scrollTransitionTween.kill();
      }

      ctx.scrollTransitionTween = gsap.to(ctx.transitionProgress, {
        value: targetP,
        duration: transitionDuration,
        ease: 'power2.out',
        onUpdate: () => {
          applyTransitionState(computeTransitionState(
            currentStation.viewMode,
            nextStation.viewMode,
            currentStation.revealRadius,
            currentStation.revealSoftness,
            nextStation.revealRadius,
            nextStation.revealSoftness,
            ctx.transitionProgress.value,
            transitionConfig
          ));
        }
      });
    }
  }

  if (ctx.activePortalTransition) {
    ctx.previousScrollProgress = clampedProgress;
    updateActiveStationUi(t, currentStation, nextStation, index, nextIndex);
    return;
  }

  const state = computeTransitionState(
    currentStation.viewMode,
    nextStation.viewMode,
    currentStation.revealRadius,
    currentStation.revealSoftness,
    nextStation.revealRadius,
    nextStation.revealSoftness,
    ctx.transitionProgress.value,
    transitionConfig
  );

  applyTransitionState(state);
  ctx.previousScrollProgress = clampedProgress;
  updateActiveStationUi(t, currentStation, nextStation, index, nextIndex);
}

function updateActiveStationUi(t, currentStation, nextStation, index, nextIndex) {
  let activeStation = t < 0.5 ? currentStation : nextStation;
  let activeStationIndex = t < 0.5 ? index : nextIndex;

  if (nextStation.viewMode === 'portal' && currentStation.viewMode !== 'portal') {
    const portalComplete = ctx.transitionProgress.value >= 0.98;
    activeStation = portalComplete ? nextStation : currentStation;
    activeStationIndex = portalComplete ? nextIndex : index;
  } else if (currentStation.viewMode === 'portal' && nextStation.viewMode === 'reveal') {
    const revealStarted = t > 0.001;
    activeStation = revealStarted ? nextStation : currentStation;
    activeStationIndex = revealStarted ? nextIndex : index;
  }

  if (window.appState.viewMode !== activeStation.viewMode) {
    window.appState.update({ viewMode: activeStation.viewMode });
  }

  if (window.appState.currentStationIndex !== activeStationIndex) {
    window.appState.update({
      currentStationIndex: activeStationIndex,
      freeNavigationActive: false,
      freeNavigationStationId: null,
      hasUserManipulatedCamera: false
    });
    updateStationImages(activeStation.images);
    window.audioManager?.playTransition();
  }

  syncScrollControlsForStation(activeStation);
}

// ─── EVENTS ──────────────────────────────────────────
let dragStart = { x: 0, y: 0 };
let dragTime = 0;
let lastPlacementClickTime = 0;

canvas.addEventListener('mousedown', (e) => {
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  dragTime = Date.now();
});

function pickAnnotationPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld(true);
  ctx.raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

  const pickTargets = [ctx.ruinModel, ctx.reconModel, ctx.localModel].filter((model) => model?.visible);
  const hits = pickTargets.length > 0 ? ctx.raycaster.intersectObjects(pickTargets, true) : [];
  const point = hits[0]?.point?.clone();

  if (point) {
    if (hits[0]?.face && hits[0]?.object) {
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hits[0].object.matrixWorld);
      const normal = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
      point.addScaledVector(normal, 0.08);
    }
    return point;
  }

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundPoint = new THREE.Vector3();
  if (ctx.raycaster.ray.intersectPlane(groundPlane, groundPoint)) {
    groundPoint.y += 0.08;
    return groundPoint;
  }

  return ctx.controls.target.clone();
}

function handleAnnotationPlacementClick(event) {
  if (!ctx.pendingAnnotationPlacement) return false;

  const point = pickAnnotationPoint(event);
  const placement = {
    position: { x: point.x, y: point.y, z: point.z },
    cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    cameraTarget: { x: ctx.controls.target.x, y: ctx.controls.target.y, z: ctx.controls.target.z }
  };
  const onPlace = ctx.pendingAnnotationPlacement;
  ctx.pendingAnnotationPlacement = null;
  document.body.classList.remove('annotation-placement-mode');
  onPlace(placement);
  return true;
}

canvas.addEventListener('mouseup', (e) => {
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - dragTime;

  if (ctx.pendingAnnotationPlacement && dist <= 6 && elapsed <= 500) {
    if (handleAnnotationPlacementClick(e)) return;
  }

  if (window.appState.mode !== 'aligning') return;

  if (dist > 6 || elapsed > 300) {
    return;
  }
  handleAlignClick(e);
});

canvas.addEventListener('pointerup', (e) => {
  if (!ctx.pendingAnnotationPlacement) return;
  if (Date.now() - lastPlacementClickTime < 50) return;

  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - dragTime;

  if (dist <= 6 && elapsed <= 500 && handleAnnotationPlacementClick(e)) {
    lastPlacementClickTime = Date.now();
  }
});

function handleMove(clientX, clientY) {
  ctx.hasMouseMoved = true;
  if (window.appState?.mode !== 'reveal') return;
  const vm = window.appState?.viewMode;
  if (vm !== 'reveal' && !ctx.activePortalTransition && !ctx.targetRevealActive) return;

  const rect = canvas.getBoundingClientRect();
  const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((clientY - rect.top) / rect.height) * 2 + 1;
  ctx.mouseTarget.set(mx, my);
  ctx.isMouseOutside = false;
}

window.addEventListener('pointermove', (e) => handleMove(e.clientX, e.clientY));

document.addEventListener('pointerleave', () => {
  ctx.isMouseOutside = true;
});
document.addEventListener('mouseleave', () => {
  ctx.isMouseOutside = true;
});

// ─── RESIZE ──────────────────────────────────────────
const resizeRendererToCanvas = () => {
  const width = Math.max(1, canvas.clientWidth || window.innerWidth);
  const height = Math.max(1, canvas.clientHeight || window.innerHeight);
  camera.aspect = width / height;
  window.appState?.setCameraFov?.(window.appState.cameraFov);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.getDrawingBufferSize(ctx.revealUniforms.uViewportSize.value);
};

window.addEventListener('resize', resizeRendererToCanvas);
new ResizeObserver(resizeRendererToCanvas).observe(canvas);

// ─── START ───────────────────────────────────────────
const isExperienceRoute = /^\/(?:stories\/(?!new(?:\/|$))|studio\/)[A-Za-z0-9_-]+/.test(window.location.pathname)
  || window.location.pathname === '/edits';
if (isExperienceRoute) {
  init();
  animate();
} else {
  clearInterval(loadingProgressTimer);
  loadingComplete = true;
  if (loadingScreen) loadingScreen.style.display = 'none';
  window.appState.update({ mode: 'platform' });
}

let experienceDisposed = false;
window.addEventListener('pagehide', () => {
  if (!isExperienceRoute || experienceDisposed) return;
  experienceDisposed = true;
  disposeExperience();
}, { once: true });
window.addEventListener('pageshow', (event) => {
  if (event.persisted && experienceDisposed) window.location.reload();
});

// ─── HMR RELOAD FOR THREE.JS ─────────────────────────
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
