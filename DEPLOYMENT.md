# FlowSense Deployment Guide

This guide will help you deploy FlowSense to Vercel (client) and Railway (server).

## Prerequisites

- GitHub account
- Vercel account (sign up at https://vercel.com)
- Railway account (sign up at https://railway.app)
- Git installed locally

## Step 1: Push to GitHub

1. Create a new repository on GitHub named `flowsense`

2. Add the remote and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/flowsense.git
git add .
git commit -m "Initial commit: FlowSense monorepo setup"
git branch -M main
git push -u origin main
```

## Step 2: Deploy Server to Railway

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your `flowsense` repository
5. Railway will auto-detect the monorepo structure
6. Configure the service:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

7. Add environment variables in Railway:
   - `PORT`: 8080 (Railway will override this automatically)
   - `NODE_ENV`: production
   - `CLIENT_URL`: (will be updated after Vercel deployment)

8. Deploy the service
9. Copy the deployed URL (e.g., `https://flowsense-server.up.railway.app`)

## Step 3: Deploy Client to Vercel

1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your `flowsense` repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. Add environment variables in Vercel:
   - `REACT_APP_API_URL`: (paste your Railway server URL from Step 2)

6. Deploy the project
7. Copy the deployed URL (e.g., `https://flowsense.vercel.app`)

## Step 4: Update CORS Settings

1. Go back to Railway
2. Update the `CLIENT_URL` environment variable with your Vercel URL
3. Redeploy the server

## Step 5: Test the Deployment

1. Visit your Vercel URL
2. The app should load and display "Server Status"
3. If the status shows "healthy", your deployment is successful!

## Environment Variables Summary

### Server (Railway)
```
PORT=8080
NODE_ENV=production
CLIENT_URL=https://your-client-url.vercel.app
```

### Client (Vercel)
```
REACT_APP_API_URL=https://your-server-url.up.railway.app
```

## Troubleshooting

### Client can't connect to server
- Check that `REACT_APP_API_URL` in Vercel matches your Railway URL
- Verify that `CLIENT_URL` in Railway matches your Vercel URL
- Check Railway logs for any errors

### Build failures
- Ensure all dependencies are listed in package.json
- Check build logs for specific error messages
- Verify that root directory is correctly set

### CORS errors
- Verify `CLIENT_URL` environment variable in Railway
- Check that the Railway server is running
- Clear browser cache and try again

## Local Development vs Production

### Local URLs
- Client: http://localhost:3000
- Server: http://localhost:8080

### Production URLs
- Client: https://your-app.vercel.app
- Server: https://your-app.up.railway.app

## Future Enhancements

After successful deployment, you can:
- Add custom domain names
- Set up CI/CD pipelines
- Add authentication
- Implement trading features
- Add database integration
