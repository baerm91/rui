import * as THREE from 'three';
import { ctx } from './context.js';

const tempLightPos = new THREE.Vector3();

export function updateLighting(elapsed) {
  // Smoothly interpolate light intensity and shadow diffuseness
  ctx.currentLightIntensity = THREE.MathUtils.lerp(ctx.currentLightIntensity, ctx.targetLightIntensity, 0.06);
  ctx.currentShadowDiffuse = THREE.MathUtils.lerp(ctx.currentShadowDiffuse, ctx.targetShadowDiffuse, 0.06);

  ctx.currentHemiEnabled = THREE.MathUtils.lerp(ctx.currentHemiEnabled, ctx.targetHemiEnabled, 0.06);
  ctx.currentKeyEnabled = THREE.MathUtils.lerp(ctx.currentKeyEnabled, ctx.targetKeyEnabled, 0.06);
  ctx.currentFillEnabled = THREE.MathUtils.lerp(ctx.currentFillEnabled, ctx.targetFillEnabled, 0.06);
  ctx.currentSpotEnabled = THREE.MathUtils.lerp(ctx.currentSpotEnabled, ctx.targetSpotEnabled, 0.06);

  ctx.currentKeyFixedToCamera = THREE.MathUtils.lerp(ctx.currentKeyFixedToCamera ? 1 : 0, ctx.targetKeyFixedToCamera ? 1 : 0, 0.06) > 0.5;
  ctx.currentFillFixedToCamera = THREE.MathUtils.lerp(ctx.currentFillFixedToCamera ? 1 : 0, ctx.targetFillFixedToCamera ? 1 : 0, 0.06) > 0.5;
  ctx.currentSpotFixedToCamera = THREE.MathUtils.lerp(ctx.currentSpotFixedToCamera ? 1 : 0, ctx.targetSpotFixedToCamera ? 1 : 0, 0.06) > 0.5;

  ctx.currentKeyPos.lerp(ctx.targetKeyPos, 0.06);
  ctx.currentFillPos.lerp(ctx.targetFillPos, 0.06);
  ctx.currentSpotPos.lerp(ctx.targetSpotPos, 0.06);

  if (ctx.lights) {
    ctx.lights.hemi.intensity = 1.8 * ctx.currentLightIntensity * ctx.currentHemiEnabled;
    ctx.lights.keyLight.intensity = 2.6 * ctx.currentLightIntensity * ctx.currentKeyEnabled;
    ctx.lights.fillLight.intensity = 1.4 * ctx.currentLightIntensity * ctx.currentFillEnabled;
    ctx.lights.spotlightTop.intensity = 8.0 * ctx.currentLightIntensity * ctx.currentSpotEnabled;

    if (ctx.currentKeyFixedToCamera) {
      tempLightPos.copy(ctx.currentKeyPos).applyMatrix4(ctx.camera.matrixWorld);
      ctx.lights.keyLight.position.copy(tempLightPos);
      ctx.lights.keyLight.target.position.copy(ctx.controls.target);
    } else {
      ctx.lights.keyLight.position.copy(ctx.currentKeyPos);
      ctx.lights.keyLight.target.position.copy(ctx.controls.target);
    }

    if (ctx.currentFillFixedToCamera) {
      tempLightPos.copy(ctx.currentFillPos).applyMatrix4(ctx.camera.matrixWorld);
      ctx.lights.fillLight.position.copy(tempLightPos);
      ctx.lights.fillLight.target.position.copy(ctx.controls.target);
    } else {
      ctx.lights.fillLight.position.copy(ctx.currentFillPos);
      ctx.lights.fillLight.target.position.copy(ctx.controls.target);
    }

    if (ctx.currentSpotFixedToCamera) {
      tempLightPos.copy(ctx.currentSpotPos).applyMatrix4(ctx.camera.matrixWorld);
      ctx.lights.spotlightTop.position.copy(tempLightPos);
      ctx.lights.spotlightTop.target.position.copy(ctx.controls.target);
    } else {
      ctx.lights.spotlightTop.position.copy(ctx.currentSpotPos);
      ctx.lights.spotlightTop.target.position.copy(ctx.controls.target);
    }

    ctx.lights.keyLight.shadow.radius = ctx.currentShadowDiffuse;
    ctx.lights.spotlightTop.shadow.radius = ctx.currentShadowDiffuse;
  }
}
