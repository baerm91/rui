// Cinematic Scene setup: pedestal, floor grid, spotlights with volumetric cones
import * as THREE from 'three';

export function createSkyDome(scene) {
  // Removed sky dome for a dark cinematic void
  return { uniforms: { uTime: { value: 0 } } };
}

export function createGrassPlane(scene) {
  const group = new THREE.Group();

  // Very dark floor reference grid, kept barely visible behind the monument.
  const gridHelper = new THREE.GridHelper(80, 80, 0x08090b, 0x030304);
  gridHelper.position.y = -0.01;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.28;
  group.add(gridHelper);

  scene.add(group);

  // Return a mock object to maintain compatibility with main.js loop
  return { mesh: group, material: { uniforms: { uTime: { value: 0 } } } };
}

// // Premium studio lighting: bright, soft, and showcasing architectural details
export function createLighting(scene) {
  // 1. Warm Hemisphere Light for soft ambient fill
  const hemi = new THREE.HemisphereLight(0xfffbf0, 0x101216, 1.8);
  scene.add(hemi);

  // 2. Powerful Key Directional Light to cast beautiful shadows and pop details
  const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.6);
  keyLight.position.set(8, 16, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 5;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
  keyLight.shadow.bias = -0.0004;
  scene.add(keyLight);

  // 3. Cool Fill Directional Light to soften shadows and add depth
  const fillLight = new THREE.DirectionalLight(0xdce9ff, 1.4);
  fillLight.position.set(-8, 12, -10);
  scene.add(fillLight);

  // 4. Subtle, soft overhead Showcase Spotlight (no volumetric cone geometry)
  const spotlightTop = new THREE.SpotLight(0xffffff, 8, 25, Math.PI / 4, 0.6, 0.5);
  spotlightTop.position.set(0, 15, 0);
  spotlightTop.target.position.set(0, 0, 0);
  spotlightTop.castShadow = true;
  spotlightTop.shadow.mapSize.width = 1024;
  spotlightTop.shadow.mapSize.height = 1024;
  spotlightTop.shadow.bias = -0.0002;
  scene.add(spotlightTop);
  scene.add(spotlightTop.target);

  return { hemi, keyLight, fillLight, spotlightTop };
}
