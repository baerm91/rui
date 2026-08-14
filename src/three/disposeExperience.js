import gsap from 'gsap';
import { ctx } from './context.js';
import { stopAnimationLoop } from './renderLoop.js';
import { audioManager } from '../utils/audioManager.js';
import { disposeModelAnimations } from './modelAnimation.js';

function collectTextures(value, textures, visited = new Set()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  if (value.isTexture) {
    textures.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextures(item, textures, visited));
    return;
  }
  Object.values(value).forEach((item) => collectTextures(item, textures, visited));
}

export function disposeExperience() {
  stopAnimationLoop();
  gsap.globalTimeline.clear();
  ctx.actions.cancelPortalTransition?.();
  ctx.scrollTransitionTween?.kill?.();
  ctx.flyToTransitionTween?.kill?.();
  ctx.portalTransitionTween?.kill?.();

  document.querySelectorAll('.station-video-panel iframe').forEach((frame) => {
    frame.src = 'about:blank';
  });
  audioManager.dispose();
  disposeModelAnimations(ctx);

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set(Object.values(ctx.textureCache || {}).filter(Boolean));
  ctx.scene?.traverse?.((object) => {
    if (object.geometry?.dispose) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      collectTextures(material, textures);
    });
  });
  collectTextures(ctx.scene?.background, textures);
  collectTextures(ctx.scene?.environment, textures);

  textures.forEach((texture) => texture.dispose?.());
  materials.forEach((material) => material.dispose?.());
  geometries.forEach((geometry) => geometry.dispose?.());
  ctx.textureCache = {};
  ctx.stationImages = [];
  ctx.revealHitMeshes = [];

  ctx.localModelObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  ctx.localModelObjectUrls = [];
  ctx.controls?.dispose?.();
  ctx.renderer?.renderLists?.dispose?.();
  ctx.renderer?.dispose?.();
  ctx.renderer?.forceContextLoss?.();

  ctx.scene?.clear?.();
  ctx.ruinModel = null;
  ctx.reconModel = null;
  ctx.localModel = null;
  ctx.renderer = null;
  ctx.controls = null;
  ctx.camera = null;
}
