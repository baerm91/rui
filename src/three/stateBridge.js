import * as THREE from 'three';
import gsap from 'gsap';
import { ctx } from './context.js';
import { saveAlignment, matrixToAlignment, alignmentToMatrix, clearAlignment } from '../alignment.js';
import { saveDraftStations } from '../stations.js';
import { configureReconstructionDepth } from './portalTransition.js';
import { loadLocalModelFiles, removeLocalModel } from './localModel.js';
import { siteConfig } from '../site.config.js';
import { DEFAULT_PROJECT_LIGHTING } from '../constants.js';
import { deleteProjectModelFiles, saveProjectModelFiles } from '../projects/projectModelStore.js';
import { resolveStationCamera } from './stationCamera.js';
import { resolveCanvasTouchAction, resolveFreeNavigationMaxDistance } from './freeOrbit.js';
import { resolveAnnotationFocusView } from './annotationCamera.js';
import { horizontalFovToVertical, normalizeProjectCameraFov } from '../projects/projectSettings.js';
import { resolveCameraTransitionDuration } from '../utils/cameraTransition.js';
import { createInterpretationViewOverride } from '../utils/interpretationComparison.js';

const getVisibleAnnotationModels = () => [ctx.localModel, ctx.ruinModel, ctx.reconModel]
  .filter((model) => model?.visible);

// Synchronously initialize window.appState to avoid race conditions with animation loop
window.appState = {
  mode: 'loading',
  alignStep: 0,
  alignTarget: 'ruin',
  viewMode: 'reveal',
  revealRadius: 0.26,
  revealSoftness: 0.05,
  lensZoom: 1.0,
  cameraFov: 75,
  lightIntensity: 1.0,
  shadowDiffuse: 1.0,
  stationMode: 'scroll',
  stations: [],
  annotations: [],
  projectConfig: null,
  alignment: null,
  currentStationIndex: 0,
  scrollProgress: 0,
  scrollSpeed: 1,
  hasUserManipulatedCamera: false,
  freeNavigationActive: false,
  freeNavigationStationId: null,
  projectOrbitTarget: { x: 0, y: 0, z: 0 },
  freeNavigationOrbitPivot: { x: 0, y: 0, z: 0 },
  introPhase: 'idle',
  hasIntroPlayed: false,
  localModelName: '',
  localModelStatus: 'idle',
  localModelError: '',
  localModelEnvironmentRemoved: [],
  localModelMaterialsConverted: 0,
  localModelProjectId: '',
  baseModelStatus: 'loading',
  baseModelError: '',
  activeProjectId: '',
  showBaseModels: true,
  firstPersonActive: false,
  interpretationViewOverride: null,

  realign: null,
  resetAlignment: null,
  skipAlignment: null,
  setViewMode: null,
  setInterpretationViewMode: null,
  captureModelRenderState: null,
  setRevealRadius: null,
  setRevealSoftness: null,
  setLensZoom: null,
  setCameraFov: null,
  setStationMode: null,
  resetFreeView: null,
  setProjectOrbitTarget: null,
  snapToStation: null,
  updateScrollProgress: null,
  saveStations: null,
  getAlignment: null,
  saveAlignmentConfig: null,
  setLightIntensity: null,
  setShadowDiffuse: null,
  updateActiveStationImages: null,
  setLightHemiEnabled: null,
  setLightKeyEnabled: null,
  setLightFillEnabled: null,
  setLightSpotEnabled: null,
  setLightKeyPos: null,
  setLightFillPos: null,
  setLightSpotPos: null,
  setLightKeyFixedToCamera: null,
  setLightFillFixedToCamera: null,
  setLightSpotFixedToCamera: null,
  convertPositionBetweenSpaces: null,
  loadLocalModelFiles: null,
  removeLocalModel: null,
  setBaseModelsVisible: null,
  captureAnnotationContext: null,
  startAnnotationPlacement: null,
  cancelAnnotationPlacement: null,
  pickAnnotationPlacementAt: null,
  beginAnnotationDrag: null,
  pickAnnotationDragAt: null,
  endAnnotationDrag: null,
  projectWorldPoint: null,
  projectAnnotationGuide: null,
  focusAnnotation: null,
  setFreeNavigationMaxDistance: null,
  smoothFreeNavigationZoom: null,
  onStateChange: null,

  update(fields) {
    Object.assign(this, fields);
    if (this.onStateChange) this.onStateChange({ ...this });
  }
};

export function setupStateBridge() {
  window.appState.captureModelRenderState = () => ({
    ruinVisible: Boolean(ctx.ruinModel?.visible),
    reconstructionVisible: Boolean(ctx.reconModel?.visible),
    ruinOpacity: ctx.revealUniforms.uOpacityRuin.value,
    reconstructionOpacity: ctx.revealUniforms.uOpacityRecon.value,
    targetRuinOpacity: ctx.targetOpacityRuin,
    targetReconstructionOpacity: ctx.targetOpacityRecon,
    revealActive: ctx.targetRevealActive
  });
  let annotationDragPlane = null;
  let annotationDragMode = 'plane';
  let annotationHeightDragStartY = 0;
  let annotationHeightPointerStartY = 0;
  let annotationHeightUnitsPerPixel = 0.01;
  const annotationDragOrigin = new THREE.Vector3();
  const annotationDragOffset = new THREE.Vector3();
  const annotationGuideRaycaster = new THREE.Raycaster();
  const annotationGuideAnchors = new Map();

  const setRayFromClientPoint = (clientX, clientY) => {
    if (!ctx.canvas || !ctx.camera) return false;
    const rect = ctx.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((clientY - rect.top) / rect.height) * 2 + 1;
    ctx.camera.updateMatrixWorld(true);
    ctx.raycaster.setFromCamera(new THREE.Vector2(mx, my), ctx.camera);
    return true;
  };

  const annotationPlacementFromPoint = (point) => ({
    position: { x: point.x, y: point.y, z: point.z },
    cameraPos: { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z },
    cameraTarget: { x: ctx.controls.target.x, y: ctx.controls.target.y, z: ctx.controls.target.z }
  });

  window.appState.loadLocalModelFiles = async (files, options = {}) => {
    const projectId = options.projectId || window.appState.activeProjectId;
    window.appState.update({ localModelStatus: 'loading', localModelError: '' });
    try {
      await loadLocalModelFiles(files);
      if (options.persist !== false) await saveProjectModelFiles(projectId, files);
      window.appState.update({ localModelProjectId: projectId });
      window.appState.setBaseModelsVisible(false);
    } catch (error) {
      window.appState.update({ localModelStatus: 'error', localModelError: error.message });
      throw error;
    }
  };

  window.appState.removeLocalModel = (options = {}) => {
    const projectId = options.projectId || window.appState.activeProjectId;
    removeLocalModel();
    if (options.deleteStored !== false) {
      deleteProjectModelFiles(projectId).catch((error) => {
        window.appState.update({ localModelError: `Das gespeicherte Modell konnte nicht entfernt werden: ${error.message}` });
      });
      window.appState.update({ localModelProjectId: projectId });
    } else {
      window.appState.update({ localModelProjectId: '' });
    }
    const shouldShowBundledModels = window.appState.activeProjectId === window.appState.projectConfig?.id;
    window.appState.setBaseModelsVisible(shouldShowBundledModels);
    if (shouldShowBundledModels) window.appState.setViewMode(window.appState.viewMode);
  };
  window.appState.setBaseModelsVisible = (visible) => {
    if (ctx.ruinModel) ctx.ruinModel.visible = !!visible;
    if (ctx.reconModel) ctx.reconModel.visible = !!visible;
    window.appState.update({ showBaseModels: !!visible });
  };
  window.appState.realign = () => {
    // We clear alignment and reload
    clearAlignment();
    location.reload();
  };

  window.appState.resetAlignment = () => {
    ctx.alignPoints.ruin = [];
    ctx.alignPoints.recon = [];
    ctx.alignPoints.ruinWorld = [];
    ctx.alignPoints.reconWorld = [];
    ctx.actions.clearMarkers();
    ctx.actions.clearLines();
    ctx.isModelAligned = false;

    // Position both models back to center and reset visibility
    ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
    ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);
    ctx.ruinModel.visible = true;
    ctx.reconModel.visible = false;

    window.appState.update({
      alignStep: 0,
      alignTarget: 'ruin'
    });
  };

  window.appState.skipAlignment = () => {
    ctx.actions.clearMarkers();
    ctx.actions.clearLines();
    ctx.isModelAligned = false;
    ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
    ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);
    ctx.actions.enterRevealMode();
  };

  window.appState.setViewMode = (mode) => {
    window.appState.update({ viewMode: mode });
    const allowBaseModels = window.appState.showBaseModels !== false;
    let opRuin = 1.0;
    let opRecon = 0.0;
    let portalTint = 0.0;
    let revActive = false;
    let shAlways = false;
    let followsMouse = false;
    let mouseBlend = 0;

    if (mode === 'ruin') {
      if (ctx.ruinModel) ctx.ruinModel.visible = allowBaseModels;
      if (ctx.reconModel) ctx.reconModel.visible = false;
      configureReconstructionDepth(true);
      opRuin = 1.0;
      opRecon = 0.0;
      revActive = false;
      shAlways = false;
      ctx.revealUniforms.uRevealHasHit.value = false;
    } else if (mode === 'recon') {
      if (ctx.ruinModel) ctx.ruinModel.visible = false;
      if (ctx.reconModel) ctx.reconModel.visible = allowBaseModels;
      configureReconstructionDepth(true);
      opRuin = 0.0;
      opRecon = 1.0;
      portalTint = 0.0;
      revActive = false;
      shAlways = true;
      ctx.revealUniforms.uRevealHasHit.value = false;
    } else if (mode === 'portal') {
      if (ctx.ruinModel) ctx.ruinModel.visible = allowBaseModels;
      if (ctx.reconModel) ctx.reconModel.visible = allowBaseModels;
      configureReconstructionDepth(false);
      opRuin = 0.0;
      opRecon = 1.0;
      portalTint = 1.0;
      revActive = false;
      shAlways = true;
      followsMouse = false;
      ctx.revealUniforms.uMouseNDC.value.set(0, 0);
      ctx.revealUniforms.uRevealHasHit.value = false;
    } else {
      if (ctx.ruinModel) ctx.ruinModel.visible = allowBaseModels;
      if (ctx.reconModel) ctx.reconModel.visible = allowBaseModels;
      configureReconstructionDepth(false);
      opRuin = 1.0;
      opRecon = 1.0;
      portalTint = 1.0;
      revActive = true;
      shAlways = false;
      followsMouse = true;
      mouseBlend = 1;
    }

    ctx.targetOpacityRuin = opRuin;
    ctx.targetOpacityRecon = opRecon;
    ctx.targetPortalTint = portalTint;
    ctx.targetRevealActive = revActive;
    ctx.targetShowAlways = shAlways;
    ctx.targetRevealFollowsMouse = followsMouse;
    ctx.targetRevealMouseBlend = mouseBlend;

    ctx.revealUniforms.uOpacityRuin.value = opRuin;
    ctx.revealUniforms.uOpacityRecon.value = opRecon;
    ctx.revealUniforms.uPortalTint.value = portalTint;
    ctx.revealUniforms.uRevealActive.value = revActive;
    ctx.revealUniforms.uShowAlways.value = shAlways;
  };

  window.appState.setInterpretationViewMode = (stationId, mode) => {
    const station = window.appState.stations?.find((candidate) => candidate?.id === stationId);
    const override = createInterpretationViewOverride(station, mode);
    if (!override) return false;
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }
    window.appState.update({ interpretationViewOverride: override });
    window.appState.setViewMode(mode);
    ctx.actions.applyScrollProgress?.(window.appState.scrollProgress);
    return true;
  };

  window.appState.setRevealRadius = (r) => {
    ctx.revealUniforms.uRevealRadius.value = r;
    ctx.targetRevealRadius = r;
    window.appState.update({ revealRadius: r });
  };

  window.appState.setRevealSoftness = (s) => {
    ctx.revealUniforms.uRevealSoftness.value = s;
    ctx.targetRevealSoftness = s;
    window.appState.update({ revealSoftness: s });
  };

  window.appState.setLensZoom = (z) => {
    ctx.revealUniforms.uLensZoom.value = z;
    window.appState.update({ lensZoom: z });
  };

  window.appState.setCameraFov = (value) => {
    const cameraFov = normalizeProjectCameraFov(value);
    if (ctx.camera) {
      ctx.camera.fov = horizontalFovToVertical(cameraFov, ctx.camera.aspect);
      ctx.camera.updateProjectionMatrix();
    }
    window.appState.update({ cameraFov });
  };

  window.appState.setLightIntensity = (val) => {
    ctx.targetLightIntensity = val;
    window.appState.update({ lightIntensity: val });
  };

  window.appState.setShadowDiffuse = (val) => {
    ctx.targetShadowDiffuse = val;
    window.appState.update({ shadowDiffuse: val });
  };

  window.appState.updateActiveStationImages = (images) => {
    ctx.actions.updateStationImages(images);
  };

  window.appState.setLightHemiEnabled = (val) => {
    ctx.targetHemiEnabled = val ? 1.0 : 0.0;
    ctx.currentHemiEnabled = ctx.targetHemiEnabled;
  };

  window.appState.setLightKeyEnabled = (val) => {
    ctx.targetKeyEnabled = val ? 1.0 : 0.0;
    ctx.currentKeyEnabled = ctx.targetKeyEnabled;
  };

  window.appState.setLightFillEnabled = (val) => {
    ctx.targetFillEnabled = val ? 1.0 : 0.0;
    ctx.currentFillEnabled = ctx.targetFillEnabled;
  };

  window.appState.setLightSpotEnabled = (val) => {
    ctx.targetSpotEnabled = val ? 1.0 : 0.0;
    ctx.currentSpotEnabled = ctx.targetSpotEnabled;
  };

  window.appState.setLightKeyPos = (pos) => {
    ctx.targetKeyPos.set(pos?.x ?? 8, pos?.y ?? 16, pos?.z ?? 10);
    ctx.currentKeyPos.copy(ctx.targetKeyPos);
  };

  window.appState.setLightFillPos = (pos) => {
    ctx.targetFillPos.set(pos?.x ?? -8, pos?.y ?? 12, pos?.z ?? -10);
    ctx.currentFillPos.copy(ctx.targetFillPos);
  };

  window.appState.setLightSpotPos = (pos) => {
    ctx.targetSpotPos.set(pos?.x ?? 0, pos?.y ?? 15, pos?.z ?? 0);
    ctx.currentSpotPos.copy(ctx.targetSpotPos);
  };

  window.appState.setLightKeyFixedToCamera = (val) => {
    ctx.targetKeyFixedToCamera = !!val;
    ctx.currentKeyFixedToCamera = ctx.targetKeyFixedToCamera;
  };

  window.appState.setLightFillFixedToCamera = (val) => {
    ctx.targetFillFixedToCamera = !!val;
    ctx.currentFillFixedToCamera = ctx.targetFillFixedToCamera;
  };

  window.appState.setLightSpotFixedToCamera = (val) => {
    ctx.targetSpotFixedToCamera = !!val;
    ctx.currentSpotFixedToCamera = ctx.targetSpotFixedToCamera;
  };

  window.appState.applyProjectLighting = (lighting = DEFAULT_PROJECT_LIGHTING) => {
    window.appState.setLightIntensity(lighting.lightIntensity ?? 1);
    window.appState.setShadowDiffuse(lighting.shadowDiffuse ?? 1);
    window.appState.setLightHemiEnabled(lighting.lightHemiEnabled ?? true);
    window.appState.setLightKeyEnabled(lighting.lightKeyEnabled ?? true);
    window.appState.setLightFillEnabled(lighting.lightFillEnabled ?? true);
    window.appState.setLightSpotEnabled(lighting.lightSpotEnabled ?? true);
    window.appState.setLightKeyFixedToCamera(!!lighting.lightKeyFixedToCamera);
    window.appState.setLightFillFixedToCamera(!!lighting.lightFillFixedToCamera);
    window.appState.setLightSpotFixedToCamera(!!lighting.lightSpotFixedToCamera);
    window.appState.setLightKeyPos(lighting.lightKeyPos ?? DEFAULT_PROJECT_LIGHTING.lightKeyPos);
    window.appState.setLightFillPos(lighting.lightFillPos ?? DEFAULT_PROJECT_LIGHTING.lightFillPos);
    window.appState.setLightSpotPos(lighting.lightSpotPos ?? DEFAULT_PROJECT_LIGHTING.lightSpotPos);
    window.appState.update({ projectLighting: lighting });
  };

  window.appState.convertPositionBetweenSpaces = (pos, toCameraSpace) => {
    const vec = new THREE.Vector3(pos.x, pos.y, pos.z);
    if (toCameraSpace) {
      ctx.camera.updateMatrixWorld();
      const viewMatrix = new THREE.Matrix4().copy(ctx.camera.matrixWorld).invert();
      vec.applyMatrix4(viewMatrix);
    } else {
      ctx.camera.updateMatrixWorld();
      vec.applyMatrix4(ctx.camera.matrixWorld);
    }
    return { x: vec.x, y: vec.y, z: vec.z };
  };

  window.appState.setStationMode = (mode) => {
    const previousMode = window.appState.stationMode;
    if (mode !== 'editor' && document.pointerLockElement) document.exitPointerLock?.();

    if (mode === 'scroll' && previousMode !== 'scroll') {
      const progress = THREE.MathUtils.clamp(window.appState.scrollProgress || 0, 0, 1);
      ctx.actions.cancelPortalTransition?.();
      if (ctx.scrollTransitionTween) {
        ctx.scrollTransitionTween.kill();
        ctx.scrollTransitionTween = null;
      }
      if (ctx.flyToTransitionTween) {
        ctx.flyToTransitionTween.kill();
        ctx.flyToTransitionTween = null;
      }
      ctx.visualScrollProgress = progress;
      ctx.previousScrollProgress = progress;
      ctx.lastIntervalIndex = 0;
      ctx.lastTargetP = 0;
      ctx.transitionProgress.value = 0;
      ctx.portalTransitionProgress.value = 0;
    }

    window.appState.update({
      stationMode: mode,
      ...(mode === 'scroll' && previousMode !== 'scroll'
        ? {
            freeNavigationActive: false,
            freeNavigationStationId: null,
            hasUserManipulatedCamera: false
          }
        : {})
    });
    ctx.canvas.style.touchAction = resolveCanvasTouchAction(mode);
    if (ctx.localModel) {
      const usesLocalProjectModel = window.appState.activeProjectId !== siteConfig.id;
      ctx.localModel.visible = mode === 'editor' || (mode === 'scroll' && usesLocalProjectModel);
    }
    if (mode === 'editor') {
      ctx.controls.enabled = true;
      ctx.controls.enableZoom = true;
      ctx.controls.enablePan = true;
      ctx.controls.enableRotate = true;
      ctx.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      ctx.controls.panSpeed = -1;
      ctx.controls.autoRotate = false;
    } else {
      ctx.controls.enableZoom = false;
      ctx.actions.updateScrollProgress(window.appState.scrollProgress);
    }
  };

  window.appState.resetFreeView = () => {
    const stationIndex = window.appState.currentStationIndex;
    const station = window.appState.stations?.[stationIndex];
    if (!station?.id
      || !window.appState.freeNavigationActive
      || window.appState.freeNavigationStationId !== station.id) return Promise.resolve();

    const stationCamera = resolveStationCamera(window.appState.stations, stationIndex, station);
    const cameraPosition = new THREE.Vector3(
      stationCamera.cameraPos.x,
      stationCamera.cameraPos.y,
      stationCamera.cameraPos.z
    );
    const cameraTarget = new THREE.Vector3(
      stationCamera.cameraTarget.x,
      stationCamera.cameraTarget.y,
      stationCamera.cameraTarget.z
    );

    ctx.freeNavigationZoomTargetDistance = null;
    window.appState.setFreeNavigationMaxDistance?.(
      station.freeNavigationMaxDistance,
      cameraPosition.distanceTo(cameraTarget)
    );

    gsap.killTweensOf(ctx.camera.position);
    gsap.killTweensOf(ctx.controls.target);
    if (ctx.flyToTransitionTween) ctx.flyToTransitionTween.kill();

    const cameraTravel = ctx.camera.position.distanceTo(cameraPosition);
    const targetTravel = ctx.controls.target.distanceTo(cameraTarget);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const resetDuration = resolveCameraTransitionDuration({
      distance: Math.max(cameraTravel, targetTravel),
      base: 0.85,
      multiplier: 0.045,
      minimum: 0.85,
      maximum: 1.6,
      reducedMotion: reduceMotion
    });

    window.appState.update({
      hasUserManipulatedCamera: false,
      freeNavigationOrbitPivot: { ...window.appState.projectOrbitTarget }
    });
    return new Promise((resolve) => {
      const timeline = gsap.timeline({
        defaults: { duration: resetDuration, ease: 'sine.inOut' },
        onUpdate: () => ctx.controls.update(),
        onInterrupt: () => {
          if (ctx.flyToTransitionTween === timeline) ctx.flyToTransitionTween = null;
          resolve();
        },
        onComplete: () => {
          ctx.camera.position.copy(cameraPosition);
          ctx.controls.target.copy(cameraTarget);
          // The scan contains a surface exactly at the captured station pose.
          // A microscopic final movement keeps the camera on the visible side
          // and forces OrbitControls to publish the completed view.
          ctx.camera.position.z += 0.0001;
          ctx.targetCameraPos.copy(ctx.camera.position);
          ctx.targetCameraTarget.copy(cameraTarget);
          ctx.controls.update();
          if (ctx.flyToTransitionTween === timeline) ctx.flyToTransitionTween = null;
          resolve();
        }
      });
      ctx.flyToTransitionTween = timeline;
      timeline.to(ctx.camera.position, {
        x: cameraPosition.x,
        y: cameraPosition.y,
        z: cameraPosition.z
      }, 0);
      timeline.to(ctx.controls.target, {
        x: cameraTarget.x,
        y: cameraTarget.y,
        z: cameraTarget.z
      }, 0);
    });
  };

  window.appState.setFreeNavigationMaxDistance = (value, requiredDistance = 0) => {
    ctx.controls.maxDistance = resolveFreeNavigationMaxDistance(
      value,
      ctx.controls.minDistance,
      Math.max(
        ctx.camera.position.distanceTo(ctx.controls.target),
        Number.isFinite(requiredDistance) ? requiredDistance : 0
      )
    );
  };

  window.appState.smoothFreeNavigationZoom = (deltaY, deltaMode = 0) => {
    const station = window.appState.stations?.[window.appState.currentStationIndex];
    const isActive = window.appState.stationMode === 'scroll'
      && !!station?.id
      && window.appState.freeNavigationActive
      && window.appState.freeNavigationStationId === station.id;
    if (!isActive || !Number.isFinite(deltaY) || deltaY === 0) return;

    const deltaScale = deltaMode === 1 ? 16 : deltaMode === 2 ? window.innerHeight : 1;
    const normalizedDelta = THREE.MathUtils.clamp(deltaY * deltaScale, -480, 480);
    const currentDistance = ctx.camera.position.distanceTo(ctx.controls.target);
    const baseDistance = Number.isFinite(ctx.freeNavigationZoomTargetDistance)
      ? ctx.freeNavigationZoomTargetDistance
      : currentDistance;
    const zoomFactor = Math.exp(normalizedDelta * 0.00055);
    ctx.freeNavigationZoomTargetDistance = THREE.MathUtils.clamp(
      baseDistance * zoomFactor,
      ctx.controls.minDistance,
      ctx.controls.maxDistance
    );
    window.appState.update({ hasUserManipulatedCamera: true });
  };

  window.appState.snapToStation = (station, stationIndex = null) => {
    if (!station || !ctx.camera || !ctx.controls) return;
    const resolvedIndex = Number.isInteger(stationIndex)
      ? stationIndex
      : window.appState.stations.findIndex((candidate) => candidate?.id === station.id);
    const stationCamera = resolveStationCamera(window.appState.stations, resolvedIndex, station);
    ctx.freeNavigationZoomTargetDistance = null;

    if (ctx.flyToTransitionTween) {
      ctx.flyToTransitionTween.kill();
      ctx.flyToTransitionTween = null;
    }
    gsap.killTweensOf(ctx.camera.position);
    gsap.killTweensOf(ctx.controls.target);
    ctx.camera.position.set(stationCamera.cameraPos.x, stationCamera.cameraPos.y, stationCamera.cameraPos.z);
    ctx.controls.target.set(stationCamera.cameraTarget.x, stationCamera.cameraTarget.y, stationCamera.cameraTarget.z);
    if (station.freeNavigation) {
      window.appState.setFreeNavigationMaxDistance?.(station.freeNavigationMaxDistance);
    }
    ctx.targetCameraPos.copy(ctx.camera.position);
    ctx.targetCameraTarget.copy(ctx.controls.target);
    ctx.controls.update();
    window.appState.update({
      currentStationIndex: Math.max(0, resolvedIndex),
      hasUserManipulatedCamera: false
    });
  };

  window.appState.updateScrollProgress = (progress) => {
    ctx.actions.updateScrollProgress(progress);
  };

  window.appState.saveStations = (newStations) => {
    saveDraftStations(
      newStations,
      window.appState.activeProjectId || window.appState.projectConfig?.id || ''
    );
    window.appState.update({ stations: newStations });
    ctx.actions.updateScrollProgress(window.appState.scrollProgress);
  };

  window.appState.getAlignment = () => window.appState.alignment;

  window.appState.saveAlignmentConfig = (alignment) => {
    const matrix = alignmentToMatrix(alignment);
    if (!matrix) return;

    saveAlignment(matrix);
    window.appState.update({ alignment: matrixToAlignment(matrix) });
  };

  window.appState.captureCamera = () => {
    return {
      cameraPos: { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z },
      cameraTarget: { x: ctx.controls.target.x, y: ctx.controls.target.y, z: ctx.controls.target.z }
    };
  };

  window.appState.setProjectOrbitTarget = (position) => {
    if (!position || !ctx.controls || !ctx.camera) return;
    const target = new THREE.Vector3(position.x, position.y, position.z);
    if (![target.x, target.y, target.z].every(Number.isFinite)) return;

    window.appState.update({
      projectOrbitTarget: { x: target.x, y: target.y, z: target.z }
    });
  };

  window.appState.captureAnnotationContext = () => {
    const cameraData = window.appState.captureCamera();
    ctx.camera.updateMatrixWorld(true);
    ctx.raycaster.setFromCamera(new THREE.Vector2(0, 0), ctx.camera);
    const hitObjects = getVisibleAnnotationModels();
    const hits = ctx.raycaster.intersectObjects(hitObjects, true);
    const point = hits[0]?.point ?? ctx.controls.target;

    return {
      ...cameraData,
      position: { x: point.x, y: point.y, z: point.z }
    };
  };

  window.appState.startAnnotationPlacement = (onPlace) => {
    ctx.pendingAnnotationPlacement = typeof onPlace === 'function' ? onPlace : null;
    document.body.classList.toggle('annotation-placement-mode', !!ctx.pendingAnnotationPlacement);
  };

  window.appState.cancelAnnotationPlacement = () => {
    ctx.pendingAnnotationPlacement = null;
    document.body.classList.remove('annotation-placement-mode');
  };

  window.appState.pickAnnotationPlacementAt = (clientX, clientY) => {
    if (!ctx.canvas || !ctx.camera) return null;
    if (!setRayFromClientPoint(clientX, clientY)) return null;
    const pickTargets = getVisibleAnnotationModels();
    const hits = pickTargets.length > 0 ? ctx.raycaster.intersectObjects(pickTargets, true) : [];
    let point = hits[0]?.point?.clone();

    if (point && hits[0]?.face && hits[0]?.object) {
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hits[0].object.matrixWorld);
      const normal = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
      point.addScaledVector(normal, 0.08);
    }

    if (!point) {
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const groundPoint = new THREE.Vector3();
      if (ctx.raycaster.ray.intersectPlane(groundPlane, groundPoint)) {
        point = groundPoint;
        point.y += 0.08;
      }
    }

    if (!point) point = ctx.controls.target.clone();

    return annotationPlacementFromPoint(point);
  };

  window.appState.beginAnnotationDrag = (position, clientX, clientY, options = {}) => {
    if (!position || !setRayFromClientPoint(clientX, clientY)) return false;

    const origin = new THREE.Vector3(position.x, position.y, position.z);
    annotationDragOrigin.copy(origin);
    annotationDragMode = options.heightOnly ? 'height' : 'plane';

    if (annotationDragMode === 'height') {
      const rect = ctx.canvas.getBoundingClientRect();
      const distance = Math.max(0.1, ctx.camera.position.distanceTo(origin));
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov * 0.5)) * distance;
      annotationHeightUnitsPerPixel = visibleHeight / Math.max(1, rect.height);
      annotationHeightDragStartY = origin.y;
      annotationHeightPointerStartY = clientY;
      annotationDragPlane = null;
      annotationDragOffset.set(0, 0, 0);
      document.body.classList.add('annotation-dragging-mode', 'annotation-height-dragging-mode');
      return true;
    }

    const planeNormal = ctx.camera.getWorldDirection(new THREE.Vector3()).normalize();
    annotationDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, origin);

    const pointerPoint = new THREE.Vector3();
    if (ctx.raycaster.ray.intersectPlane(annotationDragPlane, pointerPoint)) {
      annotationDragOffset.copy(origin).sub(pointerPoint);
    } else {
      annotationDragOffset.set(0, 0, 0);
    }

    document.body.classList.add('annotation-dragging-mode');
    return true;
  };

  window.appState.pickAnnotationDragAt = (clientX, clientY) => {
    if (annotationDragMode === 'height') {
      const point = annotationDragOrigin.clone();
      point.y = annotationHeightDragStartY
        + (annotationHeightPointerStartY - clientY) * annotationHeightUnitsPerPixel;
      return annotationPlacementFromPoint(point);
    }

    if (!annotationDragPlane || !setRayFromClientPoint(clientX, clientY)) return null;
    const point = new THREE.Vector3();
    if (!ctx.raycaster.ray.intersectPlane(annotationDragPlane, point)) return null;
    point.add(annotationDragOffset);
    return annotationPlacementFromPoint(point);
  };

  window.appState.endAnnotationDrag = () => {
    annotationDragPlane = null;
    annotationDragMode = 'plane';
    annotationDragOrigin.set(0, 0, 0);
    annotationDragOffset.set(0, 0, 0);
    document.body.classList.remove('annotation-dragging-mode', 'annotation-height-dragging-mode');
  };

  window.appState.projectWorldPoint = (point) => {
    if (!point || !ctx.camera || !ctx.renderer) return null;
    const canvasRect = ctx.renderer.domElement.getBoundingClientRect();
    const width = canvasRect.width || ctx.renderer.domElement.clientWidth || window.innerWidth;
    const height = canvasRect.height || ctx.renderer.domElement.clientHeight || window.innerHeight;
    ctx.camera.updateMatrixWorld(true);
    const vector = new THREE.Vector3(point.x, point.y, point.z);
    vector.project(ctx.camera);

    const insideView = vector.z >= -1 && vector.z <= 1
      && vector.x >= -1 && vector.x <= 1
      && vector.y >= -1 && vector.y <= 1;
    if (!insideView) return null;

    return {
      x: canvasRect.left + (vector.x * 0.5 + 0.5) * width,
      y: canvasRect.top + (-vector.y * 0.5 + 0.5) * height,
      visible: true
    };
  };

  window.appState.projectAnnotationGuide = (annotationId, point) => {
    if (!point || !ctx.camera || !ctx.renderer) return null;
    const canvasRect = ctx.renderer.domElement.getBoundingClientRect();
    const width = canvasRect.width || ctx.renderer.domElement.clientWidth || window.innerWidth;
    const height = canvasRect.height || ctx.renderer.domElement.clientHeight || window.innerHeight;
    ctx.camera.updateMatrixWorld(true);

    const projectPoint = (worldPoint) => {
      const projected = worldPoint.clone().project(ctx.camera);
      if (projected.z < -1 || projected.z > 1) return null;
      return {
        x: canvasRect.left + (projected.x * 0.5 + 0.5) * width,
        y: canvasRect.top + (-projected.y * 0.5 + 0.5) * height
      };
    };

    const markerWorld = new THREE.Vector3(point.x, point.y, point.z);
    const cacheKey = `${window.appState.activeProjectId || 'project'}:${annotationId || 'annotation'}`;
    let cachedAnchor = annotationGuideAnchors.get(cacheKey);
    const footprintChanged = !cachedAnchor
      || Math.abs(cachedAnchor.x - markerWorld.x) > 0.0001
      || Math.abs(cachedAnchor.z - markerWorld.z) > 0.0001
      || !cachedAnchor.object?.parent;

    if (footprintChanged) {
      const guideOrigin = markerWorld.clone().add(new THREE.Vector3(0, 0.08, 0));
      annotationGuideRaycaster.set(guideOrigin, new THREE.Vector3(0, -1, 0));
      const modelHits = annotationGuideRaycaster.intersectObjects(getVisibleAnnotationModels(), true);
      const surfaceHit = modelHits.find((hit) => hit.point.y <= markerWorld.y + 0.01);
      if (!surfaceHit?.object) {
        annotationGuideAnchors.delete(cacheKey);
        return null;
      }

      surfaceHit.object.updateWorldMatrix(true, false);
      cachedAnchor = {
        x: markerWorld.x,
        z: markerWorld.z,
        object: surfaceHit.object,
        localPoint: surfaceHit.object.worldToLocal(surfaceHit.point.clone())
      };
      annotationGuideAnchors.set(cacheKey, cachedAnchor);
    }

    cachedAnchor.object.updateWorldMatrix(true, false);
    const anchorWorld = cachedAnchor.localPoint.clone().applyMatrix4(cachedAnchor.object.matrixWorld);

    const marker = projectPoint(markerWorld);
    const anchor = projectPoint(anchorWorld);
    if (!marker || !anchor) return null;

    return {
      marker,
      anchor: {
        x: THREE.MathUtils.clamp(anchor.x, canvasRect.left + 5, canvasRect.right - 5),
        y: THREE.MathUtils.clamp(anchor.y, canvasRect.top + 5, canvasRect.bottom - 5)
      }
    };
  };

  window.appState.flyToStation = (station, stationIndex = null) => {
    gsap.killTweensOf(ctx.camera.position);
    gsap.killTweensOf(ctx.controls.target);
    if (ctx.flyToTransitionTween) {
      ctx.flyToTransitionTween.kill();
      ctx.flyToTransitionTween = null;
    }
    const currentStation = window.appState.stations[window.appState.currentStationIndex] || station;
    const transitionConfig = ctx.actions.getPortalTransitionConfig(currentStation, station);
    const isPortalRevealFlyTo = ctx.actions.isPortalRevealTransition(currentStation.viewMode, station.viewMode);
    const flyDuration = isPortalRevealFlyTo ? transitionConfig.duration : 1.2;
    const flyEase = isPortalRevealFlyTo ? 'none' : 'power3.out';
    const stationCamera = resolveStationCamera(window.appState.stations, stationIndex, station);

    ctx.actions.updateStationImages(station.images);
    
    gsap.to(ctx.camera.position, {
      x: stationCamera.cameraPos.x,
      y: stationCamera.cameraPos.y,
      z: stationCamera.cameraPos.z,
      duration: flyDuration,
      ease: flyEase
    });
    
    gsap.to(ctx.controls.target, {
      x: stationCamera.cameraTarget.x,
      y: stationCamera.cameraTarget.y,
      z: stationCamera.cameraTarget.z,
      duration: flyDuration,
      ease: flyEase,
      onUpdate: () => {
        ctx.controls.update();
      }
    });

    const transitionObj = { progress: 0 };
    if (isPortalRevealFlyTo) {
      ctx.actions.applyTransitionState(ctx.actions.computeTransitionState(
        currentStation.viewMode,
        station.viewMode,
        currentStation.revealRadius,
        currentStation.revealSoftness,
        station.revealRadius,
        station.revealSoftness,
        0,
        transitionConfig
      ));
    }
    
    ctx.flyToTransitionTween = gsap.to(transitionObj, {
      progress: 1,
      duration: flyDuration,
      ease: flyEase,
      onUpdate: () => {
        const state = ctx.actions.computeTransitionState(
          currentStation.viewMode,
          station.viewMode,
          currentStation.revealRadius,
          currentStation.revealSoftness,
          station.revealRadius,
          station.revealSoftness,
          transitionObj.progress,
          transitionConfig
        );
        ctx.actions.applyTransitionState(state);
      },
      onComplete: () => {
        const resolvedIndex = Number.isInteger(stationIndex)
          ? stationIndex
          : window.appState.stations.findIndex((candidate) => candidate.id === station.id);
        const nextState = { viewMode: station.viewMode };
        if (window.appState.stationMode !== 'editor' && resolvedIndex >= 0) {
          nextState.currentStationIndex = resolvedIndex;
        }
        window.appState.update(nextState);
        ctx.flyToTransitionTween = null;
      }
    });
  };

  window.appState.focusAnnotation = (annotation, { orbitAroundAnnotation = false } = {}) => {
    if (!annotation?.position || !ctx.camera || !ctx.controls) return;

    const focusView = resolveAnnotationFocusView({
      annotation,
      currentCameraPos: ctx.camera.position,
      currentCameraTarget: ctx.controls.target,
      orbitAroundAnnotation,
      minDistance: Math.max(0.25, (ctx.controls.minDistance || 0) * 1.5),
      maxDistance: Number.isFinite(ctx.controls.maxDistance)
        ? ctx.controls.maxDistance * 0.9
        : Infinity
    });
    if (!focusView) return;

    const cameraPosition = new THREE.Vector3(
      focusView.cameraPos.x,
      focusView.cameraPos.y,
      focusView.cameraPos.z
    );
    const target = new THREE.Vector3(
      focusView.cameraTarget.x,
      focusView.cameraTarget.y,
      focusView.cameraTarget.z
    );
    ctx.freeNavigationZoomTargetDistance = null;

    const activeStation = window.appState.stations?.[window.appState.currentStationIndex];
    if (activeStation?.freeNavigation) {
      window.appState.setFreeNavigationMaxDistance?.(
        activeStation.freeNavigationMaxDistance,
        cameraPosition.distanceTo(target)
      );
    }

    gsap.killTweensOf(ctx.camera.position);
    gsap.killTweensOf(ctx.controls.target);
    if (ctx.flyToTransitionTween) ctx.flyToTransitionTween.kill();

    ctx.targetCameraPos.copy(cameraPosition);
    ctx.targetCameraTarget.copy(target);
    window.appState.update({
      hasUserManipulatedCamera: true,
      ...(window.appState.freeNavigationActive
        ? { freeNavigationOrbitPivot: { x: target.x, y: target.y, z: target.z } }
        : {})
    });

    const cameraTravel = ctx.camera.position.distanceTo(cameraPosition);
    const targetTravel = ctx.controls.target.distanceTo(target);
    const focusTravel = Math.max(cameraTravel, targetTravel);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const focusDuration = resolveCameraTransitionDuration({
      distance: focusTravel,
      base: 1.45,
      multiplier: 0.055,
      minimum: 1.45,
      maximum: 2.6,
      reducedMotion: reduceMotion
    });

    const timeline = gsap.timeline({
      defaults: { duration: focusDuration, ease: 'sine.inOut' },
      onUpdate: () => ctx.controls.update(),
      onComplete: () => {
        ctx.camera.position.copy(cameraPosition);
        ctx.controls.target.copy(target);
        ctx.controls.update();
        if (ctx.flyToTransitionTween === timeline) ctx.flyToTransitionTween = null;
      }
    });
    ctx.flyToTransitionTween = timeline;
    timeline.to(ctx.camera.position, {
      x: cameraPosition.x,
      y: cameraPosition.y,
      z: cameraPosition.z
    }, 0);
    timeline.to(ctx.controls.target, {
      x: target.x,
      y: target.y,
      z: target.z
    }, 0);
  };
}
