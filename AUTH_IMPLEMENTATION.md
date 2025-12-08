# FlowSense Authentication System Implementation Plan

## Overview

This document outlines the complete authentication system with:
- User signup/login
- JWT authentication
- First-time login modal for Dhan tokens
- Daily 9 AM token expiry
- Settings page for token management
- Protected routes

## Current Progress

✅ MongoDB connection configured
✅ User model created
✅ AccessToken model created
✅ Dependencies installed

## Server Implementation (In Progress)

### Files Created:
1. `server/src/config/database.ts` - MongoDB connection
2. `server/src/models/User.ts` - User schema with bcrypt
3. `server/src/models/AccessToken.ts` - Access tokens schema

### Next Steps:

I'll now create the remaining server files and then move to the client implementation. This will include:

1. **Server Side:**
   - JWT utilities
   - Auth middleware
   - Auth controllers
   - Token management routes
   - Daily token expiry scheduler

2. **Client Side:**
   - React Router setup
   - Auth Context
   - Login/Signup pages
   - Homepage
   - Dashboard with header
   - Token Setup Modal
   - Settings page
   - Protected routes

## System Flow

### 1. User Registration
```
POST /api/auth/signup
Body: { name, email, password }
Response: { token, user }
```

### 2. User Login
```
POST /api/auth/login
Body: { email, password }
Response: { token, user, isFirstLogin }
```

### 3. First-Time Login (Token Setup)
- If `isFirstLogin === true`, modal opens
- User enters:
  - Client ID (one-time)
  - Tick Feed Token
  - Market Depth Token
  - Option Chain Token
- Tokens stored in MongoDB
- `isFirstLogin` set to false

### 4. Daily Token Expiry (9 AM)
- Cron job runs at 9:00 AM
- All tokens marked as expired
- Users must re-enter tokens on next login

### 5. Settings Page
- View/Update user details
- Update Client ID
- Update all three access tokens
- Change password

## Database Schema

### Users Collection
```typescript
{
  name: string
  email: string (unique)
  password: string (hashed)
  clientId?: string
  isFirstLogin: boolean (default: true)
  createdAt: Date
  updatedAt: Date
}
```

### AccessTokens Collection
```typescript
{
  userId: ObjectId (ref: User)
  tickFeedToken: string
  marketDepthToken: string
  optionChainToken: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### User Management
- `PUT /api/user/profile` - Update user profile
- `PUT /api/user/password` - Change password
- `PUT /api/user/client-id` - Update client ID

### Token Management
- `POST /api/tokens` - Save access tokens (first-time)
- `GET /api/tokens` - Get user's tokens
- `PUT /api/tokens` - Update access tokens
- `GET /api/tokens/status` - Check token expiry status

## Client Routes

### Public Routes
- `/` - Homepage (redirects to `/dashboard` if logged in)
- `/login` - Login page
- `/signup` - Signup page

### Protected Routes (require authentication)
- `/dashboard` - Main dashboard
- `/settings` - User settings page

## Environment Variables

### Server (.env)
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
```

### Client (.env)
```
REACT_APP_API_URL=http://localhost:8080
```

## Features Implementation

### 1. Token Setup Modal
- Shows after first login
- Cannot be closed until tokens are saved
- Form fields:
  - Client ID (text input)
  - Tick Feed Token (text input)
  - Market Depth Token (text input)
  - Option Chain Token (text input)
- Validates all fields required
- Saves to backend and closes

### 2. Dashboard Header
- Logo/App name
- Navigation:
  - Dashboard (active)
  - Settings
- User menu:
  - User name
  - Logout button

### 3. Settings Page Sections

**User Information**
- Name (editable)
- Email (read-only)
- Save changes button

**Client Configuration**
- Client ID (editable)
- Last updated timestamp

**Access Tokens**
- Tick Feed Token (editable)
- Market Depth Token (editable)
- Option Chain Token (editable)
- Token expiry status
- Update tokens button

**Security**
- Current password input
- New password input
- Confirm password input
- Change password button

## Security Considerations

1. **Password Hashing**: bcrypt with salt rounds = 10
2. **JWT**: Stored in localStorage, sent in Authorization header
3. **Protected Routes**: Middleware checks JWT validity
4. **Token Encryption**: Consider encrypting Dhan tokens at rest
5. **HTTPS**: Required in production
6. **CORS**: Properly configured for client domain

## Scheduler Implementation

```typescript
// Runs daily at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  // Set all tokens as expired
  await AccessToken.updateMany(
    {},
    { expiresAt: new Date() }
  );
});
```

## Testing Checklist

- [ ] User can signup
- [ ] User can login
- [ ] JWT token is generated
- [ ] First login shows modal
- [ ] Modal saves tokens correctly
- [ ] Dashboard loads after modal
- [ ] Header shows user info
- [ ] Settings page loads
- [ ] Can update profile
- [ ] Can update client ID
- [ ] Can update tokens
- [ ] Can change password
- [ ] Logout works
- [ ] Protected routes redirect to login
- [ ] Token expiry works at 9 AM
- [ ] Expired tokens force re-entry

## Next Actions

Continuing with server implementation, then moving to client...
