# Quick Start Guide

## Installation & Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure API endpoint** (optional):
Create `.env` file:
```
VITE_API_BASE_URL=http://localhost:3000/api
```

3. **Start development server**:
```bash
npm run dev
```

4. **Open in browser**:
Navigate to `http://localhost:5173` (or the port shown in terminal)

## Testing Offline Functionality

### Step 1: Create Submission Offline

1. Open Chrome DevTools (F12)
2. Go to **Network** tab
3. Select **Offline** from throttling dropdown
4. Fill out the submission form:
   - Enter a title
   - (Optional) Add description
   - Select one or more photos/videos
5. Click **Create Submission**
6. Verify:
   - Submission appears in "Submissions" section with "⏳ Pending" status
   - Media files appear in "Sync Queue" with "⏳ Pending" status
   - Queue count updates

### Step 2: Sync When Online

1. Switch Network back to **Online**
2. Watch the sync happen automatically:
   - Status badge changes to "Syncing..."
   - Queue items change from "Pending" to "Uploading" to "✓ Synced"
   - Submission status updates to "✓ Synced"
3. Alternatively, click **Sync Now** button for manual sync

### Step 3: Test Failed Uploads

1. Go offline again
2. Create another submission
3. Go online
4. In DevTools → Network, block the API endpoint (right-click → Block request URL)
5. Trigger sync
6. Verify:
   - Items show "❌ Failed" after max attempts
   - Error messages displayed
   - Can retry failed items

## Key Features to Test

- ✅ **Offline Creation**: Create submissions without internet
- ✅ **Auto Sync**: Automatic sync when connection restored
- ✅ **Manual Sync**: "Sync Now" button
- ✅ **Status Indicators**: Real-time connection and sync status
- ✅ **Queue Management**: View pending, uploading, synced, failed items
- ✅ **Retry Logic**: Automatic retries with max attempts
- ✅ **Service Worker**: Check DevTools → Application → Service Workers

## Browser DevTools Tips

### Service Worker
- **Application** → **Service Workers**: Check registration status
- **Update** button: Force service worker update
- **Unregister** button: Remove service worker for testing

### IndexedDB
- **Application** → **Storage** → **IndexedDB**: Inspect local data
- **records** store: Submission metadata
- **mediaQueue** store: Pending uploads

### Cache Storage
- **Application** → **Cache Storage**: View cached resources
- Multiple caches: api-cache, images-cache, videos-cache, etc.

### Network Tab
- **Offline** checkbox: Simulate offline mode
- **Throttling**: Test slow connections (Slow 3G, Fast 3G)
- **Block request URL**: Simulate API failures

## Common Issues & Solutions

### Service Worker Not Registering
- Ensure you're on HTTPS or localhost
- Check browser console for errors
- Clear cache and hard reload (Cmd+Shift+R / Ctrl+Shift+R)

### Sync Not Working
- Verify Rails API is running
- Check API endpoint in `.env` file
- Review Network tab for API errors
- Check IndexedDB for queued items

### Icons Not Showing
- Icons are placeholder images (blue squares)
- Replace with actual icons in `public/icons/`
- Use tools like https://realfavicongenerator.net/

### Large Files Failing
- Check browser quota: DevTools → Application → Storage
- Verify Rails API accepts large uploads
- Check `maxAttempts` in queue items (default: 5)

## Next Steps

1. **Connect to Rails API**: Update `src/api.js` with your actual endpoints
2. **Add Authentication**: Implement `getAuthToken()` in `src/api.js`
3. **Replace Icons**: Add real app icons to `public/icons/`
4. **Customize UI**: Modify `src/styles.css` and `index.html`
5. **Test with Real Data**: Use actual photos/videos from your device

## Production Build

```bash
npm run build
npm run preview
```

Then run Lighthouse audit for PWA score.

