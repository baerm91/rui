import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2 uLight;
uniform vec2 uTexel;
uniform vec2 uUvScale;
uniform float uHasDepth;
uniform float uStrength;
varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  return (uv - 0.5) * uUvScale + 0.5;
}

float heightAt(vec2 uv) {
  vec2 mappedUv = coverUv(clamp(uv, 0.0, 1.0));
  if (uHasDepth > 0.5) return texture2D(uDepth, mappedUv).r;
  vec3 color = texture2D(uImage, mappedUv).rgb;
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 imageUv = coverUv(vUv);
  vec3 color = texture2D(uImage, imageUv).rgb;
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  vec2 sampleStep = uTexel / max(uUvScale, vec2(0.001));
  float leftHeight = heightAt(vUv - vec2(sampleStep.x, 0.0));
  float rightHeight = heightAt(vUv + vec2(sampleStep.x, 0.0));
  float bottomHeight = heightAt(vUv - vec2(0.0, sampleStep.y));
  float topHeight = heightAt(vUv + vec2(0.0, sampleStep.y));
  float relief = uHasDepth > 0.5 ? 3.2 : 1.45;
  vec3 normal = normalize(vec3(
    (leftHeight - rightHeight) * relief,
    (bottomHeight - topHeight) * relief,
    0.075
  ));

  vec2 lightVector = uLight - vUv;
  float distanceToLight = length(lightVector);
  vec3 lightDirection = normalize(vec3(lightVector, 0.18));
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float falloff = exp(-distanceToLight * 2.8);
  float illumination = clamp((diffuse * 1.2 + 0.24) * falloff * uStrength, 0.0, 1.0);
  float glint = pow(max(dot(normal, normalize(lightDirection + vec3(0.0, 0.0, 1.0))), 0.0), 18.0);

  vec3 dark = vec3(luminance) * vec3(0.24, 0.245, 0.22);
  vec3 lit = color * (0.66 + diffuse * 0.72) + vec3(1.0, 0.78, 0.48) * glint * 0.16;
  gl_FragColor = vec4(mix(dark, lit, illumination), 1.0);
}`;

class SharedRelightEngine {
  constructor() {
    this.renderer = null;
    this.material = null;
    this.canvas = null;
    this.mount = null;
    this.owner = null;
    this.imageTexture = null;
    this.depthTexture = null;
    this.pointer = new THREE.Vector2(0.5, 0.5);
    this.targetPointer = new THREE.Vector2(0.5, 0.5);
    this.frame = 0;
    this.request = 0;
    this.resizeObserver = null;
    this.reducedMotion = false;
  }

  ensureRenderer() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'story-relight-canvas';

    const uniforms = {
      uImage: { value: null },
      uDepth: { value: null },
      uLight: { value: this.pointer },
      uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uHasDepth: { value: 0 },
      uStrength: { value: 0 }
    };
    this.material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  async attach({ mount, owner, imageUrl, depthMapUrl, pointer }) {
    this.ensureRenderer();
    this.detach();
    const request = ++this.request;
    this.mount = mount;
    this.owner = owner;
    this.pointer.set(pointer.x, 1 - pointer.y);
    this.targetPointer.copy(this.pointer);
    this.material.uniforms.uStrength.value = 0;
    mount.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      const imageTexture = await loader.loadAsync(imageUrl);
      if (request !== this.request || this.mount !== mount) {
        imageTexture.dispose();
        return;
      }
      imageTexture.colorSpace = THREE.SRGBColorSpace;
      imageTexture.minFilter = THREE.LinearFilter;
      imageTexture.magFilter = THREE.LinearFilter;
      this.imageTexture = imageTexture;
      this.material.uniforms.uImage.value = imageTexture;
      // WebGL compiles both shader branches. Binding the color texture as a
      // harmless fallback keeps the optional depth sampler initialized.
      this.material.uniforms.uDepth.value = imageTexture;
      const image = imageTexture.image;
      this.material.uniforms.uTexel.value.set(
        1 / Math.max(1, image.naturalWidth || image.width || 1024),
        1 / Math.max(1, image.naturalHeight || image.height || 1024)
      );

      if (depthMapUrl) {
        try {
          const depthTexture = await loader.loadAsync(depthMapUrl);
          if (request !== this.request || this.mount !== mount) {
            depthTexture.dispose();
            return;
          }
          depthTexture.colorSpace = THREE.NoColorSpace;
          depthTexture.minFilter = THREE.LinearFilter;
          depthTexture.magFilter = THREE.LinearFilter;
          this.depthTexture = depthTexture;
          this.material.uniforms.uDepth.value = depthTexture;
          this.material.uniforms.uHasDepth.value = 1;
        } catch (error) {
          console.warn('Depth-Map konnte nicht geladen werden; Bilddetails werden als Relief verwendet.', error);
        }
      }

      this.resize();
      owner.classList.add('is-relight-ready');
      this.animate();
    } catch (error) {
      console.warn('Relighting konnte für dieses Bild nicht gestartet werden.', error);
    }
  }

  move(mount, pointer) {
    if (mount !== this.mount) return;
    this.targetPointer.set(pointer.x, 1 - pointer.y);
    if (this.reducedMotion) this.pointer.copy(this.targetPointer);
  }

  resize() {
    if (!this.mount || !this.renderer || !this.imageTexture) return;
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.renderer.setSize(width, height, false);
    const image = this.imageTexture.image;
    const imageAspect = (image.naturalWidth || image.width || 1) / (image.naturalHeight || image.height || 1);
    const viewportAspect = width / height;
    if (viewportAspect > imageAspect) {
      this.material.uniforms.uUvScale.value.set(1, imageAspect / viewportAspect);
    } else {
      this.material.uniforms.uUvScale.value.set(viewportAspect / imageAspect, 1);
    }
  }

  animate() {
    cancelAnimationFrame(this.frame);
    const render = () => {
      if (!this.mount || !this.renderer) return;
      if (!this.reducedMotion) this.pointer.lerp(this.targetPointer, 0.14);
      this.material.uniforms.uStrength.value += (1 - this.material.uniforms.uStrength.value) * 0.09;
      this.renderer.render(this.scene, this.camera);
      this.frame = requestAnimationFrame(render);
    };
    render();
  }

  detach(requestingMount) {
    if (requestingMount && requestingMount !== this.mount) return;
    this.request += 1;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.owner?.classList.remove('is-relight-ready');
    this.canvas?.remove();
    this.imageTexture?.dispose();
    this.depthTexture?.dispose();
    this.imageTexture = null;
    this.depthTexture = null;
    if (this.material) {
      this.material.uniforms.uImage.value = null;
      this.material.uniforms.uDepth.value = null;
      this.material.uniforms.uHasDepth.value = 0;
    }
    this.mount = null;
    this.owner = null;
  }
}

let sharedEngine;

function engine() {
  if (!sharedEngine) sharedEngine = new SharedRelightEngine();
  return sharedEngine;
}

export function attachStoryRelight(options) {
  engine().attach(options);
}

export function moveStoryRelight(mount, pointer) {
  sharedEngine?.move(mount, pointer);
}

export function detachStoryRelight(mount) {
  sharedEngine?.detach(mount);
}
