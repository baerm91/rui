import { canCreateStories } from './accessControl.js';
import { canEditStory, createStory, getStory, readSession, readStories, saveStory } from './platformStore.js';
import {
  normalizeWebMcpExhibition,
  toWebMcpExhibition,
  WEB_MCP_EXHIBITION_CATEGORIES,
  WEB_MCP_EXHIBITION_LANGUAGES,
  WEB_MCP_MATERIAL_IDS
} from './webMcpExhibition.js';

const vectorSchema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 3,
  maxItems: 3
};

const transformSchema = {
  type: 'object',
  properties: {
    position: vectorSchema,
    rotation: vectorSchema,
    scale: { type: 'number' }
  }
};

const surfaceSchema = {
  type: 'object',
  properties: {
    materialId: { type: 'string', enum: WEB_MCP_MATERIAL_IDS },
    tileSize: { type: 'number', minimum: 0.25, maximum: 12 },
    rotation: { type: 'number', minimum: -180, maximum: 180 },
    roughness: { type: 'number', minimum: 0.15, maximum: 1 },
    normalStrength: { type: 'number', minimum: 0, maximum: 2 }
  }
};

const itemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Optionale stabile Objekt-ID.' },
    title: { type: 'string', maxLength: 160 },
    description: { type: 'string', maxLength: 4000 },
    modelUrl: { type: 'string', description: 'HTTP(S)-URL zu GLTF, GLB, FBX oder einer Sketchfab-Modellseite.' },
    thumbnailUrl: { type: 'string', description: 'Optionale HTTP(S)-URL zum Vorschaubild.' },
    attribution: { type: 'string', maxLength: 500 },
    license: { type: 'string', maxLength: 160 },
    thumbnailTransform: transformSchema,
    modelTransform: transformSchema
  },
  required: ['title', 'modelUrl']
};

const stationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Optionale stabile Stations-ID.' },
    title: { type: 'string', maxLength: 160 },
    introduction: { type: 'string', maxLength: 5000 },
    thumbnailLayout: { type: 'string', enum: ['tiles', 'carousel'] },
    thumbnailGridSpacing: { type: 'number', minimum: 60, maximum: 140 },
    selectedItemId: { type: 'string' },
    initialItemId: { type: 'string' },
    spatial: {
      type: 'object',
      properties: {
        position: vectorSchema,
        rotation: vectorSchema,
        movementRadius: { type: 'number', minimum: 1, maximum: 30 },
        wallMaterial: { type: 'string', enum: WEB_MCP_MATERIAL_IDS },
        surfaceMaterials: {
          type: 'object',
          properties: { wall: surfaceSchema, floor: surfaceSchema, plinth: surfaceSchema }
        },
        wallBackground: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            opacity: { type: 'number', minimum: 0.05, maximum: 1 }
          }
        },
        camera: {
          type: 'object',
          properties: {
            position: vectorSchema,
            target: vectorSchema,
            fov: { type: 'number', minimum: 25, maximum: 100 }
          }
        },
        lighting: {
          type: 'object',
          properties: {
            ambientIntensity: { type: 'number', minimum: 0, maximum: 3 },
            keyLightColor: { type: 'string', description: 'CSS-Hexfarbe, zum Beispiel #f2dfc3.' },
            keyLightIntensity: { type: 'number', minimum: 0, maximum: 8 },
            keyLightPosition: vectorSchema,
            keyLightTarget: vectorSchema
          }
        },
        audio: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Optionale HTTP(S)-URL zur Audio-Datei.' },
            volume: { type: 'number', minimum: 0, maximum: 1 },
            spatial: { type: 'boolean' },
            range: { type: 'number', minimum: 1, maximum: 50 },
            autoplay: { type: 'boolean' }
          }
        }
      }
    },
    items: { type: 'array', items: itemSchema, maxItems: 12 }
  },
  required: ['title', 'introduction', 'spatial', 'items']
};

const exhibitionProperties = {
  name: { type: 'string', maxLength: 160, description: 'Titel der Ausstellung.' },
  description: { type: 'string', maxLength: 5000, description: 'Kuratorisches Gesamtkonzept und Ziel der Ausstellung.' },
  location: { type: 'string', maxLength: 240 },
  coverImage: { type: 'string', description: 'Optionale HTTP(S)-URL zum Vorschaubild.' },
  language: { type: 'string', enum: WEB_MCP_EXHIBITION_LANGUAGES },
  categories: {
    type: 'array',
    items: { type: 'string', enum: WEB_MCP_EXHIBITION_CATEGORIES },
    minItems: 1,
    uniqueItems: true
  },
  license: { type: 'string', maxLength: 160 },
  subtitle: { type: 'string', maxLength: 240 },
  watermark: { type: 'string', maxLength: 80 },
  stations: { type: 'array', items: stationSchema, minItems: 1, maxItems: 20 }
};

export const WEB_MCP_CREATE_EXHIBITION_SCHEMA = {
  type: 'object',
  properties: exhibitionProperties,
  required: ['name', 'description', 'categories', 'stations']
};

export const WEB_MCP_UPDATE_EXHIBITION_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID des zu bearbeitenden Entwurfs.' },
    exhibition: { type: 'object', properties: exhibitionProperties }
  },
  required: ['id', 'exhibition']
};

const freshAuthorizedSession = () => {
  const session = readSession();
  if (!session) throw new Error('Für dieses Tool ist eine aktive RIU-Anmeldung erforderlich.');
  if (session.isBlocked) throw new Error('Dieses RIU-Konto ist gesperrt.');
  return session;
};

const editableDraft = (id, session) => {
  const story = getStory(String(id || ''));
  if (!story || !canEditStory(story, session.id)) throw new Error('Dieser Ausstellungsentwurf darf nicht bearbeitet werden.');
  if (story.status !== 'draft') throw new Error('WebMCP darf nur Entwürfe bearbeiten.');
  if (story.settings?.experienceType !== 'room') throw new Error('WebMCP bearbeitet in dieser Version nur Raum-Ausstellungen.');
  return story;
};

const createDraft = async (input) => {
  const session = freshAuthorizedSession();
  if (!canCreateStories(session)) throw new Error('Ihre RIU-Rolle darf keine Ausstellungen erstellen.');
  const exhibition = normalizeWebMcpExhibition(input);
  const base = createStory({
    ownerId: session.id,
    authorName: session.name,
    name: exhibition.name,
    description: exhibition.description,
    coverImage: exhibition.coverImage,
    language: exhibition.language,
    categories: exhibition.categories
  });
  const story = {
    ...base,
    location: exhibition.location,
    metadata: { ...base.metadata, license: exhibition.license },
    branding: {
      ...base.branding,
      subtitle: exhibition.subtitle,
      watermark: exhibition.watermark
    },
    stations: exhibition.stations
  };
  return toWebMcpExhibition(await saveStory(story));
};

const updateDraft = async ({ id, exhibition: input }) => {
  const session = freshAuthorizedSession();
  const story = editableDraft(id, session);
  const exhibition = normalizeWebMcpExhibition(input, story);
  const updated = {
    ...story,
    name: exhibition.name,
    description: exhibition.description,
    location: exhibition.location,
    coverImage: exhibition.coverImage,
    metadata: {
      ...story.metadata,
      language: exhibition.language,
      category: exhibition.categories[0],
      categories: exhibition.categories,
      license: exhibition.license
    },
    branding: {
      ...story.branding,
      title: exhibition.name,
      subtitle: exhibition.subtitle,
      watermark: exhibition.watermark
    },
    stations: exhibition.stations
  };
  return toWebMcpExhibition(await saveStory(updated));
};

const jsonResult = (value) => JSON.stringify(value);

export async function registerRiuWebMcpTools(modelContext = document.modelContext, signal) {
  if (!modelContext?.registerTool) return false;
  const registrationOptions = signal ? { signal } : undefined;
  const tools = [
    {
      name: 'list_my_exhibition_drafts',
      description: 'Listet die Raum-Ausstellungsentwürfe auf, die der aktuell eingeloggte RIU-User bearbeiten darf.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async () => {
        const session = freshAuthorizedSession();
        return jsonResult(readStories()
          .filter((story) => story.status === 'draft' && story.settings?.experienceType === 'room' && canEditStory(story, session.id))
          .map((story) => ({ id: story.id, name: story.name, description: story.description, updatedAt: story.updatedAt, editorUrl: `/studio/${story.id}` })));
      }
    },
    {
      name: 'get_exhibition_draft',
      description: 'Liest das vollständige Konzept, die Stationen, Medien, Materialien, Beleuchtung, Kameras und 3D-Objekte eines bearbeitbaren RIU-Ausstellungsentwurfs.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'ID des Ausstellungsentwurfs.' } },
        required: ['id']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async ({ id }) => jsonResult(toWebMcpExhibition(editableDraft(id, freshAuthorizedSession())))
    },
    {
      name: 'create_exhibition_draft',
      description: 'Konzipiert und speichert eine vollständige begehbare RIU-Raum-Ausstellung als privaten Entwurf. Lege eine schlüssige Dramaturgie mit 1 bis 20 Stationen an und verwende ausschließlich belegte, lizenzierte Medien- und 3D-Modell-URLs. Veröffentlicht die Ausstellung nicht.',
      inputSchema: WEB_MCP_CREATE_EXHIBITION_SCHEMA,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      execute: async (input) => jsonResult(await createDraft(input))
    },
    {
      name: 'update_exhibition_draft',
      description: 'Überarbeitet einen bearbeitbaren privaten RIU-Raum-Ausstellungsentwurf. Angegebene Felder werden ersetzt, ausgelassene Felder bleiben erhalten. Veröffentlicht die Ausstellung nicht.',
      inputSchema: WEB_MCP_UPDATE_EXHIBITION_SCHEMA,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      execute: async (input) => jsonResult(await updateDraft(input))
    },
    {
      name: 'open_exhibition_editor',
      description: 'Öffnet einen bearbeitbaren RIU-Ausstellungsentwurf sichtbar im Editor.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'ID des Ausstellungsentwurfs.' } },
        required: ['id']
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async ({ id }) => {
        const story = editableDraft(id, freshAuthorizedSession());
        window.location.assign(`/studio/${story.id}`);
        return null;
      }
    }
  ];
  await Promise.all(tools.map((tool) => modelContext.registerTool(tool, registrationOptions)));
  return true;
}
