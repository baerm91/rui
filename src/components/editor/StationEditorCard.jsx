import React, { useState } from 'react';
import { AlertTriangle, ArrowUp, ArrowDown, Trash2, Play, ChevronDown, ChevronUp, Image as ImageIcon, MapPin, MousePointer2, FileText, Camera, Images } from 'lucide-react';
import { ImageSlotEditor } from './ImageSlotEditor.jsx';
import { BACKGROUND_IMAGE_OPTIONS, PORTAL_PARAMS } from '../../constants.js';
import { stripHighlights } from '../../utils/textFormatting.jsx';

export function StationEditorCard({
  station,
  models,
  index,
  editingIndex,
  totalStations,
  activeAccordionIndex,
  activeImageAccordion,
  onSetActiveAccordion,
  onSetActiveImageAccordion,
  onMoveStation,
  onDeleteStation,
  isDeletePending = false,
  isExpanded,
  onExpandedChange,
  onTestStation,
  onCaptureCamera,
  onUpdateText,
  onUpdateImage,
  onUploadImage,
  onLocalBgUpload,
  getBgSelectValue
}) {
  const [activeSection, setActiveSection] = useState('content');
  const [showAdditionalContent, setShowAdditionalContent] = useState(false);
  const hasCameraPosition = ['x', 'y', 'z'].every((axis) => Number.isFinite(station.cameraPos?.[axis]));
  const hasExplicitCamera = hasCameraPosition && station.cameraExplicitlySet !== false;
  const sections = [
    { id: 'content', label: 'Inhalt', icon: FileText },
    { id: 'scene', label: 'Szene', icon: Camera },
    { id: 'media', label: 'Medien', icon: Images }
  ];

  return (
    <section className="border-b border-white/10 bg-zinc-950/75">
      <div className="flex items-center pr-5">
        <button
          type="button"
          onClick={() => onExpandedChange?.(!isExpanded)}
          className="flex min-w-0 flex-1 items-center justify-between px-5 py-3 text-left hover:bg-white/[0.03]"
          aria-expanded={isExpanded}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <FileText size={14} className="shrink-0 text-amber-400" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-zinc-200">Stationseinstellungen</span>
              <span className="block truncate text-[9px] text-zinc-500">Station {index + 1} von {totalStations} · {stripHighlights(station.title) || 'Ohne Titel'}</span>
            </span>
          </span>
          {isExpanded ? <ChevronUp size={14} className="shrink-0 text-zinc-500" /> : <ChevronDown size={14} className="shrink-0 text-zinc-500" />}
        </button>

        <div className="ml-2 flex items-center gap-1.5 border-l border-zinc-800 pl-3">
          <button 
            onClick={() => onMoveStation(index, 'up')} 
            disabled={index === 0}
            className="p-1 rounded bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none"
            title="Nach oben verschieben"
          >
            <ArrowUp size={12} />
          </button>
          <button 
            onClick={() => onMoveStation(index, 'down')} 
            disabled={index === totalStations - 1}
            className="p-1 rounded bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none"
            title="Nach unten verschieben"
          >
            <ArrowDown size={12} />
          </button>
          <button 
            onClick={() => onDeleteStation(index)}
            disabled={totalStations <= 1}
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-[8px] font-semibold disabled:pointer-events-none disabled:opacity-30 ${isDeletePending ? 'bg-red-500/20 text-red-200 ring-1 ring-red-400/50' : 'bg-red-950/30 text-red-400 hover:bg-red-900/40'}`}
            title={isDeletePending ? 'Erneut klicken, um das Löschen zu bestätigen' : 'Station löschen'}
            aria-label={isDeletePending ? 'Löschen der Station bestätigen' : 'Station löschen'}
          >
            {isDeletePending ? <><AlertTriangle size={12} /> Bestätigen</> : <Trash2 size={12} />}
          </button>
        </div>
      </div>

      {isExpanded && <div className="flex flex-col gap-3 border-t border-white/5 p-5">

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-950/70" role="tablist" aria-label="Bearbeitungsbereich">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeSection === id}
            onClick={() => setActiveSection(id)}
            className={`rounded-lg px-2 py-2 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeSection === id
                ? 'bg-zinc-800 text-amber-300 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Title Input */}
      {activeSection === 'content' && <>
      <div className="flex flex-col gap-1 text-left">
        <div className="flex justify-between items-center">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Titel</label>
          <span className="text-[9px] text-zinc-550 italic">Nutzen Sie \n für Zeilenumbrüche, *text* für Gold-Effekt</span>
        </div>
        <textarea 
          rows="2"
          value={station.title}
          onChange={(e) => onUpdateText(index, 'title', e.target.value)}
          className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none"
        />
      </div>

      {/* Description Textarea */}
      <div className="flex flex-col gap-1 text-left">
        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Beschreibung</label>
        <textarea 
          rows="3"
          value={station.description}
          onChange={(e) => onUpdateText(index, 'description', e.target.value)}
          className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
        />
      </div>

      {/* Text layer and optional readability backgrounds */}
      <div className="grid grid-cols-3 gap-3 text-left">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Text-Ebene</label>
          <select
            value={station.textLayer ?? 'front'}
            onChange={(e) => onUpdateText(index, 'textLayer', e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="front">Vor dem Modell</option>
            <option value="behind">Hinter dem Modell</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 justify-between">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Hintergrund</label>
          <label className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs cursor-pointer hover:border-zinc-700 select-none h-[30px]">
            <input 
              type="checkbox"
              checked={!!station.milkyBg}
              onChange={(e) => onUpdateText(index, 'milkyBg', e.target.checked)}
              className="accent-amber-500 rounded border-zinc-700 bg-zinc-900"
            />
            <span className="text-zinc-300">Milchig</span>
          </label>
        </div>
        <div className="flex flex-col gap-1 justify-between">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Lesbarkeit</label>
          <label className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs cursor-pointer hover:border-zinc-700 select-none h-[30px]">
            <input
              type="checkbox"
              checked={!!station.highContrastBg}
              onChange={(e) => onUpdateText(index, 'highContrastBg', e.target.checked)}
              className="accent-amber-500 rounded border-zinc-700 bg-zinc-900"
            />
            <span className="text-zinc-300">Kontrastreich</span>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/30">
        <button
          type="button"
          onClick={() => setShowAdditionalContent((value) => !value)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.03]"
          aria-expanded={showAdditionalContent}
        >
          <span>
            <strong className="block text-[10px] uppercase tracking-wider text-zinc-300">Hintergrund & Zusatztext</strong>
            <small className="text-[8px] text-zinc-600">Optionaler Szenenhintergrund, Untertitel und Detailtext</small>
          </span>
          {showAdditionalContent ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
        </button>
        {showAdditionalContent && <div className="flex flex-col gap-3 border-t border-zinc-800 p-3">
      {/* Background Image Selection */}
      <div className="flex flex-col gap-1 text-left">
        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Hintergrundbild</label>
        <select
          value={getBgSelectValue(station.bgImage)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'upload') {
              onUpdateText(index, 'bgImage', 'data:image/placeholder;base64,');
            } else if (val === 'custom') {
              onUpdateText(index, 'bgImage', 'custom_image_url.png');
            } else {
              onUpdateText(index, 'bgImage', val);
            }
          }}
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
        >
          {BACKGROUND_IMAGE_OPTIONS.map((option) => (
            <option key={option.value || 'default'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {getBgSelectValue(station.bgImage) === 'upload' && (
          <div className="mt-1 flex flex-col gap-1">
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => onLocalBgUpload(index, e)}
              className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-amber-500/50"
            />
            {station.bgImage && station.bgImage.startsWith('data:image/') && !station.bgImage.includes('placeholder') && (
              <span className="text-[9px] text-emerald-400 font-semibold">✓ Bild erfolgreich hochgeladen und konvertiert</span>
            )}
          </div>
        )}

        {getBgSelectValue(station.bgImage) === 'custom' && (
          <input 
            type="text" 
            placeholder="z.B. https://example.com/bild.jpg"
            value={station.bgImage === 'custom_image_url.png' ? '' : station.bgImage}
            onChange={(e) => onUpdateText(index, 'bgImage', e.target.value)}
            className="w-full mt-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
          />
        )}
      </div>

      {/* Subtitle / Subdescription */}
      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Untertitel (unten)</label>
          <input 
            type="text" 
            placeholder="z.B. Ein Tor zwischen Welten"
            value={station.subTitle ?? ''}
            onChange={(e) => onUpdateText(index, 'subTitle', e.target.value)}
            className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Detailtext (unten)</label>
          <textarea 
            rows="2"
            placeholder="z.B. Zeuge einer Ära..."
            value={station.subDescription ?? ''}
            onChange={(e) => onUpdateText(index, 'subDescription', e.target.value)}
            className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
          />
        </div>
      </div>
        </div>}
      </div>
      </>}

      {/* Video iframe */}
      {activeSection === 'media' && <>
      <div className="flex flex-col gap-2 text-left border border-zinc-850/70 bg-zinc-950/30 rounded-xl p-3">
        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Video iframe</label>
        <input
          type="text"
          placeholder="https://www.youtube.com/embed/..."
          value={station.videoUrl ?? ''}
          onChange={(e) => onUpdateText(index, 'videoUrl', e.target.value)}
          className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-400/50"
        />

        <p className="text-[8px] leading-relaxed text-zinc-600">Positionieren Sie den Videoframe direkt per Drag & Drop in der Vorschau.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              <span>Breite</span>
              <span className="text-cyan-300 font-normal font-mono">{station.videoWidth ?? 28}vw</span>
            </div>
            <input
              type="range" min="16" max="48" step="1"
              value={station.videoWidth ?? 28}
              onChange={(e) => onUpdateText(index, 'videoWidth', parseInt(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              <span>Höhe</span>
              <span className="text-cyan-300 font-normal font-mono">{station.videoHeight ?? 18}vw</span>
            </div>
            <input
              type="range" min="9" max="32" step="1"
              value={station.videoHeight ?? 18}
              onChange={(e) => onUpdateText(index, 'videoHeight', parseInt(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
      </>}

      {/* View Mode Dropdown */}
      {activeSection === 'scene' && <>
      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Ansichts-Modus</label>
          <select
            value={station.viewMode}
            onChange={(e) => onUpdateText(index, 'viewMode', e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="ruin">{models?.primaryName || 'Hauptmodell'}</option>
            {models?.reconstruction && <option value="recon">{models.reconstructionName || 'Rekonstruktion'}</option>}
            {models?.reconstruction && <option value="portal">Portal · beide Modelle</option>}
            {models?.reconstruction && <option value="reveal">Reveal · beide Modelle</option>}
            {!models?.reconstruction && station.viewMode !== 'ruin' && <option value={station.viewMode}>Nicht verfügbares Modell (bitte ändern)</option>}
          </select>
        </div>

        <div className="flex flex-col gap-1 justify-end">
          <button 
            onClick={() => onTestStation(index, station)}
            className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg py-1.5 text-xs flex items-center justify-center gap-1 text-zinc-300 font-medium"
          >
            <Play size={10} className="text-amber-500" />
            <span>Kamera testen</span>
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-zinc-850 bg-zinc-950/45 px-3 py-2 text-xs cursor-pointer hover:border-amber-500/25 select-none">
        <input
          type="checkbox"
          checked={!!station.playModelAnimation}
          onChange={(event) => onUpdateText(index, 'playModelAnimation', event.target.checked)}
          className="rounded border-zinc-700 bg-zinc-900 accent-amber-500"
        />
        <Play size={13} className="text-amber-400" />
        <span className="flex flex-col text-left">
          <strong className="text-[10px] text-zinc-300">Modellanimation abspielen</strong>
          <small className="text-[8px] font-normal text-zinc-600">Startet beim Betreten dieser Station erneut</small>
        </span>
      </label>

      {station.playModelAnimation && (
        <div className="rounded-xl border border-zinc-850 bg-zinc-950/45 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-500">
            <span>Animationsgeschwindigkeit</span>
            <span className="font-mono text-amber-300">{station.modelAnimationSpeed ?? 100}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="200"
            step="5"
            value={station.modelAnimationSpeed ?? 100}
            onChange={(event) => onUpdateText(index, 'modelAnimationSpeed', Number(event.target.value))}
            className="w-full accent-amber-500"
            aria-label="Animationsgeschwindigkeit"
          />
          <div className="mt-1 flex justify-between text-[8px] text-zinc-600"><span>10% langsam</span><span>100% normal</span><span>200% schnell</span></div>
        </div>
      )}

      {/* Camera Pos capture */}
      <div className="flex gap-2 items-center bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-850 mt-1">
        <div className="flex-1 text-left">
          <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block">Gespeicherte Kamera</span>
          <span className={`text-[8px] ${hasExplicitCamera ? 'text-emerald-400' : 'text-amber-400'}`}>
            {hasExplicitCamera ? 'Explizit definiert' : 'Noch nicht explizit übernommen'}
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            {hasCameraPosition
              ? `Pos: ${station.cameraPos.x.toFixed(1)}, ${station.cameraPos.y.toFixed(1)}, ${station.cameraPos.z.toFixed(1)}`
              : 'Pos: noch nicht übernommen'}
          </span>
        </div>
        <button 
          onClick={() => onCaptureCamera(index)}
          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg px-2.5 py-1 text-[10px] font-semibold tracking-wide shrink-0 transition-colors"
          title="Aktuelle Position und Blickrichtung explizit in diese Station übernehmen"
        >
          Kamera übernehmen
        </button>
      </div>

      <p className="-mt-2 px-1 text-left text-[8px] leading-relaxed text-zinc-600">
        Nur „Kamera übernehmen“ speichert Position und Blickrichtung dieser Station.
      </p>

      {/* Free navigation */}
      <label className="flex items-center gap-2 px-3 py-2 bg-zinc-950/45 border border-zinc-850 rounded-xl text-xs cursor-pointer hover:border-amber-500/25 select-none">
        <input
          type="checkbox"
          checked={!!station.freeNavigation}
          onChange={(e) => onUpdateText(index, 'freeNavigation', e.target.checked)}
          className="accent-amber-500 rounded border-zinc-700 bg-zinc-900"
        />
        <MousePointer2 size={13} className="text-amber-400" />
        <span className="text-zinc-300">Freie Navigation an dieser Station erlauben</span>
      </label>

      {station.freeNavigation && (
        <div className="flex flex-col gap-2 px-3 py-2.5 bg-zinc-950/45 border border-zinc-850 rounded-xl">
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-2.5 py-2 text-left">
            <input
              type="checkbox"
              checked={station.showAnnotationNavigation !== false}
              onChange={(event) => onUpdateText(index, 'showAnnotationNavigation', event.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 accent-amber-500"
            />
            <MapPin size={13} className="shrink-0 text-amber-400" />
            <span className="flex flex-col gap-0.5">
              <strong className="text-[9px] uppercase tracking-wider text-zinc-300">Annotationsnavigation anzeigen</strong>
              <small className="text-[8px] font-normal text-zinc-600">Vor und zurück zwischen Fundpunkten</small>
            </span>
          </label>
          <div className="mt-1 border-t border-zinc-800/80 pt-2">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Max. Zoom-Entfernung
                </span>
                <span className="block text-[8px] leading-relaxed text-zinc-600">
                  Begrenzt das Herauszoomen vom Modell
                </span>
              </div>
              <input
                type="number"
                min="2"
                max="200"
                step="1"
                value={station.freeNavigationMaxDistance ?? 40}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isFinite(nextValue)) {
                    onUpdateText(index, 'freeNavigationMaxDistance', Math.max(2, Math.min(200, nextValue)));
                  }
                }}
                className="w-16 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-right text-[10px] font-mono text-amber-400 outline-none focus:border-amber-500/40"
                aria-label="Maximale Zoom-Entfernung eingeben"
              />
            </div>
            <input
              type="range"
              min="2"
              max="200"
              step="1"
              value={station.freeNavigationMaxDistance ?? 40}
              onChange={(event) => onUpdateText(index, 'freeNavigationMaxDistance', Number(event.target.value))}
              className="w-full accent-amber-500"
              aria-label="Maximale Zoom-Entfernung der freien Ansicht"
            />
            <div className="flex justify-between text-[8px] font-mono text-zinc-650">
              <span>2 (nah)</span>
              <span>200 (weit)</span>
            </div>
          </div>
        </div>
      )}

      </>}

      {/* 3D Bildquellen Accordion Section */}
      {activeSection === 'media' && <>
      <div className="border border-zinc-800 rounded-xl overflow-hidden mt-1 bg-zinc-950/30">
        <button
          type="button"
          onClick={() => onSetActiveAccordion(activeAccordionIndex === 'images' ? null : 'images')}
          className="w-full flex justify-between items-center px-3 py-2 text-left bg-zinc-950/50 hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-zinc-300">
            <ImageIcon size={12} className="text-cyan-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Bildquellen in 3D (Max. 3)</span>
          </div>
          {activeAccordionIndex === 'images' ? <ChevronUp size={14} className="text-zinc-550" /> : <ChevronDown size={14} className="text-zinc-550" />}
        </button>

        {activeAccordionIndex === 'images' && (
          <div className="p-2 flex flex-col gap-2 border-t border-zinc-850 bg-zinc-950/10 animate-blur-fade-up">
            {[0, 1, 2].map((imgIdx) => {
              const img = (station.images && station.images[imgIdx]) || { url: "", posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false };
              return (
                <ImageSlotEditor
                  key={imgIdx}
                  img={img}
                  imgIndex={imgIdx}
                  stationIndex={index}
                  isActive={activeImageAccordion === imgIdx}
                  onToggle={onSetActiveImageAccordion}
                  onUpdateImage={onUpdateImage}
                  onUploadImage={onUploadImage}
                />
              );
            })}
          </div>
        )}
      </div>

      </>}

      {/* Slider values specifically for portal states */}
      {activeSection === 'scene' && (station.viewMode === 'portal' || station.viewMode === 'reveal') && (
        <div className="grid grid-cols-2 gap-3 mt-1 p-2 bg-zinc-950/30 border border-zinc-850/30 rounded-xl">
          <div className="flex flex-col gap-0.5 text-left">
            <div className="flex justify-between text-[9px] text-zinc-500">
              <span>Größe</span>
              <span>{Math.round(station.revealRadius * 100)}%</span>
            </div>
            <input 
              type="range" min="0.10" max={station.viewMode === 'portal' ? '3.50' : '0.55'} step="0.01" 
              value={station.revealRadius} 
              onChange={(e) => onUpdateText(index, 'revealRadius', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
            />
          </div>
          <div className="flex flex-col gap-0.5 text-left">
            <div className="flex justify-between text-[9px] text-zinc-550">
              <span>Weichheit</span>
              <span>{Math.round(station.revealSoftness * 100)}%</span>
            </div>
            <input 
              type="range" min="0.01" max="0.18" step="0.01" 
              value={station.revealSoftness} 
              onChange={(e) => onUpdateText(index, 'revealSoftness', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
            />
          </div>
        </div>
      )}
      {activeSection === 'scene' && (station.viewMode === 'portal' || station.viewMode === 'reveal') && (
        <div className="grid grid-cols-2 gap-3 mt-1 p-2 bg-zinc-950/30 border border-amber-500/10 rounded-xl">
          {PORTAL_PARAMS.map(([field, label, min, max, step, fallback]) => (
            <div key={field} className="flex flex-col gap-0.5 text-left">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>{label}</span>
                <span>{Number(station[field] ?? fallback).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={station[field] ?? fallback}
                onChange={(e) => onUpdateText(index, field, parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
              />
            </div>
          ))}
        </div>
      )}
      </div>}
    </section>
  );
}
