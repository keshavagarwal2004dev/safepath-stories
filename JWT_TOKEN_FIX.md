# JWT Token Fix - Story Creation Issue Resolved

## 🐛 Problem Identified

After signing up as an NGO, users couldn't create stories because **the JWT access token was not being stored** in localStorage.

The backend was returning the `access_token` with every signup/login response, but the frontend code wasn't:
1. ❌ Extracting the token from the response
2. ❌ Storing it in localStorage
3. ❌ Including it in subsequent API requests

### What Changed

#### 1. **API Response Types** (`src/lib/api.ts`)
**Before:**
```typescript
export const loginNgo = (payload: NgoLoginPayload) =>
  request<{ success: boolean; ngoId: string; email: string }>(...)

export const signupNgo = (payload: NgoSignupPayload) =>
  request<{ success: boolean; ngoId: string; email: string; orgName: string }>(...)
```

**After:**
```typescript
export const loginNgo = (payload: NgoLoginPayload) =>
  request<{
    success: boolean;
    ngoId: string;
    email: string;
    access_token: string;        // ✅ JWT token
    token_type: string;
    expires_in: number;           // seconds
  }>(...)

export const signupNgo = (payload: NgoSignupPayload) =>
  request<{
    success: boolean;
    ngoId: string;
    email: string;
    orgName: string;
    access_token: string;        // ✅ JWT token
    token_type: string;
    expires_in: number;           // seconds
  }>(...)
```

#### 2. **NGO Signup** (`src/pages/NgoSignup.tsx`)
**Before:**
```tsx
const response = await signupNgo({ ... });
localStorage.setItem("ngo_profile", JSON.stringify({ ngoId: response.ngoId, ... }));
navigate("/ngo/dashboard");
```

**After:**
```tsx
const response = await signupNgo({ ... });
// ✅ Store JWT token
localStorage.setItem("access_token", response.access_token);
// ✅ Store profile separately
localStorage.setItem("ngo_profile", JSON.stringify({ ngoId: response.ngoId, ... }));
navigate("/ngo/dashboard");
```

#### 3. **NGO Login** (`src/pages/NgoLogin.tsx`)
Same fix as signup - now stores the access token after login.

---

## ✅ How It Works Now

### Auth Flow
```
1. User signs up with email + password
   ↓
2. Backend returns: { success, ngoId, email, access_token, expires_in }
   ↓
3. Frontend stores:
   - localStorage["access_token"] = "jwt-token-here"
   - localStorage["ngo_profile"] = { ngoId, email, ... }
   ↓
4. User navigates to /ngo/dashboard
   ↓
5. Dashboard uses token to call protected endpoints
```

### Story Creation Flow
```
1. User navigates to Create Story page
   ↓
2. Frontend fills form (topic, description, etc.)
   ↓
3. User clicks "Generate Story"
   ↓
4. API calls createStory() which:
   - Gets token from localStorage["access_token"]
   - Adds Authorization header: "Bearer {token}"
   - Sends to POST /api/stories
   ↓
5. Backend verifies JWT → extracts ngo_id → creates story
   ↓
6. Story created ✅ → User redirected to story preview
```

---

## 🧪 How to Test

### Option 1: Quick Test (Browser DevTools)

1. **Open browser console** (F12)
2. **Sign up** with test credentials:
   - Organization: "Test NGO"
   - Email: "test@example.com"
   - Password: "TestPass123!"
3. **Check localStorage** in DevTools:
   ```
   Storage → Local Storage → localhost:8081
   ```
   Should show:
   - `access_token`: "eyJhbGc..." (JWT string)
   - `ngo_profile`: {"ngoId":"...", "email":"..."}
4. **Go to Create Story** and fill form:
   - Topic: "Water Safety"
   - Age Group: "5-8"
   - Language: "English"
   - Description: "Learn about water safety"
5. **Click Generate** → Story should be created ✅

### Option 2: API Test with curl

```bash
# 1. Signup
curl -X POST http://localhost:8000/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Test NGO",
    "email": "test@ngo.com",
    "password": "TestPass123!"
  }'

# Response will include: { access_token: "...", expires_in: 86400, ... }

# 2. Copy the access_token from response

# 3. Create a story
curl -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Water Safety Adventure",
    "topic": "water_safety",
    "ageGroup": "5-8",
    "language": "en",
    "characterCount": 2,
    "description": "Learn about water safety",
    "moralLesson": "Always be safe near water"
  }'

# Should return: { "story": { "id": "...", "title": "...", ... }, "slides": [...] }
```

---

## 🔍 Debugging Checklist

If story creation still doesn't work:

- [ ] **Check localStorage:**
  ```javascript
  console.log(localStorage.getItem("access_token"));
  console.log(localStorage.getItem("ngo_profile"));
  ```
  Both should be present after signup

- [ ] **Check browser console for errors:**
  - Look for network errors (red requests in Network tab)
  - Look for JavaScript errors in Console tab
  - Error toast messages should explain what went wrong

- [ ] **Verify backend is running:**
  ```bash
  curl http://localhost:8000/health
  # Should return: {"status":"ok"}
  ```

- [ ] **Check API response format:**
  In Network tab → Find the signup/login request → Check Response tab
  Should show:
  ```json
  {
    "success": true,
    "ngoId": "uuid-string",
    "email": "test@ngo.com",
    "access_token": "eyJhbGc...",
    "token_type": "bearer",
    "expires_in": 86400
  }
  ```

---

## 📱 Complete Signup → Create Story Flow

```
User opens app
     ↓
Clicks "NGO Sign Up"
     ↓
Fills form (org name, email, password)
     ↓
Clicks "Create Account"
     ↓
✅ Token stored in localStorage
     ↓
Navigated to Dashboard
     ↓
Clicks "+ Create Story"
     ↓
Fills story form (topic, description, etc.)
     ↓
Clicks "Generate Story"
     ↓
Frontend reads token from localStorage
     ↓
Sends request with Authorization header
     ↓
Backend verifies token → Creates story
     ↓
✅ Story created successfully
     ↓
Redirected to Story Preview page
```

---

## 🔐 Security Notes

- **Access Token**: JWT with 24-hour expiry, stored in localStorage
- **Auto-login**: Token persists across page refreshes
- **Logout**: User should clear localStorage to logout
- **Protected Routes**: `/ngo/dashboard` only accessible with valid token (ProtectedRoute component)

---

**Files Modified:**
- `src/lib/api.ts` - Added `access_token` to response types
- `src/pages/NgoSignup.tsx` - Store token on signup
- `src/pages/NgoLogin.tsx` - Store token on login

**Status:** ✅ Fix applied and ready to test
