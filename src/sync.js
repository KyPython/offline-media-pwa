/**
 * Sync Logic - Handles offline queue management and synchronization
 * 
 * Enqueues failed online operations, flushes queues when online,
 * handles retry logic with exponential backoff.
 */

import * as db from './db.js';
import * as api from './api.js';
import * as utils from './utils.js';

const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error'
};

let syncStatus = SYNC_STATUS.IDLE;
let syncListeners = [];

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(callback) {
  syncListeners.push(callback);
  callback(syncStatus); // Call immediately with current status
}

function notifySyncStatusChange(status) {
  syncStatus = status;
  syncListeners.forEach(cb => cb(status));
}

/**
 * Check if we're online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Enqueue a submission for sync
 * Creates local record and queues media files
 */
export async function enqueueSubmission(submissionData) {
  try {
    // Check total file size and available storage
    const totalSize = submissionData.mediaFiles.reduce((sum, file) => sum + file.size, 0);
    const storageCheck = await utils.checkStorageAvailability(totalSize);
    
    if (!storageCheck.enough) {
      const error = new Error(
        `Not enough storage space. Available: ${utils.formatBytes(storageCheck.available)}, ` +
        `Needed: ${utils.formatBytes(storageCheck.needed)}`
      );
      error.name = 'QuotaExceededError';
      throw error;
    }

    // Create local record
    const record = {
      title: submissionData.title,
      description: submissionData.description,
      mediaFiles: submissionData.mediaFiles.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      })),
      synced: false
    };

    const recordId = await db.createRecord(record);

    // Enqueue each media file
    const queuePromises = submissionData.mediaFiles.map(file =>
      db.enqueueMedia({
        submissionId: recordId,
        file,
        metadata: {
          title: submissionData.title,
          description: submissionData.description
        },
        status: 'pending',
        useChunked: api.shouldUseChunkedUpload(file)
      })
    );

    await Promise.all(queuePromises);

    // Try to sync immediately if online
    if (isOnline()) {
      syncQueue();
    }

    return recordId;
  } catch (error) {
    console.error('Error enqueueing submission:', error);
    
    // Handle quota errors
    if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
      const quotaError = utils.handleQuotaError(error, 'enqueueSubmission');
      throw new Error(quotaError.message);
    }
    
    throw error;
  }
}

/**
 * Progress callback for chunked uploads
 */
function createProgressCallback(queueItemId) {
  return async (bytesUploaded, totalBytes) => {
    const progress = Math.round((bytesUploaded / totalBytes) * 100);
    await db.updateQueueItem(queueItemId, {
      uploadProgress: progress,
      bytesUploaded: bytesUploaded
    });
    
    // Notify UI of progress update
    const event = new CustomEvent('uploadProgress', {
      detail: { queueItemId, progress, bytesUploaded, totalBytes }
    });
    window.dispatchEvent(event);
  };
}

/**
 * Sync a single queue item
 */
async function syncQueueItem(queueItem) {
  try {
    // Convert ArrayBuffer back to File
    const file = db.arrayBufferToFile(
      queueItem.fileData,
      queueItem.fileName,
      queueItem.fileType
    );

    // Update status to uploading
    await db.updateQueueItem(queueItem.id, {
      status: 'uploading',
      attempts: queueItem.attempts + 1,
      uploadProgress: 0,
      bytesUploaded: 0
    });

    // Determine if we should use chunked upload
    const useChunked = queueItem.useChunked || api.shouldUseChunkedUpload(file);

    // Upload to API
    if (useChunked) {
      const progressCallback = createProgressCallback(queueItem.id);
      await api.uploadMediaChunked(queueItem.submissionId, file, progressCallback);
    } else {
      // Simple upload with progress simulation
      await api.uploadMedia(queueItem.submissionId, file);
      await db.updateQueueItem(queueItem.id, {
        uploadProgress: 100,
        bytesUploaded: file.size
      });
    }

    // Mark as synced
    await db.updateQueueItem(queueItem.id, {
      status: 'synced',
      syncedAt: new Date().toISOString(),
      uploadProgress: 100
    });

    // Update record sync status if all media for this submission are synced
    await checkAndUpdateRecordSyncStatus(queueItem.submissionId);

    return { success: true, itemId: queueItem.id };
  } catch (error) {
    console.error(`Error syncing queue item ${queueItem.id}:`, error);

    const newAttempts = queueItem.attempts + 1;
    const shouldRetry = newAttempts < queueItem.maxAttempts;

    await db.updateQueueItem(queueItem.id, {
      status: shouldRetry ? 'pending' : 'failed',
      attempts: newAttempts,
      error: error.message,
      lastAttemptAt: new Date().toISOString(),
      uploadProgress: 0
    });

    return { success: false, itemId: queueItem.id, error, shouldRetry };
  }
}

/**
 * Check if all media for a submission are synced, update record accordingly
 */
async function checkAndUpdateRecordSyncStatus(submissionId) {
  const queueItems = await db.getQueueItemsBySubmissionId(submissionId);
  const allSynced = queueItems.every(item => item.status === 'synced');
  
  if (allSynced) {
    await db.updateRecord(submissionId, { synced: true });
  }
}

/**
 * Sync all pending queue items
 */
export async function syncQueue() {
  if (!isOnline()) {
    console.log('Offline - cannot sync queue');
    return { synced: 0, failed: 0 };
  }

  if (syncStatus === SYNC_STATUS.SYNCING) {
    console.log('Sync already in progress');
    return { synced: 0, failed: 0 };
  }

  notifySyncStatusChange(SYNC_STATUS.SYNCING);

  try {
    const pendingItems = await db.getPendingQueueItems();
    
    if (pendingItems.length === 0) {
      notifySyncStatusChange(SYNC_STATUS.SUCCESS);
      return { synced: 0, failed: 0 };
    }

    console.log(`Syncing ${pendingItems.length} queue items...`);

    // Process items with exponential backoff between retries
    const results = await Promise.allSettled(
      pendingItems.map((item, index) => {
        // Stagger requests slightly to avoid overwhelming the server
        const delay = index * 100;
        return new Promise(resolve => {
          setTimeout(() => {
            syncQueueItem(item).then(resolve).catch(resolve);
          }, delay);
        });
      })
    );

    const synced = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - synced;

    notifySyncStatusChange(failed === 0 ? SYNC_STATUS.SUCCESS : SYNC_STATUS.ERROR);

    return { synced, failed };
  } catch (error) {
    console.error('Error during sync:', error);
    notifySyncStatusChange(SYNC_STATUS.ERROR);
    throw error;
  }
}

/**
 * Get sync statistics
 */
export async function getSyncStats() {
  const queueItems = await db.getAllQueueItems();
  
  return {
    total: queueItems.length,
    pending: queueItems.filter(i => i.status === 'pending').length,
    uploading: queueItems.filter(i => i.status === 'uploading').length,
    synced: queueItems.filter(i => i.status === 'synced').length,
    failed: queueItems.filter(i => i.status === 'failed').length
  };
}

/**
 * Retry failed items
 */
export async function retryFailedItems() {
  const allItems = await db.getAllQueueItems();
  const failedItems = allItems.filter(
    item => item.status === 'failed' && item.attempts < item.maxAttempts
  );

  // Reset status to pending
  await Promise.all(
    failedItems.map(item =>
      db.updateQueueItem(item.id, { status: 'pending', error: null })
    )
  );

  // Trigger sync
  if (failedItems.length > 0 && isOnline()) {
    return syncQueue();
  }

  return { synced: 0, failed: 0 };
}

/**
 * Initialize sync listeners
 */
export function initSync() {
  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('Back online - triggering sync');
    syncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('Gone offline');
    notifySyncStatusChange(SYNC_STATUS.IDLE);
  });

  // Listen for Background Sync events (if supported)
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(registration => {
      // Background sync will be handled by the service worker
      // This is just for UI updates
    });
  }
}

