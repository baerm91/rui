import { authUserToProfile, getSupabase, isSupabaseConfigured } from './supabaseClient.js';

const LEGACY_SOURCE_KEY = 'riu-indexeddb-v2-carnuntum';

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
  const client = getSupabase();
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
    .select('id, email, display_name, username')
    .eq('id', profile.id)
    .single();
  if (profileError) throw profileError;
  return {
    id: storedProfile.id,
    email: storedProfile.email || profile.email,
    name: storedProfile.display_name || profile.name,
    username: storedProfile.username || profile.username
  };
}

export async function loadSupabaseState() {
  const client = getSupabase();
  if (!client) return { authUser: null, user: null, users: [], stories: [] };
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const authUser = sessionData.session?.user || null;
  const [{ data: storyRows, error: storyError }, profileResult] = await Promise.all([
    client.from('stories').select('*').order('updated_at', { ascending: false }),
    authUser
      ? client.from('profiles').select('id, email, display_name, username')
      : Promise.resolve({ data: [], error: null })
  ]);
  if (storyError) throw storyError;
  if (profileResult.error) throw profileResult.error;
  const user = authUser ? await ensureProfile(authUser) : null;
  const users = (profileResult.data || []).map((profile) => ({
    id: profile.id,
    email: profile.email || '',
    name: profile.display_name || profile.username,
    username: profile.username
  }));
  if (user && !users.some((profile) => profile.id === user.id)) users.push(user);
  return { authUser, user, users, stories: (storyRows || []).map(rowToStory) };
}

export async function importLegacyStories(stories, authUser, legacyOwnerIds = []) {
  const client = getSupabase();
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
      { onConflict: 'id' }
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
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('stories').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToStory);
}

export async function syncStoryToSupabase(story) {
  const client = getSupabase();
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

export async function deleteStoryFromSupabase(storyId) {
  const client = getSupabase();
  if (!client || !storyId) return;
  const { error } = await client.from('stories').delete().eq('id', storyId);
  if (error) throw error;
}

export async function updateSupabaseProfile(userId, { name, username }) {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('profiles').update({
    display_name: name,
    username,
    updated_at: new Date().toISOString()
  }).eq('id', userId);
  if (error) throw error;
}
