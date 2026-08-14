const DATABASE_NAME = 'riu_project_sound_assets';
const DATABASE_VERSION = 1;
const SOUND_STORE = 'sounds';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SOUND_STORE)) {
        request.result.createObjectStore(SOUND_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(SOUND_STORE, mode);
    const request = operation(transaction.objectStore(SOUND_STORE));
    transaction.oncomplete = () => { database.close(); resolve(request?.result); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error('Der Soundspeicher wurde abgebrochen.')); };
  }));
}

export const getProjectSoundKey = (projectId, soundId) => `${projectId}:${soundId}`;

export function saveProjectSoundFile(projectId, soundId, file) {
  if (!projectId || !soundId) return Promise.reject(new Error('Sound kann keinem Projekt zugeordnet werden.'));
  return transact('readwrite', (store) => store.put({
    key: getProjectSoundKey(projectId, soundId),
    projectId,
    soundId,
    blob: file,
    updatedAt: Date.now()
  }));
}

export async function readProjectSoundFile(storageKey) {
  if (!storageKey) return null;
  const record = await transact('readonly', (store) => store.get(storageKey));
  return record?.blob ?? null;
}

export function deleteProjectSoundFile(storageKey) {
  if (!storageKey) return Promise.resolve();
  return transact('readwrite', (store) => store.delete(storageKey));
}
