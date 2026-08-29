import * as THREE from 'three';
import { getSpatialMaterial, normalizeSpatialSurface } from '../utils/spatialMaterials.js';

const TEXTURE_PROPERTIES = ['map', 'normalMap', 'roughnessMap', 'aoMap'];
const texturePromises = new Map();

const loadTextureOnce = (textureLoader, url) => {
  if (!texturePromises.has(url)) texturePromises.set(url, textureLoader.loadAsync(url));
  return texturePromises.get(url);
};

const configureTexture = (texture, surface, width, height, renderer, colorTexture) => {
  const tileSize = Math.max(.25, surface.tileSize);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(.1, width / tileSize), Math.max(.1, height / tileSize));
  texture.center.set(.5, .5);
  texture.rotation = THREE.MathUtils.degToRad(surface.rotation);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
};

export function createSpatialMeshMaterial({
  surface: rawSurface,
  fallbackId,
  textureLoader,
  renderer,
  geometry,
  width,
  height,
  ...options
}) {
  const surface = normalizeSpatialSurface(rawSurface, fallbackId);
  const preset = getSpatialMaterial(surface.materialId, fallbackId);
  const material = new THREE.MeshStandardMaterial({
    color: preset.maps ? '#ffffff' : preset.color,
    roughness: surface.roughness,
    metalness: 0,
    ...options
  });
  material.normalScale.setScalar(surface.normalStrength);
  material.userData.spatialMaterialId = preset.id;

  if (preset.maps?.aoMap && geometry?.attributes?.uv && !geometry.attributes.uv1) {
    geometry.setAttribute('uv1', geometry.attributes.uv.clone());
  }

  TEXTURE_PROPERTIES.forEach((property) => {
    const url = preset.maps?.[property];
    if (!url) return;
    loadTextureOnce(textureLoader, url).then((baseTexture) => {
      if (material.userData.disposed) return;
      const texture = baseTexture.clone();
      configureTexture(texture, surface, width, height, renderer, property === 'map');
      material[property] = texture;
      material.needsUpdate = true;
    }).catch((error) => console.warn(`Raummaterial konnte nicht geladen werden: ${url}`, error));
  });
  return material;
}

export function disposeSpatialMaterial(material) {
  if (!material) return;
  material.userData.disposed = true;
  TEXTURE_PROPERTIES.forEach((property) => material[property]?.dispose?.());
  material.dispose?.();
}
