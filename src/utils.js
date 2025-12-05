/**
 * Utility functions for quota management and error handling
 */

/**
 * Check available storage quota
 * @returns {Promise<{quota: number, usage: number, available: number}>}
 */
export async function getStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota || 0,
      usage: estimate.usage || 0,
      available: (estimate.quota || 0) - (estimate.usage || 0)
    };
  }
  return { quota: 0, usage: 0, available: 0 };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if there's enough storage for a file
 * @param {number} fileSize - Size of file in bytes
 * @returns {Promise<{enough: boolean, available: number, needed: number}>}
 */
export async function checkStorageAvailability(fileSize) {
  const { available } = await getStorageQuota();
  return {
    enough: available >= fileSize,
    available,
    needed: fileSize
  };
}

/**
 * Handle quota errors gracefully
 */
export function handleQuotaError(error, context = '') {
  console.error(`Quota error in ${context}:`, error);
  
  if (error.name === 'QuotaExceededError') {
    return {
      type: 'quota_exceeded',
      message: 'Storage quota exceeded. Please free up space.',
      recoverable: true
    };
  }
  
  return {
    type: 'unknown',
    message: error.message || 'Storage error occurred',
    recoverable: false
  };
}

