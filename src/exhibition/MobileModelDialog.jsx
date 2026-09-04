import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SpatialObjectDetails } from './SpatialObjectDetails.jsx';
import './mobileModelDialog.css';

export const MOBILE_MODEL_QUERY = '(max-width: 720px), (pointer: coarse) and (max-width: 1100px)';

export function useMobileModelView() {
  const [mobile, setMobile] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(MOBILE_MODEL_QUERY).matches);
  useEffect(() => {
    const query = matchMedia(MOBILE_MODEL_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

const disposeModel = (object) => object?.traverse((child) => {
  child.geometry?.dispose();
  for (const material of [child.material].flat().filter(Boolean)) {
    for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
    material.dispose();
  }
});

export function MobileGltfModel({ item, onInteractionChange }) {
  const interactionRef = useRef(onInteractionChange);
  interactionRef.current = onInteractionChange;
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let disposed = false;
    let frame;
    let model;
    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, .01, 100);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const environmentScene = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    const environment = generator.fromScene(environmentScene, .04);
    environmentScene.dispose();
    generator.dispose();
    scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8275, 2));
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    const interactionStart = () => interactionRef.current?.(true);
    const interactionEnd = () => interactionRef.current?.(false);
    controls.addEventListener('start', interactionStart);
    controls.addEventListener('end', interactionEnd);
    controls.minDistance = .8;
    controls.maxDistance = 12;
    const fitCamera = () => {
      const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const halfFov = Math.min(verticalHalfFov, Math.atan(Math.tan(verticalHalfFov) * camera.aspect));
      // The normalized model fits in a sphere of radius one in any orientation.
      const distance = 1.15 / Math.sin(halfFov);
      const direction = camera.position.clone().sub(controls.target).normalize();
      if (!direction.lengthSq()) direction.set(0, 0, 1);
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.update();
    };
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
      camera.aspect = Math.max(width, 1) / Math.max(height, 1);
      camera.updateProjectionMatrix();
      fitCamera();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const manager = new THREE.LoadingManager();
    const draco = new DRACOLoader(manager).setDecoderPath('/three-codecs/draco/');
    const ktx2 = new KTX2Loader(manager).setTranscoderPath('/three-codecs/basis/').detectSupport(renderer);
    const loader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    loader.load(item.modelUrl, (gltf) => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = new THREE.Group();
      model.add(gltf.scene);
      model.rotation.fromArray(item.modelTransform?.rotation || [0, 0, 0]);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const scale = 2 / Math.max(bounds.getSize(new THREE.Vector3()).length(), .001);
      model.scale.multiplyScalar(scale);
      model.updateMatrixWorld(true);
      model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
      scene.add(model);
      fitCamera();
      setStatus('ready');
    }, undefined, (error) => {
      if (disposed) return;
      console.error('Mobiles 3D-Modell konnte nicht geladen werden:', error);
      setStatus('error');
    });
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      controls.removeEventListener('start', interactionStart);
      controls.removeEventListener('end', interactionEnd);
      disposeModel(model);
      environment.dispose();
      renderer.dispose();
      draco.dispose();
      ktx2.dispose();
    };
  }, [item.modelUrl, item.modelTransform?.rotation]);

  return <><canvas ref={canvasRef} className="mobile-model-canvas" aria-label={`${item.title} drehen und zoomen`} />
    {status !== 'ready' && <div className="mobile-model-status" role={status === 'error' ? 'alert' : 'status'}>{status === 'error' ? 'Das Modell konnte nicht geladen werden. Bitte schließen Sie es und versuchen Sie es erneut.' : '3D-Modell wird geladen …'}</div>}
  </>;
}

export function MobileModelDialog({ item, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<dialog ref={dialogRef} className="mobile-model-dialog" aria-labelledby="mobile-model-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="mobile-model-header"><h2 id="mobile-model-title">{item.title}</h2><button type="button" onClick={onClose} aria-label="Modell schließen" autoFocus><X size={25} aria-hidden="true" /></button></header>
    <div className="mobile-model-stage">{item.sourceType === 'gltf' ? <MobileGltfModel key={item.id} item={item} /> : children}</div>
    <SpatialObjectDetails item={item} className="mobile-model-details" showTitle={false} />
    <p className="mobile-model-hint">Mit einem Finger drehen · Mit zwei Fingern zoomen</p>
  </dialog>, document.body);
}
