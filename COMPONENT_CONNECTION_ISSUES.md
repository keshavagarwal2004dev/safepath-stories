# Component Connection & Data Flow Issues

## Frontend Component Architecture Issues

### 1. Authentication Flow Problem

```
Current (Flawed):
Landing → NgoLogin → localStorage.setItem("ngo_profile") → /ngo/** pages
                  ↑
                  No backend verification

Correct Flow Should Be:
Landing → NgoLogin → Backend Auth Endpoint → JWT Token 
         → API calls with JWT header → /ngo/** pages
                                    ↓
                               Verify JWT in each request
```

**Issue:** Frontend stores NGO profile in localStorage without backend verification. Any user can create arbitrary profiles.

---

### 2. Story Creation Data Flow

```
Current (Flawed):
CreateStory Component
    ↓
    ngoId = localStorage.getItem("ngo_profile").ngoId ❌ Untrusted
    ↓
API: POST /api/stories with ngoId
    ↓
Backend: Accepts any ngoId without validation ❌
    ↓
Story created with potentially fake ngoId

Correct Flow:
CreateStory Component
    ↓
    Get JWT token from localStorage ✓
    ↓
API: POST /api/stories with JWT header
    ↓
Backend: Extract ngoId from JWT.decode() ✓
    ↓
Backend: Verify ngoId exists in database ✓
    ↓
Story created with verified ngoId
```

**Issue:** ngoId is determined by frontend, allowing impersonation.

---

### 3. Student Home - Double Fetch Issue

```
Current (Inefficient):
StudentHome Component
    ↓
    useQuery(() => getStories({
      status: "published",
      topic: topicFilter,
      ageGroup: ageFilter
    }))
    ↓
    API Endpoint filters by topic & ageGroup ✓
    ↓
    Then JavaScript does it AGAIN:
    stories.filter(s => s.topic !== filter)  ❌ Redundant
    ↓
    Result: CPU waste, unnecessary re-renders

Correct Flow:
    Just use API-filtered results directly
```

**Issue:** Filtering happens twice (API + JavaScript), wasting resources.

---

### 4. Story Preview Publish Flow

```
Current (Broken):
StoryPreviewEditor → "Approve Story" Button
    ↓
    onClick={() => toast.success("Story approved!") }  ❌ Only UI feedback
    ↓
    navigate("/ngo/my-stories")
    ↓
    Story status in database: STILL "draft" ❌
    
UI Claims: Published ✓
Database Says: Still draft ❌
    ↓
    MISMATCH: UI and data out of sync
```

**Issue:** Approve button doesn't actually change story status. Need publish endpoint.

---

### 5. Student Story Viewing Flow

```
Current (Problem):
StudentHome
    ↓
    Link to="/student/story/:id"
    ↓
    StoryViewer Component
    ↓
    useQuery(getStorySlides(id))
    ↓
    API fails? → Falls back to mockStorySlides ❌
    ↓
    User doesn't know if viewing real or fake data

If user comes directly:
/student/story/invalid-id
    ↓
    StoryViewer loaded
    ↓
    API fails silently
    ↓
    Serves mock data as if it's real ❌
```

**Issue:** No error state. User can't tell if story exists or using fallback data.

---

### 6. Student Profile Creation Issue

```
Current:
StudentSignup
    ↓
    createStudentProfile(payload)
    ↓
    Backend: POST /api/students
    ↓
    Response: Student profile with ID
    ↓
    localStorage.setItem("student_profile", JSON.stringify(profile))
    ↓
    Stored but never synced
    ↓
    If backend profile updated, frontend doesn't know ❌
    ↓
    User sees stale data

No verification that student_profile in localStorage
matches what backend has ❌
```

**Issue:** Student profile is write-once, never updated or verified.

---

### 7. NGO Dashboard Stats Issue

```
Current (Risky):
NgoDashboard
    ↓
    ngoProfile = localStorage.getItem("ngo_profile")
    ngoId = ngoProfile.ngoId || "demo-ngo" ❌ Fallback
    ↓
    getDashboardStats(ngoId)
    ↓
    Backend query: SELECT * WHERE ngo_id = ?
    ↓
    If ngoProfile is empty:
      → Uses "demo-ngo"
      → Queries stats for wrong user ❌
    
    If user logs out but component still mounted:
      → Still queries with old localStorage data ❌
      → Could see another user's stats ❌
```

**Issue:** ngoId comes from localStorage which can be manipulated or stale.

---

### 8. Navigation State Preservation

```
Problem in Story Flow:
StudentHome
    ↓
    View Story → StoryViewer
    ↓
    Complete Story → ReinforcementScreen
    ↓
    Back to Story Library → StudentHome
    ↓
    Filter selections are LOST ❌
    ↓
    Filters reset to defaults
    ↓
    Poor UX: User has to re-select filters
```

**Issue:** Navigation doesn't preserve filter state.

---

## Data Type Contract Issues

### Frontend Type Definitions

```typescript
// src/lib/api.ts
export interface DashboardStats {
  storiesCreated: number;        // ✓ Correct
  studentsReached: number;       // ✓ Correct
  completionRate: number;        // ✓ Correct (percentage 0-100)
  activeSessions: number;        // ✓ Correct
}

export interface Story {
  createdAt: string;  // ✓ Expects ISO string
}
```

### Backend Data Models

```python
# backend/app/schemas.py
class DashboardStats(BaseModel):
    storiesCreated: int        # ✓ Matches frontend
    studentsReached: int       # ✓ Matches frontend
    completionRate: int        # ✓ Matches frontend
    activeSessions: int        # ✓ Matches frontend

class Story(BaseModel):
    createdAt: str  # ✓NOW matches, but was wrong before
```

### Problem: StudentProfileResponse Type Mismatch

```python
# Backend returns:
class StudentProfileResponse(BaseModel):
    createdAt: datetime  # ❌ Python datetime object
```

```typescript
// Frontend expects:
interface StudentProfile {
  createdAt: string;  // ❌ ISO string
}
```

**Serialization breaks:** `JSON.stringify(datetime_obj)` produces invalid format

---

## API Endpoint Coverage

### Missing Endpoints

```
✓ Implemented:
  POST   /api/auth/ngo/login
  POST   /api/auth/ngo/signup
  POST   /api/students
  GET    /api/stories
  GET    /api/stories/:id
  GET    /api/stories/:id/slides
  POST   /api/stories
  GET    /api/dashboard/stats

❌ NOT Implemented (but used in UI):
  PATCH  /api/stories/:id/publish  → "Approve Story" button needs this
  PUT    /api/stories/:id          → Story editing
  DELETE /api/stories/:id          → Story deletion
  GET    /api/students/:id         → Get student profile
  PUT    /api/students/:id         → Update student profile
  POST   /api/stories/:id/submit   → Track story completion
  GET    /api/dashboard/analytics  → Full analytics page
  PUT    /api/ngo/settings         → Settings page
```

**Issue:** UI has buttons/pages for unimplemented endpoints.

---

## Authentication Context Missing

### No Auth Context Provider

```typescript
// Current (No context):
// Each page independently checks localStorage
const ngoProfile = JSON.parse(localStorage.getItem("ngo_profile") || "{}");

// Should be:
const { ngoProfile, logout } = useAuthContext();

export const useAuthContext = () => {
  // Provides:
  // - Current user (from JWT)
  // - Login function
  // - Logout function
  // - Is authenticated
  // - Permission checks
}
```

**Issue:** Auth logic scattered across components, hard to maintain.

---

## Session & Persistence Issues

### Browser Reload Scenario

```
Scenario: User logged in, closes browser, opens it next day

Current Flow:
1. Browser reopens
2. App loads
3. localStorage.getItem("ngo_profile") exists
4. Loads /ngo/dashboard
5. Makes API calls with stale ngoId ❌
6. If ngoId was derived from old email, completely wrong ❌

Correct Flow:
1. Browser reopens
2. App loads
3. Checks if JWT token exists
4. If expired: Redirect to login
5. If valid: Use it to re-fetch user data
6. Proceed with valid auth
```

**Issue:** No session validation or token refresh.

---

## Query State Management Issues

### React Query Sync Problems

```
Problem 1: Multiple queries with same key
  - NgoDashboard queries ["dashboard-stats", ngoId]
  - But ngoId comes from untrusted localStorage
  - Different ngoId values → Different queries
  - Could cache wrong user's data

Problem 2: No query invalidation
  - After creating story, query caches don't refresh
  - "My Stories" list might not show new story immediately
  - User might think story wasn't created

Problem 3: Stale data display
  - Stories loaded from API
  - If API returns stale data, UI shows it
  - No refresh button or staleness indicator
  - User doesn't know when data was last updated
```

---

## Error Handling Flow

### Scenario: API Call Fails During Story Creation

```
Current Path:
CreateStory Component
    ↓
    mutate(storyData)
    ↓
    API Error (network, server, validation)
    ↓
    catch: toast.error(message)
    ↓
    Component state: ❌ "isLoading" still false
    ❌ No retry mechanism
    ❌ User must refresh entire form
    ❌ Lost all input ❌

Better Path:
    Parse error
    ↓
    Distinguish error type:
      - Network error → Show retry button
      - Validation error → Show field errors
      - Server error → Show alert
    ↓
    Preserve user input
    ↓
    Offer quick retry
```

**Issue:** Error handling is minimal, doesn't preserve state or offer recovery.

---

## Data Validation Issues

### Missing Validations

```
Frontend Input:
  ✓ Name (min length)
  ✓ Age Group (select dropdown)
  ✓ Password (min 8 chars)
  ❌ Email (no format check)
  ❌ Topic selection (trust user)

Backend Should:
  ❌ Validate email format
  ❌ Validate topic is in whitelist
  ❌ Validate ageGroup is valid
  ❌ Validate description isn't empty

Current: Trust frontend completely ❌
```

---

## Component Render Props Issues

### StoryViewer Props

```typescript
// Current:
const StoryViewer = () => {
  const { id: storyId } = useParams();
  // Expects 'id' param but uses ':id' in route
  
  // What if URL is /student/story/abc-def-ghi
  // and API returns 404?
  // Component doesn't handle it ❌
}

// Better:
interface StoryViewerProps {
  storyId: string;  // Type-safe
  onError?: (error: Error) => void;  // Error handling
  fallbackData?: StorySlide[];  // Explicit fallback
}

const StoryViewer: React.FC<StoryViewerProps> = ({
  storyId,
  onError,
  fallbackData = mockStorySlides
}) => {
  // ...
}
```

---

## Re-render Performance Issues

### Unnecessary Re-renders in StudentHome

```javascript
// Component re-renders when:
1. topicFilter changes
2. ageFilter changes
3. API query updates
4. Mock data selection changes

// But also re-renders unnecessarily when:
- Other page components render
- Router transitions
- Parent component re-renders

// Fix: Usememo for filtered results
const filteredStories = useMemo(() => {
  return (storiesQuery.data || mockStories).filter(s => {
    if (topicFilter && s.topic !== topicFilter) return false;
    if (ageFilter && s.ageGroup !== ageFilter) return false;
    return true;
  });
}, [storiesQuery.data, mockStories, topicFilter, ageFilter]);
```

---

## Summary: Data Flow Integrity Map

```
┌─────────────────────────────────────────────────────────┐
│  UNTRUSTED DATA SOURCES (Frontend)                      │
├─────────────────────────────────────────────────────────┤
│ localStorage ("ngo_profile")           → Used as ngoId  │
│ URL parameters (:id)                    → Used in API    │
│ User input (search, filters)            → Used in query  │
│ React Query cache                       → Data source    │
└─────────────────────────────────────────────────────────┘
                      ↓
            ❌ No validation
            ❌ No type checking  
            ❌ No authentication
                      ↓
         ┌────────────────────────┐
         │  API ENDPOINTS         │
         ├────────────────────────┤
         │ Should validate all    │
         │ parameters and auth    │
         │ ✓ Some do             │
         │ ❌ Many don't         │
         └────────────────────────┘
                      ↓
          ┌──────────────────────┐
          │  DATABASE            │
          ├──────────────────────┤
          │ Data integrity at    │
          │ risk due to invalid  │
          │ data from API        │
          └──────────────────────┘
```

---

## Component Dependency Graph

```
Landing
  ↓ login/signup links
  ├→ NgoLogin → CreateStory → StoryPreviewEditor
  │                ↓              ↓
  │            Backend API    Backend API
  │                ↓              ↓
  │          story creation   story retrieval
  │
  ├→ NgoSignup → NgoDashboard
  │                ↓
  │           Backend API (getDashboardStats)
  │           ❌ Uses untrusted ngoId
  │
  ├→ StudentSignup → StudentHome → StoryViewer
                        ↓              ↓
                    Backend API    Backend API
                        ↓              ↓
                    getStories   getStorySlides
                    ❌ Double-   ❌ No error
                       filtered     handling

Shared Dependencies:
  - localStorage (unreliable)
  - React Query (could cache wrong data)
  - React Router (params could be manipulated)
```

---

## Metadata Corruption Scenarios

### Scenario 1: Email Change
```
Time T0:
  User: john@example.com
  ngoId generated: "john"
  Stories created with ngo_id: "john"
  
Time T1 (User changes email to john.doe@organization.com):
  New ngoId generated: "john"
  Still same ID? Or new ID?
  
  If same: Works but fragile
  If different: Story association broken ❌
```

### Scenario 2: Database Inconsistency
```
Frontend says:
  - ngoId: "john"
  - storyId: "story-123"
  - Own the story
  
Backend says:
  - Story "story-123" belongs to ngoId: "alice"
  
Result: ❌ Data conflict
```

### Scenario 3: Cache Invalidation
```
User A:
  - Logs in
  - Views dashboard with stats
  - Logs out
  
User B:
  - Logs in to same browser
  - React Query cache still has User A's stats
  - Shows old data ❌
```

---

## Recommendations Priority

### MUST FIX (This Sprint)
1. Implement proper authentication (JWT)
2. Extract user ID from token, not localStorage
3. Add backend authorization checks to all endpoints
4. Fix type mismatches (createdAt)

### SHOULD FIX (Next Sprint)  
5. Add route protection
6. Implement publish story endpoint
7. Add input validation
8. Add error boundaries
9. Fix double filtering

### NICE TO HAVE (Backlog)
10. Session management
11. Offline support
12. Performance optimization
13. Better error messages
