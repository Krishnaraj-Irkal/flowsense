# FlowSense Common Deployment Errors

Quick reference for common errors and their solutions.

---

## Error 1: API URL Concatenation

### Symptom
API calls go to malformed URL like:
```
https://flowsense-server-yjxl.vercel.app/flowsense-production.up.railway.app/api/health
```

### Root Cause
Missing `https://` protocol in `REACT_APP_API_URL` environment variable.

When axios sees a URL without protocol, it treats it as a relative path and concatenates it with the current domain.

### What You Set (Wrong)
```
REACT_APP_API_URL=flowsense-production.up.railway.app
```

### What You Should Set (Correct)
```
REACT_APP_API_URL=https://flowsense-production.up.railway.app
```

### How to Fix

**In Vercel:**
1. Go to Project → Settings → Environment Variables
2. Find `REACT_APP_API_URL`
3. Edit the value to include `https://`:
   ```
   https://flowsense-production.up.railway.app
   ```
4. Save
5. Go to Deployments tab → Redeploy latest

### Verification
After redeploy, visit your site and check the "Connected to:" text. Should show:
```
Connected to: https://flowsense-production.up.railway.app
```

---

## Error 2: Railway - Missing script: "start"

### Symptom
```
npm error Missing script: "start"
```

### Root Cause
Railway running `npm start` from root directory instead of `server` directory.

### How to Fix

**In Railway:**
1. Go to your service → Settings
2. Find **Root Directory**
3. Set to: `server`
4. Click Update
5. Redeploy

### Verification
Check deployment logs - should show:
```
Building...
FlowSense Server Running
Port: 8080
```

---

## Error 3: Vercel - Unexpected token '<'

### Symptom
```
Uncaught SyntaxError: Unexpected token '<' (at bundle.xxx.js:1:1)
```

### Root Cause
JavaScript bundle not being served correctly, HTML returned instead.

### How to Fix

**In Vercel:**
1. Go to Project → Settings → General
2. Find **Root Directory**
3. Set to: `client`
4. Find **Output Directory**
5. Set to: `dist`
6. Save and redeploy

### Verification
Open DevTools → Network tab:
- `bundle.[hash].js` should load with status 200
- Content-Type should be `application/javascript`

---

## Error 4: CORS Policy Error

### Symptom
```
Access to XMLHttpRequest at 'https://railway-url' from origin 'https://vercel-url'
has been blocked by CORS policy
```

### Root Cause
Railway's `CLIENT_URL` doesn't match your Vercel URL.

### How to Fix

**In Railway:**
1. Go to your service → Variables
2. Find or add `CLIENT_URL`
3. Set to your Vercel URL:
   ```
   https://your-vercel-url.vercel.app
   ```
4. Railway auto-redeploys

### Verification
Visit Vercel site → Server Status should show "healthy" with no CORS errors in console.

---

## Error 5: API Calls to localhost in Production

### Symptom
API calls go to `http://localhost:8080` instead of Railway URL.

### Root Cause
`REACT_APP_API_URL` environment variable not set in Vercel.

### How to Fix

**In Vercel:**
1. Go to Project → Settings → Environment Variables
2. Add new variable:
   - Name: `REACT_APP_API_URL`
   - Value: `https://your-railway-url.up.railway.app`
3. Save and redeploy

### Verification
Check "Connected to:" on homepage - should show Railway URL, not localhost.

---

## Error 6: Build Fails - Cannot find module

### Symptom (Railway)
```
Error: Cannot find module 'express'
```

### Symptom (Vercel)
```
Error: Cannot find module 'react'
```

### Root Cause
Dependencies not in package.json or npm install failed.

### How to Fix

**Check locally first:**
```bash
# For server
cd server
npm install
npm run build

# For client
cd client
npm install
npm run build
```

If local build works:
- Check platform logs for npm install errors
- Verify Root Directory is set correctly
- Try clearing build cache and redeploying

---

## Error 7: Environment Variables Not Working

### Symptom
Environment variables seem to be ignored or showing as undefined.

### Root Cause
- Vercel: Need to redeploy after adding/changing env vars
- Railway: Need to wait for auto-redeploy

### How to Fix

**In Vercel:**
1. Add/edit environment variable
2. Go to Deployments tab
3. Click "Redeploy" on latest deployment
4. Don't just push new code - must redeploy

**In Railway:**
1. Add/edit environment variable
2. Wait for auto-redeploy (usually automatic)
3. Check Deployments tab for new deployment

### Verification
Check deployment logs for the environment being used.

---

## Quick Debugging Checklist

### Railway Deployment
- [ ] Root Directory = `server`
- [ ] `NODE_ENV` = `production`
- [ ] `CLIENT_URL` includes `https://`
- [ ] Build logs show success
- [ ] Can access `/api/health` endpoint

### Vercel Deployment
- [ ] Root Directory = `client`
- [ ] Output Directory = `dist`
- [ ] `REACT_APP_API_URL` includes `https://`
- [ ] Build logs show success
- [ ] Site loads without JavaScript errors

### Client-Server Connection
- [ ] Server health endpoint returns JSON
- [ ] Client shows "healthy" status
- [ ] No CORS errors in console
- [ ] "Connected to:" shows correct URL

---

## Environment Variable Format Reference

### Correct Format
```bash
# Railway
NODE_ENV=production
CLIENT_URL=https://flowsense.vercel.app

# Vercel
REACT_APP_API_URL=https://flowsense-production.up.railway.app
```

### Wrong Format
```bash
# Missing protocol
CLIENT_URL=flowsense.vercel.app                    # ❌
REACT_APP_API_URL=flowsense-production.up.railway.app  # ❌

# Trailing slash
CLIENT_URL=https://flowsense.vercel.app/           # ❌
REACT_APP_API_URL=https://flowsense-production.up.railway.app/  # ❌

# Wrong protocol
CLIENT_URL=http://flowsense.vercel.app             # ❌
REACT_APP_API_URL=http://flowsense-production.up.railway.app    # ❌
```

---

## Testing Commands

### Test Server Locally
```bash
cd server
npm run build
npm start
# Visit http://localhost:8080/api/health
```

### Test Client Locally
```bash
cd client
npm run build
# Check dist/ folder exists with bundle.js and index.html
```

### Test API Connection
```bash
# Test Railway server
curl https://your-railway-url.up.railway.app/api/health

# Should return JSON with "status": "healthy"
```

### Test From Browser Console
```javascript
// On Vercel site, open console and run:
console.log(process.env.REACT_APP_API_URL);
// Should show Railway URL with https://
```

---

## When All Else Fails

1. **Check deployment logs** on both Railway and Vercel
2. **Compare with working local setup** - both build locally?
3. **Verify environment variables** - exact format with `https://`
4. **Check Root Directory settings** - Railway: `server`, Vercel: `client`
5. **Try incognito window** - eliminates caching issues
6. **Redeploy both services** - fresh start sometimes helps

---

## Need More Help?

- [RAILWAY_SETUP.md](RAILWAY_SETUP.md) - Detailed Railway guide
- [VERCEL_SETUP.md](VERCEL_SETUP.md) - Detailed Vercel guide
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Complete deployment overview
- Check deployment logs for specific error messages
- Verify settings match the documentation exactly
