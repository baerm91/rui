import { createClient } from '@supabase/supabase-js';

const viteEnv = import.meta.env ?? {};
const supabaseUrl = viteEnv.VITE_PUBLIC_SUPABASE_URL
  || viteEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = viteEnv.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || viteEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || viteEnv.VITE_PUBLIC_SUPABASE_ANON_KEY
  || viteEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const REMEMBER_LOGIN_KEY = 'riu_remember_login';

export function readRememberLoginPreference(storage = globalThis.localStorage) {
  return storage?.getItem(REMEMBER_LOGIN_KEY) !== 'false';
}

export function writeRememberLoginPreference(remember, storage = globalThis.localStorage) {
  storage?.setItem(REMEMBER_LOGIN_KEY, remember ? 'true' : 'false');
}

export function createAuthStorage(persistentStorage, tabStorage, rememberLogin) {
  const preferredStores = () => rememberLogin()
    ? [persistentStorage, tabStorage]
    : [tabStorage, persistentStorage];

  return {
    getItem(key) {
      const [preferred, fallback] = preferredStores();
      return preferred?.getItem(key) ?? fallback?.getItem(key) ?? null;
    },
    setItem(key, value) {
      const [preferred, fallback] = preferredStores();
      fallback?.removeItem(key);
      preferred?.setItem(key, value);
    },
    removeItem(key) {
      persistentStorage?.removeItem(key);
      tabStorage?.removeItem(key);
    }
  };
}

let supabaseClient = null;

export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: createAuthStorage(
          globalThis.localStorage,
          globalThis.sessionStorage,
          () => readRememberLoginPreference()
        )
      }
    });
  }
  return supabaseClient;
}

export function authUserToProfile(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const emailName = String(user.email || '').split('@')[0];
  const name = String(metadata.full_name || metadata.name || metadata.user_name || emailName || 'RIU Autor:in').trim();
  const username = String(metadata.preferred_username || metadata.user_name || emailName || `user-${user.id.slice(0, 6)}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
  return { id: user.id, name, username, email: user.email || '' };
}

export function readOAuthCallbackError(location = window.location) {
  const search = new URLSearchParams(location.search || '');
  const hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
  const error = search.get('error') || hash.get('error');
  if (!error) return '';
  const code = search.get('error_code') || hash.get('error_code') || error;
  const description = search.get('error_description') || hash.get('error_description') || '';
  if (code === 'access_denied') return 'Die Google-Anmeldung wurde abgebrochen. Bitte versuchen Sie es erneut.';
  if (/registrier|registration|signup|saving new user/i.test(description)) {
    return 'Das Konto konnte nicht freigeschaltet werden. Bitte wenden Sie sich an die RIU-Administration.';
  }
  return description
    ? `Die Google-Anmeldung ist fehlgeschlagen: ${description}`
    : 'Die Google-Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.';
}

export async function signInWithOAuth(provider = 'google', { mode = 'login', rememberLogin = true } = {}) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase ist für diese Umgebung noch nicht konfiguriert.');
  const redirectTo = `${window.location.origin}/dashboard`;
  writeRememberLoginPreference(rememberLogin);
  localStorage.setItem('riu_auth_attempt', JSON.stringify({ mode, startedAt: Date.now() }));
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, queryParams: { prompt: 'select_account' } }
  });
  if (error) throw error;
}

export async function signOutFromSupabase() {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
