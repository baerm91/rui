import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, ChevronRight, ChevronUp, GripVertical, MapPin, Plus, Trash2 } from 'lucide-react';

export function ProjectAnnotationPanel({
  annotations = [],
  stations = [],
  placingAnnotationId,
  onAddAnnotation,
  onDeleteAnnotation,
  onMoveAnnotation,
  onUpdateAnnotation,
  onCaptureAnnotation,
  onPlaceAnnotationInScene,
  onUploadAnnotationImages,
  embedded = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState(annotations[0]?.id ?? null);
  const previousAnnotationCount = useRef(annotations.length);
  const isAddingAnnotation = useRef(false);
  const [draggedAnnotationIndex, setDraggedAnnotationIndex] = useState(null);
  const [annotationDropIndex, setAnnotationDropIndex] = useState(null);
  const annotationDropIndexRef = useRef(null);
  const annotationPointerDrag = useRef(null);
  const suppressAnnotationClick = useRef(false);

  const toggleAnnotationAtStation = (annotation, stationId) => {
    const stationIds = stations.map((station) => station.id);
    const currentlyVisible = !Array.isArray(annotation.visibleStationIds)
      || annotation.visibleStationIds.includes(stationId);
    const currentVisibility = Array.isArray(annotation.visibleStationIds)
      ? annotation.visibleStationIds.filter((id) => stationIds.includes(id))
      : stationIds;
    const nextVisibility = currentlyVisible
      ? currentVisibility.filter((id) => id !== stationId)
      : [...new Set([...currentVisibility, stationId])];
    onUpdateAnnotation(annotation.id, 'visibleStationIds', nextVisibility);
  };

  const resetAnnotationDrag = () => {
    annotationPointerDrag.current?.cleanup?.();
    setDraggedAnnotationIndex(null);
    setAnnotationDropIndex(null);
    annotationDropIndexRef.current = null;
    annotationPointerDrag.current = null;
    document.body.classList.remove('annotation-list-dragging-mode');
  };

  const updateAnnotationDropIndex = (clientY, list) => {
    const cards = [...list.querySelectorAll('[data-annotation-card]')];
    const nextDropIndex = cards.findIndex((card) => (
      clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2
    ));
    const resolvedDropIndex = nextDropIndex < 0 ? cards.length : nextDropIndex;
    annotationDropIndexRef.current = resolvedDropIndex;
    setAnnotationDropIndex(resolvedDropIndex);
  };

  const startAnnotationPointerDrag = (event, sourceIndex) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || event.target.closest('[role="group"]')) return;

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const list = event.currentTarget.parentElement;
    let dragging = false;

    const handlePointerMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!dragging) {
        const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (distance < 6) return;
        dragging = true;
        suppressAnnotationClick.current = true;
        setDraggedAnnotationIndex(sourceIndex);
        document.body.classList.add('annotation-list-dragging-mode');
      }

      moveEvent.preventDefault();
      const listBounds = list.getBoundingClientRect();
      if (moveEvent.clientY < listBounds.top + 32) list.scrollTop -= 18;
      if (moveEvent.clientY > listBounds.bottom - 32) list.scrollTop += 18;
      updateAnnotationDropIndex(moveEvent.clientY, list);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };

    const handlePointerEnd = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      cleanup();
      if (dragging && annotationDropIndexRef.current !== null) {
        const targetIndex = annotationDropIndexRef.current > sourceIndex
          ? annotationDropIndexRef.current - 1
          : annotationDropIndexRef.current;
        if (targetIndex !== sourceIndex) onMoveAnnotation?.(sourceIndex, targetIndex);
      }
      resetAnnotationDrag();
      window.setTimeout(() => {
        suppressAnnotationClick.current = false;
      }, 0);
    };

    annotationPointerDrag.current = { cleanup };
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  };

  useEffect(() => {
    const activeStillExists = annotations.some((annotation) => annotation.id === activeAnnotationId);
    if (!activeStillExists) setActiveAnnotationId(annotations[0]?.id ?? null);

    if (annotations.length > previousAnnotationCount.current && isAddingAnnotation.current) {
      setActiveAnnotationId(annotations.at(-1)?.id ?? null);
      setIsOpen(true);
    }
    isAddingAnnotation.current = false;
    previousAnnotationCount.current = annotations.length;
  }, [annotations, activeAnnotationId]);

  useEffect(() => {
    if (!placingAnnotationId) return;
    setActiveAnnotationId(placingAnnotationId);
    setIsOpen(true);
  }, [placingAnnotationId]);

  useEffect(() => () => annotationPointerDrag.current?.cleanup?.(), []);

  return (
    <div className={embedded ? 'overflow-hidden' : 'mx-5 mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/35 overflow-hidden shrink-0'}>
      {!embedded && <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <MapPin size={14} className="text-amber-400" />
          <span>
            <span className="block text-xs font-semibold text-zinc-200">Projekt-Annotationen</span>
            <span className="block text-[9px] text-zinc-500">Unabhängig von Stationen · {annotations.length} Punkt(e)</span>
          </span>
        </span>
        {isOpen ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
      </button>}

      {(embedded || isOpen) && (
        <div
          data-wheel-scroll="annotations"
          onWheel={(event) => event.stopPropagation()}
          className={`max-h-[48vh] overflow-y-auto overscroll-contain p-3 flex flex-col gap-2 ${embedded ? '' : 'border-t border-zinc-800'}`}
        >
          {annotations.length > 0 && stations.length > 0 && (
            <div className="mb-2 shrink-0 overflow-hidden rounded-xl border border-zinc-700/90 bg-zinc-950/75 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <div className="border-b border-zinc-700/80 bg-zinc-900/55 px-3 py-2.5">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-200">Sichtbarkeit je Station</span>
                <span className="mt-0.5 block text-[8px] text-zinc-500">Annotationen links · Stationen oben</span>
              </div>
              <div className="overflow-x-auto overscroll-x-contain pb-1 scrollbar-thin">
                <table className="w-full min-w-max border-collapse text-[9px]">
                  <thead>
                    <tr className="border-b border-zinc-700/80 bg-zinc-900/80">
                      <th className="sticky left-0 z-20 w-36 min-w-36 max-w-36 bg-zinc-900 px-3 py-2.5 text-left font-semibold text-zinc-400 shadow-[5px_0_12px_rgba(0,0,0,0.2)]">Annotation</th>
                      {stations.map((station, stationIndex) => (
                        <th key={station.id} className="w-[4.5rem] min-w-[4.5rem] px-1.5 py-2.5 text-center font-semibold text-zinc-300" title={station.title}>
                          <span className="block text-[8px] font-bold uppercase text-amber-300">S{stationIndex + 1}</span>
                          <span className="mx-auto mt-0.5 block max-w-16 truncate text-[8px] text-zinc-400">{station.title}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {annotations.map((annotation, annotationIndex) => (
                      <tr key={`visibility-${annotation.id}`} className="h-11 border-b border-zinc-800 last:border-b-0 hover:bg-white/[0.025]">
                        <th className="sticky left-0 z-10 w-36 min-w-36 max-w-36 bg-zinc-950 px-3 py-2.5 text-left font-medium text-zinc-200 shadow-[5px_0_12px_rgba(0,0,0,0.2)]" title={annotation.title}>
                          <span className="block truncate">{annotation.title?.trim() || `Annotation ${annotationIndex + 1}`}</span>
                        </th>
                        {stations.map((station) => {
                          const isVisible = !Array.isArray(annotation.visibleStationIds)
                            || annotation.visibleStationIds.includes(station.id);
                          return (
                            <td key={`${annotation.id}-${station.id}`} className="px-1.5 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleAnnotationAtStation(annotation, station.id)}
                                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md border transition-all ${isVisible ? 'border-amber-300/60 bg-amber-400/20 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.12)]' : 'border-zinc-700 bg-zinc-900 text-transparent hover:border-zinc-500'}`}
                                aria-pressed={isVisible}
                                aria-label={`${annotation.title || `Annotation ${annotationIndex + 1}`} in ${station.title} ${isVisible ? 'ausblenden' : 'anzeigen'}`}
                                title={isVisible ? 'In dieser Station sichtbar' : 'In dieser Station ausgeblendet'}
                              >
                                <Check size={12} strokeWidth={2.5} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {annotations.map((annotation, annotationIndex) => {
            const isActive = annotation.id === activeAnnotationId;
            const contentId = `annotation-editor-${annotation.id}`;

            return (
              <div
                key={annotation.id}
                data-annotation-card
                onClick={(event) => {
                  if (suppressAnnotationClick.current) {
                    event.preventDefault();
                    return;
                  }
                  setActiveAnnotationId(annotation.id);
                }}
                onPointerDown={(event) => startAnnotationPointerDrag(event, annotationIndex)}
                className={`relative shrink-0 rounded-xl border overflow-hidden transition-all ${
                  draggedAnnotationIndex === annotationIndex ? 'opacity-40 ' : ''
                }${
                  isActive
                    ? 'border-amber-400/60 bg-amber-500/[0.07] shadow-[0_0_0_1px_rgba(251,191,36,0.08)]'
                    : 'border-zinc-800 bg-zinc-950/55 hover:border-zinc-700'
                }`}
              >
                {annotationDropIndex === annotationIndex && draggedAnnotationIndex !== null && (
                  <span className="absolute inset-x-2 -top-px z-10 h-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" aria-hidden="true" />
                )}
                <button
                  type="button"
                  data-annotation-drag-header
                  aria-expanded={isActive}
                  aria-controls={contentId}
                  onClick={(event) => {
                    if (suppressAnnotationClick.current) {
                      event.preventDefault();
                      return;
                    }
                    setActiveAnnotationId(annotation.id);
                  }}
                  className={`w-full px-3 py-2.5 flex items-center gap-2 text-left transition-colors ${
                    isActive ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <GripVertical size={13} className="shrink-0 cursor-grab text-zinc-600" aria-hidden="true" />
                  {isActive
                    ? <ChevronDown size={13} className="shrink-0 text-amber-300" />
                    : <ChevronRight size={13} className="shrink-0 text-zinc-600" />}
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold ${
                    isActive ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {annotationIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[11px] font-semibold ${isActive ? 'text-amber-100' : 'text-zinc-300'}`}>
                      {annotation.title?.trim() || `Annotation ${annotationIndex + 1}`}
                    </span>
                    <span className="block truncate text-[8px] text-zinc-500">
                      {annotation.positionExplicitlySet === false ? 'Noch nicht im Raum platziert' : 'Im Raum platziert'}
                    </span>
                  </span>
                  {isActive && (
                    <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                      Aktiv
                    </span>
                  )}
                </button>

                {isActive && (
                  <div
                    id={contentId}
                    role="group"
                    aria-label={`Annotation ${annotationIndex + 1} bearbeiten`}
                    onFocus={() => setActiveAnnotationId(annotation.id)}
                    onClick={() => setActiveAnnotationId(annotation.id)}
                    className="border-t border-amber-400/15 p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Punkt {annotationIndex + 1} bearbeiten</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPlaceAnnotationInScene(annotation.id)}
                          className={`px-2 py-1 rounded-lg border text-[10px] transition-colors ${
                            placingAnnotationId === annotation.id
                              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                              : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-200'
                          }`}
                        >
                          {placingAnnotationId === annotation.id ? 'Klick im Raum…' : 'Im Raum platzieren'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAnnotation(annotation.id)}
                          className="p-1 rounded bg-red-950/30 hover:bg-red-900/40 text-red-400"
                          title="Annotation löschen"
                          aria-label={`Annotation ${annotationIndex + 1} löschen`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                      <div className="min-w-0 text-left">
                        <span className="block text-[8px] font-bold uppercase tracking-wider text-zinc-500">Gespeicherte Kamera</span>
                        <span className={`block truncate font-mono text-[8px] ${annotation.cameraExplicitlySet ? 'text-emerald-400' : 'text-zinc-600'}`}>
                          {annotation.cameraExplicitlySet && annotation.cameraPos
                            ? `Pos: ${annotation.cameraPos.x.toFixed(1)}, ${annotation.cameraPos.y.toFixed(1)}, ${annotation.cameraPos.z.toFixed(1)}`
                            : 'Noch nicht explizit übernommen'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCaptureAnnotation(annotation.id)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/20"
                        title="Aktuelle Kameraposition und Blickrichtung für diese Annotation übernehmen"
                      >
                        <Camera size={11} />
                        Kamera übernehmen
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Titel"
                      value={annotation.title ?? ''}
                      onChange={(event) => onUpdateAnnotation(annotation.id, 'title', event.target.value)}
                      className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                    />
                    <textarea
                      rows="3"
                      placeholder="Text"
                      value={annotation.text ?? ''}
                      onChange={(event) => onUpdateAnnotation(annotation.id, 'text', event.target.value)}
                      className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        onUploadAnnotationImages(annotation.id, event);
                        event.target.value = '';
                      }}
                      className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-amber-500/50"
                    />
                    {annotation.images?.length > 0 && (
                      <span className="text-[9px] text-emerald-400">{annotation.images.length} Bild(er) hinterlegt</span>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {['x', 'y', 'z'].map((axis) => (
                        <label key={axis} className="flex flex-col gap-1">
                          <span className="text-[8px] uppercase tracking-wider text-zinc-500">{axis.toUpperCase()}</span>
                          <input
                            type="number"
                            step="0.1"
                            value={Number(annotation.position?.[axis] ?? 0).toFixed(1)}
                            onChange={(event) => onUpdateAnnotation(annotation.id, 'position', {
                              x: annotation.position?.x ?? 0,
                              y: annotation.position?.y ?? 3.5,
                              z: annotation.position?.z ?? 0,
                              [axis]: parseFloat(event.target.value) || 0
                            })}
                            className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-amber-500/50"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {annotationDropIndex === annotationIndex + 1
                  && annotationIndex === annotations.length - 1
                  && draggedAnnotationIndex !== null && (
                    <span className="absolute inset-x-2 -bottom-px z-10 h-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" aria-hidden="true" />
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              isAddingAnnotation.current = true;
              onAddAnnotation();
            }}
            className="w-full border border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl py-2 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-all"
          >
            <Plus size={13} />
            <span>Projekt-Annotation hinzufügen</span>
          </button>
        </div>
      )}
    </div>
  );
}
