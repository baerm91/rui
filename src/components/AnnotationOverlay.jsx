import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';

export function AnnotationOverlay({ activeStation, annotations: projectAnnotations = [], appState, isEditorMode, onDragAnnotation }) {
  const modelIsVisible = isEditorMode
    || (appState.mode === 'reveal' && !['idle', 'title'].includes(appState.introPhase || 'idle'));
  const annotations = useMemo(() => (
    !modelIsVisible
      ? []
      : projectAnnotations.filter((annotation) => (
        annotation.positionExplicitlySet !== false
        && (!Array.isArray(annotation.visibleStationIds) || annotation.visibleStationIds.includes(activeStation?.id))
      ))
  ), [activeStation?.id, modelIsVisible, projectAnnotations]);
  const [positions, setPositions] = useState({});
  const [activeAnnotationId, setActiveAnnotationId] = useState(null);
  const [dragAnnotationId, setDragAnnotationId] = useState(null);
  const [dragMode, setDragMode] = useState(null);
  const [dragScreenPosition, setDragScreenPosition] = useState(null);
  const [dragGuide, setDragGuide] = useState(null);
  const [navigationListOpen, setNavigationListOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState('right');
  const annotationsRef = useRef(annotations);
  const dragAnnotationIdRef = useRef(dragAnnotationId);
  const activeAnnotationIdRef = useRef(activeAnnotationId);
  const onDragAnnotationRef = useRef(onDragAnnotation);
  const isEditorModeRef = useRef(isEditorMode);
  const popoverPlacementAnnotationIdRef = useRef(null);

  annotationsRef.current = annotations;
  dragAnnotationIdRef.current = dragAnnotationId;
  activeAnnotationIdRef.current = activeAnnotationId;
  onDragAnnotationRef.current = onDragAnnotation;
  isEditorModeRef.current = isEditorMode;

  useEffect(() => {
    let frameId = 0;
    const updatePositions = () => {
      const nextPositions = {};
      const currentAnnotations = annotationsRef.current;
      const currentDragId = dragAnnotationIdRef.current;
      const currentGuideId = currentDragId || activeAnnotationIdRef.current;
      let nextGuide = null;

      currentAnnotations.forEach((annotation) => {
        const projected = window.appState?.projectWorldPoint?.(annotation.position);
        if (projected?.visible) nextPositions[annotation.id] = projected;
        if (isEditorModeRef.current && annotation.id === currentGuideId) {
          nextGuide = window.appState?.projectAnnotationGuide?.(annotation.id, annotation.position) ?? null;
        }
      });
      setPositions(nextPositions);
      setDragGuide(nextGuide);
      frameId = requestAnimationFrame(updatePositions);
    };

    updatePositions();
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!annotations.some((annotation) => annotation.id === activeAnnotationId)) {
      setActiveAnnotationId(null);
    }
  }, [annotations, activeAnnotationId]);

  useEffect(() => {
    if (!activeAnnotationId) {
      popoverPlacementAnnotationIdRef.current = null;
      return;
    }
    if (popoverPlacementAnnotationIdRef.current === activeAnnotationId) return;

    const annotation = annotationsRef.current.find((item) => item.id === activeAnnotationId);
    const projected = positions[activeAnnotationId]
      ?? window.appState?.projectWorldPoint?.(annotation?.position);
    if (!projected) return;

    setPopoverPlacement(projected.x >= window.innerWidth / 2 ? 'left' : 'right');
    popoverPlacementAnnotationIdRef.current = activeAnnotationId;
  }, [activeAnnotationId, positions]);

  useEffect(() => {
    setNavigationListOpen(false);
  }, [activeStation?.id, appState.freeNavigationActive]);

  useEffect(() => {
    const handlePlacedAnnotation = (event) => {
      const annotationId = event.detail?.annotationId;
      if (annotationId) setActiveAnnotationId(annotationId);
    };
    window.addEventListener('heidentor:annotation-placed', handlePlacedAnnotation);
    return () => window.removeEventListener('heidentor:annotation-placed', handlePlacedAnnotation);
  }, []);

  useLayoutEffect(() => {
    if (!dragAnnotationId) return undefined;
    let moveFrameId = 0;
    let latestPointer = null;

    const applyPointerPosition = (pointer) => {
      if (!pointer) return;
      setDragScreenPosition(pointer);
      const placement = window.appState?.pickAnnotationDragAt?.(pointer.x, pointer.y)
        ?? window.appState?.pickAnnotationPlacementAt?.(pointer.x, pointer.y);
      if (placement) onDragAnnotationRef.current?.(dragAnnotationId, placement);
    };

    const handlePointerMove = (event) => {
      latestPointer = { x: event.clientX, y: event.clientY };
      if (moveFrameId) return;
      moveFrameId = requestAnimationFrame(() => {
        moveFrameId = 0;
        applyPointerPosition(latestPointer);
      });
    };

    const handlePointerUp = () => {
      if (moveFrameId) {
        cancelAnimationFrame(moveFrameId);
        moveFrameId = 0;
        applyPointerPosition(latestPointer);
      }
      window.appState?.endAnnotationDrag?.();
      dragAnnotationIdRef.current = null;
      setActiveAnnotationId(dragAnnotationId);
      setDragAnnotationId(null);
      setDragMode(null);
      setDragScreenPosition(null);
      setDragGuide(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
    return () => {
      if (moveFrameId) cancelAnimationFrame(moveFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.appState?.endAnnotationDrag?.();
    };
  }, [dragAnnotationId]);

  if (annotations.length === 0) return null;

  const activeAnnotation = annotations.find((annotation) => annotation.id === activeAnnotationId);
  const activeAnnotationIndex = annotations.findIndex((annotation) => annotation.id === activeAnnotationId);
  const showAnnotationNavigation = !isEditorMode
    && appState.stationMode === 'scroll'
    && activeStation?.freeNavigation
    && activeStation.showAnnotationNavigation !== false
    && appState.freeNavigationActive
    && annotations.length > 0;

  const focusAnnotationCamera = (annotation = activeAnnotation) => {
    if (!annotation) return;
    const liveState = window.appState;
    const freeNavigationNeedsActivation = !isEditorMode
      && liveState?.stationMode === 'scroll'
      && activeStation?.freeNavigation
      && (!liveState.freeNavigationActive
        || liveState.freeNavigationStationId !== activeStation.id);

    if (freeNavigationNeedsActivation) {
      liveState.activateFreeNavigation?.();
    }
    liveState?.focusAnnotation?.(annotation);
  };

  const navigateAnnotations = (direction) => {
    const nextIndex = activeAnnotationIndex < 0
      ? (direction > 0 ? 0 : annotations.length - 1)
      : (activeAnnotationIndex + direction + annotations.length) % annotations.length;
    const nextAnnotation = annotations[nextIndex];
    if (!nextAnnotation) return;
    setNavigationListOpen(false);
    setActiveAnnotationId(nextAnnotation.id);
    focusAnnotationCamera(nextAnnotation);
  };

  const selectAnnotation = (annotation) => {
    setNavigationListOpen(false);
    setActiveAnnotationId(annotation.id);
    focusAnnotationCamera(annotation);
  };

  return (
    <div className="annotation-layer">
      {dragGuide && (
        <svg className="annotation-orientation-guide" aria-hidden="true">
          <line
            x1={dragGuide.marker.x}
            y1={dragGuide.marker.y}
            x2={dragGuide.anchor.x}
            y2={dragGuide.anchor.y}
          />
          <circle cx={dragGuide.anchor.x} cy={dragGuide.anchor.y} r="5" />
          <circle className="annotation-orientation-guide-core" cx={dragGuide.anchor.x} cy={dragGuide.anchor.y} r="2" />
        </svg>
      )}
      {annotations.map((annotation) => {
        const projected = positions[annotation.id];
        const isDragging = dragAnnotationId === annotation.id;
        const visualPosition = projected || (isDragging ? dragScreenPosition : null);
        if (!visualPosition) return null;

        return (
          <button
            key={annotation.id}
            type="button"
            className={`annotation-marker ${activeAnnotationId === annotation.id ? 'is-active' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragging && dragMode === 'height' ? 'is-height-dragging' : ''} ${isEditorMode ? 'is-editor-draggable' : ''}`}
            style={{ left: visualPosition.x, top: visualPosition.y }}
            onPointerDown={(event) => {
              if (!isEditorMode || event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              const heightOnly = event.ctrlKey
                || event.nativeEvent?.ctrlKey
                || event.getModifierState?.('Control');
              window.appState?.beginAnnotationDrag?.(
                annotation.position,
                event.clientX,
                event.clientY,
                { heightOnly }
              );
              setActiveAnnotationId(annotation.id);
              dragAnnotationIdRef.current = annotation.id;
              setDragAnnotationId(annotation.id);
              setDragMode(heightOnly ? 'height' : 'plane');
              setDragScreenPosition({ x: event.clientX, y: event.clientY });
            }}
            onLostPointerCapture={() => {
              if (dragAnnotationIdRef.current !== annotation.id) return;
              window.appState?.endAnnotationDrag?.();
              dragAnnotationIdRef.current = null;
              setActiveAnnotationId(annotation.id);
              setDragAnnotationId(null);
              setDragMode(null);
              setDragScreenPosition(null);
              setDragGuide(null);
            }}
            onClick={(event) => {
              if (dragAnnotationId) {
                event.preventDefault();
                return;
              }
              setActiveAnnotationId(annotation.id);
              focusAnnotationCamera(annotation);
            }}
            title={isEditorMode ? 'Ziehen: Position · Strg + Ziehen: Höhe' : (annotation.title || 'Annotation')}
          >
            <MapPin size={18} strokeWidth={1.8} />
          </button>
        );
      })}

      {showAnnotationNavigation && (
        <div className="annotation-navigation" role="group" aria-label="Zwischen Annotationen wechseln">
          {navigationListOpen && (
            <div
              className="annotation-navigation-list"
              data-wheel-scroll="annotation-navigation"
              role="listbox"
              aria-label="Annotation auswählen"
              onWheel={(event) => event.stopPropagation()}
            >
              {annotations.map((annotation, index) => (
                <button
                  key={`navigation-${annotation.id}`}
                  type="button"
                  role="option"
                  aria-selected={annotation.id === activeAnnotationId}
                  className={annotation.id === activeAnnotationId ? 'is-active' : ''}
                  onClick={() => selectAnnotation(annotation)}
                >
                  <span>{index + 1}</span>
                  <strong>{annotation.title || `Annotation ${index + 1}`}</strong>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => navigateAnnotations(-1)}
            aria-label="Vorherige Annotation"
            title="Vorherige Annotation"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="annotation-navigation-status"
            onClick={() => setNavigationListOpen((isOpen) => !isOpen)}
            aria-expanded={navigationListOpen}
            aria-haspopup="listbox"
            title="Alle Annotationen anzeigen"
          >
            <strong>{activeAnnotation?.title || 'Annotationen'}</strong>
            <small>{activeAnnotationIndex >= 0 ? activeAnnotationIndex + 1 : '–'} / {annotations.length}</small>
          </button>
          <button
            type="button"
            onClick={() => navigateAnnotations(1)}
            aria-label="Nächste Annotation"
            title="Nächste Annotation"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {activeAnnotation && (
        <div
          className={`annotation-popover is-${popoverPlacement}`}
          data-placement={popoverPlacement}
          role="dialog"
          aria-label={activeAnnotation.title || 'Annotation'}
        >
          <div className="annotation-popover-header">
            <div>
              <span className="annotation-kicker">{isEditorMode ? 'Editor-Annotation' : 'Fundpunkt'}</span>
              <h3>{activeAnnotation.title || 'Annotation'}</h3>
            </div>
            <button type="button" onClick={() => setActiveAnnotationId(null)} className="annotation-close" title="SchlieÃŸen">
              <X size={16} />
            </button>
          </div>

          {activeAnnotation.images?.length > 0 && (
            <div className={`annotation-images count-${Math.min(activeAnnotation.images.length, 4)}`}>
              {activeAnnotation.images.slice(0, 4).map((image, index) => (
                <img key={`${activeAnnotation.id}-image-${index}`} src={image} alt="" />
              ))}
            </div>
          )}

          {activeAnnotation.text && (
            <p className="annotation-text">{activeAnnotation.text}</p>
          )}

        </div>
      )}
    </div>
  );
}
