# Offline Media PWA

A rock-solid offline-first Progressive Web App for syncing large media files (photos/videos) with a Rails API backend.

## Features

- ✅ **Offline-First**: Create submissions and queue media even when offline
- ✅ **Automatic Sync**: Syncs automatically when connection is restored
- ✅ **Background Sync**: Uses Workbox Background Sync for reliable uploads
- ✅ **Chunked Uploads**: Large files (>10MB) automatically use chunked upload for reliability
- ✅ **Progress Tracking**: Real-time upload progress indicators with percentage and bytes
- ✅ **IndexedDB Storage**: Efficient local storage for media files
- ✅ **Service Worker**: Workbox-powered caching and offline support
- ✅ **Real-time Status**: Connection and sync status indicators
- ✅ **Retry Logic**: Automatic retry with configurable max attempts (exponential backoff)
- ✅ **Quota Management**: Storage quota checking and graceful error handling
- ✅ **File Validation**: Size limits and validation before upload
- ✅ **Lighthouse-Ready**: Optimized for PWA best practices

## Tech Stack

- **JavaScript ES6+** (no heavy framework)
- **Vite** - Build tool and dev server
- **Workbox** - Service worker and caching
- **IndexedDB** - Local storage for media and records
- **Background Sync API** - Reliable offline uploads

## Project Structure

```
offline-media-pwa/
├── public/
│   ├── service-worker.js      # Workbox service worker
│   ├── manifest.webmanifest   # PWA manifest
│   └── icons/                 # App icons
├── src/
│   ├── api.js                 # Rails API client
│   ├── db.js                  # IndexedDB wrapper
│   ├── sync.js                # Sync logic
│   ├── ui.js                  # UI interactions
│   ├── main.js                # App bootstrap
│   └── styles.css             # Styles
├── docs/
│   └── architecture.md        # Architecture documentation
├── index.html                 # Main HTML
├── vite.config.js             # Vite configuration
└── package.json               # Dependencies
```

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment variables** (optional):
Create a `.env` file:
```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

3. **Start development server**:
```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite assigns).

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

To preview the production build:

```bash
npm run preview
```

## Testing Offline Functionality

### Method 1: Chrome DevTools

1. Open Chrome DevTools (F12)
2. Go to **Network** tab
3. Select **Offline** from the throttling dropdown
4. Create a submission with media files
5. Verify it appears in the queue
6. Switch back to **Online**
7. Watch the queue sync automatically

### Method 2: Network Throttling

1. Chrome DevTools → **Network** tab
2. Select **Slow 3G** or **Fast 3G**
3. Test upload behavior with slow connections
4. Verify retry logic works correctly

### Method 3: Service Worker Testing

1. Chrome DevTools → **Application** tab
2. **Service Workers** section
3. Check service worker status
4. Use **Update** and **Unregister** for testing
5. **Cache Storage** to inspect cached resources

## Lighthouse Testing

1. Build the app:
```bash
npm run build
npm run preview
```

2. Open Chrome DevTools → **Lighthouse** tab

3. Select:
   - ✅ Performance
   - ✅ Progressive Web App
   - ✅ Best Practices
   - ✅ Accessibility
   - ✅ SEO

4. Click **Generate report**

5. Target scores:
   - PWA: 90+
   - Performance: 80+
   - Best Practices: 90+

## Rails API Integration

### Expected Endpoints

The app expects the following Rails API endpoints:

**POST /api/submissions**
```ruby
# Expected payload (FormData):
submission[title] = "My Submission"
submission[description] = "Description"
submission[media][0] = <File>
submission[media][1] = <File>
```

**POST /api/media-uploads** (Standard upload)
```ruby
# Expected payload (FormData):
media = <File>
submission_id = 123
```

**POST /api/media-uploads/init** (Chunked upload initialization)
```ruby
# Expected payload (JSON):
{
  submission_id: 123,
  file_name: "video.mp4",
  file_size: 52428800,
  file_type: "video/mp4",
  total_chunks: 10,
  upload_id: "123-video.mp4-1234567890"
}

# Expected response:
{
  upload_id: "123-video.mp4-1234567890",
  chunk_url: "/api/media-uploads/chunk"  # Optional, defaults to this
}
```

**POST /api/media-uploads/chunk** (Chunk upload)
```ruby
# Expected payload (FormData):
chunk = <FileChunk>
upload_id = "123-video.mp4-1234567890"
chunk_index = 0
total_chunks = 10
```

**POST /api/media-uploads/finalize** (Finalize chunked upload)
```ruby
# Expected payload (JSON):
{
  upload_id: "123-video.mp4-1234567890",
  submission_id: 123
}
```

**GET /api/submissions**
Returns array of submission objects.

**GET /api/submissions/:id**
Returns single submission object.

**Note**: Chunked uploads are automatically used for files >10MB. The app will fall back to standard upload if chunked endpoints are not available (with a warning).

### Authentication

Currently, authentication is a placeholder. To implement:

1. Edit `src/api.js`
2. Implement `getAuthToken()` function
3. Update to retrieve token from your auth system (localStorage, session, etc.)

Example:
```javascript
function getAuthToken() {
  return localStorage.getItem('auth_token');
}
```

### CORS Configuration

Ensure your Rails API allows CORS from your PWA origin:

```ruby
# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:5173', 'https://your-pwa-domain.com'
    resource '/api/*',
      headers: :any,
      methods: [:get, :post, :put, :delete, :options]
  end
end
```

## How It Works

### Offline Submission Flow

1. User creates submission with media files
2. Submission stored in IndexedDB (`records` store)
3. Media files converted to ArrayBuffer and queued (`mediaQueue` store)
4. UI shows "Pending" status
5. When online, sync automatically triggers
6. Each media file uploaded to Rails API
7. Queue items marked as "Synced" on success
8. Record marked as synced when all media uploaded

### Sync Mechanism

- **Automatic**: Triggers on `online` event
- **Manual**: "Sync Now" button
- **Background**: Service worker Background Sync
- **Retry**: Up to 5 attempts per item (configurable)

### Caching Strategy

- **Precache**: App shell (HTML, JS, CSS, icons)
- **Network First**: API requests, videos
- **Cache First**: Images
- **Stale While Revalidate**: JSON data

## Troubleshooting

### Service Worker Not Registering

- Ensure you're using HTTPS (or localhost)
- Check browser console for errors
- Verify `service-worker.js` is accessible
- Clear browser cache and reload

### Sync Not Working

- Check network tab for API errors
- Verify Rails API is running and accessible
- Check IndexedDB in DevTools → Application
- Review service worker logs in DevTools → Application → Service Workers

### Large Files Failing

- Check browser quota (DevTools → Application → Storage)
- Verify Rails API accepts large uploads
- Files >10MB automatically use chunked upload (requires chunked endpoints)
- Check `maxAttempts` in queue items (default: 5)
- Review error messages in queue list
- Progress bars show upload status for large files

### Icons Not Showing

- Ensure icons exist in `public/icons/`
- Check `manifest.webmanifest` icon paths
- Verify icon sizes match manifest entries
- Clear cache and reinstall PWA

## Development

### Code Structure

- **Modular**: Each module has a single responsibility
- **Testable**: Functions are pure where possible
- **Documented**: Key functions have JSDoc comments
- **Error Handling**: Try/catch with user-friendly messages

### Adding Features

1. **New API endpoint**: Add function to `src/api.js`
2. **New storage**: Add store to `src/db.js`
3. **New sync logic**: Extend `src/sync.js`
4. **New UI**: Add to `src/ui.js` and `index.html`

### Debugging

- Use `console.log` in development
- Check IndexedDB in DevTools → Application → IndexedDB
- Inspect service worker in DevTools → Application → Service Workers
- Network tab for API calls
- Console for JavaScript errors

## Browser Support

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: iOS 11.3+ (limited Background Sync support)
- **Opera**: Full support

Note: Background Sync requires HTTPS (or localhost for development).

## License

MIT

## Contributing

This is a frontend-only project. Backend integration points are marked with `TODO` comments for alignment with your Rails API.

## Support

For issues or questions:
1. Check `docs/architecture.md` for detailed architecture
2. Review browser console for errors
3. Check service worker status in DevTools
4. Verify Rails API is accessible and responding

Deployment trigger Thu Dec  4 23:39:17 EST 2025
