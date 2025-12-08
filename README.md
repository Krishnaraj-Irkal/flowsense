# FlowSense

FlowSense - Trading platform for Dhan with client and server monorepo.

## Description
- **Server**: FlowSense backend API for Dhan trading platform
- **Client**: React-based frontend application
- **Purpose**: Private trading platform for family use

## Project Structure
```
flowsense/
├── client/          # React frontend (deployed on Vercel)
├── server/          # Node.js/Express backend (deployed on Railway)
├── package.json     # Root package.json for monorepo
└── README.md
```

## Local Development

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
npm run install:all
```

### Running Locally
```bash
# Run both client and server concurrently
npm run dev

# Or run individually
npm run dev:client
npm run dev:server
```

### Building
```bash
# Build both
npm run build

# Build individually
npm run build:client
npm run build:server
```

## Deployment

- **Client**: Deployed to Vercel
- **Server**: Deployed to Railway

## Environment Variables

### Client (.env)
```
REACT_APP_API_URL=your_server_url
```

### Server (.env)
```
PORT=8080
NODE_ENV=production
CLIENT_URL=your_client_url
```
