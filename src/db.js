/**
 * IndexedDB Helper - Minimal wrapper for local storage
 * 
 * Stores:
 * - records: submissions with metadata
 * - mediaQueue: pending uploads (file blobs + metadata + status)
 */

const DB_NAME = 'OfflineMediaPWA';
const DB_VERSION = 1;

const STORES = {
  RECORDS: 'records',
  MEDIA_QUEUE: 'mediaQueue'
};

let db = null;

/**
 * Open database connection
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Records store: submissions with metadata
      if (!database.objectStoreNames.contains(STORES.RECORDS)) {
        const recordsStore = database.createObjectStore(STORES.RECORDS, {
          keyPath: 'id',
          autoIncrement: true
        });
        recordsStore.createIndex('createdAt', 'createdAt', { unique: false });
        recordsStore.createIndex('synced', 'synced', { unique: false });
      }

      // Media queue store: pending uploads
      if (!database.objectStoreNames.contains(STORES.MEDIA_QUEUE)) {
        const queueStore = database.createObjectStore(STORES.MEDIA_QUEUE, {
          keyPath: 'id',
          autoIncrement: true
        });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('submissionId', 'submissionId', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      } else {
        // Migration: Add new fields to existing store if needed
        const queueStore = event.target.transaction.objectStore(STORES.MEDIA_QUEUE);
        // Note: IndexedDB doesn't support adding fields in upgrade, but existing items will get defaults
      }
    };
  });
}

/**
 * Generic transaction helper
 */
function transaction(storeName, mode = 'readonly') {
  return openDB().then(database => {
    const tx = database.transaction(storeName, mode);
    return tx.objectStore(storeName);
  });
}

/**
 * Records CRUD
 */

export async function createRecord(record) {
  const store = await transaction(STORES.RECORDS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.add({
      ...record,
      createdAt: new Date().toISOString(),
      synced: false
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecord(id) {
  const store = await transaction(STORES.RECORDS);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRecords() {
  const store = await transaction(STORES.RECORDS);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function updateRecord(id, updates) {
  const store = await transaction(STORES.RECORDS, 'readwrite');
  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        reject(new Error('Record not found'));
        return;
      }
      const updated = { ...record, ...updates };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteRecord(id) {
  const store = await transaction(STORES.RECORDS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Media Queue Operations
 */

/**
 * Enqueue a media file for upload
 * @param {Object} queueItem - { submissionId, file, metadata, status, useChunked }
 */
export async function enqueueMedia(queueItem) {
  const store = await transaction(STORES.MEDIA_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    // Convert File to ArrayBuffer for storage
    const file = queueItem.file;
    const reader = new FileReader();
    
    reader.onload = () => {
      const item = {
        submissionId: queueItem.submissionId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: reader.result, // ArrayBuffer
        metadata: queueItem.metadata || {},
        status: queueItem.status || 'pending',
        attempts: queueItem.attempts || 0,
        maxAttempts: queueItem.maxAttempts || 5,
        error: null,
        useChunked: queueItem.useChunked || false,
        uploadProgress: 0, // 0-100 percentage
        bytesUploaded: 0,
        createdAt: new Date().toISOString()
      };

      const request = store.add(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get all pending queue items
 */
export async function getPendingQueueItems() {
  const store = await transaction(STORES.MEDIA_QUEUE);
  const index = store.index('status');
  return new Promise((resolve, reject) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all queue items (any status)
 */
export async function getAllQueueItems() {
  const store = await transaction(STORES.MEDIA_QUEUE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get queue items by submission ID
 */
export async function getQueueItemsBySubmissionId(submissionId) {
  const store = await transaction(STORES.MEDIA_QUEUE);
  const index = store.index('submissionId');
  return new Promise((resolve, reject) => {
    const request = index.getAll(submissionId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update queue item status
 */
export async function updateQueueItem(id, updates) {
  const store = await transaction(STORES.MEDIA_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (!item) {
        reject(new Error('Queue item not found'));
        return;
      }
      const updated = { ...item, ...updates };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Delete queue item
 */
export async function deleteQueueItem(id) {
  const store = await transaction(STORES.MEDIA_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Convert ArrayBuffer back to File
 */
export function arrayBufferToFile(arrayBuffer, fileName, fileType) {
  const blob = new Blob([arrayBuffer], { type: fileType });
  return new File([blob], fileName, { type: fileType });
}

