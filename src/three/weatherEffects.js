import * as THREE from 'three';

const SNOW_COUNT = 2400;
const SNOW_AREA = 48;
const FLASH_OFFSET = new THREE.Vector3(0, 7, 3);

function createSnow(scene) {
  const positions = new Float32Array(SNOW_COUNT * 3);
  const speeds = new Float32Array(SNOW_COUNT);
  for (let index = 0; index < SNOW_COUNT; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * SNOW_AREA;
    positions[index * 3 + 1] = (Math.random() - 0.25) * 30;
    positions[index * 3 + 2] = (Math.random() - 0.5) * SNOW_AREA;
    speeds[index] = 1.2 + Math.random() * 2.4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xf4f8ff,
    size: 0.095,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  return { points, geometry, speeds };
}

function ensureWeather(context) {
  if (context.weatherEffects || !context.scene) return context.weatherEffects;
  const flashLight = new THREE.PointLight(0xcfe5ff, 0, 120, 1.1);
  context.scene.add(flashLight);
  context.weatherEffects = {
    snow: createSnow(context.scene),
    flashLight,
    baseExposure: context.renderer?.toneMappingExposure ?? 1.25,
    lastThunderFlashSerial: 0,
    flashStartedAt: -Infinity
  };
  return context.weatherEffects;
}

function updateSnow(state, camera, deltaSeconds, elapsed, intensity) {
  const { points, geometry, speeds } = state.snow;
  const strength = THREE.MathUtils.clamp(intensity / 100, 0, 2);
  points.visible = strength > 0;
  geometry.setDrawRange(0, Math.round(SNOW_COUNT * strength / 2));
  points.material.opacity = 0.55 + 0.27 * Math.min(strength, 1);
  if (strength <= 0 || !camera) return;
  points.position.copy(camera.position);
  const positions = geometry.attributes.position.array;
  for (let index = 0; index < SNOW_COUNT; index += 1) {
    const offset = index * 3;
    positions[offset] += (0.8 + Math.sin(elapsed * 0.7 + index) * 0.55) * deltaSeconds;
    positions[offset + 1] -= speeds[index] * deltaSeconds * (0.7 + strength * 0.3);
    if (positions[offset + 1] < -8) {
      positions[offset] = (Math.random() - 0.5) * SNOW_AREA;
      positions[offset + 1] = 22;
      positions[offset + 2] = (Math.random() - 0.5) * SNOW_AREA;
    }
    if (positions[offset] > SNOW_AREA / 2) positions[offset] = -SNOW_AREA / 2;
  }
  geometry.attributes.position.needsUpdate = true;
}

function flashStrength(elapsedSinceFlash) {
  if (elapsedSinceFlash < 0 || elapsedSinceFlash > 0.48) return 0;
  if (elapsedSinceFlash < 0.055) return 1;
  if (elapsedSinceFlash < 0.12) return 0.08;
  if (elapsedSinceFlash < 0.19) return 0.72;
  return Math.max(0, 0.55 * (1 - (elapsedSinceFlash - 0.19) / 0.29));
}

export function updateWeatherEffects(context, activeSoundIds, deltaSeconds, elapsed, thunderCue = null) {
  const snowIntensity = activeSoundIds?.get?.('builtin-snow') ?? (activeSoundIds?.has?.('builtin-snow') ? 100 : 0);
  const thunderIntensity = activeSoundIds?.get?.('builtin-thunder') ?? (activeSoundIds?.has?.('builtin-thunder') ? 100 : 0);
  const snowActive = snowIntensity > 0;
  const thunderActive = thunderIntensity > 0;
  if (!snowActive && !thunderActive && !context.weatherEffects) return;
  const state = ensureWeather(context);
  if (!state) return;

  updateSnow(state, context.camera, deltaSeconds, elapsed, snowIntensity);
  if (thunderActive && thunderCue?.serial > state.lastThunderFlashSerial) {
    state.flashStartedAt = elapsed;
    state.lastThunderFlashSerial = thunderCue.serial;
  }
  if (!thunderActive) state.lastThunderFlashSerial = 0;
  const strength = thunderActive ? flashStrength(elapsed - state.flashStartedAt) : 0;
  state.flashLight.intensity = strength * 24;
  if (context.camera) state.flashLight.position.copy(context.camera.position).add(FLASH_OFFSET);

  if (context.renderer) {
    const darkFactor = thunderActive ? 0.52 : 1;
    const darkExposure = state.baseExposure * darkFactor;
    const flashExposure = state.baseExposure * 1.85;
    const targetExposure = strength > 0 ? THREE.MathUtils.lerp(darkExposure, flashExposure, strength) : darkExposure;
    context.renderer.toneMappingExposure = THREE.MathUtils.damp(
      context.renderer.toneMappingExposure,
      targetExposure,
      strength > 0 ? 28 : 4.5,
      deltaSeconds
    );
  }
}
