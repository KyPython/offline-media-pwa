# Architecture Documentation

## Overview

This is an offline-first Progressive Web App (PWA) designed for reliable media (photos/videos) synchronization with a Rails API backend. The app prioritizes offline functionality, ensuring users can capture and queue media even on flaky networks, with automatic synchronization when connectivity is restored.

## Data Flow

### Submission Flow

```
User Input (UI)
    ↓
sync.enqueueSubmission()
    ↓
┌─────────────────────────────┐
│ IndexedDB (Local Storage)   │
│ - records store             │
│ - mediaQueue store          │
└─────────────────────────────┘
    ↓
[If Online] → sync.syncQueue()
    ↓
API Calls (api.js)
    ↓
Rails API Backend
```

### Sync Flow

```
Online Event / Background Sync Trigger
    ↓
sync.syncQueue()
    ↓
Get Pending Items from IndexedDB
    ↓
For each item:
    Convert ArrayBuffer → File
    ↓
    POST to Rails API
    ↓
    [Success] → Update queue item status to 'synced'
    [Failure] → Increment attempts, retry if < maxAttempts
    ↓
Update record sync status if all media synced
```

## Module Architecture

### `src/api.js`
**Purpose**: Thin wrapper around fetch for Rails API communication

**Responsibilities**:
- HTTP methods (GET, POST, PUT, DELETE)
- Authentication header management (TODO: implement token retrieval)
- FormData handling for file uploads
- Error handling and response parsing

**Key Functions**:
- `createSubmission()` - Create submission with media files
- `uploadMedia()` - Upload individual media file
- `getSubmissions()` - Fetch all submissions

**TODO Items**:
- Implement actual auth token retrieval (currently placeholder)
- Align endpoint structure with Rails API
- Handle API versioning if needed

### `src/db.js`
**Purpose**: IndexedDB wrapper for local storage

**Stores**:
1. **records**: Submission metadata
   - Fields: id, title, description, mediaFiles (metadata), createdAt, synced
   - Indexes: createdAt, synced

2. **mediaQueue**: Pending uploads
   - Fields: id, submissionId, fileName, fileType, fileSize, fileData (ArrayBuffer), metadata, status, attempts, maxAttempts, error, createdAt
   - Indexes: status, submissionId, createdAt

**Key Operations**:
- CRUD for records
- Queue management (enqueue, get pending, update status)
- File conversion (File ↔ ArrayBuffer)

**Design Decisions**:
- Storing files as ArrayBuffer to avoid File API limitations in IndexedDB
- Separate queue store for better querying and status tracking
- Auto-incrementing IDs for simplicity

### `src/sync.js`
**Purpose**: Synchronization logic and queue management

**Responsibilities**:
- Enqueue submissions when created offline
- Flush queue when online
- Retry logic with attempt tracking
- Status management (pending, uploading, synced, failed)
- Exponential backoff (staggered requests)

**Key Functions**:
- `enqueueSubmission()` - Create local record and queue media
- `syncQueue()` - Process all pending items
- `getSyncStats()` - Get queue statistics
- `retryFailedItems()` - Retry failed uploads

**Retry Strategy**:
- Max attempts: 5 (configurable per item)
- Staggered requests (100ms delay between items)
- Status tracking prevents duplicate processing
- Failed items can be manually retried

### `src/ui.js`
**Purpose**: UI interactions and display

**Responsibilities**:
- Connection status indicator
- Sync status badge
- Submission form handling
- Submissions list rendering
- Queue display and management

**UI Components**:
- Connection status (online/offline)
- Sync status badge (idle, syncing, success, error)
- Submission form with file input
- Submissions list with metadata
- Queue list with status indicators

**Update Triggers**:
- Online/offline events
- Sync status changes
- Form submissions
- Manual sync button
- Periodic queue refresh (5s interval)

### `src/main.js`
**Purpose**: Application bootstrap

**Responsibilities**:
- Initialize database
- Register service worker
- Initialize sync listeners
- Initialize UI
- Handle service worker updates

## Service Worker Architecture

### Location
`public/service-worker.js` - Uses Workbox CDN for service worker context

### Caching Strategies

#### 1. Precaching
- **What**: Core app shell (HTML, JS, CSS, icons, manifest)
- **Strategy**: Precached at install time
- **Injection**: Vite PWA plugin injects manifest at build time

#### 2. Runtime Caching

**API Requests** (`/api/*`)
- **Strategy**: Network First
- **Rationale**: Always try fresh data, fallback to cache if offline
- **TTL**: 5 minutes
- **Max Entries**: 50

**JSON Data** (`*.json`)
- **Strategy**: Stale While Revalidate
- **Rationale**: Show cached data immediately, update in background
- **TTL**: 24 hours
- **Max Entries**: 50

**Images**
- **Strategy**: Cache First
- **Rationale**: Images rarely change, reduce bandwidth
- **TTL**: 30 days
- **Max Entries**: 100

**Videos**
- **Strategy**: Network First
- **Rationale**: Videos are large, don't cache aggressively
- **TTL**: 7 days
- **Max Entries**: 10 (quota management)

### Background Sync

**Implementation**: Workbox BackgroundSyncPlugin

**Queue Name**: `media-uploads`

**Behavior**:
- Failed POST/PUT requests to `/api/submissions` or `/api/media-uploads` are queued
- Queue persists across service worker restarts
- Sync triggered by:
  - Browser background sync event (when online)
  - Periodic Background Sync (if supported)
  - Manual sync from UI

**Retention**: 24 hours max

**Error Handling**:
- Logs errors to console
- Notifies clients via postMessage
- Re-queues failed items (up to max attempts)

## Offline UX Patterns

### Connection Status
- Visual indicator (green/red badge)
- Updates on `online`/`offline` events
- Sync status badge shows current sync state

### Queue Visibility
- Real-time queue count
- Per-item status (pending, uploading, synced, failed)
- Error messages for failed items
- Manual retry option

### User Feedback
- Form submission confirmation
- Sync progress indication
- Error alerts with actionable messages
- Success notifications

## Network Handling

### Online Detection
- `navigator.onLine` API
- Window `online`/`offline` events
- Automatic sync trigger on online event

### Offline Behavior
- All submissions stored locally immediately
- Media files queued in IndexedDB
- UI shows pending status
- No blocking errors

### Sync Triggers
1. **Automatic**: When app comes online
2. **Manual**: User clicks "Sync Now" button
3. **Background**: Service worker background sync event
4. **Periodic**: Periodic Background Sync (if supported)

## Integrity Checks

### Data Consistency
- Record sync status updated when all media synced
- Queue items tracked individually
- Attempt counting prevents infinite retries
- Error messages preserved for debugging

### Quota Management
- Video cache limited to 10 entries
- Expiration plugins with `purgeOnQuotaError: true`
- IndexedDB storage for large media (no size limit, but browser-dependent)

### Error Recovery
- Failed items marked with error message
- Retry mechanism with max attempts
- Manual retry option for failed items
- Status persistence across app restarts

## Rails API Integration Points

### Expected Endpoints

**POST /api/submissions**
- Accepts: FormData with submission metadata and media files
- Expected fields:
  - `submission[title]` (string)
  - `submission[description]` (string, optional)
  - `submission[media][0]`, `submission[media][1]`, ... (File objects)
- Returns: Submission object with ID

**POST /api/media-uploads**
- Accepts: FormData with media file
- Expected fields:
  - `media` (File)
  - `submission_id` (integer)
- Returns: Media upload confirmation

**GET /api/submissions**
- Returns: Array of submission objects

**GET /api/submissions/:id**
- Returns: Single submission object

### Authentication
- TODO: Implement token-based auth
- Current: Placeholder for `Authorization: Bearer <token>` header
- Token retrieval: To be implemented (likely localStorage or session)

### Error Handling
- API errors returned as JSON with `message` field
- HTTP status codes respected
- Network errors caught and queued for retry

## Testing Strategy

### Offline Simulation
1. Chrome DevTools → Network → Offline
2. Create submission
3. Verify local storage
4. Go online
5. Verify sync

### Network Throttling
1. Chrome DevTools → Network → Throttling
2. Test slow 3G/4G scenarios
3. Verify queue behavior
4. Test retry logic

### Lighthouse Testing
1. Run `npm run build`
2. Run `npm run preview`
3. Open Chrome DevTools → Lighthouse
4. Run PWA audit
5. Verify scores (target: 90+)

### Manual Testing Checklist
- [ ] Create submission offline
- [ ] Verify queue count updates
- [ ] Go online, verify auto-sync
- [ ] Test failed upload (simulate API error)
- [ ] Verify retry mechanism
- [ ] Test manual sync button
- [ ] Verify status indicators
- [ ] Test with large files (quota handling)

## Performance Considerations

### IndexedDB
- Async operations (non-blocking)
- Batch operations where possible
- Efficient queries using indexes

### Service Worker
- Precaching reduces initial load
- Runtime caching reduces API calls
- Background sync doesn't block UI

### Media Handling
- Files stored as ArrayBuffer (efficient)
- No base64 encoding (reduces size)
- Lazy conversion (only when syncing)

### UI Updates
- Debounced queue refresh (5s interval)
- Event-driven updates (not polling)
- Efficient DOM updates

## Security Considerations

### Authentication
- Token stored securely (TODO: implement)
- HTTPS required for service workers
- No sensitive data in localStorage

### Data Validation
- Client-side validation (UX)
- Server-side validation (security)
- File type/size validation (TODO: add)

### CORS
- Rails API must allow CORS from PWA origin
- Credentials handling (TODO: configure)

## Future Enhancements

### Week 1-2 (Current)
- ✅ Core architecture
- ✅ IndexedDB implementation
- ✅ Service worker with Workbox
- ✅ Basic UI

### Week 3-4
- [ ] Enhanced error handling
- [ ] Progress indicators for large uploads
- [ ] Image compression before upload
- [ ] Video transcoding (if needed)

### Week 5-6
- [ ] Push notifications for sync completion
- [ ] Periodic Background Sync
- [ ] Conflict resolution (if backend supports)
- [ ] Offline editing capabilities

### Additional Features
- [ ] Batch operations
- [ ] Selective sync
- [ ] Storage quota monitoring
- [ ] Analytics/telemetry
- [ ] Dark mode
- [ ] Accessibility improvements

