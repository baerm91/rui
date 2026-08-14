const DATABASE_NAME = 'three_story_project_assets';
const DATABASE_VERSION = 1;
const MODEL_STORE = 'models';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MODEL_STORE)) {
        request.result.createObjectStore(MODEL_STORE, { keyPath: 'projectId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(MODEL_STORE, mode);
    const store = transaction.objectStore(MODEL_STORE);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      resolve(request?.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Der Modellspeicher wurde abgebrochen.'));
    };
  }));
}

const getRelativePath = (file) => file.relativePath || file.webkitRelativePath || file.name;

export function saveProjectModelFiles(projectId, fileList) {
  if (!projectId) throw new Error('Das Modell kann keinem Projekt zugeordnet werden.');
  const files = Array.from(fileList || []).map((file) => ({
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    relativePath: getRelativePath(file),
    blob: file
  }));
  return runTransaction('readwrite', (store) => store.put({ projectId, files, updatedAt: Date.now() }));
}

export async function readProjectModelFiles(projectId) {
  if (!projectId) return [];
  const record = await runTransaction('readonly', (store) => store.get(projectId));
  return (record?.files || []).map((entry) => {
    const file = new File([entry.blob], entry.name, {
      type: entry.type,
      lastModified: entry.lastModified
    });
    Object.defineProperty(file, 'relativePath', { value: entry.relativePath || entry.name });
    return file;
  });
}

export function deleteProjectModelFiles(projectId) {
  if (!projectId) return Promise.resolve();
  return runTransaction('readwrite', (store) => store.delete(projectId));
}

export async function copyProjectModelFiles(sourceProjectId, targetProjectId) {
  const files = await readProjectModelFiles(sourceProjectId);
  if (files.length > 0) await saveProjectModelFiles(targetProjectId, files);
}
