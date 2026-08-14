const DATABASE_NAME = 'riu_platform';
const DATABASE_VERSION = 2;

const STORES = { users: 'users', stories: 'stories', meta: 'meta', previewAssets: 'previewAssets' };

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of Object.values(STORES)) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: storeName === STORES.meta ? 'key' : 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact(storeName, mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
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
      reject(transaction.error || new Error('Die RIU-Datenbanktransaktion wurde abgebrochen.'));
    };
  }));
}

export const readAllRecords = (storeName) => transact(storeName, 'readonly', (store) => store.getAll());
export const readRecord = (storeName, id) => transact(storeName, 'readonly', (store) => store.get(id));

export function replaceAllRecords(storeName, records) {
  return transact(storeName, 'readwrite', (store) => {
    store.clear();
    for (const record of records) store.put(record);
  });
}

export const putRecord = (storeName, record) => transact(storeName, 'readwrite', (store) => store.put(record));
export const deleteRecord = (storeName, id) => transact(storeName, 'readwrite', (store) => store.delete(id));
export const readMeta = (key) => transact(STORES.meta, 'readonly', (store) => store.get(key));
export const writeMeta = (key, value) => putRecord(STORES.meta, { key, value });

export { STORES };
