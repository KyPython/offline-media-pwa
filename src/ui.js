/**
 * UI Module - Handles all UI interactions and updates
 * 
 * Manages:
 * - Connection status display
 * - Sync status display
 * - Submission form
 * - Submissions list
 * - Sync queue display
 */

import * as db from './db.js';
import * as sync from './sync.js';


/**
 * Initialize UI
 */
export function initUI() {
  setupConnectionStatus();
  setupSubmissionForm();
  setupSyncButton();
  setupSyncStatusListener();
  setupProgressListener();
  loadSubmissions();
  loadQueue();
  
  // Refresh queue periodically
  setInterval(loadQueue, 2000); // More frequent for progress updates
}

/**
 * Setup connection status indicator
 */
function setupConnectionStatus() {
  const statusText = document.getElementById('status-text');
  
  function updateStatus() {
    if (navigator.onLine) {
      statusText.textContent = 'Online';
      statusText.className = 'online';
    } else {
      statusText.textContent = 'Offline';
      statusText.className = 'offline';
    }
  }

  updateStatus();
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
}

/**
 * Setup sync status listener
 */
function setupSyncStatusListener() {
  const syncBadge = document.getElementById('sync-status');
  
  sync.onSyncStatusChange((status) => {
    syncBadge.textContent = status;
    syncBadge.className = `sync-badge ${status}`;
    
    if (status === 'syncing') {
      syncBadge.textContent = 'Syncing...';
    } else if (status === 'success') {
      syncBadge.textContent = 'Synced';
      // Refresh after successful sync
      setTimeout(() => {
        loadSubmissions();
        loadQueue();
      }, 500);
    } else if (status === 'error') {
      syncBadge.textContent = 'Error';
    } else {
      syncBadge.textContent = '';
    }
  });
}

/**
 * Setup submission form
 */
function setupSubmissionForm() {
  const form = document.getElementById('submission-form');
  const submitBtn = document.getElementById('submit-btn');
  const fileInput = document.getElementById('media-files');
  
  // File size validation
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB per file
    const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2GB total
    
    let totalSize = 0;
    const oversizedFiles = [];
    
    files.forEach(file => {
      totalSize += file.size;
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(`${file.name} (${formatFileSize(file.size)})`);
      }
    });
    
    if (oversizedFiles.length > 0) {
      alert(`Some files are too large (max 500MB per file):\n${oversizedFiles.join('\n')}`);
      e.target.value = '';
      return;
    }
    
    if (totalSize > MAX_TOTAL_SIZE) {
      alert(`Total file size too large (max 2GB): ${formatFileSize(totalSize)}`);
      e.target.value = '';
      return;
    }
    
    // Show file info
    const fileInfo = files.map(f => 
      `${f.name} (${formatFileSize(f.size)})${f.size > 10 * 1024 * 1024 ? ' - will use chunked upload' : ''}`
    ).join('\n');
    
    if (files.length > 0) {
      console.log('Selected files:', fileInfo);
    }
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const mediaFiles = document.getElementById('media-files').files;
    
    if (!title || mediaFiles.length === 0) {
      alert('Please provide a title and at least one media file');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
      const submissionData = {
        title,
        description,
        mediaFiles: Array.from(mediaFiles)
      };

      await sync.enqueueSubmission(submissionData);
      
      // Reset form
      form.reset();
      alert('Submission created! It will sync when online.');
      
      // Refresh UI
      loadSubmissions();
      loadQueue();
    } catch (error) {
      console.error('Error creating submission:', error);
      
      // Handle quota errors
      if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
        alert('Storage quota exceeded. Please free up space or delete some submissions.');
      } else {
        alert('Error creating submission: ' + error.message);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Submission';
    }
  });
}

/**
 * Setup sync button
 */
function setupSyncButton() {
  const syncBtn = document.getElementById('sync-now-btn');
  
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    
    try {
      const result = await sync.syncQueue();
      alert(`Sync complete: ${result.synced} synced, ${result.failed} failed`);
      loadQueue();
      loadSubmissions();
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Error syncing: ' + error.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = 'Sync Now';
    }
  });
}

/**
 * Load and display submissions
 */
export async function loadSubmissions() {
  const list = document.getElementById('submissions-list');
  
  try {
    const records = await db.getAllRecords();
    
    if (records.length === 0) {
      list.innerHTML = '<p class="empty-state">No submissions yet. Create one above!</p>';
      return;
    }

    list.innerHTML = records.map(record => {
      const mediaPreviews = record.mediaFiles.map(file => {
        if (file.type.startsWith('image/')) {
          return `<img src="data:${file.type};base64," alt="${file.name}" />`;
        } else if (file.type.startsWith('video/')) {
          return `<video><source src="data:${file.type};base64," /></video>`;
        }
        return '';
      }).join('');

      return `
        <div class="submission-item">
          <h3>${escapeHtml(record.title)}</h3>
          <p>${escapeHtml(record.description || '')}</p>
          <div class="submission-meta">
            <span>Created: ${new Date(record.createdAt).toLocaleString()}</span>
            <span>Status: ${record.synced ? '✓ Synced' : '⏳ Pending'}</span>
          </div>
          ${mediaPreviews ? `<div class="media-preview">${mediaPreviews}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading submissions:', error);
    list.innerHTML = '<p class="empty-state">Error loading submissions</p>';
  }
}

/**
 * Load and display sync queue
 */
export async function loadQueue() {
  const queueList = document.getElementById('queue-list');
  const queueCount = document.getElementById('queue-count');
  
  try {
    const stats = await sync.getSyncStats();
    queueCount.textContent = stats.pending;
    
    const queueItems = await db.getAllQueueItems();
    
    if (queueItems.length === 0) {
      queueList.innerHTML = '<p class="empty-state">No items in sync queue</p>';
      return;
    }

    // Sort by status and creation date
    queueItems.sort((a, b) => {
      const statusOrder = { pending: 0, uploading: 1, synced: 2, failed: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    queueList.innerHTML = queueItems.map(item => {
      const statusClass = item.status;
      const statusText = {
        pending: '⏳ Pending',
        uploading: '⬆️ Uploading',
        synced: '✓ Synced',
        failed: '❌ Failed'
      }[item.status] || item.status;

      // Progress bar for uploading items
      const progressBar = item.status === 'uploading' && item.uploadProgress !== undefined
        ? `
          <div style="margin-top: 0.5rem;">
            <div style="background: #e0e0e0; border-radius: 4px; height: 8px; overflow: hidden;">
              <div style="background: var(--primary-color); height: 100%; width: ${item.uploadProgress}%; transition: width 0.3s;"></div>
            </div>
            <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem;">
              ${item.uploadProgress}% (${formatFileSize(item.bytesUploaded || 0)} / ${formatFileSize(item.fileSize)})
            </div>
          </div>
        `
        : '';

      return `
        <div class="queue-item">
          <div class="queue-item-info">
            <strong>${escapeHtml(item.fileName)}</strong>
            <div style="font-size: 0.875rem; color: #666; margin-top: 0.25rem;">
              ${formatFileSize(item.fileSize)}${item.useChunked ? ' • Chunked' : ''} • 
              Attempts: ${item.attempts}/${item.maxAttempts}
              ${item.error ? ` • Error: ${escapeHtml(item.error)}` : ''}
            </div>
            ${progressBar}
          </div>
          <div class="queue-item-status">
            <span class="sync-badge ${statusClass}">${statusText}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading queue:', error);
    queueList.innerHTML = '<p class="empty-state">Error loading queue</p>';
  }
}

/**
 * Listen for upload progress events
 */
function setupProgressListener() {
  window.addEventListener('uploadProgress', () => {
    // Refresh queue display when progress updates
    loadQueue();
  });
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Utility: Format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

