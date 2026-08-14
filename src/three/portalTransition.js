import * as THREE from 'three';
import gsap from 'gsap';
import { ctx } from './context.js';

export function getPortalTransitionConfig(station0 = {}, station1 = {}) {
  const portalStation = station1?.viewMode === 'portal' ? station1 : station0;
  const revealStation = station1?.viewMode === 'reveal' ? station1 : station0;

  return {
    portalRadius: portalStation.portalRadius ?? revealStation.portalRadius ?? 3.2,
    portalSoftness: portalStation.portalSoftness ?? revealStation.portalSoftness ?? 0.2,
    duration: portalStation.portalTransitionDuration ?? revealStation.portalTransitionDuration ?? 2.8,
    mouseStart: revealStation.portalMouseStart ?? portalStation.portalMouseStart ?? 0.2,
    ruinFadeEnd: portalStation.portalRuinFadeEnd ?? revealStation.portalRuinFadeEnd ?? 0.22,
    revealRuinFadeStart: revealStation.portalRevealRuinFadeStart ?? portalStation.portalRevealRuinFadeStart ?? 0.18,
    revealRuinFadeEnd: revealStation.portalRevealRuinFadeEnd ?? portalStation.portalRevealRuinFadeEnd ?? 0.85,
    reconFadeStart: portalStation.portalReconFadeStart ?? revealStation.portalReconFadeStart ?? 0.08,
    reconFadeEnd: portalStation.portalReconFadeEnd ?? revealStation.portalReconFadeEnd ?? 0.46
  };
}

export function computeTransitionState(mode0, mode1, r0, s0, r1, s1, t, transitionConfig = {}) {
  let opacityRuin = 1.0;
  let opacityRecon = 0.0;
  let portalTint = 0.0;
  let revealActive = false;
  let showAlways = false;
  let revealRadius = 0.0;
  let revealSoftness = 0.0;
  let followsMouse = false;
  let mouseBlend = 0;

  const portalRadius0 = transitionConfig.portalRadius ?? 3.2;
  const portalRadius1 = transitionConfig.portalRadius ?? 3.2;
  const portalSoftness0 = transitionConfig.portalSoftness ?? 0.2;
  const portalSoftness1 = transitionConfig.portalSoftness ?? 0.2;

  if (mode0 === 'ruin' && mode1 === 'ruin') {
    opacityRuin = 1.0;
    opacityRecon = 0.0;
    portalTint = 0.0;
    revealActive = false;
    showAlways = true;
    revealRadius = 0.0;
    revealSoftness = 0.0;
  } else if (mode0 === 'recon' && mode1 === 'recon') {
    opacityRuin = 0.0;
    opacityRecon = 1.0;
    portalTint = 0.0;
    revealActive = false;
    showAlways = true;
    revealRadius = 0.0;
    revealSoftness = 0.0;
  } else if (mode0 === 'portal' && mode1 === 'portal') {
    opacityRuin = 0.0;
    opacityRecon = 1.0;
    portalTint = 1.0;
    revealActive = false;
    showAlways = true;
    followsMouse = false;
    mouseBlend = 0;
    revealRadius = 0.0;
    revealSoftness = 0.0;
  } else if (mode0 === 'reveal' && mode1 === 'reveal') {
    opacityRuin = 1.0;
    opacityRecon = 1.0;
    portalTint = 1.0;
    revealActive = true;
    showAlways = false;
    followsMouse = true;
    mouseBlend = 1;
    revealRadius = THREE.MathUtils.lerp(r0, r1, t);
    revealSoftness = THREE.MathUtils.lerp(s0, s1, t);
  } else if (mode0 === 'portal' && mode1 === 'reveal') {
    const mouseStart = transitionConfig.mouseStart ?? 0.2;

    opacityRuin = 1.0;
    opacityRecon = 1.0;
    portalTint = 1.0;
    revealActive = true;
    showAlways = false;
    mouseBlend = THREE.MathUtils.smoothstep(t, mouseStart, 1.0);
    followsMouse = mouseBlend > 0.95;
    revealRadius = THREE.MathUtils.lerp(portalRadius0, r1, t);
    revealSoftness = THREE.MathUtils.lerp(portalSoftness0, s1, t);
  } else if (mode0 === 'reveal' && mode1 === 'portal') {
    const mouseEnd = transitionConfig.mouseStart ?? 0.2;

    opacityRuin = t >= 0.999 ? 0.0 : 1.0;
    opacityRecon = 1.0;
    portalTint = 1.0;
    revealActive = t < 0.999;
    showAlways = t >= 0.999;
    mouseBlend = 1.0 - THREE.MathUtils.smoothstep(t, 0.0, mouseEnd);
    followsMouse = mouseBlend > 0.95;
    revealRadius = THREE.MathUtils.lerp(r0, portalRadius1, t);
    revealSoftness = THREE.MathUtils.lerp(s0, portalSoftness1, t);
  } else if ((mode0 === 'ruin' && mode1 === 'portal') || (mode0 === 'portal' && mode1 === 'ruin')) {
    revealActive = false;
    showAlways = true;
    const portalT = mode0 === 'ruin' ? t : 1.0 - t;
    opacityRuin = mode0 === 'ruin'
      ? 1.0 - THREE.MathUtils.smoothstep(t, 0.0, transitionConfig.ruinFadeEnd ?? 0.22)
      : THREE.MathUtils.smoothstep(t, 1.0 - (transitionConfig.ruinFadeEnd ?? 0.22), 1.0);
    opacityRecon = THREE.MathUtils.smoothstep(portalT, transitionConfig.reconFadeStart ?? 0.08, transitionConfig.reconFadeEnd ?? 0.46);
    portalTint = THREE.MathUtils.smoothstep(portalT, transitionConfig.reconFadeStart ?? 0.08, transitionConfig.reconFadeEnd ?? 0.46);
    followsMouse = false;
    mouseBlend = 0;
    revealRadius = 0.0;
    revealSoftness = 0.0;
  } else if ((mode0 === 'recon' && mode1 === 'portal') || (mode0 === 'portal' && mode1 === 'recon')) {
    const portalT = mode0 === 'recon' ? t : 1.0 - t;

    revealActive = false;
    showAlways = true;
    opacityRuin = 0.0;
    opacityRecon = 1.0;
    portalTint = mode0 === 'recon' ? t : 1.0 - t;
    followsMouse = false;
    mouseBlend = 0;
    revealRadius = 0.0;
    revealSoftness = 0.0;
  } else if ((mode0 === 'ruin' && mode1 === 'recon') || (mode0 === 'recon' && mode1 === 'ruin')) {
    revealActive = false;
    showAlways = true;
    revealRadius = 0.0;
    revealSoftness = 0.0;
    if (mode0 === 'ruin') {
      opacityRuin = 1.0 - t;
      opacityRecon = t;
      portalTint = 0.0;
    } else {
      opacityRuin = t;
      opacityRecon = 1.0 - t;
      portalTint = 0.0;
    }
  } else if ((mode0 === 'ruin' && mode1 === 'reveal') || (mode0 === 'reveal' && mode1 === 'ruin')) {
    opacityRuin = 1.0;
    if (mode0 === 'ruin') {
      revealActive = true;
      showAlways = false;
      opacityRecon = 1.0;
      portalTint = 1.0;
      followsMouse = true;
      mouseBlend = 1;
      revealRadius = THREE.MathUtils.lerp(0.0, r1, t);
      revealSoftness = THREE.MathUtils.lerp(0.0, s1, t);
    } else {
      revealActive = false;
      showAlways = true;
      opacityRecon = 1.0 - t;
      portalTint = 1.0 - t;
      followsMouse = false;
      mouseBlend = 0;
      revealRadius = 0.0;
      revealSoftness = 0.0;
    }
  } else if (mode0 === 'recon' && mode1 === 'reveal') {
    const revealStart = 0.82;
    const revealT = THREE.MathUtils.smoothstep(t, revealStart, 1.0);

    // Keep the reconstruction fully renderable until the ruin has faded in.
    // Otherwise the reveal shader has no mouse hit yet and both models can disappear.
    revealActive = revealT > 0.0;
    showAlways = revealT < 1.0;
    opacityRuin = THREE.MathUtils.smoothstep(t, 0.0, revealStart);
    opacityRecon = 1.0;
    portalTint = 1.0;
    followsMouse = revealT >= 1.0;
    mouseBlend = revealT;
    revealRadius = THREE.MathUtils.lerp(3.0, r1, revealT);
    revealSoftness = THREE.MathUtils.lerp(0.1, s1, revealT);
  } else if (mode0 === 'reveal' && mode1 === 'recon') {
    const revealEnd = 0.18;
    const revealT = 1.0 - THREE.MathUtils.smoothstep(t, 0.0, revealEnd);

    revealActive = revealT > 0.0;
    showAlways = revealT <= 0.0;
    opacityRuin = 1.0 - THREE.MathUtils.smoothstep(t, revealEnd, 1.0);
    opacityRecon = 1.0;
    portalTint = 1.0;
    followsMouse = revealT > 0.0;
    mouseBlend = revealT;
    revealRadius = THREE.MathUtils.lerp(3.0, r0, revealT);
    revealSoftness = THREE.MathUtils.lerp(0.1, s0, revealT);
  }

  return {
    opacityRuin,
    opacityRecon,
    portalTint,
    revealActive,
    showAlways,
    followsMouse,
    mouseBlend,
    revealRadius,
    revealSoftness
  };
}

export function isPortalRevealTransition(mode0, mode1) {
  return (mode0 === 'portal' && mode1 === 'reveal') || (mode0 === 'reveal' && mode1 === 'portal');
}

export function applyTransitionState(state) {
  ctx.targetOpacityRuin = state.opacityRuin;
  ctx.targetOpacityRecon = state.opacityRecon;
  ctx.targetPortalTint = state.portalTint;
  ctx.targetRevealActive = state.revealActive;
  ctx.targetShowAlways = state.showAlways;
  ctx.targetRevealFollowsMouse = state.followsMouse;
  ctx.targetRevealMouseBlend = state.mouseBlend;
  ctx.targetRevealRadius = state.revealRadius;
  ctx.targetRevealSoftness = state.revealSoftness;

  if (state.revealActive && !state.followsMouse && state.revealRadius > ctx.revealUniforms.uRevealRadius.value) {
    ctx.revealUniforms.uMouseNDC.value.copy(ctx.portalMouseTarget);
    ctx.revealUniforms.uRevealRadius.value = state.revealRadius;
    ctx.revealUniforms.uRevealSoftness.value = state.revealSoftness;
    ctx.revealUniforms.uRevealCenterWorld.value.set(9999, 9999, 9999);
    ctx.revealUniforms.uRevealHasHit.value = false;
  }

  if (state.showAlways && state.opacityRuin <= 0.001 && state.opacityRecon >= 0.999) {
    ctx.revealUniforms.uOpacityRuin.value = 0.0;
    ctx.revealUniforms.uOpacityRecon.value = 1.0;
    ctx.revealUniforms.uPortalTint.value = state.portalTint;
  }
}

export function startPortalTransition(mode0, mode1, r0, s0, r1, s1, targetProgress, transitionConfig = {}) {
  const target = THREE.MathUtils.clamp(targetProgress, 0, 1);
  const sameTransition =
    ctx.activePortalTransition &&
    ctx.activePortalTransition.mode0 === mode0 &&
    ctx.activePortalTransition.mode1 === mode1 &&
    ctx.activePortalTransition.target === target;

  if (sameTransition) return;
  if (!ctx.activePortalTransition && Math.abs(ctx.portalTransitionProgress.value - target) < 0.001) return;

  if (ctx.portalTransitionTween) {
    ctx.portalTransitionTween.kill();
  }

  ctx.activePortalTransition = { mode0, mode1, r0, s0, r1, s1, target };
  const distance = Math.abs(target - ctx.portalTransitionProgress.value);

  // Immediately apply the initial state
  applyTransitionState(computeTransitionState(mode0, mode1, r0, s0, r1, s1, ctx.portalTransitionProgress.value, transitionConfig));

  ctx.portalTransitionTween = gsap.to(ctx.portalTransitionProgress, {
    value: target,
    duration: Math.max(1.5, (transitionConfig.duration ?? 2.8) * distance),
    ease: 'sine.inOut',
    onUpdate: () => {
      applyTransitionState(computeTransitionState(mode0, mode1, r0, s0, r1, s1, ctx.portalTransitionProgress.value, transitionConfig));
    },
    onComplete: () => {
      applyTransitionState(computeTransitionState(mode0, mode1, r0, s0, r1, s1, target, transitionConfig));
      ctx.activePortalTransition = null;
      ctx.portalTransitionTween = null;
    }
  });
}

export function cancelPortalTransition() {
  if (ctx.portalTransitionTween) {
    ctx.portalTransitionTween.kill();
    ctx.portalTransitionTween = null;
  }
  ctx.activePortalTransition = null;
}

export function configureReconstructionDepth(useSceneDepth) {
  if (!ctx.reconModel) return;
  ctx.reconModel.renderOrder = useSceneDepth ? 0 : 10;
  ctx.reconModel.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      mat.depthTest = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    });
  });
}
