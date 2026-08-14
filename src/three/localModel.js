import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { normalizeModel } from '../models.js';
import { ctx } from './context.js';

const MODEL_EXTENSIONS = ['.gltf', '.glb'];

function safeDecodePath(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const normalizePath = (path) => {
  const segments = safeDecodePath(path)
    .replace(/\\/g, '/')
    .split('/');
  const normalized = [];

  segments.forEach((segment) => {
    if (!segment || segment === '.') return;
    if (segment === '..') {
      normalized.pop();
      return;
    }
    normalized.push(segment);
  });

  return normalized.join('/');
};

const getRelativePath = (file) => normalizePath(
  file.relativePath || file.webkitRelativePath || file.name
);

function findModelFile(files) {
  const candidates = files.filter((file) => {
    const name = file.name.toLowerCase();
    return MODEL_EXTENSIONS.some((extension) => name.endsWith(extension));
  });

  if (candidates.length === 0) {
    throw new Error('Im Ordner wurde keine .gltf- oder .glb-Datei gefunden.');
  }

  return candidates.sort((a, b) => {
    const aScene = a.name.toLowerCase() === 'scene.gltf' ? 0 : 1;
    const bScene = b.name.toLowerCase() === 'scene.gltf' ? 0 : 1;
    return aScene - bScene || getRelativePath(a).split('/').length - getRelativePath(b).split('/').length;
  })[0];
}

function disposeMaterial(material) {
  Object.values(material).forEach((value) => {
    if (value?.isTexture) value.dispose();
  });
  material.dispose();
}

function disposeModel(model) {
  const geometries = new Set();
  const materials = new Set();

  model.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach(disposeMaterial);
}

function getMeshMaterials(mesh) {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean);
}

function estimateRadialSurfaceScore(geometry) {
  const positions = geometry.attributes?.position;
  if (!positions || positions.count < 12) return 0;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const step = Math.max(1, Math.floor(positions.count / 240));
  let score = 0;
  let samples = 0;

  for (let index = 0; index < positions.count; index += step) {
    position.fromBufferAttribute(positions, index);
    normal.fromBufferAttribute(normals, index).normalize();
    radial.copy(position).sub(center);
    if (radial.lengthSq() < 0.000001) continue;
    score += Math.abs(normal.dot(radial.normalize()));
    samples += 1;
  }

  return samples > 0 ? score / samples : 0;
}

function detachLikelyEnvironmentMeshes(root) {
  root.updateMatrixWorld(true);
  const entries = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const dimensions = [size.x, size.y, size.z].sort((a, b) => a - b);
    const materials = getMeshMaterials(child);
    entries.push({
      mesh: child,
      maxDimension: dimensions[2],
      uniformity: dimensions[2] > 0 ? dimensions[0] / dimensions[2] : 0,
      isUnlit: materials.length > 0 && materials.every((material) => material.isMeshBasicMaterial),
      isBackFacing: materials.some((material) => material.side === THREE.BackSide),
      radialSurfaceScore: estimateRadialSurfaceScore(child.geometry),
      searchableName: `${child.name} ${child.geometry.name} ${materials.map((material) => material.name).join(' ')}`.toLowerCase()
    });
  });

  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => b.maxDimension - a.maxDimension);
  const largest = sorted[0];
  const referenceDimension = sorted[1]?.maxDimension || largest.maxDimension;
  const explicitEnvironmentPattern = /(panorama|environment|background|backdrop|sky(box|dome)?|sphere|photosphere|photo.?dome|umgebung|himmel)/i;

  const candidates = entries.filter((entry) => {
    const relativeSize = entry.maxDimension / Math.max(referenceDimension, 0.0001);
    const explicitlyNamed = explicitEnvironmentPattern.test(entry.searchableName);
    const dominantUniformUnlitShell = entry === largest
      && relativeSize >= 2.5
      && entry.uniformity >= 0.68
      && (entry.isUnlit || entry.radialSurfaceScore >= 0.74);
    return entry.isBackFacing || (explicitlyNamed && relativeSize >= 1.2) || dominantUniformUnlitShell;
  });

  candidates.forEach(({ mesh }) => mesh.parent?.remove(mesh));
  return candidates.map(({ mesh }) => mesh.name || 'Panorama-/Umgebungs-Mesh');
}

function makeMaterialsReactToLight(root) {
  const replacements = new Map();
  let convertedCount = 0;

  const convertMaterial = (material) => {
    if (!material?.isMeshBasicMaterial) return material;
    if (replacements.has(material)) return replacements.get(material);

    const replacement = new THREE.MeshStandardMaterial({
      name: material.name,
      color: material.color?.clone() ?? new THREE.Color(0xffffff),
      map: material.map ?? null,
      alphaMap: material.alphaMap ?? null,
      aoMap: material.aoMap ?? null,
      transparent: material.transparent,
      opacity: material.opacity,
      alphaTest: material.alphaTest,
      side: material.side,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      vertexColors: material.vertexColors,
      roughness: 0.82,
      metalness: 0.02
    });
    replacement.toneMapped = material.toneMapped;
    replacements.set(material, replacement);
    material.dispose();
    convertedCount += 1;
    return replacement;
  };

  root.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    child.material = Array.isArray(child.material)
      ? child.material.map(convertMaterial)
      : convertMaterial(child.material);
  });

  return convertedCount;
}

function frameLocalModel(wrapper) {
  wrapper.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrapper);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return;

  const framingDirection = new THREE.Vector3(1, 0.55, 1).normalize();
  const verticalFov = THREE.MathUtils.degToRad(ctx.camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(ctx.camera.aspect, 0.1));
  const limitingHalfFov = Math.max(0.1, Math.min(verticalFov, horizontalFov) / 2);
  const fitDistance = Math.max(
    (sphere.radius / Math.sin(limitingHalfFov)) * 1.1,
    sphere.radius + 0.2
  );
  ctx.controls.target.copy(sphere.center);
  ctx.camera.position.copy(sphere.center).addScaledVector(framingDirection, fitDistance);
  ctx.controls.minDistance = Math.max(0.025, sphere.radius * 0.008);
  ctx.controls.maxDistance = Math.max(30, sphere.radius * 18);
  ctx.camera.near = Math.max(0.005, sphere.radius / 1500);
  ctx.camera.far = Math.max(1000, sphere.radius * 100);
  ctx.camera.updateProjectionMatrix();
  ctx.controls.update();
  ctx.targetCameraPos?.copy(ctx.camera.position);
  ctx.targetCameraTarget?.copy(ctx.controls.target);
  ctx.projectDefaultCameraPos.copy(ctx.camera.position);
  ctx.projectDefaultCameraTarget.copy(ctx.controls.target);
}

export function removeLocalModel() {
  ctx.localModelLoadId += 1;

  if (ctx.localModel) {
    ctx.scene.remove(ctx.localModel);
    disposeModel(ctx.localModel);
    ctx.localModel = null;
  }

  ctx.localModelObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  ctx.localModelObjectUrls = [];
  ctx.projectDefaultCameraPos.set(0, 10, 22);
  ctx.projectDefaultCameraTarget.set(0, 3.5, 0);

  window.appState?.update({
    localModelName: '',
    localModelStatus: 'idle',
    localModelError: '',
    localModelEnvironmentRemoved: [],
    localModelMaterialsConverted: 0
  });
}

export async function loadLocalModelFiles(fileList) {
  const loadId = ++ctx.localModelLoadId;
  const files = Array.from(fileList || []);
  if (files.length === 0) throw new Error('Der ausgewaehlte Ordner ist leer.');

  const modelFile = findModelFile(files);
  const modelPath = getRelativePath(modelFile);
  const modelDirectory = modelPath.includes('/')
    ? modelPath.slice(0, modelPath.lastIndexOf('/') + 1)
    : '';

  const objectUrls = [];
  const filesByPath = new Map();
  const filesByName = new Map();

  files.forEach((file) => {
    const relativePath = getRelativePath(file);
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    filesByPath.set(relativePath.toLowerCase(), url);
    const lowerName = file.name.toLowerCase();
    filesByName.set(lowerName, filesByName.has(lowerName) ? null : url);
  });

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((requestedUrl) => {
    if (/^(blob:|data:|https?:)/i.test(requestedUrl)) return requestedUrl;

    const requestedPath = normalizePath(requestedUrl);
    const relativeToModel = normalizePath(`${modelDirectory}${requestedPath}`);
    return filesByPath.get(relativeToModel.toLowerCase())
      || filesByPath.get(requestedPath.toLowerCase())
      || filesByName.get(requestedPath.split('/').pop().toLowerCase())
      || requestedUrl;
  });

  const loader = new GLTFLoader(manager);
  const dracoLoader = new DRACOLoader(manager)
    .setDecoderPath('/three-codecs/draco/');
  const ktx2Loader = ctx.renderer
    ? new KTX2Loader(manager)
      .setTranscoderPath('/three-codecs/basis/')
      .detectSupport(ctx.renderer)
    : null;

  loader.setDRACOLoader(dracoLoader);
  if (ktx2Loader) loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(MeshoptDecoder);

  let parsedScene = null;

  try {
    const data = modelFile.name.toLowerCase().endsWith('.glb')
      ? await modelFile.arrayBuffer()
      : await modelFile.text();

    const gltf = await new Promise((resolve, reject) => {
      loader.parse(data, '', resolve, reject);
    });
    parsedScene = gltf.scene;

    if (loadId !== ctx.localModelLoadId) {
      disposeModel(gltf.scene);
      parsedScene = null;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      return null;
    }

    const removedEnvironmentMeshes = detachLikelyEnvironmentMeshes(gltf.scene);
    const convertedMaterialCount = makeMaterialsReactToLight(gltf.scene);
    const wrapper = normalizeModel(gltf.scene);
    wrapper.name = `Lokales Modell: ${modelFile.name}`;
    wrapper.visible = window.appState?.stationMode === 'editor' || window.appState?.showBaseModels === false;
    wrapper.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (ctx.localModel) {
      ctx.scene.remove(ctx.localModel);
      disposeModel(ctx.localModel);
    }
    ctx.localModelObjectUrls.forEach((url) => URL.revokeObjectURL(url));

    ctx.scene.add(wrapper);
    ctx.localModel = wrapper;
    ctx.localModelObjectUrls = objectUrls;
    parsedScene = null;
    frameLocalModel(wrapper);

    window.appState?.update({
      localModelName: modelFile.name,
      localModelStatus: 'loaded',
      localModelError: '',
      localModelEnvironmentRemoved: removedEnvironmentMeshes,
      localModelMaterialsConverted: convertedMaterialCount
    });

    return wrapper;
  } catch (error) {
    if (parsedScene) disposeModel(parsedScene);
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    if (loadId !== ctx.localModelLoadId) return null;
    throw new Error(`Das Modell konnte nicht geladen werden: ${error.message}`);
  } finally {
    dracoLoader.dispose();
    ktx2Loader?.dispose();
  }
}
