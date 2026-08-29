const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

export const SPATIAL_SURFACES = [
  { id: 'wall', label: 'Wand' },
  { id: 'floor', label: 'Boden' },
  { id: 'plinth', label: 'Sockel' }
];

export const SPATIAL_MATERIALS = [
  {
    id: 'warm-white',
    name: 'Warmweiß',
    color: '#ded9cd',
    roughness: 0.92,
    tileSize: 2,
    surfaces: ['wall', 'plinth']
  },
  {
    id: 'limestone',
    name: 'Kalkstein',
    color: '#c9c0ae',
    roughness: 0.9,
    tileSize: 1.2,
    surfaces: ['wall', 'floor', 'plinth']
  },
  {
    id: 'soft-grey',
    name: 'Hellgrau',
    color: '#c9cbc7',
    roughness: 0.94,
    tileSize: 2,
    surfaces: ['wall', 'floor', 'plinth']
  },
  {
    id: 'neutral-floor',
    name: 'Neutraler Boden',
    color: '#bcb5a6',
    roughness: 1,
    tileSize: 2,
    surfaces: ['floor']
  },
  {
    id: 'beige-wall-002',
    name: 'Beige Putzwand',
    color: '#d6c8af',
    roughness: 0.94,
    tileSize: 3,
    normalStrength: 0.55,
    preview: '/materials/beige_wall_002/diffuse.jpg',
    maps: {
      map: '/materials/beige_wall_002/diffuse.jpg',
      normalMap: '/materials/beige_wall_002/normal.jpg',
      roughnessMap: '/materials/beige_wall_002/roughness.jpg'
    },
    surfaces: ['wall'],
    source: 'Poly Haven · Beige Wall 002',
    sourceUrl: 'https://polyhaven.com/a/beige_wall_002',
    license: 'CC0'
  },
  {
    id: 'travertine-001',
    name: 'Travertin',
    color: '#d8c6a6',
    roughness: 0.82,
    tileSize: 1.2,
    normalStrength: 0.7,
    preview: '/materials/travertine_001/preview.png',
    maps: {
      map: '/materials/travertine_001/diffuse.jpg',
      normalMap: '/materials/travertine_001/normal.jpg',
      roughnessMap: '/materials/travertine_001/roughness.jpg',
      aoMap: '/materials/travertine_001/ao.jpg'
    },
    surfaces: ['wall', 'floor', 'plinth'],
    source: 'ambientCG · Travertine 001',
    sourceUrl: 'https://ambientcg.com/view?id=Travertine001',
    license: 'CC0'
  },
  {
    id: 'marble-01',
    name: 'Creme-Marmor',
    color: '#e2d4bb',
    roughness: 0.64,
    tileSize: 1.5,
    normalStrength: 0.42,
    preview: '/materials/marble_01/diffuse.jpg',
    maps: {
      map: '/materials/marble_01/diffuse.jpg',
      normalMap: '/materials/marble_01/normal.jpg',
      roughnessMap: '/materials/marble_01/roughness.jpg'
    },
    surfaces: ['wall', 'floor', 'plinth'],
    source: 'Poly Haven · Marble 01',
    sourceUrl: 'https://polyhaven.com/a/marble_01',
    license: 'CC0'
  },
  {
    id: 'wood-floor',
    name: 'Holzboden',
    color: '#9b7654',
    roughness: 0.7,
    tileSize: 1.7,
    normalStrength: 0.62,
    preview: '/materials/wood_floor/diffuse.jpg',
    maps: {
      map: '/materials/wood_floor/diffuse.jpg',
      normalMap: '/materials/wood_floor/normal.jpg',
      roughnessMap: '/materials/wood_floor/roughness.jpg'
    },
    surfaces: ['floor'],
    source: 'Poly Haven · Wood Floor',
    sourceUrl: 'https://polyhaven.com/a/wood_floor',
    license: 'CC0'
  }
];

const MATERIALS_BY_ID = new Map(SPATIAL_MATERIALS.map((material) => [material.id, material]));

export function getSpatialMaterial(id, fallbackId = 'warm-white') {
  return MATERIALS_BY_ID.get(id) || MATERIALS_BY_ID.get(fallbackId) || SPATIAL_MATERIALS[0];
}

export function normalizeSpatialSurface(value, fallbackId) {
  const input = typeof value === 'string' ? { materialId: value } : value || {};
  const preset = getSpatialMaterial(input.materialId || input.id, fallbackId);
  return {
    materialId: preset.id,
    tileSize: clampNumber(input.tileSize, preset.tileSize, 0.25, 12),
    rotation: clampNumber(input.rotation, 0, -180, 180),
    roughness: clampNumber(input.roughness, preset.roughness, 0.15, 1),
    normalStrength: clampNumber(input.normalStrength, preset.normalStrength ?? 0, 0, 2)
  };
}

export function normalizeSpatialSurfaceMaterials(spatial = {}) {
  const legacyWallId = MATERIALS_BY_ID.has(spatial.wallMaterial) ? spatial.wallMaterial : 'warm-white';
  return {
    wall: normalizeSpatialSurface(spatial.surfaceMaterials?.wall, legacyWallId),
    floor: normalizeSpatialSurface(spatial.surfaceMaterials?.floor, 'neutral-floor'),
    plinth: normalizeSpatialSurface(spatial.surfaceMaterials?.plinth, 'limestone')
  };
}

export function createCuratedSpatialSurfaceMaterials() {
  return {
    wall: normalizeSpatialSurface(null, 'beige-wall-002'),
    floor: normalizeSpatialSurface(null, 'travertine-001'),
    plinth: normalizeSpatialSurface(null, 'warm-white')
  };
}

export function getMaterialsForSurface(surface) {
  return SPATIAL_MATERIALS.filter((material) => material.surfaces.includes(surface));
}
