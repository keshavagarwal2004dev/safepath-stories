# NGO ID Refactoring Guide

## Tech Stack
- **Backend:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL)
- **Frontend:** React/TypeScript

---

## Problem Statement

**Current Implementation:**
```python
ngo_id = payload.email.split("@")[0]  # ❌ Derived from email
```

**Issues:**
- Non-unique (multiple emails can start with "john")
- Breaks if user changes email
- Data inconsistency if ngo_id changes
- Security risk: email becomes identifier

**Solution:**
- Use database-generated UUID as primary key
- Email becomes just a field, not an identifier
- All foreign keys reference `ngo_accounts.id`

---

## Database Schema Changes

### Step 1: Create Migration (Supabase)

**File to execute in Supabase SQL Editor:**

```sql
-- Migration: Add UUID to NGO accounts
-- Date: 2026-02-21
-- Description: Refactor NGO ID from email-derived to UUID

-- Step 1: Add new id column with UUID type
ALTER TABLE ngo_accounts
ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- Step 2: Create temporary mapping (for data migration)
ALTER TABLE ngo_accounts
ADD COLUMN legacy_ngo_id VARCHAR(255);

-- Step 3: Populate legacy_ngo_id with current derived IDs
UPDATE ngo_accounts
SET legacy_ngo_id = SUBSTRING(email FROM 1 FOR POSITION('@' IN email) - 1);

-- Step 4: Check for duplicates in legacy IDs
SELECT legacy_ngo_id, COUNT(*) as count
FROM ngo_accounts
GROUP BY legacy_ngo_id
HAVING COUNT(*) > 1;

-- Step 5: Update stories table to reference new ID
-- First add nullable column
ALTER TABLE stories
ADD COLUMN ngo_id_new UUID;

-- Populate from ngo_accounts using email as bridge
UPDATE stories s
SET ngo_id_new = n.id
FROM ngo_accounts n
WHERE s.ngo_id = SUBSTRING(n.email FROM 1 FOR POSITION('@' IN n.email) - 1);

-- Step 6: Verify data migration was successful
SELECT COUNT(*) as stories_with_new_id
FROM stories
WHERE ngo_id_new IS NOT NULL;

-- This should equal total story count

-- Step 7: Drop old column and rename new one (after verification)
ALTER TABLE stories
DROP COLUMN ngo_id;

ALTER TABLE stories
RENAME COLUMN ngo_id_new TO ngo_id;

-- Step 8: Add foreign key constraint
ALTER TABLE stories
ADD CONSTRAINT fk_stories_ngo_id
FOREIGN KEY (ngo_id) REFERENCES ngo_accounts(id) ON DELETE CASCADE;

-- Step 9: Drop legacy mapping column
ALTER TABLE ngo_accounts
DROP COLUMN legacy_ngo_id;

-- Step 10: Set id as primary key (if not already)
ALTER TABLE ngo_accounts
ADD CONSTRAINT pk_ngo_accounts_id PRIMARY KEY (id);

-- Step 11: Verify all changes
SELECT 
  (SELECT COUNT(*) FROM ngo_accounts) as total_ngos,
  (SELECT COUNT(*) FROM stories WHERE ngo_id IS NOT NULL) as stories_with_valid_ngo
;
```

### Important Notes:
- **Backup first!** Run this in a safe environment before production
- **Test migration** on a copy of production database
- **Verify counts** at each step to ensure data integrity
- **Monitor performance** if you have lots of data

---

## Backend Code Changes

### Step 1: Update Schemas (Python)

**File: `backend/app/schemas.py`**

Update response models to include UUID id:

```python
from uuid import UUID
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

StoryStatus = Literal["draft", "published"]

# ✅ NEW: NGO Account models
class NgoAccount(BaseModel):
    id: UUID
    org_name: str
    email: str
    created_at: datetime

class NgoLoginResponse(BaseModel):
    success: bool
    ngoId: str  # ✅ Change to UUID type
    email: str

class NgoSignupResponse(BaseModel):
    success: bool
    ngoId: str  # ✅ Change to UUID type
    email: str
    orgName: str
```

**Complete models file section:**
```python
# ✅ Updated schemas with proper UUIDs

class NgoLoginRequest(BaseModel):
    email: str
    password: str

class NgoLoginResponse(BaseModel):
    success: bool
    ngoId: str  # ✅ From database UUID
    email: str

class NgoSignupRequest(BaseModel):
    orgName: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=5)
    password: str = Field(min_length=8)

class NgoSignupResponse(BaseModel):
    success: bool
    ngoId: str  # ✅ From database UUID
    email: str
    orgName: str

class StoryCreateRequest(BaseModel):
    ngoId: str  # ✅ Now a proper UUID (not email-derived)
    title: str = Field(min_length=1)
    topic: str
    ageGroup: str
    language: str
    characterCount: int = Field(ge=1, le=4)
    regionContext: str | None = None
    description: str
    moralLesson: str | None = None

class Story(BaseModel):
    id: str
    title: str
    topic: str
    ageGroup: str
    language: str
    coverImage: str | None = None
    status: StoryStatus
    studentsReached: int = 0
    completionRate: int = 0
    createdAt: str
```

### Step 2: Update Main Backend Logic

**File: `backend/app/main.py`**

Replace the NGO login/signup functions completely:

```python
@router.post("/auth/ngo/login", response_model=NgoLoginResponse)
def ngo_login(payload: NgoLoginRequest) -> NgoLoginResponse:
    """
    Login NGO with email and password.
    Returns the database-generated UUID as ngoId.
    """
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    client = get_supabase_client()
    
    try:
        # ✅ Query by email, get id from database
        result = (
            client.table("ngo_accounts")
            .select("id, password_hash")  # ✅ Get id from DB
            .eq("email", payload.email)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not result.data or not verify_password(payload.password, result.data[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    row = result.data[0]
    ngo_id = str(row["id"])  # ✅ Use database UUID, convert to string for JSON
    
    return NgoLoginResponse(success=True, ngoId=ngo_id, email=payload.email)


@router.post("/auth/ngo/signup", response_model=NgoSignupResponse)
def ngo_signup(payload: NgoSignupRequest) -> NgoSignupResponse:
    """
    Sign up new NGO.
    Database generates UUID automatically.
    """
    if not payload.email or not payload.password or not payload.orgName:
        raise HTTPException(
            status_code=400,
            detail="Email, password, and organization name are required"
        )

    client = get_supabase_client()

    # Check if email already exists
    try:
        existing = (
            client.table("ngo_accounts")
            .select("id")
            .eq("email", payload.email)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if existing.data:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create new NGO account
    hashed_pw = hash_password(payload.password)
    try:
        result = (
            client.table("ngo_accounts")
            .insert({
                # ✅ DO NOT include id - database generates it
                "org_name": payload.orgName,
                "email": payload.email,
                "password_hash": hashed_pw,
            })
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create account")

    row = result.data[0]
    ngo_id = str(row["id"])  # ✅ Use database-generated UUID
    
    return NgoSignupResponse(
        success=True,
        ngoId=ngo_id,  # ✅ Real UUID from database
        email=row["email"],
        orgName=row["org_name"]
    )


@router.post("/stories", response_model=StoryCreateResponse)
def create_story(payload: StoryCreateRequest) -> StoryCreateResponse:
    """
    Create a new story.
    
    ✅ IMPORTANT: In production with JWT auth, extract ngo_id from token, not payload.
    For now this shows how to accept it, but verify it exists in database.
    """
    client = get_supabase_client()

    # ✅ NEW: Verify the ngo_id actually exists in database
    try:
        ngo_check = (
            client.table("ngo_accounts")
            .select("id")
            .eq("id", payload.ngoId)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not ngo_check.data:
        raise HTTPException(status_code=400, detail="Invalid NGO ID")

    # ✅ Use the real UUID from payload
    story_insert = (
        client.table(settings.supabase_stories_table)
        .insert({
            "ngo_id": payload.ngoId,  # ✅ Real UUID
            "title": payload.title,
            "topic": payload.topic,
            "age_group": payload.ageGroup,
            "language": payload.language,
            "region_context": payload.regionContext,
            "description": payload.description,
            "moral_lesson": payload.moralLesson,
            "character_count": payload.characterCount,
            "status": "draft",
        })
        .execute()
    )

    if not story_insert.data:
        raise HTTPException(status_code=500, detail="Failed to create story")

    story_row = story_insert.data[0]
    
    # ... rest of story creation logic (unchanged)
    # slides_source, slides_to_store, etc.


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(ngo_id: str = Query(..., min_length=1)) -> DashboardStats:
    """
    Get dashboard stats for NGO.
    
    ✅ IMPORTANT: In production, extract ngo_id from JWT token, not query param.
    This prevents users from viewing other NGOs' stats.
    """
    client = get_supabase_client()
    
    # ✅ Query using UUID
    result = client.table(settings.supabase_stories_table).select(
        "students_reached,completion_rate"
    ).eq("ngo_id", ngo_id).execute()
    
    rows = result.data or []

    stories_created = len(rows)
    students_reached = sum((row.get("students_reached", 0) or 0) for row in rows)
    completion_rate = (
        int(sum((row.get("completion_rate", 0) or 0) for row in rows) / stories_created)
        if stories_created else 0
    )

    return DashboardStats(
        storiesCreated=stories_created,
        studentsReached=students_reached,
        completionRate=completion_rate,
        activeSessions=0,
    )
```

### Step 3: Remove Email-Derived ID Logic

**DELETE THIS CODE:**

From `backend/app/main.py`, remove these lines entirely:

```python
# ❌ DELETE THESE LINES FROM ngo_login()
ngo_id = payload.email.split("@")[0]

# ❌ DELETE THESE LINES FROM ngo_signup()
ngo_id = payload.email.split("@")[0]
```

---

## Frontend Code Changes

### Step 1: Update API Types

**File: `src/lib/api.ts`**

```typescript
// Update response types to expect UUID as string
export interface NgoLoginResponse {
  success: boolean;
  ngoId: string;  // ✅ Now a real UUID string
  email: string;
}

export interface NgoSignupResponse {
  success: boolean;
  ngoId: string;  // ✅ Now a real UUID string
  email: string;
  orgName: string;
}

export interface StoryCreatePayload {
  ngoId: string;  // ✅ Real UUID, not email-derived
  title: string;
  topic: string;
  ageGroup: string;
  language: string;
  characterCount: number;
  regionContext?: string;
  description: string;
  moralLesson?: string;
}
```

### Step 2: Update Components (No Logic Changes Needed)

The frontend components should continue to work as-is since they already:
- Store `ngoId` in localStorage
- Pass it to API calls
- Display it in UI (if at all)

**Verification in `src/pages/CreateStory.tsx`:**

```typescript
// ✅ This stays the same - it already works with the ngoId from localStorage
const ngoProfile = JSON.parse(localStorage.getItem("ngo_profile") || "{}");
const ngoId = ngoProfile.ngoId || "demo-ngo";

// ✅ Now ngoId is a real UUID, not email-derived
createMutation.mutate({
  ngoId,  // ✅ This is now {"ngoId": "550e8400-e29b-41d4-a716-446655440000"}
  title: generatedTitle,
  topic,
  // ...
});
```

**Verification in `src/pages/NgoDashboard.tsx`:**

```typescript
// ✅ This also stays the same and works better now
const ngoProfile = JSON.parse(localStorage.getItem("ngo_profile") || "{}");
const ngoId = ngoProfile.ngoId || "demo-ngo";

// ✅ ngoId is now a real UUID
const statsQuery = useQuery({
  queryKey: ["dashboard-stats", ngoId],
  queryFn: () => getDashboardStats(ngoId),
});
```

---

## Step-by-Step Migration Plan

### Phase 1: Preparation (No Changes Deployed)
- [ ] Backup production database
- [ ] Test migration script on database copy
- [ ] Verify all data counts before/after
- [ ] Prepare rollback plan

### Phase 2: Database Migration
1. [ ] Run migration SQL in Supabase
2. [ ] Verify stories properly linked to NGO ids
3. [ ] Check no data was lost

### Phase 3: Backend Deployment
1. [ ] Deploy updated Python backend
2. [ ] Test login endpoint (should return UUID ngoId)
3. [ ] Test story creation (should accept UUID)
4. [ ] Test dashboard stats (should query by UUID)
5. [ ] Monitor error logs

### Phase 4: Frontend Deployment
1. [ ] Deploy updated TypeScript frontend
2. [ ] Test NGO signup → localStorage has UUID
3. [ ] Test create story → API call uses UUID
4. [ ] Test dashboard loads correctly
5. [ ] Clear browser cache and test again

### Phase 5: Validation
- [ ] All NGOs can login
- [ ] All stories still accessible
- [ ] Dashboard stats correct
- [ ] No data inconsistencies

---

## Example Usage

### Before (❌ Broken)
```python
# Backend generates ID from email
user_email = "john.doe@safepath.org"
ngo_id = user_email.split("@")[0]  # "john"
# If user changes email: john → jane, ngo_id stays "john" (orphaned data)
```

### After (✅ Fixed)
```python
# Database generates UUID
# User signup creates row:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",  # Generated by database
  "email": "john.doe@safepath.org",
  "org_name": "SafePath NGO",
  "password_hash": "bcrypt_hash_here"
}

# Response to frontend
{
  "success": true,
  "ngoId": "550e8400-e29b-41d4-a716-446655440000",  # Real UUID
  "email": "john.doe@safepath.org",
  "orgName": "SafePath NGO"
}

# User can now change email without breaking stories
# All stories still linked via UUID
```

---

## Testing Checklist

### Database
- [ ] Migration script runs without errors
- [ ] Total NGO count unchanged after migration
- [ ] Total story count unchanged after migration
- [ ] All stories have valid ngo_id (not NULL)
- [ ] Foreign key constraints work
- [ ] Can query stories by ngo_id

### Backend
- [ ] NGO signup returns valid UUID as ngoId
- [ ] NGO login returns valid UUID as ngoId
- [ ] Story creation accepts UUID ngoId
- [ ] Story creation rejects invalid ngoId
- [ ] Dashboard stats query by UUID ngoId
- [ ] Cannot query stats with invalid ngoId

### Frontend
- [ ] NGO signup stores UUID in localStorage
- [ ] NGO login stores UUID in localStorage
- [ ] Create story sends UUID in payload
- [ ] Dashboard displays stats (no errors)
- [ ] Can view stories after creation

### Integration
- [ ] Full signup → create story → view story flow works
- [ ] Logout and login with same account - stories still visible
- [ ] Change email (if allowed) - stories still linked
- [ ] Multiple NGOs' stories don't get mixed

---

## Rollback Plan

If migration fails:

```sql
-- Rollback: Restore old structure
BEGIN TRANSACTION;

-- Remove new columns and constraints
ALTER TABLE stories
DROP CONSTRAINT fk_stories_ngo_id;

ALTER TABLE stories
DROP COLUMN ngo_id;

-- Rename back
ALTER TABLE stories
RENAME COLUMN ngo_id_old TO ngo_id;

-- Remove UUID from ngo_accounts
ALTER TABLE ngo_accounts
DROP CONSTRAINT pk_ngo_accounts_id;

ALTER TABLE ngo_accounts
DROP COLUMN id;

ROLLBACK; -- Only if errors occurred, otherwise COMMIT
```

---

## Summary of Benefits

| Issue | Before | After |
|-------|--------|-------|
| **ID Uniqueness** | ❌ email.split("@")[0] | ✅ UUID |
| **Email Changes** | ❌ Breaks stories | ✅ Stories safe |
| **Data Consistency** | ❌ Fragile | ✅ Guaranteed |
| **Foreign Keys** | ❌ String matching | ✅ UUID integrity |
| **Multi-user Safety** | ❌ Email collision risk | ✅ Unique UUID |
| **API Design** | ❌ ID leaked details | ✅ ID is opaque |
| **Security** | ❌ Email is identifier | ✅ ID is identifier |

---

## Additional Resources

- [Supabase UUID Documentation](https://supabase.com/docs/guides/database/uuid)
- [PostgreSQL UUID Type](https://www.postgresql.org/docs/current/uuid-ossp.html)
- [FastAPI Database/ORM](https://fastapi.tiangolo.com/tutorial/sql-databases/)

---

## Questions?

If you encounter issues:

1. **Check migration logs:** Supabase SQL Editor shows errors
2. **Verify data:** Run verification queries from Step 5 of migration
3. **Test in staging:** Never run directly on production
4. **Backup first:** Always backup before schema changes
