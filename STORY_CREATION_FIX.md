# Story Creation Issue - Diagnosis & Fix

## Issue
Users get "request failed" error when trying to create a story after signing up.

## Root Cause Analysis

The 422 error (Unprocessable Entity) suggests one of the following:
1. **JWT token not being sent** - The Authorization header might be empty
2. **Invalid request payload** - A field doesn't match schema expectations
3. **Both** - Token not sent + invalid payload

## ✅ Fixes Applied

### 1. **Token Validation Check** (`src/pages/CreateStory.tsx`)
**Before**: Silently sent request with possibly missing token
**After**: Check token exists before sending request
```tsx
const token = localStorage.getItem("access_token");
if (!token) {
  toast.error("Not authenticated. Please sign in again.");
  return;
}
```

### 2. **Debug Logging** (`src/pages/CreateStory.tsx`)
**Before**: No visibility into what's being sent
**After**: Logs payload and token status to console
```tsx
console.log("Creating story with payload:", payload);
console.log("Token present:", !!token);
```

### 3. **Error Message Extraction** (`src/lib/api.ts`)
**Before**: Only checked for `detail` field in error response
**After**: Checks for both `message` and `detail` fields, plus logs validation details
```tsx
if (payload?.message) {
  message = payload.message;
  if (payload?.error) {
    message = `${message} (${payload.error})`;
  }
}
```

### 4. **Better Error Display** (`src/pages/CreateStory.tsx`)
**Before**: Generic error toast
**After**: Distinguishes validation errors from other errors
```tsx
if (message.includes("Validation error")) {
  toast.error("Validation error: " + message);
} else {
  toast.error(message);
}
```

---

## 🧪 How to Test

### Step 1: Open Browser Console
- Press `F12` in browser
- Click "Console" tab

### Step 2: Sign Up Fresh
1. Clear localStorage:
   ```javascript
   localStorage.clear()
   ```
2. Signup with new credentials:
   - Org: "Test Org"
   - Email: `test_{randomnumber}@org.com` (must be unique!)
   - Password: `Test123!`

### Step 3: Check Token Stored
In console, run:
```javascript
console.log(localStorage.getItem("access_token"))
```
Should show a long JWT string starting with `eyJ...`

### Step 4: Create Story
1. Go to "Create Story"
2. Fill form:
   - Topic: Select any option
   - Age Group: Select any option
   - Language: Select any option
   - Description: Type something
3. Click "Generate Story"

### Step 5: Check Console

You should see:
```
Creating story with payload: {title: "...", topic: "...", ...}
Token present: true
```

Then either:
- **Success**: "Story generated successfully" toast
- **Failure**: Error toast with details

### Step 6: If Failed - Check Network Tab

1. Click "Network" tab in DevTools
2. Find the POST request to `/api/stories`
3. Click on it
4. Check "Response" tab - should show error details

---

## 🔍 What Each Fix Does

| Fix | Purpose | Tests |
|-----|---------|-------|
| Token validation | Prevents sending request without auth | `localStorage.getItem("access_token")` check |
| Debug logging | Shows what's being sent | Console shows payload and token status |
| Error extraction | Shows real error from backend | 422 error shows field that failed validation |
| Better UX | Distinguishes error types | Different error messages for different failures |

---

## 📋 Request Flow (After Fix)

```
User fills form
    ↓
Clicks "Generate Story"
    ↓
handleGenerate() runs:
  1. Check form fields filled ✓
  2. Check token exists ← NEW
  3. Log payload (debug) ← NEW
  4. Call createStory()
    ↓
createStory():
  1. Get token from localStorage
  2. Set Authorization: Bearer {token}
  3. Send POST /api/stories with payload
    ↓
Backend:
  1. Validate JWT token
  2. Extract ngo_id from token
  3. Validate request body (Pydantic)
  4. Create story + slides
  5. Return story
    ↓
Frontend:
  1. Show success: "Story generated successfully"
  2. Redirect to story preview
```

---

## 📊 Expected vs Actual

**Before Fix:**
- User hits "Generate"
- Silent failure (token might/might not be sent)
- Generic error message
- No visibility into what went wrong

**After Fix:**
-  User hits "Generate"
- Pre-validation check (token exists?)
- Console logs exactly what's being sent
- Detailed error message shows which field failed
- User knows exactly what to fix

---

## 🔧 If Still Not Working

See the comprehensive guide: [STORY_CREATION_DEBUG.md](STORY_CREATION_DEBUG.md)

includes:
- Step-by-step browser console debugging
- Network tab analysis
- Common issues & solutions
- Backend API testing with curl
- Token validation checks

---

## Files Modified

1. ✅ `src/pages/CreateStory.tsx` - Token check + debug logging + better errors
2. ✅ `src/lib/api.ts` - Improved error message extraction
3. ✅ `src/pages/NgoSignup.tsx` - Token storage (added earlier)
4. ✅ `src/pages/NgoLogin.tsx` - Token storage (added earlier)

**Status**: All fixes applied, ready to test

---

**Quick Test Command** (in browser console after signing up):
```javascript
// Should show JWT token (long string):
localStorage.getItem("access_token")

// Should show ngo profile:
localStorage.getItem("ngo_profile")

// Decode JWT to see contents:
const parts = localStorage.getItem("access_token").split(".");
JSON.parse(atob(parts[1]))
```

Expected JWT contents:
```json
{
  "sub": "uuid-of-ngo",
  "email": "your@email.com",
  "org_name": "Your Org",
  "role": "ngo",
  "iat": 1708584000,
  "exp": 1708670400
}
```

---

**Last Updated**: February 21, 2026
**Status**: ✅ Ready to test
