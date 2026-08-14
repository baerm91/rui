import { useState, useEffect } from 'react';
import { FIELD_TO_STATE_SETTER, KNOWN_BG_IMAGES } from '../constants.js';
import { defaultStationConfig, defaultStations } from '../stations.js';
import {
  cloneStationData,
  createAnnotation,
  createImageSlots,
  createStation,
  updateAnnotationById,
  updateStationAt
} from '../utils/stationEditing.js';

export function useEditorActions(appState) {
  const [editingStations, setEditingStations] = useState([]);
  const [editingAnnotations, setEditingAnnotations] = useState([]);
  const [editingIndex, setEditingIndex] = useState(0);
  const [activeAccordionIndex, setActiveAccordionIndex] = useState(null);
  const [activeImageAccordion, setActiveImageAccordion] = useState(0);
  const [dragState, setDragState] = useState(null);
  const [localModelPickerError, setLocalModelPickerError] = useState('');
  const [placingAnnotationId, setPlacingAnnotationId] = useState(null);
  const [placingOriginPoint, setPlacingOriginPoint] = useState(false);

  // `/edits` can enter editor mode before the large 3D assets are ready.
  // Hydrate the lightweight station draft as soon as station data arrives.
  useEffect(() => {
    if (appState.stationMode !== 'editor' || editingStations.length > 0 || !appState.stations?.length) return;
    setEditingStations(cloneStationData(appState.stations));
    setEditingAnnotations(cloneStationData(appState.annotations ?? []));
    setEditingIndex(Math.min(appState.currentStationIndex ?? 0, appState.stations.length - 1));
  }, [appState.stationMode, appState.stations, appState.currentStationIndex, editingStations.length]);

  // Mouse move and up handlers for dragging the text box in the editor
  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e) => {
      const editorRect = document.getElementById('scene-canvas')?.getBoundingClientRect();
      const editorWidth = editorRect?.width || window.innerWidth;
      const editorHeight = editorRect?.height || window.innerHeight;
      if (dragState.type === 'text-resize') {
        const editorScale = Math.max(0.01, editorWidth / window.innerWidth);
        const maxWidth = Math.max(280, window.innerWidth * (1 - dragState.startValueX / 100) - 16);
        const widthDelta = (e.clientX - dragState.startX) / editorScale;
        const newWidth = Math.round(Math.max(280, Math.min(maxWidth, dragState.startWidth + widthDelta)));
        setEditingStations((currentStations) => updateStationAt(currentStations, editingIndex, (station) => ({
          ...station,
          textWidth: newWidth
        })));
        return;
      }
      const deltaXPercent = ((e.clientX - dragState.startX) / editorWidth) * 100;
      const deltaYPercent = ((e.clientY - dragState.startY) / editorHeight) * 100;
      const newX = Math.max(2, Math.min(85, Math.round(dragState.startValueX + deltaXPercent)));
      const newY = Math.max(2, Math.min(85, Math.round(dragState.startValueY + deltaYPercent)));
      setEditingStations((currentStations) => updateStationAt(currentStations, editingIndex, (station) => {
        if (dragState.type === 'video') {
          return { ...station, videoX: newX, videoY: newY };
        }
        return { ...station, textX: newX, textY: newY };
      }));
    };
    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, editingIndex]);

  useEffect(() => () => {
    window.appState?.cancelAnnotationPlacement?.();
  }, []);

  const enterEditorMode = () => {
    const currentStations = cloneStationData(appState.stations);
    setEditingStations(currentStations);
    setEditingAnnotations(cloneStationData(appState.annotations ?? []));
    setEditingIndex(appState.currentStationIndex);
    window.appState?.setStationMode?.('editor');
  };

  const saveAndExitEditor = () => {
    window.appState?.cancelAnnotationPlacement?.();
    setPlacingAnnotationId(null);
    setPlacingOriginPoint(false);
    try {
      window.appState?.saveStations?.(editingStations);
      window.appState?.update?.({ annotations: cloneStationData(editingAnnotations) });
    } catch (error) {
      alert(error.message);
      return;
    }
    if (window.location.pathname === '/edits' || window.location.pathname.startsWith('/studio/')) return;
    window.appState?.setStationMode?.('scroll');
    document.body.style.overflow = 'auto';
  };

  const cancelEditor = () => {
    window.appState?.cancelAnnotationPlacement?.();
    setPlacingAnnotationId(null);
    setPlacingOriginPoint(false);
    if (window.location.pathname === '/edits' || window.location.pathname.startsWith('/studio/')) {
      window.location.href = '/dashboard';
      return;
    }
    window.appState?.setStationMode?.('scroll');
    document.body.style.overflow = 'auto';
  };

  const handleCaptureCamera = (index) => {
    if (placingOriginPoint) {
      window.appState?.cancelAnnotationPlacement?.();
      setPlacingOriginPoint(false);
    }
    const coords = window.appState?.captureCamera?.();
    if (coords) {
      setEditingStations((currentStations) => updateStationAt(currentStations, index, (station) => ({
        ...station,
        cameraPos: coords.cameraPos,
        cameraTarget: coords.cameraTarget,
        cameraExplicitlySet: true
      })));
    }
  };

  const handleAddAnnotation = () => {
    const capture = window.appState?.captureAnnotationContext?.() || window.appState?.captureCamera?.();
    const station = editingStations[editingIndex];
    setEditingAnnotations((annotations) => [
      ...annotations,
      createAnnotation(annotations, station, capture)
    ]);
  };

  const handleDeleteAnnotation = (annotationId) => {
    setEditingAnnotations((annotations) => annotations.filter((annotation) => annotation.id !== annotationId));
  };

  const handleMoveAnnotation = (sourceIndex, targetIndex) => {
    setEditingAnnotations((annotations) => {
      if (
        sourceIndex < 0
        || sourceIndex >= annotations.length
        || targetIndex < 0
        || targetIndex >= annotations.length
        || sourceIndex === targetIndex
      ) return annotations;

      const updated = [...annotations];
      const [movedAnnotation] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, movedAnnotation);
      return updated;
    });
  };

  const handleUpdateAnnotation = (annotationId, field, value) => {
    setEditingAnnotations((annotations) => updateAnnotationById(
      annotations,
      annotationId,
      (annotation) => ({ ...annotation, [field]: value })
    ));
  };

  const handleCaptureAnnotation = (annotationId) => {
    const camera = window.appState?.captureCamera?.();
    if (!camera) return;
    setEditingAnnotations((annotations) => updateAnnotationById(
      annotations,
      annotationId,
      (annotation) => ({
        ...annotation,
        cameraPos: camera.cameraPos,
        cameraTarget: camera.cameraTarget,
        cameraExplicitlySet: true
      })
    ));
  };

  const handlePlaceAnnotationInScene = (annotationId) => {
    if (placingAnnotationId === annotationId) {
      window.appState?.cancelAnnotationPlacement?.();
      setPlacingAnnotationId(null);
      return;
    }

    setPlacingOriginPoint(false);
    setPlacingAnnotationId(annotationId);
    window.appState?.startAnnotationPlacement?.((placement) => {
      setEditingAnnotations((annotations) => updateAnnotationById(
        annotations,
        annotationId,
        (annotation) => ({
          ...annotation,
          position: placement.position,
          positionExplicitlySet: true,
          cameraPos: placement.cameraPos,
          cameraTarget: placement.cameraTarget,
          cameraExplicitlySet: true
        })
      ));
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('heidentor:annotation-placed', { detail: { annotationId } }));
      }, 0);
      setPlacingAnnotationId(null);
    });
  };

  const handlePlaceOriginPoint = (onPlace) => {
    if (placingOriginPoint) {
      window.appState?.cancelAnnotationPlacement?.();
      setPlacingOriginPoint(false);
      return;
    }

    setPlacingAnnotationId(null);
    setPlacingOriginPoint(true);
    window.appState?.startAnnotationPlacement?.((placement) => {
      onPlace?.(placement.position);
      setPlacingOriginPoint(false);
    });
  };

  const handleDragAnnotation = (annotationId, placement) => {
    if (!placement?.position) return;
    setEditingAnnotations((annotations) => updateAnnotationById(
      annotations,
      annotationId,
      (annotation) => ({
        ...annotation,
        position: placement.position,
        positionExplicitlySet: true
      })
    ));
  };

  const handleTestStation = (index, station) => {
    if (placingOriginPoint) {
      window.appState?.cancelAnnotationPlacement?.();
      setPlacingOriginPoint(false);
    }
    setEditingIndex(index);
    if (appState.baseModelStatus === 'ready' || appState.localModelStatus === 'loaded') {
      window.appState?.flyToStation?.(station, index);
    }
  };

  const handleAddStation = () => {
    const coords = window.appState?.captureCamera?.() || {
      cameraPos: { x: 0, y: 10, z: 22 },
      cameraTarget: { x: 0, y: 3.5, z: 0 }
    };
    const newStation = createStation(editingStations.length, appState, coords);
    const updated = [...editingStations, newStation];
    setEditingStations(updated);
    setEditingIndex(updated.length - 1);
  };

  const handleDeleteStation = (index) => {
    if (editingStations.length <= 1) {
      alert('Es muss mindestens eine Station übrig bleiben!');
      return;
    }
    const updated = editingStations.filter((_, idx) => idx !== index);
    setEditingStations(updated);
    if (editingIndex >= updated.length) setEditingIndex(updated.length - 1);
  };

  const handleMoveStation = (index, directionOrTargetIndex) => {
    const targetIdx = typeof directionOrTargetIndex === 'number'
      ? directionOrTargetIndex
      : directionOrTargetIndex === 'up' ? index - 1 : index + 1;
    if (
      index < 0
      || index >= editingStations.length
      || targetIdx < 0
      || targetIdx >= editingStations.length
      || targetIdx === index
    ) return;

    const updated = [...editingStations];
    const [movedStation] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, movedStation);

    if (editingIndex === index) {
      setEditingIndex(targetIdx);
    } else if (index < editingIndex && editingIndex <= targetIdx) {
      setEditingIndex(editingIndex - 1);
    } else if (targetIdx <= editingIndex && editingIndex < index) {
      setEditingIndex(editingIndex + 1);
    }
    setEditingStations(updated);
  };

  const handleUpdateStationText = (index, field, val) => {
    const updated = updateStationAt(editingStations, index, (station) => ({
      ...station,
      ...(field === 'milkyBg' && val ? { highContrastBg: false } : {}),
      ...(field === 'highContrastBg' && val ? { milkyBg: false } : {}),
      [field]: val
    }));
    setEditingStations(updated);
    if (editingIndex === index) {
      if (field === 'freeNavigationMaxDistance' && updated[index]?.freeNavigation) {
        window.appState?.setFreeNavigationMaxDistance?.(updated[index].freeNavigationMaxDistance);
      }
      const setterName = FIELD_TO_STATE_SETTER[field];
      if (setterName) {
        const setter = window.appState?.[setterName];
        if (setter) {
          setter(field === 'revealRadius' || field === 'revealSoftness'
            || field.startsWith('portal') // Handle newly added portal params
            ? parseFloat(val) : val);
        }
      }
    }
  };

  const handleLocalImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Warnung: Das ausgewählte Bild ist sehr groß (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB). Bilder über 2 MB können das Limit des lokalen Speichers (LocalStorage) überschriten.');
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') handleUpdateStationText(index, 'bgImage', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const getBgSelectValue = (bgImage) => {
    if (!bgImage) return '';
    if (KNOWN_BG_IMAGES.includes(bgImage)) return bgImage;
    if (bgImage.startsWith('data:image/')) return 'upload';
    return 'custom';
  };

  const handleUpdateStationImage = (stationIndex, imgIndex, field, val) => {
    const updated = updateStationAt(editingStations, stationIndex, (station) => {
      const images = station.images ? [...station.images] : createImageSlots();
      images[imgIndex] = {
        ...(images[imgIndex] ?? createImageSlots(1)[0]),
        [field]: val
      };
      return { ...station, images };
    });
    setEditingStations(updated);
    if (editingIndex === stationIndex) {
      window.appState?.updateActiveStationImages?.(updated[stationIndex].images);
    }
  };

  const handleLocal3DImageUpload = (stationIndex, imgIndex, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert('Warnung: Das ausgewählte Bild ist sehr groß (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB). Bilder über 1.5 MB können das Limit des lokalen Speichers (LocalStorage) überschreiten.');
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') handleUpdateStationImage(stationIndex, imgIndex, 'url', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAnnotationImageUpload = (annotationId, e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;

    Promise.all(files.map((file) => new Promise((resolve) => {
      if (file.size > 1.5 * 1024 * 1024) {
        alert('Warnung: Das ausgewÃ¤hlte Bild ist sehr groÃŸ (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB). Bilder Ã¼ber 1.5 MB kÃ¶nnen das Limit des lokalen Speichers (LocalStorage) Ã¼berschreiten.');
      }
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result);
      reader.readAsDataURL(file);
    }))).then((images) => {
      handleUpdateAnnotation(
        annotationId,
        'images',
        images.filter((image) => typeof image === 'string')
      );
    });
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Möchten Sie wirklich die vordefinierten Standard-Stationen wiederherstellen? Ihre Änderungen gehen verloren.')) {
      setEditingStations(cloneStationData(defaultStations));
      setEditingAnnotations(cloneStationData(defaultStationConfig.annotations));
    }
  };

  const handleLocalModelFiles = async (files) => {
    if (!files?.length) return;
    setLocalModelPickerError('');
    try {
      await window.appState?.loadLocalModelFiles?.(files);
    } catch (error) {
      setLocalModelPickerError(error.message);
    }
  };

  const handleLocalModelFolder = async () => {
    if (!window.showDirectoryPicker) return false;
    setLocalModelPickerError('');
    try {
      const directory = await window.showDirectoryPicker({ mode: 'read' });
      const files = [];
      const collectFiles = async (handle, prefix = '') => {
        for await (const [name, entry] of handle.entries()) {
          const relativePath = prefix ? `${prefix}/${name}` : name;
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            Object.defineProperty(file, 'relativePath', { value: relativePath });
            files.push(file);
          } else {
            await collectFiles(entry, relativePath);
          }
        }
      };
      await collectFiles(directory);
      await handleLocalModelFiles(files);
      return true;
    } catch (error) {
      if (error.name !== 'AbortError') setLocalModelPickerError(error.message);
      return true;
    }
  };

  const handleRemoveLocalModel = () => {
    setLocalModelPickerError('');
    window.appState?.removeLocalModel?.();
  };
  return {
    editingStations, setEditingStations,
    editingAnnotations, setEditingAnnotations,
    editingIndex, setEditingIndex,
    activeAccordionIndex, setActiveAccordionIndex,
    activeImageAccordion, setActiveImageAccordion,
    placingAnnotationId, placingOriginPoint,
    dragState, setDragState,
    enterEditorMode, saveAndExitEditor, cancelEditor,
    handleCaptureCamera, handlePlaceOriginPoint, handleTestStation,
    handleAddStation, handleDeleteStation, handleMoveStation,
    handleUpdateStationText,
    handleLocalImageUpload, getBgSelectValue,
    handleUpdateStationImage, handleLocal3DImageUpload,
    handleAddAnnotation, handleDeleteAnnotation, handleUpdateAnnotation,
    handleCaptureAnnotation, handlePlaceAnnotationInScene, handleDragAnnotation, handleMoveAnnotation, handleAnnotationImageUpload,
    handleRestoreDefaults,
    handleLocalModelFolder, handleLocalModelFiles, handleRemoveLocalModel,
    localModelPickerError
  };
}
