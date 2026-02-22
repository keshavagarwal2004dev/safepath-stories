# Critical Fixes - Code Examples

## Fix 1: Implement JWT-Based Authentication

### Backend Changes

**File: `backend/app/config.py`** (Add to imports)
```python
import os
from datetime import timedelta

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
```

**File: `backend/app/schemas.py`** (Add new schemas)
```python
from datetime import datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    ngoId: str
    email: str
    expiresIn: int  # seconds

class TokenPayload(BaseModel):
    sub: str  # ngoId
    email: str
    iat: int  # issued at
    exp: int  # expiration
```

**File: `backend/app/main.py`** (Add JWT utilities)
```python
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from app.config import get_settings

security = HTTPBearer()

def create_access_token(ngo_id: str, email: str) -> tuple[str, int]:
    settings = get_settings()
    expire_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expire_delta
    
    payload = {
        "sub": ngo_id,
        "email": email,
        "iat": datetime.now(timezone.utc).timestamp(),
        "exp": expire.timestamp(),
    }
    
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt, int(expire_delta.total_seconds())

def verify_token(credentials: HTTPAuthCredentials = Depends(security)) -> dict:
    settings = get_settings()
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        ngo_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if ngo_id is None or email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {"ngo_id": ngo_id, "email": email}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

**File: `backend/app/main.py`** (Update login/signup endpoints)
```python
@router.post("/auth/ngo/login", response_model=TokenResponse)
def ngo_login(payload: NgoLoginRequest) -> TokenResponse:
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    client = get_supabase_client()
    try:
        result = (
            client.table("ngo_accounts")
            .select("id, password_hash")
            .eq("email", payload.email)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)
    
    if not result.data or not verify_password(payload.password, result.data[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    row = result.data[0]
    ngo_id = str(row["id"])  # ✅ Use actual database ID
    
    token, expires_in = create_access_token(ngo_id, payload.email)
    return TokenResponse(
        access_token=token,
        ngoId=ngo_id,
        email=payload.email,
        expiresIn=expires_in
    )

@router.post("/auth/ngo/signup", response_model=TokenResponse)
def ngo_signup(payload: NgoSignupRequest) -> TokenResponse:
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
    ngo_id = str(row["id"])  # ✅ Use actual database ID
    
    token, expires_in = create_access_token(ngo_id, payload.email)
    return TokenResponse(
        access_token=token,
        ngoId=ngo_id,
        email=payload.email,
        expiresIn=expires_in
    )
```

**File: `backend/app/main.py`** (Protect endpoints with JWT)
```python
@router.post("/stories", response_model=StoryCreateResponse)
def create_story(
    payload: StoryCreateRequest,
    current_user: dict = Depends(verify_token)  # ✅ Add JWT verification
) -> StoryCreateResponse:
    """Create story - requires authentication"""
    
    # ✅ Extract ngoId from verified token, not request
    ngo_id = current_user["ngo_id"]
    
    # ✅ Verify ngoId exists in database
    client = get_supabase_client()
    ngo_check = (
        client.table("ngo_accounts")
        .select("id")
        .eq("id", ngo_id)
        .execute()
    )
    if not ngo_check.data:
        raise HTTPException(status_code=403, detail="Invalid NGO")
    
    # Rest of story creation with verified ngo_id
    story_insert = (
        client.table(settings.supabase_stories_table)
        .insert({
            "ngo_id": ngo_id,  # ✅ Use verified ngo_id
            "title": payload.title,
            # ... rest of fields
        })
        .execute()
    )
    # ...
```

### Frontend Changes

**File: `src/lib/api.ts`**
```typescript
export interface TokenResponse {
  access_token: string;
  token_type: string;
  ngoId: string;
  email: string;
  expiresIn: number;
}

export const loginNgo = async (payload: NgoLoginPayload): Promise<TokenResponse> => {
  const response = await request<TokenResponse>("/api/auth/ngo/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  
  // ✅ Store token
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("ngo_profile", JSON.stringify({
    ngoId: response.ngoId,
    email: response.email,
  }));
  
  return response;
};

// ✅ Helper to add JWT to requests
const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async <T>(
  path: string,
  init?: RequestInit,
  query?: Record<string, string | undefined>
): Promise<T> => {
  return fetch(buildUrl(path, query), {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),  // ✅ Add token to every request
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  // ... rest of logic
};
```

**File: `src/hooks/useAuth.ts`** (New file)
```typescript
import { useCallback } from "react";

export const useAuth = () => {
  const getToken = useCallback(() => {
    return localStorage.getItem("access_token");
  }, []);

  const getNgoProfile = useCallback(() => {
    const profile = localStorage.getItem("ngo_profile");
    return profile ? JSON.parse(profile) : null;
  }, []);

  const isAuthenticated = useCallback(() => {
    return !!getToken() && !!getNgoProfile();
  }, [getToken, getNgoProfile]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("ngo_profile");
    localStorage.removeItem("student_profile");
  }, []);

  return {
    getToken,
    getNgoProfile,
    isAuthenticated,
    logout,
  };
};
```

---

## Fix 2: Fix Password Hashing

**File: `backend/requirements.txt`** (Add)
```
bcrypt>=4.0.0
passlib[bcrypt]>=1.7.4
```

**File: `backend/app/main.py`** (Replace)
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash"""
    return pwd_context.verify(password, hashed)
```

---

## Fix 3: Fix Student Profile Type

**File: `backend/app/schemas.py`**
```python
class StudentProfileResponse(BaseModel):
    id: str
    name: str
    ageGroup: str
    avatar: str | None = None
    createdAt: str  # ✅ Changed from datetime to str
```

**File: `backend/app/main.py`** (Update response)
```python
@router.post("/students", response_model=StudentProfileResponse)
def create_student_profile(payload: StudentProfileCreate) -> StudentProfileResponse:
    client = get_supabase_client()
    try:
        result = (
            client.table(settings.supabase_students_table)
            .insert({
                "name": payload.name,
                "age_group": payload.ageGroup,
                "avatar": payload.avatar,
            })
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create student profile")

    row = result.data[0]
    created_at = row["created_at"]
    
    # ✅ Convert to ISO string if needed
    if isinstance(created_at, datetime):
        created_at_str = created_at.isoformat()
    else:
        created_at_str = str(created_at)
    
    return StudentProfileResponse(
        id=str(row["id"]),
        name=row["name"],
        ageGroup=row["age_group"],
        avatar=row.get("avatar"),
        createdAt=created_at_str,  # ✅ As string
    )
```

---

## Fix 4: Add Route Protection (Frontend)

**File: `src/components/ProtectedRoute.tsx`** (New file)
```typescript
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  element: React.ReactElement;
  requiredRole?: "ngo" | "student";
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  element, 
  requiredRole 
}) => {
  const { isAuthenticated, getNgoProfile } = useAuth();

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === "ngo") {
    const ngoProfile = getNgoProfile();
    if (!ngoProfile?.ngoId) {
      return <Navigate to="/ngo-login" replace />;
    }
  }

  return element;
};
```

**File: `src/App.tsx`**
```tsx
import { ProtectedRoute } from "@/components/ProtectedRoute";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/ngo-login" element={<NgoLogin />} />
          <Route path="/ngo-signup" element={<NgoSignup />} />
          <Route path="/student-signup" element={<StudentSignup />} />
          
          {/* ✅ Protected NGO routes */}
          <Route 
            path="/ngo" 
            element={<ProtectedRoute element={<NgoLayout />} requiredRole="ngo" />}
          >
            <Route path="dashboard" element={<NgoDashboard />} />
            <Route path="create-story" element={<CreateStory />} />
            <Route path="story-preview" element={<StoryPreviewEditor />} />
            <Route path="my-stories" element={<MyStories />} />
            <Route path="analytics" element={<NgoDashboard />} />
          </Route>

          {/* ✅ Protected student routes */}
          <Route path="/student/home" element={<ProtectedRoute element={<StudentHome />} />} />
          <Route path="/student/story/:id" element={<ProtectedRoute element={<StoryViewer />} />} />
          <Route path="/student/reinforcement" element={<ProtectedRoute element={<ReinforcementScreen />} />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
```

---

## Fix 5: Implement Story Publish Endpoint

**File: `backend/app/main.py`**
```python
@router.patch("/stories/{story_id}/publish", response_model=Story)
def publish_story(
    story_id: str,
    current_user: dict = Depends(verify_token)
) -> Story:
    """Publish story - requires authentication"""
    
    client = get_supabase_client()
    ngo_id = current_user["ngo_id"]
    
    # ✅ Verify ownership
    story_check = (
        client.table(settings.supabase_stories_table)
        .select("ngo_id")
        .eq("id", story_id)
        .limit(1)
        .execute()
    )
    
    if not story_check.data:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story_check.data[0]["ngo_id"] != ngo_id:
        raise HTTPException(status_code=403, detail="Not authorized to publish this story")
    
    # ✅ Update status
    result = (
        client.table(settings.supabase_stories_table)
        .update({"status": "published"})
        .eq("id", story_id)
        .execute()
    )
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to publish story")
    
    return to_story(result.data[0])
```

**File: `src/lib/api.ts`**
```typescript
export const publishStory = (storyId: string) =>
  request<Story>(`/api/stories/${storyId}/publish`, {
    method: "PATCH",
  });
```

**File: `src/pages/StoryPreviewEditor.tsx`**
```tsx
import { useMutation } from "@tanstack/react-query";
import { publishStory } from "@/lib/api";

const StoryPreviewEditor = () => {
  // ...
  
  const publishMutation = useMutation({
    mutationFn: publishStory,
    onSuccess: () => {
      toast.success("Story published successfully!");
      navigate("/ngo/my-stories");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to publish";
      toast.error(message);
    },
  });

  return (
    // ...
    <Button 
      className="gap-2 font-bold shadow-glow"
      onClick={() => publishMutation.mutate(storyId)}
      disabled={publishMutation.isPending}
    >
      <Check className="h-4 w-4" />
      {publishMutation.isPending ? "Publishing..." : "Approve Story"}
    </Button>
    // ...
  );
};
```

---

## Fix 6: Add Input Validation

**File: `backend/app/schemas.py`**
```python
from pydantic import Field, field_validator

VALID_TOPICS = {
    "Good Touch Bad Touch",
    "Stranger Danger",
    "Safe & Unsafe Secrets",
    "Bullying",
    "Online Safety",
    "Body Autonomy",
}

VALID_AGE_GROUPS = {"4-6", "5-7", "6-8", "8-10", "9-12", "12-14"}

class StudentProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ageGroup: str
    avatar: str | None = None
    
    @field_validator('ageGroup')
    def validate_age_group(cls, v):
        if v not in VALID_AGE_GROUPS:
            raise ValueError(f"Invalid age group: {v}")
        return v

class StoryCreateRequest(BaseModel):
    ngoId: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    topic: str
    ageGroup: str
    language: str
    characterCount: int = Field(ge=1, le=4)
    regionContext: str | None = None
    description: str = Field(min_length=10, max_length=500)
    moralLesson: str | None = None
    
    @field_validator('topic')
    def validate_topic(cls, v):
        if v not in VALID_TOPICS:
            raise ValueError(f"Invalid topic: {v}")
        return v
    
    @field_validator('ageGroup')
    def validate_age_group(cls, v):
        if v not in VALID_AGE_GROUPS:
            raise ValueError(f"Invalid age group: {v}")
        return v
```

---

## Fix 7: Implement Search Functionality

**File: `src/pages/StudentHome.tsx`**
```typescript
const StudentHome = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");

  // ... queries ...

  const filteredStories = useMemo(() => {
    const baseStories = storiesQuery.data?.length ? storiesQuery.data : mockStories;
    
    return baseStories.filter((s) => {
      // Topic filter
      if (topicFilter && s.topic !== topicFilter) return false;
      
      // Age filter
      if (ageFilter && s.ageGroup !== ageFilter) return false;
      
      // Search term
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(search);
        const matchesTopic = s.topic.toLowerCase().includes(search);
        if (!matchesTitle && !matchesTopic) return false;
      }
      
      return true;
    });
  }, [storiesQuery.data, mockStories, topicFilter, ageFilter, searchTerm]);

  return (
    <>
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search stories..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Render filtered stories */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredStories.length > 0 ? (
          filteredStories.map((story) => (
            // ... story card ...
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No stories found</p>
          </div>
        )}
      </div>
    </>
  );
};
```

---

## Fix 8: Add Error Boundary and Error State

**File: `src/components/ErrorBoundary.tsx`** (New file)
```typescript
import React, { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">{this.state.error?.message}</p>
            <Button 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onRetry?.();
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**File: `src/pages/StoryViewer.tsx`**
```typescript
const StoryViewer = () => {
  const navigate = useNavigate();
  const { id: storyId } = useParams();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const slidesQuery = useQuery({
    queryKey: ["story-slides", storyId],
    queryFn: () => getStorySlides(storyId || ""),
    enabled: Boolean(storyId),
  });

  // ✅ Loading state
  if (slidesQuery.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center gradient-story">
        <div className="animate-spin">Loading story...</div>
      </div>
    );
  }

  // ✅ Error state - NOT silent fallback
  if (slidesQuery.isError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center gradient-story">
        <div className="text-center text-card">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Story not found</h1>
          <Button 
            onClick={() => navigate("/student/home")}
            className="mt-4"
          >
            Back to Stories
          </Button>
        </div>
      </div>
    );
  }

  // ✅ Check if we have actual data
  if (!slidesQuery.data?.length) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center gradient-story">
        <div className="text-center text-card">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">No content available</h1>
          <Button 
            onClick={() => navigate("/student/home")}
            className="mt-4"
          >
            Back to Stories
          </Button>
        </div>
      </div>
    );
  }

  const slides = slidesQuery.data;
  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  // ... rest of component
};
```

---

## Installation Instructions

1. **Install dependencies:**
```bash
cd backend
pip install -r requirements.txt
# Add new: pip install pyjwt bcrypt passlib

cd ../
bun install  # or npm install
```

2. **Set environment variables:**
```bash
# backend/.env
SECRET_KEY=your-random-secret-key-32-chars-or-more
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# Keep existing:
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. **Run migrations if needed** (if database schema changed)

4. **Test authentication:**
```bash
# Test signup
curl -X POST http://localhost:8000/api/auth/ngo/signup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Test Org",
    "email": "test@example.com",
    "password": "password123"
  }'

# Should return token
# {
#   "access_token": "eyJ0eXAi...",
#   "token_type": "bearer",
#   "ngoId": "uuid",
#   "email": "test@example.com",
#   "expiresIn": 604800
# }
```

---

## Testing Checklist

- [ ] Can sign up NGO with valid credentials
- [ ] JWT token is returned and stored
- [ ] JWT token is sent with protected API calls
- [ ] Cannot access /ngo/* without token
- [ ] Password is properly hashed with bcrypt
- [ ] Student profile type matches schema
- [ ] Story can be published (status changes to published)
- [ ] Cannot publish stories you don't own
- [ ] Search works in StudentHome
- [ ] Error messages show for failed API calls
- [ ] Story viewer shows error for invalid story ID
