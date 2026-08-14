import * as THREE from 'three';
import { ctx } from './context.js';

const MAX_TEXTURE_CACHE_SIZE = 24;

function cacheTexture(url, texture) {
  const existingTexture = ctx.textureCache[url];
  if (existingTexture && existingTexture !== texture) {
    texture.dispose();
    return existingTexture;
  }

  ctx.textureCache[url] = texture;
  const cachedUrls = Object.keys(ctx.textureCache);
  if (cachedUrls.length <= MAX_TEXTURE_CACHE_SIZE) return texture;

  const activeTextures = new Set(ctx.stationImages.map((mesh) => mesh.material.map).filter(Boolean));
  const removableUrl = cachedUrls.find((cachedUrl) => {
    const cachedTexture = ctx.textureCache[cachedUrl];
    return cachedUrl !== url && !activeTextures.has(cachedTexture);
  });

  if (removableUrl) {
    ctx.textureCache[removableUrl].dispose();
    delete ctx.textureCache[removableUrl];
  }

  return texture;
}

export function initStationImages() {
  for (let i = 0; i < 3; i++) {
    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      visible: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { fixToCamera: false };
    ctx.scene.add(mesh);
    ctx.stationImages.push(mesh);
  }
}

export function updateStationImages(images) {
  if (!images || !Array.isArray(images)) {
    ctx.stationImages.forEach((mesh) => {
      mesh.userData.requestedUrl = '';
      mesh.visible = false;
    });
    return;
  }

  for (let i = 0; i < 3; i++) {
    const mesh = ctx.stationImages[i];
    if (!mesh) continue;

    const imgData = images[i];
    if (!imgData || !imgData.url) {
      mesh.userData.requestedUrl = '';
      mesh.visible = false;
      continue;
    }

    const url = imgData.url;
    mesh.userData.requestedUrl = url;
    mesh.userData.fixToCamera = !!imgData.fixToCamera;
    mesh.userData.localPosX = imgData.posX ?? 0;
    mesh.userData.localPosY = imgData.posY ?? 0;
    const pz = imgData.posZ ?? 0;
    mesh.userData.localPosZ = pz === 0 ? -6.0 : (pz > 0 ? -pz : pz);

    if (!mesh.userData.fixToCamera) {
      mesh.position.set(imgData.posX ?? 0, imgData.posY ?? 3.5, imgData.posZ ?? 0);
    }

    const baseScale = imgData.scale ?? 1.0;

    if (ctx.textureCache[url]) {
      const tex = ctx.textureCache[url];
      mesh.material.map = tex;
      mesh.material.needsUpdate = true;
      mesh.visible = true;
      
      const aspect = (tex.image && tex.image.height) ? (tex.image.width / tex.image.height) : 1;
      mesh.scale.set(baseScale * aspect, baseScale, 1);
    } else {
      mesh.visible = false;
      ctx.textureLoader.load(url, (tex) => {
        if (mesh.userData.requestedUrl === url) {
          const cachedTexture = cacheTexture(url, tex);
          mesh.material.map = cachedTexture;
          mesh.material.needsUpdate = true;
          mesh.visible = true;
          
          const aspect = (cachedTexture.image && cachedTexture.image.height)
            ? (cachedTexture.image.width / cachedTexture.image.height)
            : 1;
          mesh.scale.set(baseScale * aspect, baseScale, 1);
        } else {
          tex.dispose();
        }
      }, undefined, (err) => {
        console.error("Error loading image texture:", url, err);
      });
    }
  }
}

const tempPos = new THREE.Vector3();

export function updateBillboardPlanes() {
  ctx.stationImages.forEach(mesh => {
    if (mesh && mesh.visible) {
      if (mesh.userData.fixToCamera) {
        tempPos.set(
          mesh.userData.localPosX ?? 0,
          mesh.userData.localPosY ?? 0,
          mesh.userData.localPosZ ?? -6
        );
        tempPos.applyMatrix4(ctx.camera.matrixWorld);
        mesh.position.copy(tempPos);
        mesh.quaternion.copy(ctx.camera.quaternion);
      } else {
        mesh.rotation.set(0, 0, 0);
      }
    }
  });
}
