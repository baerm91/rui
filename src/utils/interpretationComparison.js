const SUPPORTED_VIEW_MODES = new Set(['ruin', 'recon']);

const cleanText = (value, fallback = '') => (
  typeof value === 'string' && value.trim() ? value.trim() : fallback
);

const normalizeState = (state, index) => {
  const viewMode = SUPPORTED_VIEW_MODES.has(state?.viewMode) ? state.viewMode : null;
  if (!viewMode) return null;
  return {
    id: cleanText(state.id, `state-${index + 1}`),
    label: cleanText(state.label, viewMode === 'ruin' ? 'Erhaltener Befund' : 'Rekonstruktion'),
    viewMode,
    description: cleanText(state.description)
  };
};

export function normalizeInterpretationComparison(value) {
  if (!value || typeof value !== 'object') return null;
  const states = Array.isArray(value.states)
    ? value.states.map(normalizeState).filter(Boolean)
    : [];
  if (states.length < 2) return null;

  const explanation = value.explanation && typeof value.explanation === 'object'
    ? {
      label: cleanText(value.explanation.label, 'Warum so rekonstruiert?'),
      title: cleanText(value.explanation.title, 'Zur Rekonstruktion'),
      text: cleanText(value.explanation.text),
      sourceLabel: cleanText(value.explanation.sourceLabel),
      sourceUrl: cleanText(value.explanation.sourceUrl)
    }
    : null;

  const experimentalMode = value.experimentalMode && typeof value.experimentalMode === 'object'
    && value.experimentalMode.viewMode === 'reveal'
    ? {
      label: cleanText(value.experimentalMode.label, 'Interaktiv vergleichen'),
      viewMode: 'reveal',
      description: cleanText(value.experimentalMode.description)
    }
    : null;

  return {
    title: cleanText(value.title, 'Befund und Rekonstruktion'),
    states,
    explanation: explanation?.text ? explanation : null,
    experimentalMode
  };
}

export function resolveRevealInterpretationComparison(station) {
  const normalized = normalizeInterpretationComparison(station?.interpretationComparison);
  if (normalized || station?.viewMode !== 'reveal') return normalized;
  return {
    title: 'Ruine und Rekonstruktion',
    states: [
      { id: 'evidence', label: 'Ruine', viewMode: 'ruin', description: '' },
      { id: 'reconstruction', label: 'Rekonstruktion', viewMode: 'recon', description: '' }
    ],
    explanation: null,
    experimentalMode: {
      label: 'Interaktiv vergleichen',
      viewMode: 'reveal',
      description: ''
    }
  };
}

export function getInterpretationState(comparison, viewMode) {
  const normalized = normalizeInterpretationComparison(comparison);
  if (!normalized) return null;
  return normalized.states.find((state) => state.viewMode === viewMode)
    || (normalized.experimentalMode?.viewMode === viewMode ? normalized.experimentalMode : null);
}

export function getNextInterpretationState(comparison, viewMode) {
  const normalized = normalizeInterpretationComparison(comparison);
  if (!normalized || normalized.states.length < 2) return null;
  const activeIndex = normalized.states.findIndex((state) => state.viewMode === viewMode);
  return normalized.states[(activeIndex + 1 + normalized.states.length) % normalized.states.length];
}

export function createInterpretationViewOverride(station, viewMode) {
  const comparison = resolveRevealInterpretationComparison(station);
  if (!station?.id || !getInterpretationState(comparison, viewMode)) return null;
  return { stationId: station.id, viewMode };
}

export function resolveInterpretationStation(station, override) {
  if (!station || override?.stationId !== station.id) return station;
  const validOverride = createInterpretationViewOverride(station, override.viewMode);
  return validOverride ? { ...station, viewMode: validOverride.viewMode } : station;
}
