import React, { useEffect, useRef, useState } from 'react';
import { getSketchfabModelUid } from '../utils/modelSource.js';
import { getSketchfabCamera, getSketchfabScreenshot, loadSketchfabViewerApi, positionKey, setSketchfabCamera, shouldSketchfabCapturePointer, SKETCHFAB_VIEWER_VERSION, vectorToObject } from '../utils/sketchfabViewerApi.js';
import { interpolateStationCameras } from '../utils/cameraInterpolation.js';

export function SketchfabViewer({
  modelUrl,
  title,
  activeStation,
  annotations = [],
  stations = [],
  scrollProgress = 0,
  stationMode = 'scroll',
  freeNavigationIsActive = false
}) {
  const iframeRef = useRef(null);
  const apiRef = useRef(null);
  const annotationsRef = useRef(annotations);
  const projectionCacheRef = useRef(new Map());
  const placementCallbackRef = useRef(null);
  const scrollCameraFrameRef = useRef(0);
  const pendingScrollCameraRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [isPlacing, setIsPlacing] = useState(false);
  const uid = getSketchfabModelUid(modelUrl);
  annotationsRef.current = annotations;

  useEffect(() => {
    if (!uid || !iframeRef.current || !window.appState) return undefined;
    setStatus('loading');
    let disposed = false;
    let projectionFrame = 0;
    let projectionUpdateInFlight = false;
    const bridge = window.appState;
    const originalMethods = {};
    const replace = (name, method) => { originalMethods[name] = bridge[name]; bridge[name] = method; };
    const fail = (error) => {
      console.error('Sketchfab Viewer:', error);
      if (!disposed) { setStatus('error'); bridge.update?.({ externalViewerStatus: 'error' }); }
    };

    loadSketchfabViewerApi().then((Sketchfab) => {
      if (disposed) return;
      const client = new Sketchfab(SKETCHFAB_VIEWER_VERSION, iframeRef.current);
      client.init(uid, {
        autostart: 1, camera: 0, dnt: 1, ui_hint: 0, ui_infos: 0, ui_stop: 0,
        success(api) {
          if (disposed) return;
          apiRef.current = api;
          api.start();
          api.addEventListener('viewerready', () => {
            if (disposed) return;
            setStatus('ready');
            bridge.update?.({ externalViewerStatus: 'ready' });
            replace('captureCamera', () => getSketchfabCamera(api));
            replace('captureAnnotationContext', async () => {
              const camera = await getSketchfabCamera(api);
              return { ...camera, position: camera.cameraTarget };
            });
            replace('flyToStation', (station) => station?.cameraExplicitlySet ? setSketchfabCamera(api, station, 1.2) : Promise.resolve());
            replace('snapToStation', (station) => station?.cameraExplicitlySet ? setSketchfabCamera(api, station, 0) : Promise.resolve());
            replace('resetFreeView', () => {
              const station = bridge.stations?.[bridge.currentStationIndex];
              return station?.freeNavigation && station?.cameraExplicitlySet
                ? setSketchfabCamera(api, station, 0.85)
                : Promise.resolve();
            });
            replace('focusAnnotation', async (annotation) => {
              if (!annotation?.position) return;
              const current = await getSketchfabCamera(api);
              return setSketchfabCamera(api, {
                cameraPos: annotation.cameraExplicitlySet ? annotation.cameraPos : current.cameraPos,
                cameraTarget: annotation.cameraExplicitlySet ? annotation.cameraTarget : annotation.position
              }, 1.2);
            });
            replace('startAnnotationPlacement', (callback) => {
              placementCallbackRef.current = callback;
              setIsPlacing(true);
              document.body.classList.toggle('annotation-placement-mode', typeof callback === 'function');
            });
            replace('cancelAnnotationPlacement', () => {
              placementCallbackRef.current = null;
              setIsPlacing(false);
              document.body.classList.remove('annotation-placement-mode');
            });
            replace('projectWorldPoint', (position) => projectionCacheRef.current.get(positionKey(position)) || null);
            replace('captureThumbnail', () => getSketchfabScreenshot(api, Math.max(960, window.innerWidth), Math.max(540, window.innerHeight)));
            api.addEventListener('click', async (event) => {
              const callback = placementCallbackRef.current;
              if (!callback || !event?.position3D) return;
              placementCallbackRef.current = null;
              setIsPlacing(false);
              document.body.classList.remove('annotation-placement-mode');
              const camera = await getSketchfabCamera(api);
              callback({ ...camera, position: vectorToObject(event.position3D) });
            }, { pick: 'slow' });

            const updateProjections = () => {
              if (disposed || projectionUpdateInFlight) return;
              const rect = iframeRef.current?.getBoundingClientRect();
              const current = annotationsRef.current.filter((annotation) => annotation?.positionExplicitlySet !== false);
              if (!rect || !current.length) { projectionCacheRef.current = new Map(); return; }
              projectionUpdateInFlight = true;
              const next = new Map();
              let pending = current.length;
              current.forEach((annotation) => api.getWorldToScreenCoordinates([
                Number(annotation.position?.x) || 0,
                Number(annotation.position?.y) || 0,
                Number(annotation.position?.z) || 0
              ], (...result) => {
                const [error, coordinates] = result.length > 1 ? result : [null, result[0]];
                if (!error && coordinates?.canvasCoord) {
                  const [x, y] = coordinates.canvasCoord;
                  if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
                    next.set(positionKey(annotation.position), { x: rect.left + x, y: rect.top + y, visible: true });
                  }
                }
                pending -= 1;
                if (!pending) {
                  if (!disposed) projectionCacheRef.current = next;
                  projectionUpdateInFlight = false;
                }
              }));
            };
            const projectNextFrame = () => {
              if (disposed) return;
              updateProjections();
              projectionFrame = window.requestAnimationFrame(projectNextFrame);
            };
            projectNextFrame();
          });
        },
        error: fail
      });
    }).catch(fail);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(projectionFrame);
      window.cancelAnimationFrame(scrollCameraFrameRef.current);
      placementCallbackRef.current = null;
      document.body.classList.remove('annotation-placement-mode');
      apiRef.current = null;
      Object.entries(originalMethods).forEach(([name, method]) => { bridge[name] = method; });
      bridge.update?.({ externalViewerStatus: null });
    };
  }, [uid]);

  useEffect(() => {
    if (stationMode === 'scroll' || status !== 'ready' || !activeStation?.cameraExplicitlySet || !apiRef.current) return;
    setSketchfabCamera(apiRef.current, activeStation, 1.2).catch((error) => console.error('Sketchfab camera:', error));
  }, [activeStation?.id, activeStation?.cameraExplicitlySet, stationMode, status]);

  useEffect(() => {
    if (stationMode !== 'scroll' || status !== 'ready' || !apiRef.current) return undefined;
    if (freeNavigationIsActive) {
      pendingScrollCameraRef.current = null;
      window.cancelAnimationFrame(scrollCameraFrameRef.current);
      scrollCameraFrameRef.current = 0;
      return undefined;
    }
    pendingScrollCameraRef.current = interpolateStationCameras(stations, scrollProgress);
    if (!pendingScrollCameraRef.current || scrollCameraFrameRef.current) return undefined;

    scrollCameraFrameRef.current = window.requestAnimationFrame(() => {
      scrollCameraFrameRef.current = 0;
      const camera = pendingScrollCameraRef.current;
      pendingScrollCameraRef.current = null;
      if (!camera || !apiRef.current) return;
      setSketchfabCamera(apiRef.current, camera, 0)
        .catch((error) => console.error('Sketchfab scroll camera:', error));
    });

    return undefined;
  }, [freeNavigationIsActive, scrollProgress, stationMode, stations, status]);

  if (!uid) return null;
  const capturesPointer = shouldSketchfabCapturePointer(stationMode, isPlacing, freeNavigationIsActive);
  return <div
    className={`sketchfab-viewer ${capturesPointer ? 'is-interactive' : 'is-timeline-controlled'}`}
    data-testid="sketchfab-viewer"
  >
    <iframe ref={iframeRef} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen title={`Sketchfab-Modell: ${title || '3D-Modell'}`} />
    {status === 'loading' && <div className="sketchfab-viewer-status">Sketchfab-Modell wird geladen …</div>}
    {status === 'error' && <div className="sketchfab-viewer-status is-error">Sketchfab-Modell konnte nicht geladen werden.</div>}
    {isPlacing && <div className="sketchfab-placement-hint">Gewünschten Punkt direkt im Modell anklicken</div>}
  </div>;
}
