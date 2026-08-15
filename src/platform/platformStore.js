import starhembergConfig from '../../project/starhemberg.project (12).json' with { type: 'json' };
import heidentorConfig from '../../heidentor-stations.json' with { type: 'json' };
import {
  deleteRecord, putRecord, readAllRecords, readMeta, readRecord, replaceAllRecords, STORES, writeMeta
} from './platformDatabase.js';
import { HEIDENTOR_STABLE_LIGHTING } from '../projects/projectLightingPresets.js';
import { isSupabaseConfigured, signInWithOAuth, signOutFromSupabase } from './supabaseClient.js';
import {
  deleteStoryFromSupabase, deleteStoryPreviewFromSupabase, fetchRemoteStories, importLegacyStories,
  loadSupabaseState, syncStoriesToSupabase, syncStoryToSupabase, updateSupabaseProfile,
  uploadStoryPreviewToSupabase
} from './supabaseStore.js';
import { normalizeUserRole } from './accessControl.js';

export const STORIES_KEY = 'three_story_projects_v1';
export const ACTIVE_STORY_KEY = 'three_story_active_project_v1';
export const USERS_KEY = 'riu_users_v1';
export const SESSION_KEY = 'riu_session_v1';

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));

export const COLLABORATOR_ROLES = ['editor', 'viewer'];
export const COLLABORATION_STATUSES = ['pending', 'accepted', 'declined'];

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 32);
}

export function normalizeStoryCollaborators(collaborators) {
  if (!Array.isArray(collaborators)) return [];
  const seen = new Set();
  return collaborators.flatMap((collaborator) => {
    if (!collaborator?.userId || seen.has(collaborator.userId)) return [];
    seen.add(collaborator.userId);
    return [{
      userId: collaborator.userId,
      username: normalizeUsername(collaborator.username),
      name: String(collaborator.name || collaborator.username || '').trim(),
      role: COLLABORATOR_ROLES.includes(collaborator.role) ? collaborator.role : 'viewer',
      status: COLLABORATION_STATUSES.includes(collaborator.status) ? collaborator.status : 'pending',
      invitedAt: collaborator.invitedAt || now(),
      respondedAt: collaborator.respondedAt || null
    }];
  });
}

export function getStoryPermission(story, userId) {
  if (!story || !userId) return null;
  if (story.ownerId === userId) return 'owner';
  const collaborator = normalizeStoryCollaborators(story.collaborators)
    .find((item) => item.userId === userId && item.status === 'accepted');
  return collaborator?.role || null;
}

export const canEditStory = (story, userId) => ['owner', 'editor'].includes(getStoryPermission(story, userId));
export const canViewStory = (story, userId) => story?.status === 'published' || !!getStoryPermission(story, userId);

export function getStoryEditors(story) {
  return normalizeStoryCollaborators(story?.collaborators)
    .filter((collaborator) => collaborator.status === 'accepted' && collaborator.role === 'editor');
}

export function normalizeStoryCategories(categories, legacyCategory = '') {
  const values = Array.isArray(categories) ? categories : (categories ? [categories] : []);
  const normalized = [...new Set(values
    .map((category) => String(category || '').trim())
    .filter(Boolean))];
  const legacy = String(legacyCategory || '').trim();
  if (!normalized.length && legacy) normalized.push(legacy);
  return normalized.length ? normalized : ['Sonstiges'];
}

let usersCache = [];
let storiesCache = [];
let demoOwnerId = '';
const recordedStoryViews = new Set();

function ensureUsernames(users) {
  const used = new Set();
  return (Array.isArray(users) ? users : []).map((user, index) => {
    const base = normalizeUsername(user.username || user.email?.split('@')[0] || user.name) || `user-${index + 1}`;
    let username = base;
    let suffix = 2;
    while (used.has(username)) username = `${base.slice(0, 28)}-${suffix++}`;
    used.add(username);
    return { ...user, username };
  });
}

const demoStories = [
  {
    ...clone(starhembergConfig.project),
    id: 'demo-starhemberg',
    slug: 'starhemberg',
    name: 'Burg Starhemberg',
    description: 'Eine räumliche Erzählung durch die Baugeschichte einer der bedeutendsten Burgruinen Niederösterreichs.',
    ownerId: 'riu-curatorial',
    authorName: 'RIU Redaktion',
    status: 'published',
    publishedAt: '2026-07-12T10:00:00.000Z',
    createdAt: '2026-07-12T10:00:00.000Z',
    updatedAt: '2026-08-02T09:12:52.000Z',
    coverImage: 'https://starhemberg.vercel.app/star_sky_bg.png',
    location: 'Markt Piesting, Österreich',
    metadata: { language: 'de', category: 'Kulturerbe', categories: ['Kulturerbe'] },
    stats: { views: 0, lastViewedAt: null },
    models: { primary: 'https://starhemberg.vercel.app/model/scene.gltf', reconstruction: '', localModelName: '', primaryName: 'Burg Starhemberg' },
    branding: { title: 'Burg Starhemberg', subtitle: 'Stein gewordene Geschichte', watermark: 'STARHEMBERG' },
    alignment: clone(starhembergConfig.alignment),
    annotations: clone(starhembergConfig.annotations || []),
    stations: clone(starhembergConfig.stations || []),
    settings: clone(starhembergConfig.project?.settings || {})
  },
  {
    id: 'demo-heidentor',
    slug: 'heidentor',
    name: 'Das Heidentor',
    description: 'Ruine und Rekonstruktion begegnen einander in einer Reise durch Österreichs größtes erhaltenes römisches Monument.',
    ownerId: 'riu-curatorial',
    authorName: 'RIU Redaktion',
    status: 'published',
    publishedAt: '2026-07-10T10:00:00.000Z',
    createdAt: '2026-07-10T10:00:00.000Z',
    updatedAt: '2026-07-13T16:18:22.000Z',
    stationRevision: 1,
    coverImage: 'https://heidentor.vercel.app/roman_blueprint_bg.png',
    location: 'Petronell-Carnuntum, Österreich',
    metadata: { language: 'de', category: 'Archäologie', categories: ['Archäologie'] },
    stats: { views: 0, lastViewedAt: null },
    branding: { title: 'Das Heidentor', subtitle: 'Zwischen Bestand und Rekonstruktion', watermark: 'HEIDENTOR' },
    models: {
      primary: 'https://heidentor.vercel.app/the_heidentor_in_petronell-carnuntum/scene.gltf',
      reconstruction: 'https://heidentor.vercel.app/reconstruction_of_the_heidentor/scene.gltf',
      localModelName: '',
      primaryName: 'Heidentor · heutige Ruine',
      reconstructionName: 'Heidentor · Rekonstruktion'
    },
    settings: { scrollSpeed: 1, lighting: clone(HEIDENTOR_STABLE_LIGHTING) },
    alignment: clone(heidentorConfig.alignment),
    annotations: [],
    stations: clone(heidentorConfig.stations || [])
  }
];

export function findCrossStoryStationSource(stations, currentStoryId, stories = demoStories) {
  const candidateIds = new Set((Array.isArray(stations) ? stations : []).map((station) => station?.id).filter(Boolean));
  if (candidateIds.size < 2) return null;
  const currentStory = stories.find((story) => story.id === currentStoryId);
  const currentIds = new Set((currentStory?.stations || []).map((station) => station?.id).filter(Boolean));
  const currentMatches = [...candidateIds].filter((id) => currentIds.has(id)).length;
  if (currentMatches / candidateIds.size > 0.25) return null;

  return stories.find((story) => {
    if (story.id === currentStoryId) return false;
    const referenceIds = new Set((story.stations || []).map((station) => station?.id).filter(Boolean));
    const matches = [...candidateIds].filter((id) => referenceIds.has(id)).length;
    return matches / candidateIds.size >= 0.75;
  })?.id ?? null;
}

function safeParse(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const reportDatabaseError = (error) => console.warn('RIU-Datenbank konnte nicht aktualisiert werden.', error);
const persistStoriesNow = () => {
  if (typeof indexedDB === 'undefined') {
    localStorage.setItem(STORIES_KEY, JSON.stringify(storiesCache));
    return Promise.resolve();
  }
  return replaceAllRecords(STORES.stories, storiesCache);
};
const persistStories = () => {
  persistStoriesNow().catch(reportDatabaseError);
};

function seededStories(current = storiesCache) {
  const userStories = Array.isArray(current)
    ? current.filter((story) => !demoStories.some((demo) => demo.id === story?.id)).map((story) => {
      const categories = normalizeStoryCategories(story.metadata?.categories, story.metadata?.category || story.category);
      return {
        ...story,
        collaborators: normalizeStoryCollaborators(story.collaborators),
        metadata: {
          ...story.metadata,
          language: story.metadata?.language || story.language || 'de',
          category: categories[0],
          categories
        },
        stats: { views: Number(story.stats?.views) || 0, lastViewedAt: story.stats?.lastViewedAt || null }
      };
    })
    : [];
  const existingDemos = new Map((Array.isArray(current) ? current : [])
    .filter((story) => demoStories.some((demo) => demo.id === story?.id))
    .map((story) => [story.id, story]));
  const owner = usersCache.find((user) => user.id === demoOwnerId);
  return [
    ...demoStories.map((demo) => {
      const existing = existingDemos.get(demo.id);
      const hasCrossStoryData = !!findCrossStoryStationSource(existing?.stations, demo.id, demoStories);
      const storyData = owner
        ? { ...demo, ...existing }
        : { ...existing, ...demo };
      const categories = normalizeStoryCategories(
        storyData.metadata?.categories,
        storyData.metadata?.category || storyData.category
      );
      const demoLightingRevision = Number(demo.settings?.lighting?.stationConsistencyRevision) || 0;
      const existingLightingRevision = Number(storyData.settings?.lighting?.stationConsistencyRevision) || 0;
      return {
        ...storyData,
        ...(demoLightingRevision > existingLightingRevision ? {
          settings: {
            ...storyData.settings,
            lighting: clone(demo.settings.lighting)
          }
        } : {}),
        ...(hasCrossStoryData ? {
          models: clone(demo.models),
          settings: clone(demo.settings),
          alignment: clone(demo.alignment),
          annotations: clone(demo.annotations),
          stations: clone(demo.stations)
        } : {}),
        ownerId: owner?.id || existing?.ownerId || demo.ownerId,
        authorName: owner?.name || existing?.authorName || demo.authorName,
        collaborators: normalizeStoryCollaborators(storyData.collaborators),
        metadata: { ...storyData.metadata, category: categories[0], categories },
        stats: { views: Number(existing?.stats?.views) || 0, lastViewedAt: existing?.stats?.lastViewedAt || null }
      };
    }),
    ...userStories
  ];
}

export function mergeStoryCollections(localStories = [], remoteStories = []) {
  const merged = new Map();
  for (const story of Array.isArray(localStories) ? localStories : []) {
    if (story?.id) merged.set(story.id, story);
  }
  for (const story of Array.isArray(remoteStories) ? remoteStories : []) {
    if (story?.id) merged.set(story.id, story);
  }
  return [...merged.values()];
}

async function migrateLocalStoryPreviews(remoteStories) {
  if (typeof indexedDB === 'undefined') return remoteStories;
  const previewAssets = await readAllRecords(STORES.previewAssets);
  if (!previewAssets.length) return remoteStories;

  const migratedStories = [...remoteStories];
  for (const previewAsset of previewAssets) {
    const storyIndex = migratedStories.findIndex((story) => story.id === previewAsset.storyId);
    const story = migratedStories[storyIndex];
    if (!story || story.previewVideoUrl || !(previewAsset.blob instanceof Blob) || previewAsset.blob.size === 0) continue;
    const generatedAt = previewAsset.createdAt || now();
    const remotePreview = await uploadStoryPreviewToSupabase(story, previewAsset.blob, generatedAt);
    if (!remotePreview) continue;
    const updated = {
      ...story,
      previewVideoAssetId: previewAsset.id,
      previewVideoUrl: remotePreview.publicUrl,
      previewVideoStoragePath: remotePreview.storagePath,
      previewGeneratedAt: generatedAt,
      previewVideoMimeType: previewAsset.mimeType || previewAsset.blob.type || 'video/webm',
      previewDurationSeconds: previewAsset.durationSeconds || 3,
      previewReturnDurationSeconds: previewAsset.returnDurationSeconds || 3.5,
      previewEndStationNumber: previewAsset.endStationNumber || 2,
      previewPlaybackMode: previewAsset.playbackMode || 'ping-pong',
      updatedAt: generatedAt
    };
    await syncStoryToSupabase(updated);
    migratedStories[storyIndex] = updated;
  }
  return migratedStories;
}

export async function initializePlatformStore() {
  const legacyActiveUserId = safeParse(SESSION_KEY, null)?.userId || '';
  if (typeof indexedDB === 'undefined') {
    usersCache = ensureUsernames(safeParse(USERS_KEY, []));
    storiesCache = seededStories(safeParse(STORIES_KEY, []));
  } else {
    const [databaseUsers, databaseStories, ownerRecord] = await Promise.all([
      readAllRecords(STORES.users),
      readAllRecords(STORES.stories),
      readMeta('demoOwnerId')
    ]);
    usersCache = ensureUsernames(databaseUsers.length ? databaseUsers : safeParse(USERS_KEY, []));
    storiesCache = databaseStories.length ? databaseStories : safeParse(STORIES_KEY, []);
    demoOwnerId = ownerRecord?.value || '';
    if (!demoOwnerId && usersCache.some((user) => user.id === legacyActiveUserId)) {
      demoOwnerId = legacyActiveUserId;
      await writeMeta('demoOwnerId', demoOwnerId);
    }
    storiesCache = seededStories(storiesCache);
  }

  if (isSupabaseConfigured) {
    const remoteState = await loadSupabaseState();
    if (remoteState.authUser && remoteState.user) {
      if (remoteState.user.isBlocked) {
        await signOutFromSupabase();
        localStorage.removeItem(SESSION_KEY);
        localStorage.setItem('riu_auth_notice', 'Dieses Konto wurde von einem Administrator gesperrt.');
        storiesCache = seededStories(mergeStoryCollections(storiesCache, remoteState.stories));
      } else {
      await importLegacyStories(storiesCache, remoteState.authUser, [legacyActiveUserId, demoOwnerId]);
      const remoteStories = await migrateLocalStoryPreviews(await fetchRemoteStories());
      usersCache = ensureUsernames(remoteState.users);
      demoOwnerId = remoteState.user.id;
      storiesCache = seededStories(remoteStories);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: remoteState.user.id }));
      if (typeof indexedDB !== 'undefined') await writeMeta('demoOwnerId', demoOwnerId);
      }
    } else {
      // Keep the pre-OAuth browser data until the user has signed in and the
      // authenticated migration can claim it. Public rows still win on ID
      // collisions, but must never erase private local drafts.
      storiesCache = seededStories(mergeStoryCollections(storiesCache, remoteState.stories));
    }
  }

  if (typeof indexedDB !== 'undefined') {
    await Promise.all([
      replaceAllRecords(STORES.users, usersCache),
      replaceAllRecords(STORES.stories, storiesCache)
    ]);
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(STORIES_KEY);
  } else {
    localStorage.setItem(USERS_KEY, JSON.stringify(usersCache));
    localStorage.setItem(STORIES_KEY, JSON.stringify(storiesCache));
  }
}

export const platformReady = typeof window !== 'undefined'
  ? initializePlatformStore().catch((error) => {
    reportDatabaseError(error);
    if (!usersCache.length) usersCache = safeParse(USERS_KEY, []);
    if (!storiesCache.length) storiesCache = seededStories(safeParse(STORIES_KEY, []));
  })
  : Promise.resolve();

export function ensureSeedStories() {
  storiesCache = seededStories(storiesCache);
  persistStories();
  return storiesCache;
}

export function readStories() {
  return ensureSeedStories();
}

export function writeStories(stories) {
  storiesCache = clone(stories);
  persistStories();
  syncStoriesToSupabase(storiesCache).catch(reportDatabaseError);
  window.dispatchEvent(new CustomEvent('riu-stories-changed'));
  return storiesCache;
}

export function getStory(idOrSlug) {
  return readStories().find((story) => story.id === idOrSlug || story.slug === idOrSlug) ?? null;
}

export function getRouteStory(pathname = window.location.pathname) {
  const match = pathname.match(/^\/(?:stories|studio)\/([^/]+)/);
  if (!match) return null;
  const story = getStory(decodeURIComponent(match[1]));
  if (story) localStorage.setItem(ACTIVE_STORY_KEY, story.id);
  return story;
}

export function createStory({
  ownerId, authorName, name, description, modelUrl, coverImage = '', language = 'de', categories, category = 'Sonstiges'
}) {
  const created = now();
  const id = globalThis.crypto?.randomUUID?.() ?? `story_${Date.now()}`;
  const normalizedCategories = normalizeStoryCategories(categories, category);
  return {
    id,
    slug: id,
    name: name.trim(),
    description: description.trim(),
    ownerId,
    authorName,
    status: 'draft',
    createdAt: created,
    updatedAt: created,
    publishedAt: null,
    coverImage,
    location: '',
    metadata: { language, category: normalizedCategories[0], categories: normalizedCategories },
    stats: { views: 0, lastViewedAt: null },
    branding: { title: name.trim(), subtitle: '', watermark: name.trim().toUpperCase() },
    models: { primary: modelUrl.trim(), reconstruction: '', localModelName: '', primaryName: name.trim() },
    settings: { scrollSpeed: 1 },
    alignment: null,
    annotations: [],
    collaborators: [],
    stations: [{
      id: `station_${Date.now()}`,
      title: 'Auftakt',
      description: 'Beginnen Sie hier Ihre räumliche Erzählung.',
      viewMode: 'ruin',
      cameraPos: { x: 0, y: 5, z: 14 },
      cameraTarget: { x: 0, y: 2.5, z: 0 },
      cameraExplicitlySet: false,
      freeNavigation: false,
      showAnnotations: true,
      images: []
    }]
  };
}

export async function saveStory(story) {
  const stories = readStories();
  const next = stories.some((item) => item.id === story.id)
    ? stories.map((item) => item.id === story.id ? { ...story, updatedAt: now() } : item)
    : [...stories, story];
  const previousStories = storiesCache;
  storiesCache = clone(next);
  try {
    await persistStoriesNow();
  } catch (error) {
    storiesCache = previousStories;
    throw error;
  }
  await syncStoryToSupabase(storiesCache.find((item) => item.id === story.id) ?? story);
  window.dispatchEvent(new CustomEvent('riu-stories-changed'));
  return storiesCache.find((item) => item.id === story.id) ?? story;
}

export function updateStoryMetadata(storyId, actorId, metadata) {
  const stories = readStories();
  const story = stories.find((item) => item.id === storyId);
  if (!story || !canEditStory(story, actorId)) throw new Error('Die Metadaten dieser Story dürfen nicht geändert werden.');

  const name = String(metadata.name || '').trim();
  if (!name) throw new Error('Bitte geben Sie einen Namen für die Story ein.');
  const categories = normalizeStoryCategories(metadata.categories, metadata.category || story.metadata?.category);
  const updated = {
    ...story,
    name,
    description: String(metadata.description || '').trim(),
    coverImage: String(metadata.coverImage || '').trim(),
    metadata: {
      ...story.metadata,
      language: metadata.language || story.metadata?.language || 'de',
      category: categories[0],
      categories,
      license: String(metadata.license || '').trim()
    },
    branding: { ...story.branding, title: name },
    updatedAt: now()
  };
  writeStories(stories.map((item) => item.id === storyId ? updated : item));
  return updated;
}

function requireOwnedStory(storyId, ownerId) {
  const story = readStories().find((item) => item.id === storyId);
  if (!story || story.ownerId !== ownerId) throw new Error('Nur der Story-Ersteller darf die Zusammenarbeit verwalten.');
  return story;
}

function findUserByUsername(username) {
  const normalized = normalizeUsername(username);
  return usersCache.find((user) => normalizeUsername(user.username) === normalized) || null;
}

export function inviteStoryCollaborator(storyId, ownerId, { username, role }) {
  const story = requireOwnedStory(storyId, ownerId);
  const normalizedRole = COLLABORATOR_ROLES.includes(role) ? role : 'viewer';
  const user = findUserByUsername(username);
  if (!user) throw new Error('Unter diesem Username wurde kein Konto gefunden.');
  if (user.id === ownerId) throw new Error('Sie sind bereits Ersteller:in dieser Story.');
  const collaborators = normalizeStoryCollaborators(story.collaborators);
  const existing = collaborators.find((item) => item.userId === user.id);
  if (existing?.status === 'accepted') throw new Error('Diese Person arbeitet bereits an der Story mit.');
  const invitation = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: normalizedRole,
    status: 'pending',
    invitedAt: now(),
    respondedAt: null
  };
  const updated = {
    ...story,
    collaborators: existing
      ? collaborators.map((item) => item.userId === user.id ? invitation : item)
      : [...collaborators, invitation],
    updatedAt: now()
  };
  writeStories(readStories().map((item) => item.id === storyId ? updated : item));
  return updated;
}

export function respondToCollaboration(storyId, userId, response) {
  if (!['accepted', 'declined'].includes(response)) throw new Error('Ungültige Antwort auf die Anfrage.');
  const stories = readStories();
  const story = stories.find((item) => item.id === storyId);
  const collaborators = normalizeStoryCollaborators(story?.collaborators);
  const invitation = collaborators.find((item) => item.userId === userId && item.status === 'pending');
  if (!story || !invitation) throw new Error('Diese Anfrage ist nicht mehr verfügbar.');
  const updated = {
    ...story,
    collaborators: collaborators.map((item) => item.userId === userId
      ? { ...item, status: response, respondedAt: now() }
      : item),
    updatedAt: now()
  };
  writeStories(stories.map((item) => item.id === storyId ? updated : item));
  return updated;
}

export function updateStoryCollaboratorRole(storyId, ownerId, userId, role) {
  const story = requireOwnedStory(storyId, ownerId);
  if (!COLLABORATOR_ROLES.includes(role)) throw new Error('Bitte wählen Sie Editor oder Viewer.');
  const collaborators = normalizeStoryCollaborators(story.collaborators);
  if (!collaborators.some((item) => item.userId === userId)) throw new Error('Diese Person wurde nicht gefunden.');
  const updated = {
    ...story,
    collaborators: collaborators.map((item) => item.userId === userId ? { ...item, role } : item),
    updatedAt: now()
  };
  writeStories(readStories().map((item) => item.id === storyId ? updated : item));
  return updated;
}

export function removeStoryCollaborator(storyId, ownerId, userId) {
  const story = requireOwnedStory(storyId, ownerId);
  const updated = {
    ...story,
    collaborators: normalizeStoryCollaborators(story.collaborators).filter((item) => item.userId !== userId),
    updatedAt: now()
  };
  writeStories(readStories().map((item) => item.id === storyId ? updated : item));
  return updated;
}

export function recordStoryView(storyId, viewerId = '') {
  const story = storiesCache.find((item) => item.id === storyId);
  if (!story || story.status !== 'published' || story.ownerId === viewerId || recordedStoryViews.has(storyId)) {
    return story ?? null;
  }

  recordedStoryViews.add(storyId);
  const updated = {
    ...story,
    stats: {
      ...story.stats,
      views: (Number(story.stats?.views) || 0) + 1,
      lastViewedAt: now()
    }
  };
  storiesCache = storiesCache.map((item) => item.id === storyId ? updated : item);
  putRecord(STORES.stories, updated).catch(reportDatabaseError);
  window.dispatchEvent(new CustomEvent('riu-stories-changed'));
  return updated;
}

export function publishStory(storyId, ownerId) {
  const stories = readStories();
  const story = stories.find((item) => item.id === storyId);
  if (!story || story.ownerId !== ownerId) throw new Error('Diese Story darf nicht veröffentlicht werden.');
  const publishedAt = story.publishedAt || now();
  const next = stories.map((item) => item.id === storyId
    ? { ...item, status: 'published', publishedAt, updatedAt: now() }
    : item);
  writeStories(next);
  return next.find((item) => item.id === storyId);
}

export function unpublishStory(storyId, ownerId) {
  const stories = readStories();
  const story = stories.find((item) => item.id === storyId);
  if (!story || story.ownerId !== ownerId) throw new Error('Die Freigabe dieser Story darf nicht geändert werden.');
  const next = stories.map((item) => item.id === storyId
    ? { ...item, status: 'draft', unpublishedAt: now(), updatedAt: now() }
    : item);
  writeStories(next);
  return next.find((item) => item.id === storyId);
}

export function deleteStory(storyId, ownerId) {
  const story = getStory(storyId);
  if (!story || story.ownerId !== ownerId) throw new Error('Diese Story darf nicht gelöscht werden.');
  writeStories(readStories().filter((item) => item.id !== storyId));
  deleteStoryFromSupabase(storyId).catch(reportDatabaseError);
  deleteStoryPreviewFromSupabase(story.previewVideoStoragePath).catch(reportDatabaseError);
  if (story.previewVideoAssetId && typeof indexedDB !== 'undefined') {
    deleteRecord(STORES.previewAssets, story.previewVideoAssetId).catch(reportDatabaseError);
  }
}

export async function saveStoryPreview(storyId, previewBlob, {
  durationSeconds = 3,
  returnDurationSeconds = 3.5,
  endStationNumber = 2,
  playbackMode = 'ping-pong'
} = {}) {
  if (!(previewBlob instanceof Blob) || previewBlob.size === 0) {
    throw new Error('Die erzeugte Preview enthält keine Videodaten.');
  }
  if (typeof indexedDB === 'undefined') {
    throw new Error('Dieser Browser unterstützt die lokale Preview-Speicherung nicht.');
  }
  const story = getStory(storyId);
  if (!story || !canEditStory(story, readSession()?.id)) {
    throw new Error('Die Preview dieser Story darf nicht geändert werden.');
  }

  // Eine stabile Asset-ID ersetzt das alte WebM und verhindert verwaiste Dateien.
  const assetId = `story-preview:${storyId}`;
  const generatedAt = now();
  const remotePreview = await uploadStoryPreviewToSupabase(story, previewBlob, generatedAt);
  await putRecord(STORES.previewAssets, {
    id: assetId,
    storyId,
    blob: previewBlob,
    mimeType: previewBlob.type || 'video/webm',
    durationSeconds,
    returnDurationSeconds,
    endStationNumber,
    playbackMode,
    createdAt: generatedAt
  });

  const updated = {
    ...story,
    previewVideoAssetId: assetId,
    previewVideoUrl: remotePreview?.publicUrl || story.previewVideoUrl || '',
    previewVideoStoragePath: remotePreview?.storagePath || story.previewVideoStoragePath || '',
    previewGeneratedAt: generatedAt,
    previewVideoMimeType: previewBlob.type || 'video/webm',
    previewDurationSeconds: durationSeconds,
    previewReturnDurationSeconds: returnDurationSeconds,
    previewEndStationNumber: endStationNumber,
    previewPlaybackMode: playbackMode,
    updatedAt: generatedAt
  };
  storiesCache = storiesCache.map((item) => item.id === storyId ? updated : item);
  try {
    await putRecord(STORES.stories, updated);
    await syncStoryToSupabase(updated);
  } catch (error) {
    await deleteRecord(STORES.previewAssets, assetId).catch(reportDatabaseError);
    throw error;
  }
  window.dispatchEvent(new CustomEvent('riu-stories-changed'));
  return updated;
}

export async function readStoryPreviewBlob(assetId) {
  if (!assetId || typeof indexedDB === 'undefined') return null;
  return (await readRecord(STORES.previewAssets, assetId))?.blob ?? null;
}

export function readSession() {
  const session = safeParse(SESSION_KEY, null);
  if (!session?.userId) return null;
  const user = usersCache.find((item) => item.id === session.userId);
  return user ? {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: normalizeUserRole(user.role),
    isBlocked: Boolean(user.isBlocked)
  } : null;
}

export async function updateUserProfile(userId, { name, username }) {
  const normalizedName = String(name || '').trim();
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedName) throw new Error('Bitte geben Sie einen Namen ein.');
  if (normalizedUsername.length < 3) throw new Error('Der Username muss mindestens 3 Zeichen lang sein.');
  const user = usersCache.find((item) => item.id === userId);
  if (!user) throw new Error('Das Konto wurde nicht gefunden.');
  if (usersCache.some((item) => item.id !== userId && normalizeUsername(item.username) === normalizedUsername)) {
    throw new Error('Dieser Username ist bereits vergeben.');
  }
  const updatedUser = { ...user, name: normalizedName, username: normalizedUsername, updatedAt: now() };
  usersCache = usersCache.map((item) => item.id === userId ? updatedUser : item);
  storiesCache = storiesCache.map((story) => ({
    ...story,
    ...(story.ownerId === userId ? { authorName: normalizedName, updatedAt: now() } : {}),
    collaborators: normalizeStoryCollaborators(story.collaborators).map((collaborator) => collaborator.userId === userId
      ? { ...collaborator, name: normalizedName, username: normalizedUsername }
      : collaborator)
  }));
  await Promise.all([
    putRecord(STORES.users, updatedUser),
    replaceAllRecords(STORES.stories, storiesCache),
    updateSupabaseProfile(userId, { name: normalizedName, username: normalizedUsername }),
    syncStoriesToSupabase(storiesCache)
  ]);
  return {
    id: updatedUser.id,
    name: updatedUser.name,
    username: updatedUser.username,
    email: updatedUser.email,
    role: normalizeUserRole(updatedUser.role),
    isBlocked: Boolean(updatedUser.isBlocked)
  };
}

export async function loginWithOAuth() {
  await signInWithOAuth('google');
}

export async function logoutUser() {
  await signOutFromSupabase();
  localStorage.removeItem(SESSION_KEY);
}

export function updateStoryProject(projectId, project) {
  const story = storiesCache.find((item) => item.id === projectId);
  if (!story || !canEditStory(story, readSession()?.id)) return null;
  const updated = {
    ...story,
    name: project.name ?? story.name,
    description: project.description ?? story.description,
    coverImage: project.coverImage ?? story.coverImage,
    branding: clone(project.branding ?? story.branding),
    models: clone(project.models ?? story.models),
    settings: clone(project.settings ?? story.settings),
    alignment: clone(project.alignment ?? story.alignment),
    annotations: clone(project.annotations ?? story.annotations),
    stations: clone(project.stations ?? story.stations),
    updatedAt: now()
  };
  storiesCache = storiesCache.map((item) => item.id === projectId ? updated : item);
  putRecord(STORES.stories, updated).catch(reportDatabaseError);
  syncStoryToSupabase(updated).catch(reportDatabaseError);
  return updated;
}

export function isValidModelUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && /\.(?:fbx|glb|gltf)(?:[?#].*)?$/i.test(url.href);
  } catch {
    return false;
  }
}

export { demoStories };
