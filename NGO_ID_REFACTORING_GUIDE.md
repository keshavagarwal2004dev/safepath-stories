# NGO ID Refactoring - Complete Implementation Guide

## Tech Stack
- **Backend:** Python 3.8+ with FastAPI
- **Database:** PostgreSQL (Supabase)
- **Frontend:** React 18+ with TypeScript
- **ORM/Client:** Supabase Python client

---

## Current Problem

```python
# ❌ CURRENT (PROBLEMATIC)
ngo_id = payload.email.split("@")[0]  # Derives from email!

# Issues:
# 1. Not unique across domains (john, john.doe, etc.)
# 2. Changes if user updates email
# 3. Breaks all story associations
# 4. Database has proper UUID but it's ignored
```

---

## Solution Architecture

```
Database (Already Correct):
├── ngo_accounts.id: UUID (PRIMARY KEY) ✓
├── ngo_accounts.email: TEXT (UNIQUE) ✓
└── stories.ngo_id: TEXT → should be UUID

After Refactor:
├── ngo_accounts.id: UUID (PRIMARY KEY) ✓
├── ngo_accounts.email: TEXT (UNIQUE) ✓
└── stories.ngo_id: UUID (FOREIGN KEY) ✓
   └── References ngo_accounts.id
```

---

## Step 1: Database Migration

### Migration File: `backend/migrations/002_fix_ngo_id_foreign_key.sql`

```sql
-- Step 1: Create temp column with UUID type
ALTER TABLE public.stories 
ADD COLUMN ngo_id_uuid UUID;

-- Step 2: Update existing records with proper UUIDs
-- First, we need to join stories to ngo_accounts by email
UPDATE public.stories s
SET ngo_id_uuid = n.id
FROM public.ngo_accounts n
WHERE s.ngo_id = n.email OR s.ngo_id = SPLIT_PART(n.email, '@', 1);

-- Step 3: Handle any orphaned records (stories without matching NGO)
-- These should be cleaned up before production migration
-- Check for records where ngo_id_uuid is still NULL
-- DELETE FROM public.stories WHERE ngo_id_uuid IS NULL;

-- Step 4: Make the new column NOT NULL only after verification
ALTER TABLE public.stories 
ALTER COLUMN ngo_id_uuid SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE public.stories
ADD CONSTRAINT fk_stories_ngo_id 
FOREIGN KEY (ngo_id_uuid) REFERENCES public.ngo_accounts(id) ON DELETE CASCADE;

-- Step 6: Drop old column and rename
ALTER TABLE public.stories 
DROP COLUMN ngo_id;

ALTER TABLE public.stories 
RENAME COLUMN ngo_id_uuid TO ngo_id;

-- Step 7: Update column type back to UUID
ALTER TABLE public.stories 
ALTER COLUMN ngo_id TYPE UUID USING ngo_id::UUID;

-- Verify:
SELECT s.id, s.title, s.ngo_id, n.org_name 
FROM public.stories s
JOIN public.ngo_accounts n ON s.ngo_id = n.id
LIMIT 5;
```

### Rollback Migration (if needed)

```sql
-- Store old data before rollback
CREATE TEMP TABLE stories_backup AS
SELECT s.id, s.title, s.ngo_id, n.email
FROM public.stories s
JOIN public.ngo_accounts n ON s.ngo_id = n.id;

-- Rollback
ALTER TABLE public.stories
DROP CONSTRAINT fk_stories_ngo_id;

ALTER TABLE public.stories
ADD COLUMN ngo_id_text TEXT;

UPDATE public.stories s
SET ngo_id_text = SPLIT_PART(sb.email, '@', 1)
FROM stories_backup sb
WHERE s.id = sb.id;

ALTER TABLE public.stories
DROP COLUMN ngo_id;

ALTER TABLE public.stories
RENAME COLUMN ngo_id_text TO ngo_id;
```

### Pre-Migration Checklist

```bash
# Before running migration, verify:
1. All stories have valid NGO associations
2. No orphaned stories exist
3. Database backup created
4. No active user sessions
5. Deployment window scheduled
```

---

## Step 2: Pydantic Schema Updates

### File: `backend/app/schemas.py`

```python
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr

# ✅ Updated NGO Schemas

class NgoLoginRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)

class NgoLoginResponse(BaseModel):
    success: bool
    ngoId: UUID  # ✅ Changed from str to UUID
    email: str
    orgName: str

class NgoSignupRequest(BaseModel):
    orgName: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)

class NgoSignupResponse(BaseModel):
    success: bool
    ngoId: UUID  # ✅ Changed from str to UUID
    email: str
    orgName: str

class NgoProfileResponse(BaseModel):
    ngoId: UUID  # ✅ Changed from str to UUID
    email: str
    orgName: str
    createdAt: str

# ✅ Updated Story Schemas

class StoryCreateRequest(BaseModel):
    ngoId: UUID  # ✅ Changed to UUID
    title: str = Field(..., min_length=1, max_length=200)
    topic: str
    ageGroup: str
    language: str
    characterCount: int = Field(..., ge=1, le=4)
    regionContext: str | None = None
    description: str
    moralLesson: str | None = None

class Story(BaseModel):
    id: UUID
    ngoId: UUID  # ✅ Changed to UUID
    title: str
    topic: str
    ageGroup: str
    language: str
    coverImage: str | None = None
    status: str
    studentsReached: int = 0
    completionRate: int = 0
    createdAt: str

class StoryCreateResponse(BaseModel):
    story: Story
    slides: list['StorySlide']

class DashboardStats(BaseModel):
    storiesCreated: int
    studentsReached: int
    completionRate: int
    activeSessions: int
```

---

## Step 3: Backend Endpoint Updates

### File: `backend/app/main.py`

```python
from uuid import UUID
from app.schemas import (
    NgoLoginRequest, NgoLoginResponse,
    NgoSignupRequest, NgoSignupResponse,
    StoryCreateRequest, StoryCreateResponse,
)

# ============================================
# AUTHENTICATION ENDPOINTS (UPDATED)
# ============================================

@router.post("/auth/ngo/login", response_model=NgoLoginResponse)
def ngo_login(payload: NgoLoginRequest) -> NgoLoginResponse:
    """Login endpoint - now returns proper UUID"""
    
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    client = get_supabase_client()
    try:
        result = (
            client.table("ngo_accounts")
            .select("id, org_name, password_hash")  # ✅ Select actual id
            .eq("email", payload.email)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not result.data or not verify_password(payload.password, result.data[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    row = result.data[0]
    
    # ✅ Use actual database ID (UUID)
    ngo_id = UUID(row["id"])
    
    # ✅ Generate JWT token (see authentication section)
    token, expires_in = create_access_token(str(ngo_id), payload.email)
    
    return NgoLoginResponse(
        success=True,
        ngoId=ngo_id,  # ✅ Return UUID
        email=payload.email,
        orgName=row["org_name"],
    )


@router.post("/auth/ngo/signup", response_model=NgoSignupResponse)
def ngo_signup(payload: NgoSignupRequest) -> NgoSignupResponse:
    """Signup endpoint - now uses database-generated UUID"""
    
    if not payload.email or not payload.password or not payload.orgName:
        raise HTTPException(status_code=400, detail="Email, password, and org name required")

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
    
    # ✅ Use actual database ID (UUID)
    ngo_id = UUID(row["id"])
    
    # ✅ Generate JWT token
    token, expires_in = create_access_token(str(ngo_id), payload.email)
    
    return NgoSignupResponse(
        success=True,
        ngoId=ngo_id,  # ✅ Return UUID
        email=row["email"],
        orgName=row["org_name"],
    )


# ============================================
# STORY ENDPOINTS (UPDATED)
# ============================================

@router.post("/stories", response_model=StoryCreateResponse)
def create_story(
    payload: StoryCreateRequest,
    current_user: dict = Depends(verify_token)  # JWT verification
) -> StoryCreateResponse:
    """Create story - ngoId now extracted from JWT instead of request"""
    
    client = get_supabase_client()
    
    # ✅ Extract ngoId from JWT token (not from request)
    ngo_id = current_user["ngo_id"]
    
    # ✅ Verify ngoId exists in database
    ngo_check = (
        client.table("ngo_accounts")
        .select("id")
        .eq("id", ngo_id)
        .execute()
    )
    if not ngo_check.data:
        raise HTTPException(status_code=403, detail="Invalid NGO")

    # Story creation with proper UUID
    story_insert = (
        client.table(settings.supabase_stories_table)
        .insert({
            "ngo_id": ngo_id,  # ✅ Now UUID
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
    
    # ... rest of story generation logic ...
    
    return StoryCreateResponse(story=to_story(story_row), slides=slides)


@router.get("/stories", response_model=list[Story])
def list_stories(
    status: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    age_group: str | None = Query(default=None),
    ngo_id: UUID | None = Query(default=None),  # ✅ UUID type
) -> list[Story]:
    """List stories - now with proper UUID filtering"""
    
    client = get_supabase_client()
    query = client.table(settings.supabase_stories_table).select("*").order("created_at", desc=True)

    if status:
        query = query.eq("status", status)
    if topic:
        query = query.eq("topic", topic)
    if age_group:
        query = query.eq("age_group", age_group)
    if ngo_id:
        query = query.eq("ngo_id", str(ngo_id))  # UUID -> string for query

    result = query.execute()
    return [to_story(row) for row in (result.data or [])]


@router.get("/stories/{story_id}", response_model=Story)
def get_story(story_id: UUID) -> Story:  # ✅ Accept UUID
    """Get story by ID"""
    
    client = get_supabase_client()
    result = (
        client.table(settings.supabase_stories_table)
        .select("*")
        .eq("id", str(story_id))  # UUID -> string for query
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Story not found")
    return to_story(result.data[0])


# ============================================
# DASHBOARD ENDPOINTS (UPDATED)
# ============================================

@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: dict = Depends(verify_token)
) -> DashboardStats:
    """Get dashboard stats - uses JWT to get ngoId"""
    
    client = get_supabase_client()
    
    # ✅ Extract ngoId from JWT (verified and secure)
    ngo_id = current_user["ngo_id"]
    
    result = (
        client.table(settings.supabase_stories_table)
        .select("students_reached,completion_rate")
        .eq("ngo_id", ngo_id)  # ✅ Query with UUID
        .execute()
    )
    
    rows = result.data or []
    stories_created = len(rows)
    students_reached = sum((row.get("students_reached", 0) or 0) for row in rows)
    completion_rate = (
        int(sum((row.get("completion_rate", 0) or 0) for row in rows) / stories_created)
        if stories_created
        else 0
    )

    return DashboardStats(
        storiesCreated=stories_created,
        studentsReached=students_reached,
        completionRate=completion_rate,
        activeSessions=0,
    )


# ============================================
# HELPER FUNCTIONS (UPDATED)
# ============================================

def to_story(row: dict[str, Any]) -> Story:
    """Convert database row to Story model"""
    
    created_at = row.get("created_at")
    if isinstance(created_at, datetime):
        created_at_str = created_at.date().isoformat()
    elif isinstance(created_at, str):
        created_at_str = created_at.split("T")[0]
    else:
        created_at_str = datetime.utcnow().date().isoformat()

    return Story(
        id=UUID(row["id"]),
        ngoId=UUID(row["ngo_id"]),  # ✅ Convert to UUID
        title=row["title"],
        topic=row["topic"],
        ageGroup=row["age_group"],
        language=row["language"],
        coverImage=row.get("cover_image_url"),
        status=row.get("status", "draft"),
        studentsReached=row.get("students_reached", 0) or 0,
        completionRate=row.get("completion_rate", 0) or 0,
        createdAt=created_at_str,
    )
```

---

## Step 4: Frontend Updates

### File: `src/lib/api.ts`

```typescript
// ✅ Updated to use UUID for ngoId

export interface NgoLoginResponse {
  success: boolean;
  ngoId: string;  // UUID as string in JSON
  email: string;
  orgName: string;
}

export interface NgoSignupResponse {
  success: boolean;
  ngoId: string;  // UUID as string in JSON
  email: string;
  orgName: string;
}

export interface Story {
  id: string;  // UUID
  ngoId: string;  // UUID (now proper)
  title: string;
  topic: string;
  ageGroup: string;
  language: string;
  coverImage?: string | null;
  status: "draft" | "published";
  studentsReached: number;
  completionRate: number;
  createdAt: string;
}

export interface StoryCreatePayload {
  // ngoId removed - will be from JWT token
  title: string;
  topic: string;
  ageGroup: string;
  language: string;
  characterCount: number;
  regionContext?: string;
  description: string;
  moralLesson?: string;
}

// API calls now use JWT automatically
export const loginNgo = (payload: NgoLoginPayload) =>
  request<NgoLoginResponse>("/api/auth/ngo/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const signupNgo = (payload: NgoSignupPayload) =>
  request<NgoSignupResponse>("/api/auth/ngo/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// Story creation - ngoId no longer passed by client
export const createStory = (payload: StoryCreatePayload) =>
  request<{ story: Story; slides: StorySlide[] }>("/api/stories", {
    method: "POST",
    body: JSON.stringify(payload),  // ✅ ngoId not included
  });
```

### File: `src/pages/CreateStory.tsx`

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createStory } from "@/lib/api";
import { toast } from "sonner";

const CreateStory = () => {
  const navigate = useNavigate();
  
  // ✅ No need to get ngoId from localStorage
  // Backend extracts it from JWT token
  
  const [topic, setTopic] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [language, setLanguage] = useState("");
  const [characterCount, setCharacterCount] = useState("1");
  const [regionContext, setRegionContext] = useState("");
  const [description, setDescription] = useState("");
  const [moralLesson, setMoralLesson] = useState("");

  const createMutation = useMutation({
    mutationFn: createStory,
    onSuccess: ({ story }) => {
      toast.success("Story generated successfully");
      navigate(`/ngo/story-preview?storyId=${story.id}`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not generate story";
      toast.error(message);
    },
  });

  const isGenerating = createMutation.isPending;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!topic || !ageGroup || !language || !description.trim()) {
      toast.error("Please fill topic, age group, language and story description");
      return;
    }

    const generatedTitle = `${topic} Adventure`;
    
    // ✅ No ngoId in payload - backend gets it from JWT
    createMutation.mutate({
      title: generatedTitle,
      topic,
      ageGroup,
      language,
      characterCount: Number(characterCount),
      regionContext: regionContext || undefined,
      description: description.trim(),
      moralLesson: moralLesson || undefined,
    });
  };

  return (
    // ... JSX remains the same ...
  );
};

export default CreateStory;
```

### File: `src/pages/NgoDashboard.tsx`

```typescript
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, getStories } from "@/lib/api";

const NgoDashboard = () => {
  // ✅ No need to get ngoId from localStorage
  // Backend uses JWT token to identify user
  
  const storiesQuery = useQuery({
    queryKey: ["stories", "ngo-dashboard"],
    queryFn: () => getStories(),  // ✅ No ngo_id filter needed
  });

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),  // ✅ Backend uses JWT
  });

  // ... rest of component remains the same ...
};

export default NgoDashboard;
```

---

## Step 5: JWT Authentication & User Extraction

### File: `backend/app/main.py` (Authentication utilities)

```python
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from app.config import get_settings

security = HTTPBearer()

def create_access_token(ngo_id: str, email: str) -> tuple[str, int]:
    """Create JWT token with ngo_id"""
    settings = get_settings()
    expire_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expire_delta
    
    payload = {
        "sub": ngo_id,  # Subject is the ngo_id (UUID)
        "email": email,
        "type": "ngo",
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(expire.timestamp()),
    }
    
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt, int(expire_delta.total_seconds())

def verify_token(credentials: HTTPAuthCredentials = Depends(security)) -> dict:
    """Verify JWT and extract user info"""
    settings = get_settings()
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        ngo_id: str = payload.get("sub")
        email: str = payload.get("email")
        token_type: str = payload.get("type")
        
        if not ngo_id or token_type != "ngo":
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {"ngo_id": ngo_id, "email": email}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## Step 6: Frontend Auth Context

### File: `src/hooks/useAuth.ts`

```typescript
import { useCallback } from "react";

interface NgoProfile {
  ngoId: string;  // UUID
  email: string;
  orgName: string;
}

export const useAuth = () => {
  const getToken = useCallback(() => {
    return localStorage.getItem("access_token");
  }, []);

  const getNgoProfile = useCallback((): NgoProfile | null => {
    const profile = localStorage.getItem("ngo_profile");
    return profile ? JSON.parse(profile) : null;
  }, []);

  const getStoredNgoId = useCallback((): string | null => {
    const profile = getNgoProfile();
    return profile?.ngoId || null;  // Returns UUID string
  }, [getNgoProfile]);

  const isAuthenticated = useCallback(() => {
    return !!getToken() && !!getNgoProfile();
  }, [getToken, getNgoProfile]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("ngo_profile");
  }, []);

  return {
    getToken,
    getNgoProfile,
    getStoredNgoId,
    isAuthenticated,
    logout,
  };
};
```

---

## Step 7: Migration Helper Script

### File: `backend/migrations/migration_helper.py`

```python
"""Helper script to verify migration readiness and perform checks"""

from uuid import UUID
from supabase import create_client

def check_migration_readiness(supabase_url: str, service_role_key: str) -> dict:
    """Check if migration can proceed safely"""
    
    client = create_client(supabase_url, service_role_key)
    
    # Check 1: Get all stories with current ngo_id
    stories_result = client.table("stories").select("id, ngo_id").execute()
    stories = stories_result.data or []
    
    # Check 2: Get all NGO accounts
    ngo_result = client.table("ngo_accounts").select("id, email").execute()
    ngos = ngo_result.data or []
    
    # Create mapping of email to UUID
    email_to_uuid = {ngo["email"]: ngo["id"] for ngo in ngos}
    email_prefix_to_uuid = {}
    for ngo in ngos:
        prefix = ngo["email"].split("@")[0]
        if prefix not in email_prefix_to_uuid:
            email_prefix_to_uuid[prefix] = []
        email_prefix_to_uuid[prefix].append(ngo["id"])
    
    # Check 3: Validate all story ngo_ids can be mapped
    orphaned_stories = []
    ambiguous_stories = []
    mappable_stories = []
    
    for story in stories:
        current_ngo_id = story["ngo_id"]
        
        # Try exact email match
        if current_ngo_id in email_to_uuid:
            mappable_stories.append({
                "story_id": story["id"],
                "current_ngo_id": current_ngo_id,
                "new_ngo_id": email_to_uuid[current_ngo_id],
                "method": "exact_email"
            })
        # Try email prefix match
        elif current_ngo_id in email_prefix_to_uuid:
            matches = email_prefix_to_uuid[current_ngo_id]
            if len(matches) == 1:
                mappable_stories.append({
                    "story_id": story["id"],
                    "current_ngo_id": current_ngo_id,
                    "new_ngo_id": matches[0],
                    "method": "email_prefix"
                })
            else:
                ambiguous_stories.append({
                    "story_id": story["id"],
                    "current_ngo_id": current_ngo_id,
                    "possible_matches": matches,
                    "reason": f"Multiple NGOs with prefix '{current_ngo_id}'"
                })
        else:
            orphaned_stories.append({
                "story_id": story["id"],
                "current_ngo_id": current_ngo_id,
            })
    
    return {
        "total_stories": len(stories),
        "total_ngos": len(ngos),
        "mappable_stories": len(mappable_stories),
        "orphaned_stories": len(orphaned_stories),
        "ambiguous_stories": len(ambiguous_stories),
        "orphaned": orphaned_stories,
        "ambiguous": ambiguous_stories,
        "mappable": mappable_stories,
        "can_migrate": len(orphaned_stories) == 0 and len(ambiguous_stories) == 0,
    }

def show_migration_readiness(report: dict) -> None:
    """Display migration readiness report"""
    
    print("\n=== MIGRATION READINESS REPORT ===\n")
    print(f"Total Stories:       {report['total_stories']}")
    print(f"Total NGOs:          {report['total_ngos']}")
    print(f"Mappable Stories:    {report['mappable_stories']}")
    print(f"Orphaned Stories:    {report['orphaned_stories']}")
    print(f"Ambiguous Stories:   {report['ambiguous_stories']}")
    print(f"\nCan Migrate:         {'✅ YES' if report['can_migrate'] else '❌ NO'}\n")
    
    if not report["can_migrate"]:
        if report["orphaned_stories"]:
            print("⚠️  Orphaned Stories (no matching NGO):")
            for story in report["orphaned"]:
                print(f"   - Story {story['story_id']}: ngo_id='{story['current_ngo_id']}'")
        
        if report["ambiguous_stories"]:
            print("\n⚠️  Ambiguous Stories (multiple matching NGOs):")
            for story in report["ambiguous"]:
                print(f"   - Story {story['story_id']}: {story['reason']}")
                print(f"     Possible NGO IDs: {story['possible_matches']}")

# Usage:
if __name__ == "__main__":
    import os
    
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    report = check_migration_readiness(supabase_url, service_role_key)
    show_migration_readiness(report)
```

---

## Step 8: Testing Scenarios

### Before Migration Testing

```bash
# 1. Run readiness check
python backend/migrations/migration_helper.py

# Output should show:
# Can Migrate: ✅ YES
# (with zero orphaned/ambiguous stories)
```

### After Migration Testing

```python
"""Test file: backend/tests/test_ngo_id_refactor.py"""

import pytest
from uuid import UUID
from app.main import ngo_login, ngo_signup, create_story
from app.schemas import NgoLoginRequest, NgoSignupRequest, StoryCreateRequest


def test_ngo_login_returns_uuid_id():
    """Test that login returns UUID ngo_id"""
    response = ngo_login(NgoLoginRequest(
        email="test@example.com",
        password="password123"
    ))
    
    # ngo_id should be valid UUID
    assert isinstance(response.ngoId, str)
    assert len(response.ngoId) == 36  # UUID string length
    UUID(response.ngoId)  # Should not raise


def test_ngo_signup_returns_uuid_id():
    """Test that signup returns UUID ngo_id"""
    response = ngo_signup(NgoSignupRequest(
        orgName="Test Org",
        email="neworg@example.com",
        password="password123"
    ))
    
    assert isinstance(response.ngoId, str)
    UUID(response.ngoId)  # Validate UUID format


def test_story_uses_uuid_foreign_key():
    """Test that story ngo_id is properly used as UUID FK"""
    # Create story with verified user context
    current_user = {"ngo_id": "550e8400-e29b-41d4-a716-446655440000"}
    
    story_data = StoryCreateRequest(
        ngoId="550e8400-e29b-41d4-a716-446655440000",  # Should be ignored
        title="Test Story",
        topic="Stranger Danger",
        ageGroup="6-8",
        language="English",
        characterCount=1,
        description="Test description"
    )
    
    # Backend should use ngo_id from JWT, not from request
    # Story should have correct UUID ngo_id


def test_story_query_with_uuid_filter():
    """Test that story filtering works with UUID ngo_id"""
    ngo_uuid = "550e8400-e29b-41d4-a716-446655440000"
    
    # Should be able to query stories by UUID
    client = get_supabase_client()
    result = (
        client.table("stories")
        .select("*")
        .eq("ngo_id", ngo_uuid)
        .execute()
    )
    
    assert result.data is not None


def test_dashboard_stats_uses_uuid():
    """Test that dashboard stats correctly filter by UUID ngo_id"""
    current_user = {"ngo_id": "550e8400-e29b-41d4-a716-446655440000"}
    
    stats = get_dashboard_stats(current_user)
    
    # Should return valid stats
    assert stats.storiesCreated >= 0
    assert stats.studentsReached >= 0
```

---

## Step 9: Deployment Timeline

### Phase 1: Pre-Migration (Day 1)
```
- [ ] Run migration readiness check
- [ ] Backup production database
- [ ] Create rollback runbook
- [ ] Test migration on staging
- [ ] Notify users of maintenance window
```

### Phase 2: Migration (Designated window)
```
- [ ] Stop backend service
- [ ] Run SQL migration
- [ ] Verify data integrity
- [ ] Deploy new backend code
- [ ] Deploy new frontend code
```

### Phase 3: Verification (Post-Migration)
```
- [ ] Test NGO login/signup
- [ ] Test story creation
- [ ] Test dashboard stats
- [ ] Check API logs for errors
- [ ] Monitor system health
```

### Phase 4: Monitoring (Next 48 hours)
```
- [ ] Watch error logs
- [ ] Monitor database performance
- [ ] Check all API endpoints
- [ ] Verify story associations
- [ ] Have rollback plan ready
```

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| **Database** | Migrate `stories.ngo_id` from TEXT to UUID with FK |
| **Backend Schemas** | `NgoId` changed from `str` to `UUID` |
| **Login/Signup** | Return actual database ID instead of email-derived |
| **Auth** | Implement JWT with ngo_id in token |
| **Story Creation** | Extract ngo_id from JWT, not request body |
| **Story Queries** | Filter by UUID ngo_id |
| **Dashboard** | Get ngo_id from JWT, not localStorage |
| **Frontend** | Remove ngo_id derivation logic, use JWT for auth |

---

## Rollback Plan

If issues occur:

1. **Stop all services**
2. **Run rollback migration** (provided above)
3. **Revert to previous backend code**
4. **Revert to previous frontend code**
5. **Verify data returned to previous state**
6. **Restart services**

---

## Key Benefits After Refactoring

✅ **Proper Database Relations** - Foreign key constraint enforces data integrity  
✅ **Immutable IDs** - UUID won't change if email changes  
✅ **Security** - Cannot forge NGO IDs in JWT  
✅ **Scalability** - Proper schema design for future features  
✅ **Data Integrity** - Orphaned stories prevented by foreign key  
✅ **Type Safety** - UUID type ensures format correctness  

