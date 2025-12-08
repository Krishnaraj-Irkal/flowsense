# FlowSense - Quick Start Guide

## What is FlowSense?

FlowSense is a monorepo containing a trading platform for Dhan with:
- **Client**: React + TypeScript frontend
- **Server**: Node.js + Express + TypeScript backend

## Project Structure

```
flowsense/
├── client/                  # React frontend
│   ├── src/
│   │   ├── App.tsx         # Main app component
│   │   ├── App.css         # Styles
│   │   ├── index.tsx       # Entry point
│   │   └── index.css       # Global styles
│   ├── public/
│   │   ├── index.html      # HTML template
│   │   └── favicon.ico     # Favicon
│   ├── package.json
│   ├── tsconfig.json
│   ├── webpack.config.js
│   ├── vercel.json         # Vercel deployment config
│   └── .env                # Environment variables
│
├── server/                  # Express backend
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   └── routes/
│   │       └── health.ts   # Health check endpoint
│   ├── package.json
│   ├── tsconfig.json
│   ├── railway.json        # Railway deployment config
│   ├── Procfile            # Railway Procfile
│   └── .env                # Environment variables
│
├── package.json             # Root package.json
├── .gitignore
├── README.md
├── DEPLOYMENT.md            # Deployment instructions
└── QUICKSTART.md            # This file
```

## Getting Started

### 1. Install Dependencies

```bash
# Install all dependencies (root, client, and server)
npm run install:all
```

### 2. Run Locally

#### Option A: Run both concurrently
```bash
npm run dev
```

#### Option B: Run separately

**Terminal 1 - Start Server:**
```bash
npm run dev:server
```

**Terminal 2 - Start Client:**
```bash
npm run dev:client
```

### 3. Access the Application

- **Client**: http://localhost:3000
- **Server**: http://localhost:8080
- **API Health Check**: http://localhost:8080/api/health

## Building for Production

### Build Both
```bash
npm run build
```

### Build Individually
```bash
npm run build:client
npm run build:server
```

## Environment Variables

### Client (.env)
```
REACT_APP_API_URL=http://localhost:8080
```

### Server (.env)
```
PORT=8080
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

## Next Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit: FlowSense monorepo"
   git remote add origin https://github.com/YOUR_USERNAME/flowsense.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy to Production**
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions
   - Deploy server to Railway
   - Deploy client to Vercel

3. **Start Building Features**
   - Add authentication
   - Implement trading features
   - Add database integration
   - Create user dashboard

## Available Scripts

### Root Level
- `npm run dev` - Run both client and server
- `npm run dev:client` - Run only client
- `npm run dev:server` - Run only server
- `npm run build` - Build both client and server
- `npm run build:client` - Build only client
- `npm run build:server` - Build only server

### Client Level
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

### Server Level
- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript
- `npm start` - Start production server
- `npm run type-check` - Check TypeScript types

## Technology Stack

### Client
- React 18
- TypeScript
- Webpack 5
- Axios
- CSS

### Server
- Node.js
- Express
- TypeScript
- CORS
- Helmet
- Morgan

## Troubleshooting

### Port already in use
If you get "port already in use" error:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Module not found
```bash
# Clean install
rm -rf node_modules client/node_modules server/node_modules
npm run install:all
```

### TypeScript errors
```bash
# Type check
cd server
npm run type-check
```

## Support

For issues or questions:
1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment help
2. Review error messages in browser console (client) or terminal (server)
3. Check environment variables are set correctly
