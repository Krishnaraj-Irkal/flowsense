# FlowSense Client Implementation Guide

## ✅ Server Side - COMPLETE

The server-side authentication system is fully implemented and committed. Here's what's working:

### Server Features
- ✅ MongoDB connection
- ✅ User registration & login with JWT
- ✅ Password hashing with bcrypt
- ✅ Protected API routes
- ✅ Token management for Dhan APIs
- ✅ Daily 9 AM token expiry
- ✅ Full REST API

### API Endpoints Available
```
POST /api/auth/signup       - Register user
POST /api/auth/login        - Login user
GET  /api/auth/me           - Get current user
PUT  /api/auth/profile      - Update profile
PUT  /api/auth/password     - Change password
PUT  /api/auth/client-id    - Update client ID
POST /api/tokens            - Save tokens (first-time)
GET  /api/tokens            - Get user's tokens
PUT  /api/tokens            - Update tokens
GET  /api/tokens/status     - Check token status
```

## 📋 Client Side - TO DO

Now we need to build the React frontend. Here's what needs to be created:

### 1. Authentication Context (`client/src/context/AuthContext.tsx`)
- Manages global auth state
- Stores JWT token in localStorage
- Provides login/logout functions
- Provides current user info
- Handles token refresh

### 2. API Service (`client/src/services/api.ts`)
- Axios instance with base URL
- Request interceptor (adds JWT token)
- Response interceptor (handles 401 errors)
- All API calls to backend

### 3. Pages

#### Homepage (`client/src/pages/Homepage.tsx`)
- Public landing page
- Shows FlowSense branding
- Login & Signup buttons
- Redirects to dashboard if already logged in

#### Login Page (`client/src/pages/Login.tsx`)
- Email & password form
- Calls `/api/auth/login`
- Stores JWT token
- Redirects to dashboard
- Shows first-time modal if needed

#### Signup Page (`client/src/pages/Signup.tsx`)
- Name, email, password form
- Calls `/api/auth/signup`
- Auto-logs in after signup
- Shows first-time modal

#### Dashboard (`client/src/pages/Dashboard.tsx`)
- Protected route (requires auth)
- Shows welcome message
- Header with navigation
- Main content area
- Will show trading data later

#### Settings Page (`client/src/pages/Settings.tsx`)
- Protected route
- User profile section
- Client ID section
- Access tokens section (3 tokens)
- Password change section
- Save buttons for each section

### 4. Components

#### Header (`client/src/components/Header.tsx`)
- App logo/name
- Navigation links (Dashboard, Settings)
- User menu with logout

#### Token Setup Modal (`client/src/components/TokenSetupModal.tsx`)
- Shows on first login
- Cannot be closed without saving
- Form fields:
  - Client ID
  - Tick Feed Token
  - Market Depth Token
  - Option Chain Token
- Validation
- Calls `/api/tokens` POST

#### Protected Route (`client/src/components/ProtectedRoute.tsx`)
- Wrapper component
- Checks if user is authenticated
- Redirects to login if not
- Renders children if authenticated

### 5. Router Setup (`client/src/App.tsx`)
Update to use React Router:
```tsx
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><Settings /></ProtectedRoute>
      } />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

### 6. Types (`client/src/types/index.ts`)
```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  clientId?: string;
  isFirstLogin: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Tokens {
  tickFeedToken: string;
  marketDepthToken: string;
  optionChainToken: string;
}
```

## 📁 Directory Structure Needed

```
client/src/
├── components/
│   ├── Header.tsx
│   ├── Header.css
│   ├── TokenSetupModal.tsx
│   ├── TokenSetupModal.css
│   └── ProtectedRoute.tsx
├── pages/
│   ├── Homepage.tsx
│   ├── Homepage.css
│   ├── Login.tsx
│   ├── Login.css
│   ├── Signup.tsx
│   ├── Signup.css
│   ├── Dashboard.tsx
│   ├── Dashboard.css
│   ├── Settings.tsx
│   └── Settings.css
├── context/
│   └── AuthContext.tsx
├── services/
│   └── api.ts
├── types/
│   └── index.ts
├── App.tsx (updated)
├── App.css (updated)
├── index.tsx
└── index.css
```

## 🔑 Key Implementation Points

### Auth Context Pattern
```typescript
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Verify token and get user
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    setToken(response.data.token);
    setUser(response.data.user);
    localStorage.setItem('token', response.data.token);
    return response.data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{user, token, login, logout, loading}}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Axios Interceptor
```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Protected Route Pattern
```typescript
const ProtectedRoute: React.FC<{children: React.ReactNode}> = ({children}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

### First-Time Login Flow
```typescript
// In Login.tsx after successful login
if (user.isFirstLogin) {
  setShowTokenModal(true);
}

// In TokenSetupModal.tsx
const handleSubmit = async () => {
  await api.post('/tokens', {
    clientId,
    tickFeedToken,
    marketDepthToken,
    optionChainToken
  });
  setShowTokenModal(false);
  navigate('/dashboard');
};
```

## 🎨 Styling Guidelines

- Use the same gradient scheme as current app
- Primary color: #667eea to #764ba2
- Cards with shadow and hover effects
- Responsive design (mobile-first)
- Form fields with proper validation styling
- Loading states for async operations
- Error messages in red (#e53e3e)
- Success messages in green (#22543d)

## 🧪 Testing Flow

1. **Signup**:
   - Fill form → Submit → Auto-login → Show token modal → Fill tokens → Redirect to dashboard

2. **Login (first time)**:
   - Fill form → Submit → Show token modal → Fill tokens → Redirect to dashboard

3. **Login (subsequent)**:
   - Fill form → Submit → Redirect to dashboard (no modal)

4. **Token Expiry** (after 9 AM):
   - Login → isFirstLogin=true → Show token modal again

5. **Settings**:
   - Update profile → Success message
   - Update Client ID → Success message
   - Update tokens → Success message & new expiry
   - Change password → Success message

6. **Logout**:
   - Click logout → Clear token → Redirect to homepage

## 📝 Next Steps

Ready to implement? Start with:
1. Create directory structure
2. Build AuthContext
3. Build API service
4. Create pages one by one
5. Add components
6. Test complete flow

All server endpoints are ready and waiting for the frontend!
