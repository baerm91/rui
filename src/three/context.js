import * as THREE from 'three';

export const ctx = {
  // ThreeJS core objects
  canvas: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  
  // Models and alignment
  ruinModel: null,
  reconModel: null,
  localModel: null,
  localModelObjectUrls: [],
  localModelLoadId: 0,
  projectDefaultCameraPos: new THREE.Vector3(0, 10, 22),
  projectDefaultCameraTarget: new THREE.Vector3(0, 3.5, 0),
  ruinOffsetY: 0,
  reconOffsetY: 0,
  isModelAligned: false,
  revealHitMeshes: [],
  modelAnimationControllers: [],
  activeModelAnimationStationId: null,
  
  // Environment and images
  lights: null,
  skyMaterial: null,
  grassObj: null,
  stationImages: [],
  textureCache: {},
  textureLoader: new THREE.TextureLoader(),
  
  // Uniforms and raycasting
  revealUniforms: {
    uMouseNDC: { value: new THREE.Vector2(9999, 9999) },
    uCameraWorldPos: { value: new THREE.Vector3(0, 0, 0) },
    uRayDirection: { value: new THREE.Vector3(0, 0, 1) },
    uRevealCenterWorld: { value: new THREE.Vector3(9999, 9999, 9999) },
    uRevealHasHit: { value: false },
    uWorldRadius: { value: 0.0 },
    uWorldSoftness: { value: 0.0 },
    uViewportSize: { value: new THREE.Vector2() },
    uRevealRadius: { value: 0.26 },
    uRevealSoftness: { value: 0.05 },
    uRevealActive: { value: false },
    uShowAlways: { value: false },
    uLensZoom: { value: 1.0 },
    uTime: { value: 0 },
    uOpacityRuin: { value: 1.0 },
    uOpacityRecon: { value: 0.0 },
    uPortalTint: { value: 0.0 }
  },
  raycaster: new THREE.Raycaster(),
  mouseTarget: new THREE.Vector2(0, 0),
  portalMouseTarget: new THREE.Vector2(0, 0),
  blendedRevealTarget: new THREE.Vector2(0, 0),
  
  // Modes
  isRevealMode: false,
  isMouseOutside: true,
  hasMouseMoved: false,
  movementKeys: new Set(),
  firstPerson: {
    active: false,
    verticalMove: false,
    yaw: 0,
    pitch: 0,
    lookDistance: 5
  },
  
  // Targets for scroll transitions
  targetCameraPos: new THREE.Vector3(0, 10, 22),
  targetCameraTarget: new THREE.Vector3(0, 3.5, 0),
  targetRevealRadius: 0.26,
  targetRevealSoftness: 0.05,
  targetOpacityRuin: 1.0,
  targetOpacityRecon: 0.0,
  targetPortalTint: 0.0,
  targetRevealActive: false,
  targetShowAlways: false,
  targetRevealFollowsMouse: false,
  targetRevealMouseBlend: 0,
  introModelOpacity: { value: 1 },
  
  // Light intensity targets
  targetLightIntensity: 1.0,
  targetShadowDiffuse: 1.0,
  currentLightIntensity: 1.0,
  currentShadowDiffuse: 1.0,
  
  targetHemiEnabled: 1.0,
  currentHemiEnabled: 1.0,
  
  targetKeyEnabled: 1.0,
  currentKeyEnabled: 1.0,
  targetKeyFixedToCamera: false,
  currentKeyFixedToCamera: false,
  targetKeyPos: new THREE.Vector3(8, 16, 10),
  currentKeyPos: new THREE.Vector3(8, 16, 10),
  
  targetFillEnabled: 1.0,
  currentFillEnabled: 1.0,
  targetFillFixedToCamera: false,
  currentFillFixedToCamera: false,
  targetFillPos: new THREE.Vector3(-8, 12, -10),
  currentFillPos: new THREE.Vector3(-8, 12, -10),
  
  targetSpotEnabled: 1.0,
  currentSpotEnabled: 1.0,
  targetSpotFixedToCamera: false,
  currentSpotFixedToCamera: false,
  targetSpotPos: new THREE.Vector3(0, 15, 0),
  currentSpotPos: new THREE.Vector3(0, 15, 0),
  
  // Tweens and scroll transition state
  lastIntervalIndex: 0,
  lastTargetP: 0.0,
  transitionProgress: { value: 0.0 },
  portalTransitionProgress: { value: 0.0 },
  scrollTransitionTween: null,
  flyToTransitionTween: null,
  freeNavigationZoomTargetDistance: null,
  portalTransitionTween: null,
  activePortalTransition: null,
  previousScrollProgress: 0,
  visualScrollProgress: 0,
  
  // Alignment state
  alignPoints: {
    ruin: [],
    recon: [],
    ruinWorld: [],
    reconWorld: []
  },
  alignMarkers: [],
  alignLines: [],
  pendingAnnotationPlacement: null,
  
  // Cross-module actions
  actions: {
    startAlignmentMode: null,
    handleAlignClick: null,
    completeAlignment: null,
    enterRevealMode: null,
    updateStationImages: null,
    updateScrollProgress: null,
    applyScrollProgress: null,
    clearMarkers: null,
    clearLines: null,
    getPortalTransitionConfig: null,
    computeTransitionState: null,
    isPortalRevealTransition: null,
    applyTransitionState: null,
    startPortalTransition: null,
    cancelPortalTransition: null,
    playInitialIntro: null
  }
};
