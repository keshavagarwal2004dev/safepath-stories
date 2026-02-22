from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


StoryStatus = Literal["draft", "published"]


class Choice(BaseModel):
    id: str
    text: str
    correct: bool


class StorySlide(BaseModel):
    id: int
    image: str | None = None
    text: str
    choices: list[Choice] | None = None


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


class DashboardStats(BaseModel):
    storiesCreated: int
    studentsReached: int
    completionRate: int
    activeSessions: int


# ============================================================================
# AUTHENTICATION SCHEMAS
# ============================================================================

class NgoLoginRequest(BaseModel):
    email: str
    password: str


class NgoLoginResponse(BaseModel):
    """
    ✅ REFACTORED: ngoId is now a database-generated UUID (as string).
    Returns JWT access token for authenticated requests.
    """
    success: bool
    ngoId: str  # UUID as string, e.g. "550e8400-e29b-41d4-a716-446655440000"
    email: str
    access_token: str  # ✅ JWT token for subsequent authenticated requests
    token_type: str = "bearer"
    expires_in: int  # seconds


class NgoSignupRequest(BaseModel):
    orgName: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=5)
    password: str = Field(min_length=8)


class NgoSignupResponse(BaseModel):
    """
    ✅ REFACTORED: ngoId is now a database-generated UUID (as string).
    Returns JWT access token for authenticated requests.
    """
    success: bool
    ngoId: str  # UUID as string, e.g. "550e8400-e29b-41d4-a716-446655440000"
    email: str
    orgName: str
    access_token: str  # ✅ JWT token for authentication
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenResponse(BaseModel):
    """JWT access token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseModel):
    """Decoded JWT token payload."""
    ngo_id: str
    email: str
    org_name: str
    role: str


# ============================================================================
# STUDENT SCHEMAS
# ============================================================================


class StudentProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ageGroup: str
    avatar: str | None = None


class StudentProfileResponse(BaseModel):
    id: str
    name: str
    ageGroup: str
    avatar: str | None = None
    createdAt: str  # ✅ FIXED: Changed from datetime to str for JSON serialization


class StoryCreateRequest(BaseModel):
    """
    ✅ REFACTORED: ngoId removed - extracted from JWT token instead.
    """
    title: str = Field(min_length=1)
    topic: str
    ageGroup: str
    language: str
    characterCount: int = Field(ge=1, le=4)
    regionContext: str | None = None
    description: str
    moralLesson: str | None = None


class StoryCreateResponse(BaseModel):
    story: Story
    slides: list[StorySlide]


class StorySearchResponse(BaseModel):
    """
    Paginated search results for stories.
    ✅ Case-insensitive search by title and description
    ✅ Filtered by authenticated NGO
    ✅ Includes total count for pagination
    """
    stories: list[Story]
    total: int
    limit: int
    offset: int


class ErrorResponse(BaseModel):
    """
    ✅ Standardized error response format.
    Used for all error responses (400, 401, 403, 404, 422, 500, etc.)
    """
    success: bool = False
    message: str
    error: str | None = None  # Optional error code or additional context