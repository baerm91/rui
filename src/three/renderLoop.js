import * as THREE from 'three';
import { ctx } from './context.js';
import { updateLighting } from './lighting.js';
import { updateBillboardPlanes } from './imagePlanes.js';
import { updateModelAnimations } from './modelAnimation.js';
import { updateWeatherEffects } from './weatherEffects.js';
import { audioManager } from '../utils/audioManager.js';
import {
  isFreeNavigationActiveState,
  isKeyboardNavigationAllowedState,
  resolveFreeMovementSpeed
} from './freeOrbit.js';

const clock = new THREE.Clock();
let frameCount = 0;
let lastElapsed = 0;
const movementForward = new THREE.Vector3();
const movementRight = new THREE.Vector3();
const movementDelta = new THREE.Vector3();
const freeZoomDirection = new THREE.Vector3();
let animationFrameId = null;
let animationEnabled = true;

function updateSmoothFreeNavigationZoom(deltaSeconds) {
  const targetDistance = ctx.freeNavigationZoomTargetDistance;
  if (!Number.isFinite(targetDistance) || !ctx.camera || !ctx.controls) return;

  const station = window.appState?.stations?.[window.appState.currentStationIndex];
  const isActive = window.appState?.stationMode === 'scroll'
    && station?.freeNavigation
    && window.appState.freeNavigationActive
    && window.appState.freeNavigationStationId === station.id;
  if (!isActive) {
    ctx.freeNavigationZoomTargetDistance = null;
    return;
  }

  freeZoomDirection.copy(ctx.camera.position).sub(ctx.controls.target);
  const currentDistance = freeZoomDirection.length();
  if (currentDistance < 0.0001) freeZoomDirection.set(0, 0.35, 1);
  freeZoomDirection.normalize();

  const clampedTarget = THREE.MathUtils.clamp(
    targetDistance,
    ctx.controls.minDistance,
    ctx.controls.maxDistance
  );
  const nextDistance = THREE.MathUtils.damp(currentDistance, clampedTarget, 11, deltaSeconds);
  ctx.camera.position.copy(ctx.controls.target).addScaledVector(freeZoomDirection, nextDistance);
  ctx.targetCameraPos?.copy(ctx.camera.position);

  if (Math.abs(nextDistance - clampedTarget) < 0.002) {
    ctx.camera.position.copy(ctx.controls.target).addScaledVector(freeZoomDirection, clampedTarget);
    ctx.freeNavigationZoomTargetDistance = null;
  }
}

function updateKeyboardMovement(deltaSeconds) {
  if ((!ctx.controls?.enabled && !ctx.firstPerson?.active) || !ctx.camera || ctx.movementKeys.size === 0) return;
  if (!isKeyboardNavigationAllowedState(window.appState)) return;

  const forwardInput = (ctx.movementKeys.has('KeyW') ? 1 : 0) - (ctx.movementKeys.has('KeyS') ? 1 : 0);
  const rightInput = (ctx.movementKeys.has('KeyD') ? 1 : 0) - (ctx.movementKeys.has('KeyA') ? 1 : 0);
  if (forwardInput === 0 && rightInput === 0) return;

  ctx.camera.getWorldDirection(movementForward);
  movementForward.y = 0;
  if (movementForward.lengthSq() < 0.0001) {
    movementForward.copy(ctx.controls.target).sub(ctx.camera.position);
    movementForward.y = 0;
  }
  movementForward.normalize();
  movementRight.crossVectors(movementForward, ctx.camera.up).normalize();

  movementDelta.set(0, 0, 0)
    .addScaledVector(movementForward, forwardInput)
    .addScaledVector(movementRight, rightInput);
  if (movementDelta.lengthSq() > 1) movementDelta.normalize();

  const targetDistance = ctx.camera.position.distanceTo(ctx.controls.target);
  const sprinting = ctx.movementKeys.has('ShiftLeft') || ctx.movementKeys.has('ShiftRight');
  const speed = resolveFreeMovementSpeed({
    targetDistance,
    cameraFov: ctx.camera.fov,
    isEditor: window.appState?.stationMode === 'editor',
    sprinting
  });
  movementDelta.multiplyScalar(speed * deltaSeconds);

  ctx.camera.position.add(movementDelta);
  ctx.controls.target.add(movementDelta);
  ctx.targetCameraPos?.copy(ctx.camera.position);
  ctx.targetCameraTarget?.copy(ctx.controls.target);
}

export function animate() {
  if (!animationEnabled) return;
  animationFrameId = requestAnimationFrame(animate);
  frameCount++;

  const elapsed = clock.getElapsedTime();
  const deltaSeconds = Math.min(Math.max(elapsed - lastElapsed, 0), 0.05);
  lastElapsed = elapsed;

  const activeStation = window.appState?.stations?.[window.appState.currentStationIndex];
  updateModelAnimations(ctx, activeStation, deltaSeconds);
  updateWeatherEffects(ctx, audioManager.getActiveSoundEffects(), deltaSeconds, elapsed, audioManager.getThunderCue());

  // Update time for environment/material animations
  ctx.revealUniforms.uTime.value = elapsed;
  if (ctx.skyMaterial && ctx.skyMaterial.uniforms && ctx.skyMaterial.uniforms.uTime) {
    ctx.skyMaterial.uniforms.uTime.value = elapsed;
  }
  if (ctx.grassObj && ctx.grassObj.material && ctx.grassObj.material.uniforms && ctx.grassObj.material.uniforms.uTime) {
    ctx.grassObj.material.uniforms.uTime.value = elapsed;
  }

  // Smoothly interpolate light parameters
  updateLighting(elapsed);

  // Update 3D images pool billboarding
  updateBillboardPlanes();

  // Smooth cursor follow and camera ray calculation
  if (ctx.isRevealMode && ctx.targetRevealActive && !ctx.targetShowAlways) {
    const targetAnchor = (ctx.isMouseOutside || !ctx.hasMouseMoved) ? ctx.portalMouseTarget : ctx.mouseTarget;
    ctx.blendedRevealTarget.copy(targetAnchor);

    if (ctx.revealUniforms.uMouseNDC.value.x > 9000) {
      ctx.revealUniforms.uMouseNDC.value.copy(ctx.blendedRevealTarget);
    } else {
      ctx.revealUniforms.uMouseNDC.value.lerp(ctx.blendedRevealTarget, ctx.targetRevealFollowsMouse ? 0.12 : 0.08);
    }

    // Always update camera position and ray direction based on current uMouseNDC
    ctx.revealUniforms.uCameraWorldPos.value.copy(ctx.camera.position);
    ctx.raycaster.setFromCamera(ctx.revealUniforms.uMouseNDC.value, ctx.camera);
    ctx.revealUniforms.uRayDirection.value.copy(ctx.raycaster.ray.direction);

    // Raycast when the reveal is active
    const revealHits = ctx.raycaster.intersectObjects(ctx.revealHitMeshes, false);
    if (revealHits.length > 0) {
      const hit = revealHits[0].point;
      ctx.revealUniforms.uRevealCenterWorld.value.copy(hit);
      ctx.revealUniforms.uRevealHasHit.value = true;
    } else {
      ctx.revealUniforms.uRevealCenterWorld.value.set(9999, 9999, 9999);
      ctx.revealUniforms.uRevealHasHit.value = false;
    }
  }

  if (window.appState && window.appState.mode === 'reveal') {
    if (window.appState.stationMode === 'scroll') {
      if (ctx.visualScrollProgress === undefined) {
        ctx.visualScrollProgress = window.appState.scrollProgress || 0;
      }

      const targetProg = window.appState.scrollProgress || 0;
      const diff = targetProg - ctx.visualScrollProgress;
      const stationIntervals = Math.max((window.appState.stations?.length || 1) - 1, 1);
      const fastJumpThreshold = Math.max(0.12, 0.75 / stationIntervals);
      const isFastStationJump = Math.abs(diff) >= fastJumpThreshold;

      if (isFastStationJump) {
        // A large wheel/trackpad impulse can cross several stations in one
        // event. Traversing every intermediate camera for a few frames makes
        // the view cut through the model and briefly appear black.
        ctx.visualScrollProgress = targetProg;
      } else if (Math.abs(diff) > 0.00001) {
        const absDiff = Math.abs(diff);
        // Adaptive catch-up: gentle for small gaps (normal scroll), aggressive for large gaps (fast scroll)
        const catchupFactor = THREE.MathUtils.lerp(0.07, 0.45, THREE.MathUtils.clamp(absDiff * 5, 0, 1));
        const catchup = diff * catchupFactor;
        const maxSpeed = THREE.MathUtils.lerp(0.006, 0.06, THREE.MathUtils.clamp(absDiff * 4, 0, 1));
        const step = Math.sign(catchup) * Math.min(Math.abs(catchup), maxSpeed);
        ctx.visualScrollProgress += step;
      } else {
        ctx.visualScrollProgress = targetProg;
      }

      if (ctx.actions.applyScrollProgress) {
        ctx.actions.applyScrollProgress(ctx.visualScrollProgress);
      }

      if (isFastStationJump) {
        ctx.actions.cancelPortalTransition?.();
        if (ctx.scrollTransitionTween) {
          ctx.scrollTransitionTween.kill();
          ctx.scrollTransitionTween = null;
        }

        const stations = window.appState.stations || [];
        const stationIndex = Math.min(
          Math.round(targetProg * stationIntervals),
          Math.max(stations.length - 1, 0)
        );
        const station = stations[stationIndex];
        if (station) {
          window.appState.setViewMode(station.viewMode);
          ctx.targetRevealRadius = station.revealRadius;
          ctx.targetRevealSoftness = station.revealSoftness;
          ctx.revealUniforms.uRevealRadius.value = station.revealRadius;
          ctx.revealUniforms.uRevealSoftness.value = station.revealSoftness;
          ctx.actions.updateStationImages?.(station.images);
          if (window.appState.currentStationIndex !== stationIndex) {
            window.appState.update({ currentStationIndex: stationIndex });
          }
        }
      }

      const activeStation = window.appState.stations?.[window.appState.currentStationIndex];
      const freeNavigationIsActive = activeStation?.freeNavigation
        && window.appState.freeNavigationActive
        && window.appState.freeNavigationStationId === activeStation.id;
      const shouldFollowScrollCamera = !freeNavigationIsActive;
      if (shouldFollowScrollCamera) {
        if (isFastStationJump) {
          ctx.camera.position.copy(ctx.targetCameraPos);
          ctx.controls.target.copy(ctx.targetCameraTarget);
        } else {
          const camDist = ctx.camera.position.distanceTo(ctx.targetCameraPos);
          const camLerp = THREE.MathUtils.lerp(0.06, 0.35, THREE.MathUtils.clamp(camDist / 12, 0, 1));
          ctx.camera.position.lerp(ctx.targetCameraPos, camLerp);
          ctx.controls.target.lerp(ctx.targetCameraTarget, camLerp);
        }
      }
      
      // Interpolate reveal parameters
      if (ctx.activePortalTransition) {
        ctx.revealUniforms.uRevealRadius.value = ctx.targetRevealRadius;
        ctx.revealUniforms.uRevealSoftness.value = ctx.targetRevealSoftness;
      } else {
        const radiusGap = Math.abs(ctx.targetRevealRadius - ctx.revealUniforms.uRevealRadius.value);
        const revealLerp = THREE.MathUtils.lerp(0.06, 0.35, THREE.MathUtils.clamp(radiusGap * 2, 0, 1));
        ctx.revealUniforms.uRevealRadius.value = THREE.MathUtils.lerp(ctx.revealUniforms.uRevealRadius.value, ctx.targetRevealRadius, revealLerp);
        ctx.revealUniforms.uRevealSoftness.value = THREE.MathUtils.lerp(ctx.revealUniforms.uRevealSoftness.value, ctx.targetRevealSoftness, revealLerp);
      }
    } else {
      // Snap visual scroll progress to state in other modes so it starts in sync when returning to scroll mode
      ctx.visualScrollProgress = window.appState.scrollProgress || 0;
    }
    
    // Smooth opacity convergence — adaptive rate to prevent model disappearance during fast scrolling
    const baseOpLerp = ctx.activePortalTransition ? 0.25 : 0.08;
    const ruinTarget = ctx.targetOpacityRuin * ctx.introModelOpacity.value;
    const reconTarget = ctx.targetOpacityRecon * ctx.introModelOpacity.value;
    const ruinGap = Math.abs(ruinTarget - ctx.revealUniforms.uOpacityRuin.value);
    const reconGap = Math.abs(reconTarget - ctx.revealUniforms.uOpacityRecon.value);
    const tintGap = Math.abs(ctx.targetPortalTint - ctx.revealUniforms.uPortalTint.value);
    const opLerpRuin = THREE.MathUtils.lerp(baseOpLerp, 0.5, THREE.MathUtils.clamp(ruinGap * 3, 0, 1));
    const opLerpRecon = THREE.MathUtils.lerp(baseOpLerp, 0.5, THREE.MathUtils.clamp(reconGap * 3, 0, 1));
    const opLerpTint = THREE.MathUtils.lerp(baseOpLerp, 0.5, THREE.MathUtils.clamp(tintGap * 3, 0, 1));
    ctx.revealUniforms.uOpacityRuin.value = THREE.MathUtils.lerp(ctx.revealUniforms.uOpacityRuin.value, ruinTarget, opLerpRuin);
    ctx.revealUniforms.uOpacityRecon.value = THREE.MathUtils.lerp(ctx.revealUniforms.uOpacityRecon.value, reconTarget, opLerpRecon);
    ctx.revealUniforms.uPortalTint.value = THREE.MathUtils.lerp(ctx.revealUniforms.uPortalTint.value, ctx.targetPortalTint, opLerpTint);
    ctx.revealUniforms.uRevealActive.value = ctx.targetRevealActive;
    ctx.revealUniforms.uShowAlways.value = ctx.targetShowAlways;
    
    // Manage model visibility
    const allowBaseModels = window.appState?.showBaseModels !== false;
    if (ctx.ruinModel) ctx.ruinModel.visible = allowBaseModels && ((ctx.revealUniforms.uOpacityRuin.value > 0.01) || ctx.targetRevealActive);
    if (ctx.reconModel) {
      ctx.reconModel.visible = allowBaseModels && (ctx.revealUniforms.uOpacityRecon.value > 0.01 || (ctx.targetRevealActive && ctx.revealUniforms.uRevealRadius.value > 0.01));
      ctx.reconModel.renderOrder = ctx.targetRevealActive ? 10 : 0;
    }
  }

  // Calculate world radius and softness dynamically from camera distance
  const distToTarget = ctx.camera.position.distanceTo(ctx.controls.target);
  const fovRad = (ctx.camera.fov * Math.PI) / 180;
  const halfFovHeight = distToTarget * Math.tan(fovRad / 2);
  ctx.revealUniforms.uWorldRadius.value = ctx.revealUniforms.uRevealRadius.value * halfFovHeight;
  ctx.revealUniforms.uWorldSoftness.value = ctx.revealUniforms.uRevealSoftness.value * halfFovHeight;

  updateKeyboardMovement(deltaSeconds);
  updateSmoothFreeNavigationZoom(deltaSeconds);
  if (!ctx.firstPerson?.active && !isFreeNavigationActiveState(window.appState)) {
    ctx.controls.update();
  }
  ctx.renderer.render(ctx.scene, ctx.camera);
}

export function stopAnimationLoop() {
  animationEnabled = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  clock.stop();
}
