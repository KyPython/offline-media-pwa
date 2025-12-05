# Deployment Guide

This PWA can be deployed to multiple platforms. Here are instructions for Vercel and Render.

## Prerequisites

1. **GitHub Repository**: Push your code to GitHub first
2. **Environment Variables**: Set `VITE_API_BASE_URL` if your API is not at `http://localhost:3000/api`

## Vercel Deployment

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Add environment variable (if needed):
   - `VITE_API_BASE_URL` = Your Rails API URL
6. Click "Deploy"

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Vercel Configuration

The `vercel.json` file is already configured with:
- SPA routing (all routes → index.html)
- Service worker headers
- Cache control for static assets
- Service worker cache control

## Render Deployment

### Option 1: Via Render Dashboard

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Static Site"
3. Connect your GitHub repository
4. Configure:
   - **Name**: offline-media-pwa
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
5. Add environment variable (if needed):
   - `VITE_API_BASE_URL` = Your Rails API URL
6. Click "Create Static Site"

### Option 2: Via Render.yaml

The `render.yaml` file is already configured. Render will auto-detect it when you connect your repo.

### Render Configuration

The `render.yaml` file includes:
- Static site configuration
- SPA routing
- Service worker headers
- Cache control headers

## Environment Variables

Both platforms support environment variables. Set these in your deployment dashboard:

- `VITE_API_BASE_URL`: Your Rails API base URL (e.g., `https://api.example.com/api`)

**Important**: 
- Vite requires the `VITE_` prefix for environment variables
- These are baked into the build at build time
- You'll need to rebuild after changing environment variables

## Post-Deployment Checklist

- [ ] Verify service worker is registered (DevTools → Application → Service Workers)
- [ ] Test offline functionality
- [ ] Verify API endpoints are accessible (check CORS)
- [ ] Test PWA installation on mobile
- [ ] Run Lighthouse audit (target: 90+ PWA score)
- [ ] Test chunked uploads with large files
- [ ] Verify HTTPS (required for service workers)

## Custom Domain Setup

### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Render
1. Go to your Static Site → Settings → Custom Domains
2. Add your custom domain
3. Configure DNS as instructed

## Troubleshooting

### Service Worker Not Working
- Ensure HTTPS is enabled (required for service workers)
- Check service worker registration in DevTools
- Verify `service-worker.js` is accessible
- Clear browser cache and hard reload

### API Calls Failing
- Check CORS configuration on Rails API
- Verify `VITE_API_BASE_URL` is set correctly
- Check browser console for errors
- Verify API is accessible from deployment domain

### Build Failures
- Check build logs in deployment dashboard
- Verify all dependencies are in `package.json`
- Ensure Node.js version is compatible (check `package.json` engines if specified)

### Routing Issues
- Verify SPA routing is configured (all routes → index.html)
- Check `vercel.json` or `render.yaml` rewrites
- Test direct URL access to routes

## Continuous Deployment

Both Vercel and Render support automatic deployments:
- **Vercel**: Auto-deploys on push to main branch
- **Render**: Auto-deploys on push to main branch (if enabled)

To disable auto-deploy, configure in dashboard settings.

## Monitoring

### Vercel Analytics
- Enable in Project Settings → Analytics
- View performance metrics and errors

### Render Logs
- View real-time logs in dashboard
- Check build and runtime logs

## Performance Optimization

Both platforms automatically:
- Enable CDN caching
- Compress assets (gzip/brotli)
- Optimize images (if configured)
- Enable HTTP/2

## Security

- HTTPS is automatically enabled
- Service workers require HTTPS (or localhost)
- CORS must be configured on Rails API
- Environment variables are encrypted

