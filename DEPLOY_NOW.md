# Quick Deploy Instructions

## Vercel Dashboard Method (Easiest)

1. Go to your Vercel dashboard
2. Click **"Add New..."** or **"Import Project"**
3. Select **"Import Git Repository"**
4. Find and click on **`offline-media-pwa`**
5. Configure:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variable** (optional):
     - Key: `VITE_API_BASE_URL`
     - Value: Your Rails API URL (or leave empty)
6. Click **"Deploy"**

## Vercel CLI Method

```bash
# Authenticate (opens browser)
vercel login

# Link to existing project or create new
vercel link

# Deploy to production
vercel --prod --yes
```

## After Deployment

Once deployed, Vercel will:
- Give you a URL like `https://offline-media-pwa.vercel.app`
- Auto-deploy on every push to `main` branch
- Provide HTTPS automatically (required for service workers)

## Test Your Deployment

1. Visit your Vercel URL
2. Open DevTools → Application → Service Workers
3. Verify service worker is registered
4. Test offline functionality
5. Run Lighthouse audit

