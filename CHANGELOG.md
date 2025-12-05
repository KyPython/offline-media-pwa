# Changelog

## [1.1.0] - Enhanced Features

### Added
- **Chunked Upload Support**: Large files (>10MB) automatically use chunked upload for better reliability on flaky networks
  - 5MB chunk size for optimal balance between reliability and overhead
  - Automatic retry per chunk with exponential backoff
  - Seamless fallback to standard upload if chunked endpoints unavailable

- **Progress Indicators**: Real-time upload progress tracking
  - Progress bars showing percentage and bytes uploaded
  - Updates every 2 seconds during upload
  - Visual feedback for chunked uploads

- **Storage Quota Management**: 
  - Pre-upload quota checking
  - Graceful error handling for quota exceeded scenarios
  - User-friendly error messages

- **File Size Validation**:
  - 500MB per file limit
  - 2GB total submission limit
  - Clear warnings for oversized files
  - Automatic chunked upload indicator for large files

- **Enhanced Error Handling**:
  - Quota error detection and recovery suggestions
  - Better error messages with context
  - Retry logic improvements

### Changed
- Queue refresh interval reduced from 5s to 2s for better progress updates
- Upload status now includes progress percentage and bytes
- File selection shows chunked upload indicator for large files

### Technical Details
- New `utils.js` module for quota and storage management
- Enhanced `api.js` with `uploadMediaChunked()` function
- Progress tracking via custom events and IndexedDB updates
- Improved error handling in sync logic

## [1.0.0] - Initial Release

### Features
- Offline-first architecture
- IndexedDB storage for media files
- Workbox service worker
- Background Sync API
- Automatic retry logic
- Real-time status indicators
- PWA manifest and icons

