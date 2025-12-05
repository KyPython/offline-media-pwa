# GitHub Setup & Deployment Instructions

## Step 1: Push to GitHub

### Create a New Repository on GitHub

1. Go to [github.com](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Name it: `offline-media-pwa` (or your preferred name)
4. Choose public or private
5. **Don't** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Push Your Code

Run these commands in your terminal:

```bash
cd /Users/ky/offline-media-pwa

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/offline-media-pwa.git

# Or if using SSH:
# git remote add origin git@github.com:YOUR_USERNAME/offline-media-pwa.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

### Via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your `offline-media-pwa` repository
4. Vercel will auto-detect Vite configuration
5. **Add Environment Variable** (if your API is not localhost):
   - Key: `VITE_API_BASE_URL`
   - Value: Your Rails API URL (e.g., `https://your-api.railway.app/api`)
6. Click "Deploy"
7. Wait for deployment (usually 1-2 minutes)
8. Your app will be live at `https://your-project.vercel.app`

### Via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login
vercel login

# Deploy (from project directory)
cd /Users/ky/offline-media-pwa
vercel

# Follow prompts:
# - Link to existing project? No (first time)
# - Project name: offline-media-pwa
# - Directory: ./
# - Override settings? No

# Deploy to production
vercel --prod
```

## Step 3: Deploy to Render

### Via Render Dashboard

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click "New +" → "Static Site"
3. Connect your GitHub account (if not already)
4. Select your `offline-media-pwa` repository
5. Configure:
   - **Name**: `offline-media-pwa`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
6. **Add Environment Variable** (if needed):
   - Key: `VITE_API_BASE_URL`
   - Value: Your Rails API URL
7. Click "Create Static Site"
8. Wait for deployment (usually 2-3 minutes)
9. Your app will be live at `https://offline-media-pwa.onrender.com`

### Render Auto-Detection

Render will automatically detect the `render.yaml` file and use those settings.

## Environment Variables

Both platforms need this environment variable if your Rails API is not at `http://localhost:3000/api`:

- **Key**: `VITE_API_BASE_URL`
- **Value**: Your production Rails API URL (e.g., `https://api.example.com/api`)

**Important**: 
- Vite environment variables must start with `VITE_`
- They are baked into the build at build time
- You must rebuild after changing environment variables

## Post-Deployment Checklist

After deploying to both platforms:

- [ ] Test the live URL in a browser
- [ ] Open DevTools → Application → Service Workers
- [ ] Verify service worker is registered
- [ ] Test offline functionality (DevTools → Network → Offline)
- [ ] Check console for errors
- [ ] Verify API calls work (check Network tab)
- [ ] Test on mobile device
- [ ] Run Lighthouse audit (target: 90+ PWA score)

## Troubleshooting

### Service Worker Not Working
- **HTTPS Required**: Service workers only work on HTTPS (or localhost)
- Both Vercel and Render provide HTTPS automatically
- Clear browser cache and hard reload (Cmd+Shift+R / Ctrl+Shift+R)

### API Calls Failing
- Check CORS configuration on your Rails API
- Add your deployment URLs to Rails CORS allowed origins:
  ```ruby
  # config/initializers/cors.rb
  origins 'https://your-project.vercel.app', 'https://offline-media-pwa.onrender.com'
  ```

### Build Failures
- Check build logs in deployment dashboard
- Verify all dependencies are in `package.json`
- Check Node.js version compatibility

## Custom Domains

### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed

### Render
1. Go to Static Site → Settings → Custom Domains
2. Add your custom domain
3. Configure DNS as instructed

## Continuous Deployment

Both platforms automatically deploy when you push to the `main` branch:
- Push to GitHub → Auto-deploy on Vercel
- Push to GitHub → Auto-deploy on Render

## Quick Commands Reference

```bash
# Git workflow
git add .
git commit -m "Your commit message"
git push origin main

# Vercel CLI
vercel              # Deploy to preview
vercel --prod       # Deploy to production
vercel logs         # View logs

# Check deployment status
# - Vercel: Check dashboard or use `vercel ls`
# - Render: Check dashboard
```

## Next Steps

1. ✅ Push to GitHub
2. ✅ Deploy to Vercel
3. ✅ Deploy to Render
4. ✅ Test both deployments
5. ✅ Configure custom domain (optional)
6. ✅ Set up monitoring/analytics (optional)

Your PWA is now live and ready for production use! 🚀

