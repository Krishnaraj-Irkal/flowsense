# Railway Deployment - Step by Step

## The Issue You Encountered

You got this error:
```
npm error Missing script: "start"
```

This happens because Railway was running `npm start` from the **root directory** instead of the **server directory**.

## Solution: Configure Root Directory

Railway needs to know your server code is in the `server` folder. Here's how to fix it:

### Step 1: Set Root Directory in Railway

1. Go to your Railway project: https://railway.app/project
2. Click on your service (the one that's failing)
3. Click on the **Settings** tab
4. Scroll down to find **Root Directory**
5. Enter: `server`
6. Click **Update**

### Step 2: Environment Variables

Go to the **Variables** tab and add:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `CLIENT_URL` | `http://localhost:3000` (temporary) |

**Important**: Do NOT set `PORT` - Railway sets this automatically!

### Step 3: Deploy Settings (Optional)

Go to **Settings** → **Deploy** section:
- **Build Command**: Leave empty (uses `npm run build` from package.json)
- **Start Command**: Leave empty (uses `npm start` from package.json)
- **Watch Paths**: Leave empty

### Step 4: Trigger Deployment

Option A: Click the **Deploy** button in Railway

Option B: Push a commit to GitHub:
```bash
git commit --allow-empty -m "Trigger Railway deployment"
git push
```

### Step 5: Check the Build

1. Go to the **Deployments** tab
2. Click on the latest deployment
3. Watch the logs:
   - You should see: "Installing dependencies..."
   - Then: "Building..."
   - Then: "FlowSense Server Running"

### Step 6: Get Your URL

1. Once deployed successfully, go to **Settings** → **Networking**
2. Under "Public Networking", click **Generate Domain**
3. Copy the URL (e.g., `https://flowsense-production.up.railway.app`)
4. Test it by visiting: `https://your-url.up.railway.app/api/health`

## Verify It's Working

Your server is working if you see this JSON response:
```json
{
  "status": "healthy",
  "message": "FlowSense server is running",
  "timestamp": "2025-12-08T...",
  "uptime": 123.456,
  "environment": "production"
}
```

## Common Issues & Solutions

### Issue: "Missing script: start"
**Solution**: Set Root Directory to `server` in Railway Settings

### Issue: Build fails with "Cannot find module"
**Solution**: Make sure all dependencies are in server/package.json

### Issue: Server starts but crashes immediately
**Solution**: Check environment variables, especially `CLIENT_URL`

### Issue: CORS errors
**Solution**: Update `CLIENT_URL` environment variable with your Vercel URL

### Issue: "Module not found" in production
**Solution**: Make sure you're building TypeScript (`npm run build` creates the `dist` folder)

## Verification Checklist

- [ ] Root Directory is set to `server`
- [ ] `NODE_ENV` is set to `production`
- [ ] `CLIENT_URL` is set (will update after Vercel deployment)
- [ ] Build logs show successful compilation
- [ ] Deployment status is "Success"
- [ ] Public URL is generated
- [ ] `/api/health` endpoint returns JSON

## After Railway is Working

1. Deploy your client to Vercel (see [DEPLOYMENT.md](DEPLOYMENT.md))
2. Get the Vercel URL
3. Come back to Railway → Variables
4. Update `CLIENT_URL` to your Vercel URL
5. Railway will auto-redeploy with the new variable

## Quick Commands Reference

### Check if server builds locally:
```bash
cd server
npm run build
npm start
```

### Test the health endpoint locally:
```bash
curl http://localhost:8080/api/health
```

### Check Railway logs:
Go to Railway Dashboard → Your Service → Deployments → Click latest deployment → View logs

## Need More Help?

- Check Railway docs: https://docs.railway.app
- View deployment logs in Railway dashboard
- Ensure your GitHub repo is up to date
- Compare your setup with [DEPLOYMENT.md](DEPLOYMENT.md)

## Current File Structure

Railway expects this structure when Root Directory = `server`:
```
server/
├── package.json       ← Has "start" script
├── tsconfig.json
├── src/
│   └── index.ts
├── dist/              ← Created by build
│   └── index.js       ← This is what runs
├── nixpacks.toml      ← Railway build config
└── Procfile           ← Backup start command
```

The `package.json` in the `server` folder has:
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc"
  }
}
```

That's why setting the Root Directory to `server` is crucial!
