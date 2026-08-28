export const COMPACT_EXPERIENCE_MEDIA_QUERY = '(max-width: 768px), (orientation: landscape) and (max-height: 520px), (hover: none) and (pointer: coarse)';

export function isCompactExperienceViewport(matchMedia = globalThis.matchMedia) {
  return typeof matchMedia === 'function' && matchMedia(COMPACT_EXPERIENCE_MEDIA_QUERY).matches;
}

export function shouldTrackRevealPointer({ compactViewport = false, pointerType = 'mouse' } = {}) {
  return !compactViewport || pointerType !== 'touch';
}

export function isMobileRevealTap({
  compactViewport = false,
  pointerType = '',
  stationMode = '',
  viewMode = '',
  freeNavigationActive = false,
  maximumMovement = Infinity,
  durationMs = Infinity,
  involvedMultipleTouches = false
} = {}) {
  return compactViewport
    && pointerType === 'touch'
    && stationMode === 'scroll'
    && viewMode === 'reveal'
    && !freeNavigationActive
    && !involvedMultipleTouches
    && maximumMovement <= 10
    && durationMs <= 500;
}

export function shouldRequireExplicitRevealExploration({ compactViewport = false, viewMode = '' } = {}) {
  return compactViewport && viewMode === 'reveal';
}
