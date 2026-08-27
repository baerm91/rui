import { authUserToProfile, getSupabase, isSupabaseConfigured } from './supabaseClient.js';
import { normalizeAnalyticsResult } from './storyAnalytics.js';

const LEGACY_SOURCE_KEY = 'riu-indexeddb-v2-carnuntum';
const STORY_PREVIEW_BUCKET = 'story-previews';

const storyToRow = (story, ownerId = story.ownerId) => ({
  id: story.id,
  slug: story.slug || story.id,
  owner_id: ownerId,
  title: story.name || 'Unbenannte Story',
  status: story.status === 'published' ? 'published' : 'draft',
  story: { ...story, ownerId },
  created_at: story.createdAt || new Date().toISOString(),
  updated_at: story.updatedAt || new Date().toISOString(),
  published_at: story.publishedAt || null
});

const rowToStory = (row) => ({
  ...(row.story || {}),
  id: row.id,
  slug: row.slug || row.id,
  ownerId: row.owner_id,
  name: row.title || row.story?.name || 'Unbenannte Story',
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  publishedAt: row.published_at
});

async function ensureProfile(user) {
  const client = await getSupabase();
  const profile = authUserToProfile(user);
  if (!client || !profile) return profile;
  const { error } = await client.from('profiles').update({
    email: profile.email,
    display_name: profile.name,
    updated_at: new Date().toISOString()
  }).eq('id', profile.id);
  if (error) throw error;
  const { data: storedProfile, error: profileError } = await client
    .from('profiles')
    .select('id, email, display_name, username, role, is_blocked')
    .eq('id', profile.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!storedProfile) {
    throw new Error('Das Google-Konto ist vorhanden, aber das RIU-Profil fehlt. Bitte lassen Sie das Konto durch die RIU-Administration reparieren.');
  }
  return {
    id: storedProfile.id,
    email: storedProfile.email || profile.email,
    name: storedProfile.display_name || profile.name,
    username: storedProfile.username || profile.username,
    role: storedProfile.role || 'light-user',
    isBlocked: Boolean(storedProfile.is_blocked)
  };
}

export async function loadSupabaseState() {
  const client = await getSupabase();
  if (!client) return { authUser: null, user: null, users: [], stories: [] };
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const authUser = sessionData.session?.user || null;
  const [{ data: storyRows, error: storyError }, profileResult] = await Promise.all([
    client.from('stories').select('*').order('updated_at', { ascending: false }),
    authUser
      ? client.from('profiles').select('id, email, display_name, username, role, is_blocked')
      : Promise.resolve({ data: [], error: null })
  ]);
  if (storyError) throw storyError;
  if (profileResult.error) throw profileResult.error;
  const user = authUser ? await ensureProfile(authUser) : null;
  const users = (profileResult.data || []).map((profile) => ({
    id: profile.id,
    email: profile.email || '',
    name: profile.display_name || profile.username,
    username: profile.username,
    role: profile.role || 'light-user',
    isBlocked: Boolean(profile.is_blocked)
  }));
  if (user && !users.some((profile) => profile.id === user.id)) users.push(user);
  return { authUser, user, users, stories: (storyRows || []).map(rowToStory) };
}

export async function importLegacyStories(stories, authUser, legacyOwnerIds = []) {
  const client = await getSupabase();
  if (!client || !authUser) return [];
  const profile = await ensureProfile(authUser);
  const { data: imported, error: importReadError } = await client
    .from('legacy_imports')
    .select('story_ids')
    .eq('user_id', authUser.id)
    .eq('source_key', LEGACY_SOURCE_KEY)
    .maybeSingle();
  if (importReadError) throw importReadError;
  const previouslyImportedIds = new Set(imported?.story_ids || []);

  const ownerIds = new Set([...legacyOwnerIds.filter(Boolean), 'riu-curatorial']);
  const claimed = (stories || [])
    .filter((story) => ownerIds.has(story.ownerId) && !previouslyImportedIds.has(story.id))
    .map((story) => ({ ...story, ownerId: authUser.id, authorName: profile.name }));

  if (claimed.length) {
    const { error: storyError } = await client.from('stories').upsert(
      claimed.map((story) => storyToRow(story, authUser.id)),
      // A browser can contain seeded story IDs that already belong to another
      // account. Never turn a login migration into an UPDATE of those rows.
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (storyError) throw storyError;
  }

  const storyIds = [...new Set([...previouslyImportedIds, ...claimed.map((story) => story.id)])];
  const { error: markerError } = await client.from('legacy_imports').upsert({
    user_id: authUser.id,
    source_key: LEGACY_SOURCE_KEY,
    story_ids: storyIds
  }, { onConflict: 'user_id,source_key' });
  if (markerError) throw markerError;
  return storyIds;
}

export async function fetchRemoteStories() {
  const client = await getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('stories').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToStory);
}

export async function syncStoryToSupabase(story) {
  const client = await getSupabase();
  if (!client || !story?.id) return story;
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId || story.ownerId !== userId) return story;
  const { error } = await client.from('stories').upsert(storyToRow(story, userId), { onConflict: 'id' });
  if (error) throw error;
  return story;
}

export async function syncStoriesToSupabase(stories) {
  if (!isSupabaseConfigured) return;
  await Promise.all((stories || []).map((story) => syncStoryToSupabase(story)));
}

export async function uploadStoryPreviewToSupabase(story, previewBlob, generatedAt) {
  const client = await getSupabase();
  if (!client || !story?.id || !(previewBlob instanceof Blob)) return null;
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Bitte melden Sie sich erneut an, um die Preview zu speichern.');

  const extension = previewBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const storagePath = `${userId}/${story.id}.${extension}`;
  const { error } = await client.storage.from(STORY_PREVIEW_BUCKET).upload(storagePath, previewBlob, {
    cacheControl: '60',
    contentType: previewBlob.type || 'video/webm',
    upsert: true
  });
  if (error) throw error;

  const { data } = client.storage.from(STORY_PREVIEW_BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error('Supabase hat keine URL für die Preview zurückgegeben.');
  return {
    storagePath,
    publicUrl: `${data.publicUrl}?v=${encodeURIComponent(generatedAt)}`
  };
}

export async function deleteStoryPreviewFromSupabase(storagePath) {
  const client = await getSupabase();
  if (!client || !storagePath) return;
  const { error } = await client.storage.from(STORY_PREVIEW_BUCKET).remove([storagePath]);
  if (error) throw error;
}

export async function deleteStoryFromSupabase(storyId) {
  const client = await getSupabase();
  if (!client || !storyId) return;
  const { error } = await client.from('stories').delete().eq('id', storyId);
  if (error) throw error;
}

export async function updateSupabaseProfile(userId, { name, username }) {
  const client = await getSupabase();
  if (!client) return;
  const { error } = await client.from('profiles').update({
    display_name: name,
    username,
    updated_at: new Date().toISOString()
  }).eq('id', userId);
  if (error?.code === '23505' || error?.message?.includes('profiles_username_lower_idx')) {
    throw new Error('Dieser Username ist bereits vergeben.');
  }
  if (error) throw error;
}

export async function fetchPlatformAccess() {
  const client = await getSupabase();
  if (!client) return { registrationsEnabled: true, defaultRole: 'light-user' };
  const { data, error } = await client.rpc('get_platform_access');
  if (error) throw error;
  const settings = data?.[0] || {};
  return {
    registrationsEnabled: settings.registrations_enabled !== false,
    defaultRole: settings.default_role || 'light-user'
  };
}

export async function fetchAdminUsers() {
  const client = await getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('admin_list_users');
  if (error) throw error;
  return (data || []).map((profile) => ({
    id: profile.id,
    email: profile.email || '',
    name: profile.display_name || profile.username,
    username: profile.username,
    role: profile.role || 'light-user',
    isBlocked: Boolean(profile.is_blocked),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  }));
}

export async function updateAdminUser(userId, { role, isBlocked }) {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase ist nicht konfiguriert.');
  const { error } = await client.rpc('admin_update_user', {
    target_user_id: userId,
    new_role: role,
    new_is_blocked: isBlocked
  });
  if (error) throw error;
}

export async function updatePlatformAccess({ registrationsEnabled, defaultRole }) {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase ist nicht konfiguriert.');
  const { error } = await client.rpc('admin_update_platform_settings', {
    new_registrations_enabled: registrationsEnabled,
    new_default_role: defaultRole
  });
  if (error) throw error;
}

export async function fetchStoryVersions(storyId) {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase ist nicht konfiguriert.');
  const { data, error } = await client
    .from('story_versions')
    .select('id, version_number, reason, created_at, created_by')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((version) => ({
    id: version.id,
    versionNumber: version.version_number,
    reason: version.reason,
    createdAt: version.created_at,
    createdBy: version.created_by
  }));
}

export async function restoreStoryVersion(versionId) {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase ist nicht konfiguriert.');
  const { data, error } = await client.rpc('restore_story_version', {
    target_version_id: versionId
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? rowToStory(row) : null;
}

export async function recordStoryAnalyticsEvent(storyId, sessionId, eventType, {
  stationId = null,
  annotationId = null,
  deviceClass = 'desktop',
  durationSeconds = null,
  loadMs = null
} = {}) {
  const client = await getSupabase();
  if (!client || !storyId || !sessionId) return false;
  const { data, error } = await client.rpc('record_story_analytics_event', {
    target_story_id: storyId,
    target_session_id: sessionId,
    target_event_type: eventType,
    target_station_id: stationId,
    target_annotation_id: annotationId,
    target_device_class: deviceClass,
    target_duration_seconds: durationSeconds,
    target_load_ms: loadMs
  });
  if (error) throw error;
  return Boolean(data);
}

export async function fetchStoryAnalytics(storyId) {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase ist nicht konfiguriert.');
  const { data, error } = await client.rpc('get_story_analytics', {
    target_story_id: storyId
  });
  if (error) throw error;
  return normalizeAnalyticsResult(data);
}

export async function fetchOwnedStoryViewCounts() {
  const client = await getSupabase();
  if (!client) return {};
  const { data, error } = await client.rpc('get_owned_story_view_counts');
  if (error) throw error;
  return Object.fromEntries((data || []).map((item) => [item.story_id, {
    views: Number(item.views) || 0,
    lastViewedAt: item.last_viewed_at || null
  }]));
}
