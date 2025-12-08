# Vercel Deployment - Step by Step

## The Issue You're Seeing

Error: `Uncaught SyntaxError: Unexpected token '<'`

This typically means:
1. The JavaScript bundle isn't being served correctly
2. HTML is being returned instead of the JS file
3. Configuration issue with Vercel routing

## Solution: Proper Vercel Configuration

### Step 1: Deploy to Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New** → **Project**
3. Find and import your `flowsense` repository
4. Click **Import**

### Step 2: Configure the Project

Vercel will show you configuration options:

#### Framework Preset
- Select: **Other** (or leave as detected)

#### Root Directory
- Click **Edit** next to Root Directory
- Enter: `client`
- Click **Continue**

#### Build Settings
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Environment Variables

Click **Add Environment Variable** and add:

| Name | Value |
|------|-------|
| `REACT_APP_API_URL` | `https://your-railway-url.up.railway.app` |

**Important**: Use your Railway server URL here (from Railway deployment)

### Step 4: Deploy

Click **Deploy** and wait for the build to complete (2-3 minutes)

### Step 5: Verify Deployment

Once deployed:
1. Click **Visit** to open your site
2. Open browser DevTools (F12) → Network tab
3. Refresh the page
4. Check that `bundle.[hash].js` loads with status 200

## Troubleshooting the `<` Error

### Issue 1: Wrong Root Directory
**Symptom**: Build fails or wrong files deployed
**Solution**:
- Go to Project Settings → General → Root Directory
- Set to: `client`
- Redeploy

### Issue 2: Build Output Wrong
**Symptom**: `Unexpected token '<'` error
**Solution**:
1. Check Project Settings → General → Output Directory is `dist`
2. Verify locally that build works:
```bash
cd client
npm run build
ls dist  # Should see bundle.[hash].js and index.html
```

### Issue 3: Environment Variable Not Set
**Symptom**: API calls fail, but no syntax error
**Solution**:
- Go to Project Settings → Environment Variables
- Add `REACT_APP_API_URL` with your Railway URL
- Redeploy from Deployments tab

### Issue 4: Caching Issues
**Symptom**: Old version loads
**Solution**:
- Hard refresh: Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)
- Clear browser cache
- Try incognito/private window

## Vercel Dashboard Checklist

After deployment, verify these settings:

### General Settings
- [ ] Root Directory: `client`
- [ ] Output Directory: `dist`
- [ ] Build Command: `npm run build`
- [ ] Install Command: `npm install`
- [ ] Node.js Version: 18.x or higher

### Environment Variables
- [ ] `REACT_APP_API_URL` is set to Railway URL

### Deployment Status
- [ ] Build completed successfully
- [ ] No build errors in logs
- [ ] Visit link works and shows your app

## Testing Your Deployment

### Test 1: Site Loads
Visit your Vercel URL - should see FlowSense homepage

### Test 2: JavaScript Loads
Open DevTools → Network tab:
- `bundle.[hash].js` should load (status 200)
- Size should be ~180KB
- Type should be `application/javascript`

### Test 3: API Connection
On the homepage:
- "Server Status" card should show "healthy" or "Failed to connect"
- If "Failed to connect", check environment variable

### Test 4: Console Check
Open DevTools → Console:
- Should have no errors (or just API connection errors if Railway not deployed yet)
- Should NOT see `SyntaxError: Unexpected token '<'`

## Common Vercel Issues

### Build Succeeds but Site Shows Error

**Check 1: Output Directory**
```bash
# Locally verify build output
cd client
npm run build
ls dist
# Should see: index.html, bundle.[hash].js, favicon.ico
```

**Check 2: vercel.json Configuration**
The [vercel.json](client/vercel.json) should have:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Check 3: Deployment Logs**
- Go to Deployments tab
- Click on latest deployment
- Check "Building" logs for any warnings

### CORS Errors After Deployment

This is expected if you haven't updated Railway's `CLIENT_URL`:

1. Copy your Vercel URL (e.g., `https://flowsense.vercel.app`)
2. Go to Railway → Your Service → Variables
3. Update `CLIENT_URL` to your Vercel URL
4. Railway will auto-redeploy

### API Calls Return 404

Check your `REACT_APP_API_URL`:
- Should end with no trailing slash
- Should be `https://` not `http://`
- Should be your Railway public URL
- Example: `https://flowsense-production.up.railway.app`

## Manual Redeploy

If you need to redeploy without code changes:

### Option 1: From Vercel Dashboard
1. Go to Deployments tab
2. Find the last successful deployment
3. Click ⋯ (three dots)
4. Click "Redeploy"

### Option 2: Push Empty Commit
```bash
git commit --allow-empty -m "Trigger Vercel redeploy"
git push
```

## Vercel CLI (Optional)

For local testing with Vercel:

```bash
# Install Vercel CLI globally
npm install -g vercel

# From client directory
cd client
vercel dev

# To deploy
vercel --prod
```

## After Successful Deployment

1. Copy your Vercel URL
2. Test the site thoroughly
3. Update Railway's `CLIENT_URL` environment variable
4. Test the full client-server connection

## Project Settings Quick Access

In Vercel dashboard:
- **Settings** → General: Root directory, build settings
- **Settings** → Environment Variables: Add/edit variables
- **Deployments**: View all deployments and logs
- **Visit**: Quick link to your live site

## Need More Help?

- Check Vercel deployment logs for specific errors
- Verify [vercel.json](client/vercel.json) configuration
- Compare with [DEPLOYMENT.md](DEPLOYMENT.md)
- Test build locally first: `cd client && npm run build`

## Current Configuration Files

Your client has these Vercel-related files:
- `client/vercel.json` - Vercel configuration
- `client/package.json` - Build scripts
- `client/webpack.config.js` - Webpack bundler config
- `client/.env` - Environment variables (local only, not pushed to git)

The build process:
1. Vercel runs `npm install` in `client` directory
2. Vercel runs `npm run build` (webpack --mode production)
3. Webpack creates `dist` folder with:
   - `index.html`
   - `bundle.[contenthash].js`
   - `favicon.ico`
4. Vercel serves files from `dist` folder

That's it! Your client should now deploy successfully to Vercel.
