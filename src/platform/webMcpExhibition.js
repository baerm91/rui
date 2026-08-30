import { isValidSpatialModelUrl, normalizeSpatialItems, normalizeSpatialStation, normalizeThumbnailGridSpacing, normalizeThumbnailLayout } from '../utils/spatialStory.js';
import { normalizeStationBehavior } from '../utils/stationBehavior.js';
import { normalizeStationRelations } from '../utils/stationRelations.js';
import { normalizeNarrativeSteps } from '../utils/stationNarrative.js';

export const WEB_MCP_EXHIBITION_CATEGORIES = ['Archäologie', 'Architektur', 'Kulturerbe', 'Kunst', 'Natur', 'Sonstiges'];
export const WEB_MCP_EXHIBITION_LANGUAGES = ['de', 'en', 'fr', 'it', 'es'];
export const WEB_MCP_MATERIAL_IDS = ['warm-white', 'limestone', 'soft-grey', 'neutral-floor', 'beige-wall-002', 'travertine-001', 'marble-01', 'wood-floor'];

const text = (value, name, maximum, required = false) => {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) throw new Error(`${name} darf nicht leer sein.`);
  if (normalized.length > maximum) throw new Error(`${name} darf höchstens ${maximum} Zeichen lang sein.`);
  return normalized;
};

const url = (value, name) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (normalized.length > 2048) throw new Error(`${name} ist zu lang.`);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${name} muss eine vollständige HTTP(S)-URL sein.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${name} muss eine HTTP(S)-URL sein.`);
  return parsed.href;
};

const identifier = (value, prefix, index, used) => {
  const candidate = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  let result = candidate || `${prefix}_${Date.now()}_${index}`;
  let suffix = 2;
  while (used.has(result)) result = `${candidate || `${prefix}_${Date.now()}_${index}`}-${suffix++}`;
  used.add(result);
  return result;
};

const normalizeItems = (items, stationIndex) => {
  if (!Array.isArray(items)) return [];
  if (items.length > 12) throw new Error(`Station ${stationIndex + 1} darf höchstens 12 Objekte enthalten.`);
  const used = new Set();
  const prepared = items.map((item, itemIndex) => ({
    ...item,
    id: identifier(item?.id, `item_${stationIndex + 1}`, itemIndex + 1, used),
    title: text(item?.title || `Objekt ${itemIndex + 1}`, `Objekttitel ${itemIndex + 1}`, 160, true),
    description: text(item?.description, `Objektbeschreibung ${itemIndex + 1}`, 4000),
    modelUrl: url(item?.modelUrl, `Modell-URL von Objekt ${itemIndex + 1}`),
    thumbnailUrl: url(item?.thumbnailUrl, `Thumbnail-URL von Objekt ${itemIndex + 1}`),
    attribution: text(item?.attribution, `Attribution von Objekt ${itemIndex + 1}`, 500),
    license: text(item?.license, `Lizenz von Objekt ${itemIndex + 1}`, 160)
  }));
  if (prepared.some((item) => !item.modelUrl)) throw new Error(`Jedes Objekt in Station ${stationIndex + 1} benötigt eine Modell-URL.`);
  if (prepared.some((item) => !isValidSpatialModelUrl(item.modelUrl))) {
    throw new Error(`Mindestens eine Modell-URL in Station ${stationIndex + 1} wird nicht unterstützt. Erlaubt sind GLTF, GLB, FBX und Sketchfab.`);
  }
  return normalizeSpatialItems(prepared);
};

export function normalizeWebMcpStations(stations) {
  if (!Array.isArray(stations) || !stations.length) throw new Error('Die Ausstellung benötigt mindestens eine Station.');
  if (stations.length > 20) throw new Error('Eine Ausstellung darf höchstens 20 Stationen enthalten.');
  const used = new Set();
  return stations.map((station, index) => {
    const id = identifier(station?.id, 'station', index + 1, used);
    const title = text(station?.title || `Station ${index + 1}`, `Titel von Station ${index + 1}`, 160, true);
    const introduction = text(station?.introduction ?? station?.description, `Einführung von Station ${index + 1}`, 5000, true);
    const items = normalizeItems(station?.items, index);
    const spatialInput = {
      ...station,
      spatial: {
        ...station?.spatial,
        wallBackground: {
          ...station?.spatial?.wallBackground,
          url: url(station?.spatial?.wallBackground?.url, `Wandbild-URL von Station ${index + 1}`)
        },
        audio: {
          ...station?.spatial?.audio,
          url: url(station?.spatial?.audio?.url, `Audio-URL von Station ${index + 1}`)
        }
      }
    };
    const selectedItemId = items.some((item) => item.id === station?.selectedItemId)
      ? station.selectedItemId
      : items[0]?.id || null;
    return {
      id,
      title,
      description: introduction,
      introduction,
      behavior: normalizeStationBehavior(station?.behavior),
      relations: normalizeStationRelations(station?.relations, items),
      narrativeSteps: normalizeNarrativeSteps(station?.narrativeSteps, items),
      spatial: normalizeSpatialStation(spatialInput, index),
      items,
      thumbnailLayout: normalizeThumbnailLayout(station?.thumbnailLayout),
      thumbnailGridSpacing: normalizeThumbnailGridSpacing(station?.thumbnailGridSpacing),
      selectedItemId,
      initialItemId: items.some((item) => item.id === station?.initialItemId) ? station.initialItemId : selectedItemId
    };
  });
}

export function normalizeWebMcpExhibition(input, existing = null) {
  const source = input || {};
  const name = source.name == null && existing
    ? existing.name
    : text(source.name, 'Der Ausstellungstitel', 160, true);
  const description = source.description == null && existing
    ? existing.description
    : text(source.description, 'Das Ausstellungskonzept', 5000, true);
  const language = source.language == null && existing ? existing.metadata?.language : source.language || 'de';
  if (!WEB_MCP_EXHIBITION_LANGUAGES.includes(language)) throw new Error('Die Sprache wird nicht unterstützt.');
  const categories = source.categories == null && existing
    ? existing.metadata?.categories || [existing.metadata?.category || 'Sonstiges']
    : [...new Set(Array.isArray(source.categories) ? source.categories : [])];
  if (!categories?.length || categories.some((category) => !WEB_MCP_EXHIBITION_CATEGORIES.includes(category))) {
    throw new Error('Mindestens eine gültige Kategorie ist erforderlich.');
  }
  return {
    name,
    description,
    location: source.location == null && existing ? existing.location || '' : text(source.location, 'Der Ort', 240),
    coverImage: source.coverImage == null && existing ? existing.coverImage || '' : url(source.coverImage, 'Die Vorschaubild-URL'),
    language,
    categories,
    license: source.license == null && existing ? existing.metadata?.license || '' : text(source.license, 'Die Lizenz', 160),
    subtitle: source.subtitle == null && existing ? existing.branding?.subtitle || '' : text(source.subtitle, 'Der Untertitel', 240),
    watermark: source.watermark == null && existing ? existing.branding?.watermark || '' : text(source.watermark, 'Das Wasserzeichen', 80),
    stations: source.stations == null && existing ? existing.stations : normalizeWebMcpStations(source.stations)
  };
}

export function toWebMcpExhibition(story) {
  return {
    id: story.id,
    name: story.name,
    description: story.description,
    status: story.status,
    location: story.location || '',
    coverImage: story.coverImage || '',
    language: story.metadata?.language || 'de',
    categories: story.metadata?.categories || [story.metadata?.category || 'Sonstiges'],
    license: story.metadata?.license || '',
    subtitle: story.branding?.subtitle || '',
    watermark: story.branding?.watermark || '',
    stations: story.stations || [],
    editorUrl: `/studio/${story.id}`,
    previewUrl: `/stories/${story.slug || story.id}`
  };
}
