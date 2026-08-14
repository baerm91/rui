// Model loading and normalization
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { siteConfig } from './site.config.js';
import { createModelAnimationController } from './three/modelAnimation.js';

const OPTIMIZED_MODEL_TEXTURES = [
  {
    source: 'https://heidentor.vercel.app/the_heidentor_in_petronell-carnuntum/textures/',
    target: '/models/heidentor-primary/textures/'
  },
  {
    source: 'https://heidentor.vercel.app/reconstruction_of_the_heidentor/textures/',
    target: '/models/heidentor-reconstruction/textures/'
  }
];

export function resolveModelAssetUrl(url) {
  let absoluteUrl;
  try {
    absoluteUrl = new URL(url, globalThis.location?.href ?? 'http://localhost/').href;
  } catch {
    return url;
  }

  const override = OPTIMIZED_MODEL_TEXTURES.find(({ source }) => absoluteUrl.startsWith(source));
  if (!override) return url;

  const fileName = absoluteUrl.slice(override.source.length).split(/[?#]/, 1)[0];
  if (!fileName || fileName.includes('/') || fileName.includes('..')) return url;
  return `${override.target}${fileName}`;
}

export function usesOptimizedModelTextures(modelConfig = {}) {
  return Object.values(modelConfig).some((url) => (
    typeof url === 'string'
    && url.startsWith('https://heidentor.vercel.app/')
  ));
}

export function getModelFormat(url) {
  try {
    const pathname = new URL(url, globalThis.location?.href ?? 'http://localhost/').pathname.toLowerCase();
    if (pathname.endsWith('.fbx')) return 'fbx';
    if (pathname.endsWith('.glb') || pathname.endsWith('.gltf')) return 'gltf';
  } catch {
    return null;
  }
  return null;
}

/**
 * Load a supported remote model with progress tracking.
 */
function loadModel(url, manager) {
  const format = getModelFormat(url);
  return new Promise((resolve, reject) => {
    const loader = format === 'fbx'
      ? new FBXLoader(manager)
      : format === 'gltf'
        ? new GLTFLoader(manager)
        : null;
    if (!loader) {
      reject(new Error(`Nicht unterst\u00fctztes 3D-Modellformat: ${url}`));
      return;
    }
    loader.load(
      url,
      (loaded) => resolve({
        scene: format === 'fbx' ? loaded : loaded.scene,
        animations: loaded.animations ?? [],
        format
      }),
      undefined,
      (error) => reject(new Error(
        `Das 3D-Modell unter ${url} konnte nicht geladen werden. Prüfen Sie die URL, die CORS-Freigabe des Modellservers und alle externen Textur- oder Begleitdateien.${error?.message ? ` (${error.message})` : ''}`
      ))
    );
  });
}

/**
 * Center and normalize a model to fit within a reasonable size
 */
export function normalizeModel(model, targetSize = 10) {
  model.updateMatrixWorld(true);
  
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) {
    throw new Error('Das 3D-Modell enthält keine darstellbare Geometrie.');
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim < 1e-6) {
    throw new Error('Das 3D-Modell hat keine gültige räumliche Ausdehnung.');
  }

  const scale = targetSize / maxDim;

  // Keep the imported root transform untouched so animation tracks targeting
  // that root cannot overwrite the normalization offset.
  const wrapper = new THREE.Group();
  const centeringGroup = new THREE.Group();
  centeringGroup.position.set(-center.x, -center.y, -center.z);
  centeringGroup.add(model);
  wrapper.add(centeringGroup);
  wrapper.scale.setScalar(scale);
  wrapper.updateMatrixWorld(true);

  // Place on ground
  const box2 = new THREE.Box3().setFromObject(wrapper);
  wrapper.position.y -= box2.min.y;

  return wrapper;
}

/**
 * Collect all mesh materials from a model
 */
function collectMaterials(model) {
  const materials = [];
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        materials.push(...child.material);
      } else {
        materials.push(child.material);
      }
    }
  });
  return materials;
}

/**
 * Inject custom shader code into all materials of a model
 * This modifies the onBeforeCompile to add reveal logic
 */
export function setupRevealMaterials(model, isReconstruction, revealUniforms) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    
    materials.forEach(mat => {
      mat.transparent = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
      
      // Store reference for uniform updates
      mat.userData.revealUniforms = revealUniforms;
      mat.userData.isReconstruction = isReconstruction;
      
      mat.customProgramCacheKey = () => {
        return (isReconstruction ? 'recon_' : 'ruin_') + (mat.name || mat.uuid);
      };
      
      mat.onBeforeCompile = (shader) => {
        // Add custom uniforms
        shader.uniforms.uMouseNDC = revealUniforms.uMouseNDC;
        shader.uniforms.uCameraWorldPos = revealUniforms.uCameraWorldPos;
        shader.uniforms.uRayDirection = revealUniforms.uRayDirection;
        shader.uniforms.uRevealCenterWorld = revealUniforms.uRevealCenterWorld;
        shader.uniforms.uRevealHasHit = revealUniforms.uRevealHasHit;
        shader.uniforms.uWorldRadius = revealUniforms.uWorldRadius;
        shader.uniforms.uWorldSoftness = revealUniforms.uWorldSoftness;
        shader.uniforms.uViewportSize = revealUniforms.uViewportSize;
        shader.uniforms.uRevealRadius = revealUniforms.uRevealRadius;
        shader.uniforms.uRevealSoftness = revealUniforms.uRevealSoftness;
        shader.uniforms.uRevealActive = revealUniforms.uRevealActive;
        shader.uniforms.uShowAlways = revealUniforms.uShowAlways;
        shader.uniforms.uLensZoom = revealUniforms.uLensZoom;
        shader.uniforms.uTime = revealUniforms.uTime;
        shader.uniforms.uOpacityRuin = revealUniforms.uOpacityRuin;
        shader.uniforms.uOpacityRecon = revealUniforms.uOpacityRecon;
        shader.uniforms.uPortalTint = revealUniforms.uPortalTint;
        
        // Pass world position and uniform data from vertex shader
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPosition;
          uniform vec2 uMouseNDC;
          uniform vec2 uViewportSize;
          uniform float uRevealRadius;
          uniform float uRevealSoftness;
          uniform float uLensZoom;
          uniform bool uRevealActive;
          uniform bool uShowAlways;`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
          
          // Magnifying lens effect in vertex shader
          if (uRevealActive && !uShowAlways && uLensZoom > 1.0) {
            vec2 aspect = vec2(uViewportSize.y > 0.001 ? uViewportSize.x / uViewportSize.y : 1.0, 1.0);
            vec2 ndcPos = gl_Position.xy / gl_Position.w;
            vec2 dir = (ndcPos - uMouseNDC) * aspect;
            float dist = length(dir);
            float radius = uRevealRadius; // screen-space radius relative to height
            
            if (dist < radius) {
              float normalizedDist = dist / radius;
              // Smooth transition to avoid tearing at the boundaries
              float t = smoothstep(0.0, 1.0, normalizedDist);
              float zoom = max(mix(uLensZoom, 1.0, t), 0.001);
              
              // Scale the NDC position relative to the mouse cursor
              vec2 newNdcPos = uMouseNDC + (ndcPos - uMouseNDC) / zoom;
              gl_Position.xy = newNdcPos * gl_Position.w;
            }
          }`
        );
        
        // Add uniforms & varying to fragment shader
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          uniform vec2 uMouseNDC;
          uniform vec3 uCameraWorldPos;
          uniform vec3 uRayDirection;
          uniform vec3 uRevealCenterWorld;
          uniform bool uRevealHasHit;
          uniform float uWorldRadius;
          uniform float uWorldSoftness;
          uniform vec2 uViewportSize;
          uniform float uRevealRadius;
          uniform float uRevealSoftness;
          uniform float uLensZoom;
          uniform bool uRevealActive;
          uniform bool uShowAlways;
          uniform float uTime;
          uniform float uOpacityRuin;
          uniform float uOpacityRecon;
          uniform float uPortalTint;
          varying vec3 vWorldPosition;`
        );
        
        // Add discard logic and transition effects at the end of fragment shader
        if (isReconstruction) {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            gl_FragColor.a = uOpacityRecon; // Set reconstruction opacity
            if (uShowAlways) {
              vec3 portalTint = vec3(1.0, 0.72, 0.32);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, portalTint, 0.26 * uPortalTint);
            } else if (uRevealActive) {
              // 3D spatial reveal with shimmer wave
              float reveal3D = 0.0;
              float dist3D = 0.0;
              float currentWorldRadius = uWorldRadius;
              float currentWorldSoftness = max(uWorldSoftness, 0.0001);
              if (uRevealHasHit) {
                dist3D = distance(vWorldPosition, uRevealCenterWorld);
                float angle3D = atan(vWorldPosition.z - uRevealCenterWorld.z, vWorldPosition.x - uRevealCenterWorld.x);
                float wave3D = 0.02 * sin(angle3D * 12.0 + uTime * 4.0);
                currentWorldRadius = uWorldRadius * (1.0 + wave3D);
                reveal3D = 1.0 - smoothstep(currentWorldRadius - currentWorldSoftness, currentWorldRadius + currentWorldSoftness, dist3D);
              }

              // 2D screen-space reveal (Lupeneffekt) with shimmer wave
              vec2 mousePixel = (uMouseNDC * 0.5 + 0.5) * uViewportSize;
              vec2 dir2D = gl_FragCoord.xy - mousePixel;
              float angle2D = atan(dir2D.y, dir2D.x);
              float wave2D = 0.015 * sin(angle2D * 16.0 + uTime * 4.5);
              float dist2D = length(dir2D);
              float radius2D = uRevealRadius * uViewportSize.y * 0.5 * (1.0 + wave2D);
              float softness2D = uRevealSoftness * uViewportSize.y * 0.5;
              float currentSoftness2D = max(softness2D, 0.001);
              float reveal2D = 1.0 - smoothstep(radius2D - currentSoftness2D, radius2D + currentSoftness2D, dist2D);

              // Combined reveal
              float finalReveal = max(reveal3D, reveal2D);

              // Edge highlight with pulsating golden glow
              float edge3D = 0.0;
              if (uRevealHasHit) {
                edge3D = smoothstep(currentWorldRadius - currentWorldSoftness * 2.0, currentWorldRadius, dist3D) * reveal3D;
              }
              float edge2D = smoothstep(radius2D - currentSoftness2D * 2.0, radius2D, dist2D) * reveal2D;
              float finalEdge = max(edge3D, edge2D);

              float pulse = 0.5 + 0.5 * sin(uTime * 3.5);
              float edgeGlow = finalEdge * (1.0 + 0.38 * pulse);

              vec3 portalTint = vec3(1.0, 0.72, 0.32);
              gl_FragColor.rgb = mix(gl_FragColor.rgb * 1.12, portalTint, 0.20 * finalReveal + 0.45 * edgeGlow);
              gl_FragColor.a *= finalReveal;
            } else {
              discard;
            }
            if (gl_FragColor.a < 0.01) discard;`
          );
        } else {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            gl_FragColor.a = uOpacityRuin; // Set ruin opacity
            if (uRevealActive) {
              // 3D spatial cutout with same shimmer wave
              float cutout3D = 0.0;
              if (uRevealHasHit) {
                float dist3D = distance(vWorldPosition, uRevealCenterWorld);
                float angle3D = atan(vWorldPosition.z - uRevealCenterWorld.z, vWorldPosition.x - uRevealCenterWorld.x);
                float wave3D = 0.02 * sin(angle3D * 12.0 + uTime * 4.0);
                float currentWorldRadius = uWorldRadius * (1.0 + wave3D);
                float currentWorldSoftness = max(uWorldSoftness, 0.0001);
                cutout3D = 1.0 - smoothstep(currentWorldRadius - currentWorldSoftness, currentWorldRadius + currentWorldSoftness, dist3D);
              }

              // 2D screen-space cutout with same shimmer wave
              vec2 mousePixel = (uMouseNDC * 0.5 + 0.5) * uViewportSize;
              vec2 dir2D = gl_FragCoord.xy - mousePixel;
              float angle2D = atan(dir2D.y, dir2D.x);
              float wave2D = 0.015 * sin(angle2D * 16.0 + uTime * 4.5);
              float dist2D = length(dir2D);
              float radius2D = uRevealRadius * uViewportSize.y * 0.5 * (1.0 + wave2D);
              float softness2D = uRevealSoftness * uViewportSize.y * 0.5;
              float currentSoftness2D = max(softness2D, 0.001);
              float cutout2D = 1.0 - smoothstep(radius2D - currentSoftness2D, radius2D + currentSoftness2D, dist2D);

              // Combined cutout
              float finalCutout = max(cutout3D, cutout2D);

              gl_FragColor.a *= 1.0 - finalCutout;
            }
            if (gl_FragColor.a < 0.01) discard;`
          );
        }
      };
    });
  });
}

/**
 * Load both models and return them
 */
export async function loadModels(scene, onProgress, modelConfig = siteConfig.models) {
  const manager = new THREE.LoadingManager();
  if (usesOptimizedModelTextures(modelConfig)) {
    manager.setURLModifier(resolveModelAssetUrl);
  }

  manager.onStart = () => {
    onProgress?.(0.03);
  };

  manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    if (itemsTotal > 0) {
      onProgress?.(itemsLoaded / itemsTotal);
    }
  };

  const [ruinAsset, reconAsset] = await Promise.all([
    loadModel(modelConfig.primary, manager),
    modelConfig.reconstruction
      ? loadModel(modelConfig.reconstruction, manager)
      : Promise.resolve(null)
  ]);

  onProgress?.(1);

  const ruinWrapper = normalizeModel(ruinAsset.scene);
  
  const reconWrapper = new THREE.Group();
  reconWrapper.name = 'Keine Rekonstruktion konfiguriert';
  if (reconAsset) {
    // Rotate reconstruction model 90 degrees around X to stand upright (Z-up to Y-up)
    reconAsset.scene.rotation.x = -Math.PI / 2;
    reconWrapper.add(normalizeModel(reconAsset.scene));
  }

  scene.add(ruinWrapper);
  scene.add(reconWrapper);

  const modelAnimations = [
    createModelAnimationController(ruinAsset.scene, ruinAsset.animations, {
      stabilizeMechanicalRotations: ruinAsset.format === 'fbx'
    }),
    reconAsset ? createModelAnimationController(reconAsset.scene, reconAsset.animations, {
      stabilizeMechanicalRotations: reconAsset.format === 'fbx'
    }) : null
  ].filter(Boolean);

  return {
    ruinModel: ruinWrapper,
    reconModel: reconWrapper,
    modelAnimations
  };
}
