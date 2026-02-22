# NGO ID Refactor - Testing Guide

Complete testing guide to verify the NGO ID refactoring from email-derived IDs to UUIDs.

---

## Pre-Migration Testing

Before running the migration, ensure the system works as-is:

### Test 1: Current NGO Signup

```bash
curl -X POST http://localhost:8000/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Pre-Migration Test Org",
    "email": "premigration@test.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "ngoId": "premigration",  // ❌ Email-derived (WILL CHANGE)
  "email": "premigration@test.com",
  "orgName": "Pre-Migration Test Org"
}
```

**Save this ngoId for later comparison.**

### Test 2: Current NGO Login

```bash
curl -X POST http://localhost:8000/api/auth/ngo/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "premigration@test.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "ngoId": "premigration",  // ❌ Email-derived
  "email": "premigration@test.com"
}
```

### Test 3: Create Story (Pre-Migration)

```bash
curl -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "ngoId": "premigration",
    "title": "Test Story Pre-Migration",
    "topic": "Stranger Danger",
    "ageGroup": "6-8",
    "language": "English",
    "characterCount": 1,
    "description": "This is a test story"
  }'
```

**Save the story ID** returned in response as `STORY_ID_PRE_MIGRATION`.

---

## Post-Migration Testing

After running the SQL migration and deploying new backend code:

### Test 4: Post-Migration NGO Signup

```bash
curl -X POST http://localhost:8000/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Post-Migration Test Org",
    "email": "postmigration@test.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "ngoId": "550e8400-e29b-41d4-a716-446655440000",  // ✅ Real UUID!
  "email": "postmigration@test.com",
  "orgName": "Post-Migration Test Org"
}
```

**Save this ngoId (it's a real UUID) as `UUID_NGO_ID_NEW`.**

### Test 5: New NGO Can Login

```bash
curl -X POST http://localhost:8000/api/auth/ngo/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "postmigration@test.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "ngoId": "550e8400-e29b-41d4-a716-446655440000",  // ✅ Same UUID as signup
  "email": "postmigration@test.com"
}
```

### Test 6: New NGO Can Create Story with UUID

```bash
# Use the UUID ngoId from Test 4
curl -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "ngoId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Test Story Post-Migration",
    "topic": "Good Touch Bad Touch",
    "ageGroup": "8-10",
    "language": "English",
    "characterCount": 2,
    "description": "Story created after UUID migration"
  }'
```

**Expected:** ✅ Success 200 with story data

### Test 7: Old Pre-Migration NGO Still Works

Old NGOs **before the migration** should still work because their data is migrated:

```bash
curl -X POST http://localhost:8000/api/auth/ngo/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "premigration@test.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "ngoId": "550e8400-e29b-41d4-a716-446655440001",  // ✅ NEW UUID (not "premigration")!
  "email": "premigration@test.com"
}
```

**Important:** The `ngoId` is now a UUID, not "premigration"!

### Test 8: Pre-Migration Stories Still Accessible

The story created in Test 3 should still be retrievable:

```bash
curl -X GET "http://localhost:8000/api/stories/$STORY_ID_PRE_MIGRATION"
```

**Expected:** ✅ Success 200 with story data

**Verify:** The `ngo_id` in response should be a UUID now.

### Test 9: Dashboard Stats with Old NGO (UUID)

```bash
# Use the NEW UUID from Test 7
curl -X GET "http://localhost:8000/api/dashboard/stats?ngo_id=550e8400-e29b-41d4-a716-446655440001"
```

**Expected Response:**
```json
{
  "storiesCreated": 1,  // The story from Test 3
  "studentsReached": 0,
  "completionRate": 0,
  "activeSessions": 0
}
```

### Test 10: Dashboard Stats with New NGO (UUID)

```bash
# Use the UUID from Test 4
curl -X GET "http://localhost:8000/api/dashboard/stats?ngo_id=550e8400-e29b-41d4-a716-446655440000"
```

**Expected Response:**
```json
{
  "storiesCreated": 1,  // The story from Test 6
  "studentsReached": 0,
  "completionRate": 0,
  "activeSessions": 0
}
```

### Test 11: Invalid UUID Returns 400/404

Test that invalid ngoId values are rejected:

```bash
curl -X GET "http://localhost:8000/api/dashboard/stats?ngo_id=invalid-email-prefix"
```

**Expected:** ❌ Error 400 or 404

```bash
curl -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "ngoId": "not-a-valid-uuid",
    "title": "Should fail",
    ...
  }'
```

**Expected:** ❌ Error 400 "Invalid NGO ID"

---

## Database Verification Queries

Run these in Supabase SQL Editor to verify the migration:

### Query 1: Verify UUID Column Exists

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ngo_accounts' AND column_name = 'id';
```

**Expected:**
```
column_name | data_type
id          | uuid
```

### Query 2: Count NGO Accounts

```sql
SELECT COUNT(*) as total_ngos FROM ngo_accounts;
```

**Should be > 0**

### Query 3: Verify Story ngo_id Type

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stories' AND column_name = 'ngo_id';
```

**Expected:**
```
column_name | data_type
ngo_id      | uuid
```

### Query 4: Check for Orphaned Stories

```sql
SELECT COUNT(*) as orphaned_stories
FROM stories s
LEFT JOIN ngo_accounts n ON s.ngo_id = n.id
WHERE n.id IS NULL;
```

**Expected: 0 orphaned stories**

### Query 5: Verify Foreign Key

```sql
SELECT constraint_name, table_name, column_name
FROM information_schema.constraint_column_usage
WHERE table_name = 'stories' AND column_name = 'ngo_id';
```

**Expected:** Foreign key constraint exists

### Query 6: All Stories with NGO Info

```sql
SELECT 
  s.id as story_id,
  s.title,
  s.ngo_id,
  n.org_name,
  n.email
FROM stories s
JOIN ngo_accounts n ON s.ngo_id = n.id
LIMIT 10;
```

**All stories should have valid NGO references**

---

## Frontend Testing

### Test 12: NGO Signup Flow (Browser)

1. Open http://localhost:5173/ngo-signup
2. Fill in:
   - Organization Name: "Test Org Frontend"
   - Email: "frontend@test.com"
   - Password: "password123"
3. Click "Create Account"
4. Open DevTools → Application → localStorage
5. Check `ngo_profile` value

**Before:**
```json
{ "ngoId": "frontend", ... }  // ❌ Email-derived
```

**After:**
```json
{ "ngoId": "550e8400-e29b-41d4-a716-446655440002", ... }  // ✅ Real UUID
```

### Test 13: NGO Login Flow (Browser)

1. Open http://localhost:5173/ngo-login
2. Use frontend@test.com / password123
3. Check localStorage `ngo_profile`

**Should show UUID ngoId**

### Test 14: Create Story Flow (Browser)

1. After login, navigate to /ngo/create-story
2. Fill in form and create a story
3. Check Network tab (DevTools)
4. Look at POST request to `/api/stories`

**Request body should have:**
```json
{
  "ngoId": "550e8400-e29b-41d4-a716-446655440002",  // ✅ UUID from localStorage
  ...
}
```

### Test 15: Dashboard (Browser)

1. Navigate to /ngo/dashboard
2. Verify stats load correctly
3. Check Network → GET /api/dashboard/stats

**URL should have real UUID:**
```
GET /api/dashboard/stats?ngo_id=550e8400-e29b-41d4-a716-446655440002
```

---

## Integration Testing (Full Flow)

### Scenario 1: Complete User Journey

```bash
#!/bin/bash

BASE_URL="http://localhost:8000"

echo "1. Signup new NGO..."
SIGNUP=$(curl -s -X POST $BASE_URL/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d "{
    \"orgName\": \"Full Flow Test\",
    \"email\": \"fullflow@test.com\",
    \"password\": \"password123\"
  }")
echo "Signup response: $SIGNUP"
NGO_ID=$(echo $SIGNUP | grep -o '"ngoId":"[^"]*"' | cut -d'"' -f4)
echo "NGO ID: $NGO_ID"

echo -e "\n2. Create story with UUID ngoId..."
CREATE=$(curl -s -X POST $BASE_URL/api/stories \
  -H "Content-Type: application/json" \
  -d "{
    \"ngoId\": \"$NGO_ID\",
    \"title\": \"Integration Test Story\",
    \"topic\": \"Stranger Danger\",
    \"ageGroup\": \"6-8\",
    \"language\": \"English\",
    \"characterCount\": 1,
    \"description\": \"Test story\"
  }")
echo "Create story response: $CREATE"
STORY_ID=$(echo $CREATE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Story ID: $STORY_ID"

echo -e "\n3. Get dashboard stats..."
STATS=$(curl -s "$BASE_URL/api/dashboard/stats?ngo_id=$NGO_ID")
echo "Dashboard stats: $STATS"

echo -e "\n4. Login with same credentials..."
LOGIN=$(curl -s -X POST $BASE_URL/api/auth/ngo/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"fullflow@test.com\",
    \"password\": \"password123\"
  }")
echo "Login response: $LOGIN"
LOGIN_ID=$(echo $LOGIN | grep -o '"ngoId":"[^"]*"' | cut -d'"' -f4)
echo "Login ID: $LOGIN_ID"

echo -e "\n5. Verify IDs match..."
if [ "$NGO_ID" == "$LOGIN_ID" ]; then
  echo "✅ SUCCESS: NGO ID is consistent (UUID)"
else
  echo "❌ FAILED: NGO ID mismatch!"
  echo "  Signup ID: $NGO_ID"
  echo "  Login ID: $LOGIN_ID"
fi
```

**Run this script:**
```bash
chmod +x test_flow.sh
./test_flow.sh
```

**Expected output:**
```
✅ SUCCESS: NGO ID is consistent (UUID)
```

---

## Performance Testing

### Test 16: Dashboard Query Performance

Before migration, after migration:

```bash
# Time the dashboard query
time curl -s "http://localhost:8000/api/dashboard/stats?ngo_id=$NGO_ID" > /dev/null
```

**Should be < 500ms**

### Test 17: Story Creation Performance

```bash
time curl -s -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -d '{...}' > /dev/null
```

**Should be < 2s (due to AI generation)**

---

## Error Handling Tests

### Test 18: Missing ngoId

```bash
curl -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "title": "No NGO ID",
    "topic": "Test",
    ...
  }'
```

**Expected:** ❌ Validation error

### Test 19: Invalid ngoId Format

```bash
curl -X POST http://localhost:8000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "ngoId": "not-a-valid-uuid-format",
    ...
  }'
```

**Expected:** ❌ Error "Invalid NGO ID"

### Test 20: Non-existent ngoId

```bash
curl -X GET "http://localhost:8000/api/dashboard/stats?ngo_id=00000000-0000-0000-0000-000000000000"
```

**Expected:** ❌ Error 404 or empty stats (not crash)

---

## Regression Testing

### Test 21: All Existing NGOs Can Login

For each NGO that existed before migration:

```bash
curl -X POST http://localhost:8000/api/auth/ngo/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$OLD_EMAIL\",
    \"password\": \"$OLD_PASSWORD\"
  }"
```

**Expected:** ✅ Success with UUID ngoId

### Test 22: All Existing Stories Accessible

For each story:

```bash
curl http://localhost:8000/api/stories/$STORY_ID
```

**Expected:** ✅ Success, story accessible

### Test 23: Can Change Email (Optional)

If your system allows email changes:

```bash
curl -X PUT http://localhost:8000/api/ngo/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@test.com"
  }'
```

**After change:**
- ngoId should stay the same (UUID) ✅
- Stories should still be linked ✅
- Login with new email should work ✅

---

## Monitoring & Alerts

### Setup Error Alerts

Monitor these in your logs:

```
❌ Invalid NGO ID error
❌ Orphaned story (ngo_id not found)
❌ Story creation for non-existent NGO
```

### Success Metrics

Track these:

```
✅ NGO signups per day (should be > 0)
✅ Stories created per day
✅ Dashboard stat queries (should be fast)
✅ Login success rate (should be 100%)
```

---

## Rollback Tests

### Test 24: Rollback Procedure

If something goes wrong:

1. Stop accepting new requests
2. Revert backend code to old version
3. In Supabase: Restore from backup
4. Restart backend
5. Run Test 1 to verify it works

**Expected:** Same as pre-migration behavior

---

## Summary Checklist

- [ ] Pre-migration tests pass (Tests 1-3)
- [ ] SQL migration runs without errors
- [ ] Post-migration tests pass (Tests 4-11)
- [ ] Database verification passes (Queries 1-6)
- [ ] Frontend tests pass (Tests 12-15)
- [ ] Integration test passes (Scenario 1)
- [ ] Performance is acceptable (Tests 16-17)
- [ ] Error handling works (Tests 18-20)
- [ ] Regression tests pass (Tests 21-23)
- [ ] No errors in logs
- [ ] Monitoring alerts configured
- [ ] Rollback procedure tested

**If all checks pass: ✅ Refactoring successful!**
