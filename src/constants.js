// ─── SHARED CONSTANTS ─────────────────────────────────
// Extracted from repeated hardcoded values across App.jsx and main.js

export const DEFAULT_LIGHT_POSITIONS = {
  key:  { x: 8,  y: 16, z: 10 },
  fill: { x: -8, y: 12, z: -10 },
  spot: { x: 0,  y: 15, z: 0 }
};

export const DEFAULT_PROJECT_LIGHTING = {
  lightIntensity: 1,
  shadowDiffuse: 1,
  lightHemiEnabled: true,
  lightKeyEnabled: true,
  lightKeyFixedToCamera: false,
  lightKeyPos: { ...DEFAULT_LIGHT_POSITIONS.key },
  lightFillEnabled: true,
  lightFillFixedToCamera: false,
  lightFillPos: { ...DEFAULT_LIGHT_POSITIONS.fill },
  lightSpotEnabled: true,
  lightSpotFixedToCamera: false,
  lightSpotPos: { ...DEFAULT_LIGHT_POSITIONS.spot }
};

export const BACKGROUND_IMAGE_OPTIONS = [
  { value: '',                        label: 'Keines (Standard dunkel)' },
  { value: 'roman_blueprint_bg.png',  label: 'Römische Bauzeichnung (Blaupause)' },
  { value: 'star_sky_bg.png',         label: 'Sternenhimmel (Dramatisch)' },
  { value: 'heidentor_blueprint.png', label: 'Heidentor Aufriss-Zeichnung' },
  { value: 'upload',                  label: 'Eigene Bilddatei hochladen (.png, .jpg)' },
  { value: 'custom',                  label: 'Externe URL / Pfad' }
];

export const KNOWN_BG_IMAGES = ['roman_blueprint_bg.png', 'star_sky_bg.png', 'heidentor_blueprint.png'];

export const NEW_STATION_TEMPLATE = {
  title: '',
  description: 'Beschreiben Sie hier, was an dieser Station zu sehen ist.',
  viewMode: 'reveal',
  cameraPos: { x: 0, y: 10, z: 22 },
  cameraTarget: { x: 0, y: 3.5, z: 0 },
  cameraExplicitlySet: false,
  revealRadius: 0.26,
  revealSoftness: 0.05,
  bgImage: '',
  textX: 10,
  textY: 35,
  textWidth: 512,
  subTitle: '',
  subDescription: '',
  videoUrl: '',
  videoX: 58,
  videoY: 22,
  videoWidth: 28,
  videoHeight: 18,
  textLayer: 'front',
  milkyBg: false,
  highContrastBg: false,
  playModelAnimation: false,
  modelAnimationSpeed: 100,
  freeNavigation: false,
  freeNavigationTargetOffsetY: 0,
  freeNavigationMaxDistance: 40,
  showAnnotationNavigation: true
};

export const DEFAULT_IMAGE_SLOT = {
  url: '',
  posX: 0,
  posY: 3.5,
  posZ: 0,
  scale: 1.0,
  fixToCamera: false
};

export const IMAGE_SLOT_POSITION_FIELDS = [
  { field: 'posX', label: 'Pos X', min: -15, max: 15, fallback: 0 },
  { field: 'posY', label: 'Pos Y', min: 0, max: 15, fallback: 3.5 },
  { field: 'posZ', label: 'Pos Z', min: -15, max: 15, fallback: 0 }
];

// Lookup map for field → window.appState setter dispatch
// Used by useEditorActions to replace the if-else chain in handleUpdateStationText
export const FIELD_TO_STATE_SETTER = {
  viewMode:              'setViewMode',
  revealRadius:          'setRevealRadius',
  revealSoftness:        'setRevealSoftness'
};

// Light configuration for the editor UI cards
export const LIGHT_SOURCES = [
  { key: 'lightHemiEnabled', label: 'Umgebungslicht', desc: 'Hemisphären-Füllung' },
  { key: 'lightKeyEnabled',  label: 'Hauptlicht',    desc: 'Schattenwerfer' },
  { key: 'lightFillEnabled', label: 'Fülllicht',     desc: 'Schatten-Aufhellung' },
  { key: 'lightSpotEnabled', label: 'Spotlight',     desc: 'Fokuslicht oben' }
];

// Configuration for the three light position editors
export const LIGHT_POSITION_CONFIGS = [
  {
    enabledKey: 'lightKeyEnabled',
    posKey: 'lightKeyPos',
    fixedKey: 'lightKeyFixedToCamera',
    label: 'Hauptlicht (Key) Position',
    defaultPos: DEFAULT_LIGHT_POSITIONS.key,
    axes: [
      { axis: 'x', label: 'Pos X', min: -30, max: 30, fallback: 8 },
      { axis: 'y', label: 'Pos Y', min: 1,   max: 30, fallback: 16 },
      { axis: 'z', label: 'Pos Z', min: -30, max: 30, fallback: 10 }
    ]
  },
  {
    enabledKey: 'lightFillEnabled',
    posKey: 'lightFillPos',
    fixedKey: 'lightFillFixedToCamera',
    label: 'Fülllicht (Fill) Position',
    defaultPos: DEFAULT_LIGHT_POSITIONS.fill,
    axes: [
      { axis: 'x', label: 'Pos X', min: -30, max: 30, fallback: -8 },
      { axis: 'y', label: 'Pos Y', min: 1,   max: 30, fallback: 12 },
      { axis: 'z', label: 'Pos Z', min: -30, max: 30, fallback: -10 }
    ]
  },
  {
    enabledKey: 'lightSpotEnabled',
    posKey: 'lightSpotPos',
    fixedKey: 'lightSpotFixedToCamera',
    label: 'Spotlight Position',
    defaultPos: DEFAULT_LIGHT_POSITIONS.spot,
    axes: [
      { axis: 'x', label: 'Pos X', min: -20, max: 20, fallback: 0 },
      { axis: 'y', label: 'Pos Y', min: 1,   max: 35, fallback: 15 },
      { axis: 'z', label: 'Pos Z', min: -20, max: 20, fallback: 0 }
    ]
  }
];

// Portal tuning parameters shown in the editor
export const PORTAL_PARAMS = [
  ['portalRadius',              'Portalgröße',      1.0, 4.5, 0.05, 3.2],
  ['portalSoftness',            'Portalweichheit',  0.02, 0.5, 0.01, 0.2],
  ['portalTransitionDuration',  'Portaldauer',      0.5, 5.0, 0.1, 2.8],
  ['portalMouseStart',          'Mausstart',        0.0, 0.8, 0.01, 0.2],
  ['portalRuinFadeEnd',         'Ruine aus',        0.02, 0.8, 0.01, 0.22],
  ['portalRevealRuinFadeStart', 'Reveal Ruine ab',  0.0, 0.8, 0.01, 0.18],
  ['portalRevealRuinFadeEnd',   'Reveal Ruine voll',0.1, 1.0, 0.01, 0.85],
  ['portalReconFadeEnd',        'Portal ein',       0.05, 0.9, 0.01, 0.46]
];
