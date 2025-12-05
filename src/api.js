/**
 * API Client - Thin wrapper around fetch for Rails API
 * 
 * Handles authentication, error handling, and request formatting.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Get authentication token
 * TODO: Replace with actual auth token retrieval (e.g., from localStorage, session, etc.)
 */
function getAuthToken() {
  // TODO: Implement actual token retrieval
  // Example: return localStorage.getItem('auth_token');
  return null;
}

/**
 * Create headers with authentication
 */
function getHeaders(contentType = 'application/json') {
  const headers = {
    'Content-Type': contentType
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Handle API response
 */
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * GET request
 */
export async function get(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: getHeaders()
  });
  return handleResponse(response);
}

/**
 * POST request
 */
export async function post(endpoint, data) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * POST with FormData (for file uploads)
 */
export async function postFormData(endpoint, formData) {
  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Don't set Content-Type for FormData - browser will set it with boundary

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData
  });
  return handleResponse(response);
}

/**
 * PUT request
 */
export async function put(endpoint, data) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * DELETE request
 */
export async function del(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(response);
}

/**
 * Create a submission with media files
 * 
 * TODO: Align endpoint and payload structure with your Rails API
 * Expected Rails endpoint: POST /api/submissions
 * Expected payload structure may vary based on your backend
 */
export async function createSubmission(submissionData) {
  // For now, we'll create the submission metadata first
  // Then upload media files separately or in a multipart request
  // TODO: Adjust based on your Rails API structure
  
  const formData = new FormData();
  formData.append('submission[title]', submissionData.title);
  formData.append('submission[description]', submissionData.description || '');
  
  // Append media files
  if (submissionData.mediaFiles && submissionData.mediaFiles.length > 0) {
    submissionData.mediaFiles.forEach((file, index) => {
      formData.append(`submission[media][${index}]`, file);
    });
  }

  return postFormData('/submissions', formData);
}

/**
 * Get all submissions
 * TODO: Align endpoint with your Rails API
 */
export async function getSubmissions() {
  return get('/submissions');
}

/**
 * Get a single submission
 * TODO: Align endpoint with your Rails API
 */
export async function getSubmission(id) {
  return get(`/submissions/${id}`);
}

/**
 * Upload media file
 * TODO: Align endpoint with your Rails API
 * This might be a separate endpoint if you handle media uploads separately
 */
export async function uploadMedia(submissionId, file) {
  const formData = new FormData();
  formData.append('media', file);
  formData.append('submission_id', submissionId);
  
  return postFormData('/media-uploads', formData);
}

/**
 * Chunk size for large file uploads (5MB chunks)
 */
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Upload media file in chunks
 * Useful for large files (>10MB) or flaky networks
 * 
 * @param {number} submissionId - Submission ID
 * @param {File} file - File to upload
 * @param {Function} onProgress - Progress callback (bytesUploaded, totalBytes)
 * @returns {Promise} Upload result
 */
export async function uploadMediaChunked(submissionId, file, onProgress) {
  const fileSize = file.size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const uploadId = `${submissionId}-${file.name}-${Date.now()}`;

  // Initialize multipart upload
  // TODO: Adjust based on your Rails API multipart upload endpoint
  const initResponse = await post('/media-uploads/init', {
    submission_id: submissionId,
    file_name: file.name,
    file_size: fileSize,
    file_type: file.type,
    total_chunks: totalChunks,
    upload_id: uploadId
  });

  const { upload_id, chunk_url } = initResponse;

  // Upload each chunk
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunk = file.slice(start, end);

    const chunkFormData = new FormData();
    chunkFormData.append('chunk', chunk);
    chunkFormData.append('upload_id', upload_id);
    chunkFormData.append('chunk_index', chunkIndex);
    chunkFormData.append('total_chunks', totalChunks);

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const token = getAuthToken();
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${chunk_url || '/media-uploads/chunk'}`, {
          method: 'POST',
          headers,
          body: chunkFormData
        });

        if (!response.ok) {
          throw new Error(`Chunk upload failed: ${response.statusText}`);
        }

        success = true;
        const bytesUploaded = end;
        if (onProgress) {
          onProgress(bytesUploaded, fileSize);
        }
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}: ${error.message}`);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));
      }
    }
  }

  // Finalize upload
  const finalizeResponse = await post('/media-uploads/finalize', {
    upload_id: upload_id,
    submission_id: submissionId
  });

  return finalizeResponse;
}

/**
 * Check if file should use chunked upload
 * Files larger than 10MB use chunked upload
 */
export function shouldUseChunkedUpload(file) {
  const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
  return file.size > LARGE_FILE_THRESHOLD;
}

