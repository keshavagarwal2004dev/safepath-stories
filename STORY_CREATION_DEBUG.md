# Story Creation Troubleshooting Guide

## Issue: "Request Failed" Error When Creating Story

If you're seeing a "Request failed" error when trying to create a story after signing up, follow this guide.

---

## 🔍 Step 1: Check Browser Console

1. **Open Developer Tools**: Press `F12` in your browser
2. **Go to Console tab**
3. **Try creating a story** and look for:
   - **Green log**: `"Creating story with payload: {...}"` - Shows what's being sent
   - **Green log**: `"Token present: true/false"` - Shows if token is stored
   - **Red error**: Any JavaScript errors

### What You Should See

✅ **Success Pattern:**
```javascript
Creating story with payload: {
  title: "Good Touch Bad Touch Adventure",
  topic: "Good Touch Bad Touch",
  ageGroup: "6-8",
  language: "English",
  characterCount: 1,
  regionContext: undefined,
  description: "Learn about body safety",
  moralLesson: undefined
}
Token present: true
```

❌ **Failure Pattern:**
```
Token present: false
 OR
No "Creating story" log appears
 OR
Error in console mentioning validation
```

---

## 🔍 Step 2: Check Network Tab

1. **Open DevTools** → **Network tab**
2. **Try creating a story**
3. **Look for POST request to `/api/stories`**
4. **Click on it and check:**

### Request Headers Tab
Should show:
```
Authorization: Bearer eyJhbGc... (long JWT token)
Content-Type: application/json
```

If Authorization header is **missing** or **empty**, that's the problem! ❌

### Response Tab
The error response should show:
```json
{
  "success": false,
  "message": "Validation error: ...",
  "error": "field_name: error details"
}
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Token Not Stored
**Symptom**: `Token present: false` in console

**Solution**:
1. Clear localStorage:
   ```javascript
   // In browser console:
   localStorage.clear();
   ```
2. Sign up again with a new email
3. Check DevTools → Application → Local Storage → look for `access_token`

**Backend Check:**
```bash
curl -X POST http://localhost:8000/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Debug NGO",
    "email": "debug@test.com",
    "password": "Debug123!"
  }'
```

Response should include:
```json
{
  "access_token": "eyJhbGci...",
  "success": true,
  "ngoId": "...",
  ...
}
```

**Frontend Check:**
After signup, run in console:
```javascript
console.log(localStorage.getItem("access_token"));
```
Should show JWT token (long string starting with `eyJ...`)

---

### Issue 2: Token Present But Request Still Fails
**Symptom**: Token stored but getting 422 error

**Solution**: Check request body format

Run in console to test the payload:
```javascript
const payload = {
  title: "Test Story",
  topic: "Good Touch Bad Touch",
  ageGroup: "6-8",
  language: "English",
  characterCount: 1,
  description: "Test description"
};

console.log("Payload keys:", Object.keys(payload));
console.log("Topic type:", typeof payload.topic);
console.log("CharacterCount type:", typeof payload.characterCount);
console.log(JSON.stringify(payload, null, 2));
```

**Check:** All required fields present? All types correct?

---

### Issue 3: 401 Unauthorized Error
**Symptom**: "Not authenticated" error

**Solution**: Token is invalid or expired

```javascript
// Check token in console:
const token = localStorage.getItem("access_token");
if (token) {
  // Decode JWT (it has 3 parts separated by .)
  const parts = token.split(".");
  const decoded = JSON.parse(atob(parts[1]));
  console.log("Token decoded:", decoded);
  console.log("Expires at:", new Date(decoded.exp * 1000));
  console.log("Expired?", Date.now() > decoded.exp * 1000);
}
```

**What to expect:**
```javascript
{
  "sub": "uuid-of-ngo",
  "email": "your@email.com",
  "org_name": "Your Org",
  "role": "ngo",
  "iat": 1708584000,  // Created timestamp
  "exp": 1708670400   // Expiry timestamp (24 hours later)
}
```

If expired, sign in again to get fresh token.

---

### Issue 4: Story Parameters Invalid
**Symptom**: 422 error with validation detail

**Solution**: Check dropdown values

Allowed values:
- **Topic**: "Good Touch Bad Touch", "Stranger Danger", "Safe & Unsafe Secrets", "Bullying", "Online Safety", "Body Autonomy"
- **Age Group**: "4-6", "5-7", "6-8", "8-10", "9-12", "12-14"
- **Language**: "English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada"
- **Character Count**: 1, 2, 3, or 4

Make sure you've selected from the dropdowns, not manually typed.

---

## ✅ Complete Test Flow

```
1. Open browser DevTools (F12)
   ↓
2. Clear all localStorage:
   localStorage.clear()
   ↓
3. Sign up with test account:
   - Org: "Test NGO"
   - Email: "test@example.com" (change each time!)
   - Password: "TestPass123!"
   ↓
4. Check localStorage for access_token:
   localStorage.getItem("access_token")
   (should show JWT token)
   ↓
5. Go to Create Story page
   ↓
6. Fill form:
   - Topic: Select "Good Touch Bad Touch"
   - Age Group: Select "6-8"
   - Language: Select "English"
   - Characters: Select "1"
   - Description: Type "Test story"
   ↓
7. Click "Generate Story"
   ↓
8. Check console for logs:
   - Should see "Creating story with payload"
   - Should see "Token present: true"
   ↓
9. Check Network tab:
   - Look for POST /api/stories request
   - Check Response tab for error details
   ↓
IF SUCCESS: Story created ✅
IF FAILURE: Share error from Response tab
```

---

## 📋 Quick Debug Checklist

- [ ] Backend running on port 8000? (`curl http://localhost:8000/health`)
- [ ] Frontend running on port 8081? (`http://localhost:8081` loads)
- [ ] Signed up successfully? (No errors, redirected to dashboard)
- [ ] Token in localStorage? (`localStorage.getItem("access_token")` shows JWT)
- [ ] Token not expired? (Decode and check `exp` claim)
- [ ] Form filled correctly? (All required fields selected from dropdowns)
- [ ] Network request sent? (POST /api/stories in Network tab)
- [ ] Authorization header present? (Check Request Headers in Network tab)

---

## 🆘 Still Not Working?

Run these commands in order and share the output:

```bash
# 1. Test backend health
curl http://localhost:8000/health

# 2. Test signup (replace with your email)
curl -X POST http://localhost:8000/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Debug Org",
    "email": "debug'$(date +%s)'@test.com",
    "password": "Debug123!"
  }' | jq .

# 3. Copy the access_token from response above, then test creating story:
#    Replace TOKEN_HERE with access_token from previous response
curl -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_HERE" \
  -d '{
    "title": "Test Story",
    "topic": "Good Touch Bad Touch",
    "ageGroup": "6-8",
    "language": "English",
    "characterCount": 1,
    "description": "Test description"
  }' | jq .
```

The last command should either:
- **Success**: Return story object with id
- **Failure**: Show error details in the response

---

**Last Updated**: February 21, 2026
**Status**: Ready to debug
