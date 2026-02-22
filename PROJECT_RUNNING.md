# SafePath Stories - Project Running ✅

## Servers Status

### Backend (FastAPI)
- **Status**: ✅ Running
- **URL**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs
- **Environment**: Development (auto-reload enabled)
- **Terminal ID**: c85b530d-c946-4d8b-8122-5432a830f9e6

### Frontend (Vite + React)
- **Status**: ✅ Running
- **URL**: http://localhost:8081
- **Terminal ID**: 7685e3b1-158f-40ca-9de7-ba217e4dd06a

---

## Quick Start API Tests

### 1. Health Check
```bash
curl http://localhost:8000/health
# Response: {"status":"ok"}
```

### 2. Error Handling Examples
```bash
# Test not found error (404)
curl http://localhost:8000/example-errors?error_type=not_found

# Test permission error (403)
curl http://localhost:8000/example-errors?error_type=permission

# Test server error (500)
curl http://localhost:8000/example-errors?error_type=server
```

### 3. Signup New NGO
```bash
curl -X POST http://localhost:8000/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Test NGO",
    "email": "test@ngo.com",
    "password": "SecurePass123!"
  }'
```

Expected Response:
```json
{
  "success": true,
  "ngoId": "uuid-string",
  "email": "test@ngo.com",
  "orgName": "Test NGO",
  "access_token": "jwt-token-here",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### 4. Login NGO
```bash
curl -X POST http://localhost:8000/api/auth/ngo/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ngo.com",
    "password": "SecurePass123!"
  }'
```

### 5. Access Protected Endpoint
```bash
# Get dashboard stats (requires JWT)
curl -X GET http://localhost:8000/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### 6. Search Stories
```bash
curl -X GET "http://localhost:8000/api/stories/search?q=water&limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

Expected Response:
```json
{
  "stories": [
    {
      "id": "uuid",
      "title": "Water Safety",
      "topic": "water_safety",
      "ageGroup": "5-8",
      "language": "en",
      "coverImage": null,
      "status": "draft",
      "studentsReached": 0,
      "completionRate": 0,
      "createdAt": "2026-02-21T14:00:00.000000"
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

---

## Implementation Summary

### ✅ Recently Implemented

1. **Error Handling Middleware**
   - Catches async errors automatically
   - Standard error response format (success, message, error)
   - Specific handlers for validation, auth, permission, and server errors
   - File: `backend/app/main.py` (lines 63-232)

2. **Story Search Endpoint**
   - Case-insensitive search by title and description
   - Pagination support (limit, offset)
   - Returns total count for pagination UI
   - Requires JWT authentication
   - File: `backend/app/main.py` (lines 495-568)

3. **Story Publish Endpoint**
   - PATCH /stories/{story_id}/publish
   - Ownership verification (403 if not owner, 404 if not found)
   - Requires JWT authentication
   - File: `backend/app/main.py` (lines 632-686)

4. **JWT Authentication System**
   - Bcrypt password hashing (10 rounds)
   - SHA256 fallback for legacy users
   - JWT token generation with 24-hour expiry
   - Protected routes with dependency injection
   - Files: `backend/app/auth.py`, `backend/app/main.py`

5. **Frontend Route Protection**
   - ProtectedRoute component for authenticated pages
   - JWT token validation and expiry checking
   - Automatic redirect to login on invalid token
   - File: `src/components/ProtectedRoute.tsx`

6. **Frontend API Integration**
   - JWT Bearer token in Authorization headers
   - Error handling with standardized format
   - Files: `src/lib/api.ts`

---

## Error Response Format

All errors from the API follow this consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "ERROR_CODE"  // Optional: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, SERVER_ERROR, etc.
}
```

### HTTP Status Codes Mapping

| Status | Error Code | Scenario |
|--------|-----------|----------|
| 400 | VALIDATION_ERROR | Invalid request body |
| 401 | UNAUTHORIZED | Missing or invalid JWT token |
| 403 | FORBIDDEN | Permission denied (eg. accessing other's story) |
| 404 | NOT_FOUND | Resource not found |
| 422 | VALIDATION_ERROR | Pydantic validation failed |
| 500 | SERVER_ERROR | Unhandled exception or database error |

---

## Environment Configuration

### Backend (.env)
```
VITE_API_BASE_URL=http://localhost:8000
SUPABASE_URL=https://uspfwdjuiebwnbephvpj.supabase.co
SUPABASE_ANON_KEY=sb_publishable_8jSMlpY2J321FKF6sapdPg_rHraLM0I
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

### Key Settings in config.py
- `app_env`: "development"
- `debug`: true (set to false in production)
- `jwt_exp_hours`: 24
- `jwt_algorithm`: "HS256"

---

## Running Locally

### Start Backend
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Start Frontend
```bash
cd safepath-stories-main
npm run dev
# or
bun install && bun run dev
```

### Access Application
- Frontend: http://localhost:8081
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

---

## Next Steps

1. **Test JWT Flow**: Create an account → Login → Access protected routes
2. **Test Story Operations**: Create story → Search stories → Publish story
3. **Test Error Handling**: Try endpoints without auth, with invalid IDs, etc.
4. **Frontend Integration**: Login page → Dashboard → Story management UI

---

## Troubleshooting

### Backend won't start
- Check if port 8000 is available: `netstat -an | grep 8000`
- Install dependencies: `pip install -r backend/requirements.txt`
- Check Python version: 3.10+

### Frontend won't start
- Install dependencies: `npm install` or `bun install`
- Check if port 8080/8081 is available
- Clear node_modules and reinstall if needed

### Cannot connect to API
- Ensure backend is running: `curl http://localhost:8000/health`
- Check CORS settings if getting CORS errors
- Verify frontend is configured with correct API URL

---

**Last Updated**: February 21, 2026
**Status**: ✅ All systems operational
