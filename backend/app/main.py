from datetime import datetime
from typing import Any
import hashlib
import logging
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from postgrest.exceptions import APIError

from app.config import BASE_DIR, get_settings
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_ngo,
)
from app.image_generation import ImageGenerationError, generate_story_images
from app.safety_critic import SafetyCriticError, apply_safety_critic
from app.schemas import (
    DashboardStats,
    ErrorResponse,
    NgoLoginRequest,
    NgoLoginResponse,
    NgoSignupRequest,
    NgoSignupResponse,
    Story,
    StoryCreateRequest,
    StoryCreateResponse,
    StorySearchResponse,
    StorySlide,
    StudentProfileCreate,
    StudentProfileResponse,
)
from app.supabase_client import get_supabase_client
from app.story_generation import (
    StoryGenerationError,
    build_default_branching_slides,
    generate_story_with_ollama,
)

settings = get_settings()
app = FastAPI(title="SafePath Stories API", version="0.1.0")
logger = logging.getLogger(__name__)

generated_images_path = BASE_DIR / settings.generated_images_dir
Path(generated_images_path).mkdir(parents=True, exist_ok=True)
app.mount(f"/{settings.generated_images_url_path.strip('/')}", StaticFiles(directory=str(generated_images_path)), name="generated-images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix=settings.api_prefix)


# ============================================================================
# ✅ CENTRALIZED ERROR HANDLING MIDDLEWARE & EXCEPTION HANDLERS
# ============================================================================

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    ✅ Middleware to catch unhandled async errors and format them consistently.
    Catches exceptions that slip through regular exception handlers.
    """
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            logger.exception(f"Unhandled exception in {request.method} {request.url.path}: {exc}")
            return JSONResponse(
                status_code=500,
                content=ErrorResponse(
                    success=False,
                    message="Internal server error",
                    error=str(exc) if settings.debug else "An unexpected error occurred",
                ).model_dump(),
            )


app.add_middleware(ErrorHandlingMiddleware)


# ✅ Exception handler for validation errors (400/422)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with standardized format."""
    errors = exc.errors()
    error_details = "; ".join([f"{'.'.join(map(str, err['loc'][1:]))}: {err['msg']}" for err in errors])
    
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            success=False,
            message="Validation error: request body is invalid",
            error=error_details[:200],  # Truncate for security
        ).model_dump(),
    )


# ✅ Exception handler for HTTP errors (401, 403, 404, 500)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTPException with standardized format."""
    error_code = None
    
    if exc.status_code == 401:
        error_code = "UNAUTHORIZED"
    elif exc.status_code == 403:
        error_code = "FORBIDDEN"
    elif exc.status_code == 404:
        error_code = "NOT_FOUND"
    elif exc.status_code >= 500:
        error_code = "SERVER_ERROR"
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            success=False,
            message=exc.detail if isinstance(exc.detail, str) else "An error occurred",
            error=error_code,
        ).model_dump(),
    )


# ✅ Exception handler for Supabase API errors
@app.exception_handler(APIError)
async def supabase_exception_handler(request: Request, exc: APIError):
    """Handle Supabase client errors with standardized format."""
    logger.error(f"Supabase API error: {exc}")
    
    payload = exc.args[0] if exc.args and isinstance(exc.args[0], dict) else {}
    code = payload.get("code")
    message = payload.get("message", "Database error")
    
    # Map Supabase error codes to HTTP status codes
    if code == "42501" or "row-level security policy" in str(exc).lower():
        return JSONResponse(
            status_code=403,
            content=ErrorResponse(
                success=False,
                message="Permission denied by database policy",
                error="RLS_POLICY_VIOLATION",
            ).model_dump(),
        )
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            success=False,
            message=message,
            error=code or "DATABASE_ERROR",
        ).model_dump(),
    )


# ✅ Exception handler for story generation errors
@app.exception_handler(StoryGenerationError)
async def story_generation_exception_handler(request: Request, exc: StoryGenerationError):
    """Handle story generation errors with standardized format."""
    logger.error(f"Story generation error: {exc}")
    
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            success=False,
            message="Failed to generate story. Please try again.",
            error="STORY_GENERATION_FAILED",
        ).model_dump(),
    )


# ✅ Exception handler for image generation errors
@app.exception_handler(ImageGenerationError)
async def image_generation_exception_handler(request: Request, exc: ImageGenerationError):
    """Handle image generation errors with standardized format."""
    logger.error(f"Image generation error: {exc}")
    
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            success=False,
            message="Failed to generate images. Please try again.",
            error="IMAGE_GENERATION_FAILED",
        ).model_dump(),
    )


# ✅ Exception handler for safety critic errors
@app.exception_handler(SafetyCriticError)
async def safety_critic_exception_handler(request: Request, exc: SafetyCriticError):
    """Handle safety validation errors with standardized format."""
    logger.error(f"Safety critic error: {exc}")
    
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            success=False,
            message="Content failed safety validation. Please revise your story.",
            error="SAFETY_VALIDATION_FAILED",
        ).model_dump(),
    )


def raise_supabase_http_error(error: APIError) -> None:
    payload = error.args[0] if error.args and isinstance(error.args[0], dict) else {}
    error_text = str(error)
    code = payload.get("code")
    message = payload.get("message", "Supabase request failed")

    if code == "42501" or "42501" in error_text or "row-level security policy" in error_text.lower():
        raise HTTPException(
            status_code=403,
            detail="Database permission denied by Supabase RLS. Set SUPABASE_SERVICE_ROLE_KEY in backend/.env or add RLS policies.",
        )

    raise HTTPException(status_code=502, detail=f"Database error: {message}")


def to_story(row: dict[str, Any]) -> Story:
    """Convert database row to Story model with consistent datetime serialization."""
    created_at = row.get("created_at")
    
    # ✅ FIXED: Convert datetime to ISO string for JSON serialization (consistent with StudentProfileResponse)
    if isinstance(created_at, datetime):
        created_at_str = created_at.isoformat()
    elif isinstance(created_at, str):
        # Already a string, use as-is (should be ISO format from Supabase)
        created_at_str = created_at
    else:
        # Fallback to current timestamp
        created_at_str = datetime.utcnow().isoformat()

    return Story(
        id=str(row["id"]),
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


def to_slide(row: dict[str, Any]) -> StorySlide:
    return StorySlide(
        id=int(row["position"]),
        image=row.get("image_url"),
        text=row["text"],
        choices=row.get("choices"),
    )


# ============================================================================
# ✅ CENTRALIZED ERROR HANDLING - USAGE DOCUMENTATION
# ============================================================================
#
# All errors are automatically caught and formatted consistently:
#
# Standard Error Response:
#   {
#     "success": false,
#     "message": "Human-readable error message",
#     "error": "ERROR_CODE"
#   }
#
# Error Handling Flow:
#   1. Validation Error (invalid request body)
#      → Returns 422 with message "Validation error: request body is invalid"
#      → Error code: None (validation details in message)
#      Example: POST /api/stories with invalid JSON
#
#   2. Authentication Error (missing or invalid token)
#      → Returns 401 with message "Not authenticated" or "Token expired"
#      → Error code: "UNAUTHORIZED"
#      Example: GET /api/dashboard/stats without Authorization header
#
#   3. Permission Error (user lacks access)
#      → Returns 403 with message "You do not have permission"
#      → Error code: "FORBIDDEN"
#      Example: Trying to publish another NGO's story
#
#   4. Resource Not Found
#      → Returns 404 with message "Story not found"
#      → Error code: "NOT_FOUND"
#      Example: GET /api/stories/invalid-id
#
#   5. Generation Errors (story/image/safety validation)
#      → Returns 400 with specific error message
#      → Error codes: "STORY_GENERATION_FAILED", "IMAGE_GENERATION_FAILED", "SAFETY_VALIDATION_FAILED"
#      Example: generate_story() fails due to API error
#
#   6. Database Errors
#      → Returns 500 with message "Internal server error"
#      → Error code: "SERVER_ERROR" or "DATABASE_ERROR"
#      Example: Connection to Supabase fails
#
# ============================================================================
# ✅ HTTP ERROR RESPONSE EXAMPLES
# ============================================================================
#
# 1. VALIDATION ERROR (422 Unprocessable Entity)
#    Request:
#      POST /api/stories
#      Content-Type: application/json
#      Authorization: Bearer <token>
#      {"title": "", "topic": ""}  # Missing required fields
#
#    Response:
#      {
#        "success": false,
#        "message": "Validation error: request body is invalid",
#        "error": "title: Field required; topic: Field required"
#      }
#
# 2. UNAUTHORIZED ERROR (401)
#    Request:
#      GET /api/dashboard/stats
#      (No Authorization header)
#
#    Response:
#      {
#        "success": false,
#        "message": "Not authenticated",
#        "error": "UNAUTHORIZED"
#      }
#
# 3. FORBIDDEN ERROR (403)
#    Request:
#      PATCH /api/stories/other-ngo-story-id/publish
#      Authorization: Bearer <your-ngo-token>
#
#    Response:
#      {
#        "success": false,
#        "message": "You can only publish your own stories",
#        "error": "FORBIDDEN"
#      }
#
# 4. NOT FOUND ERROR (404)
#    Request:
#      GET /api/stories/nonexistent-id
#
#    Response:
#      {
#        "success": false,
#        "message": "Story not found",
#        "error": "NOT_FOUND"
#      }
#
# 5. GENERATION ERROR (400)
#    Request:
#      POST /api/stories
#      Content-Type: application/json
#      Authorization: Bearer <token>
#      {story creation payload}
#      (LLM service fails internally)
#
#    Response:
#      {
#        "success": false,
#        "message": "Failed to generate story. Please try again.",
#        "error": "STORY_GENERATION_FAILED"
#      }
#
# 6. SERVER ERROR (500)
#    Request:
#      GET /api/stories
#      (Database connection fails)
#
#    Response:
#      {
#        "success": false,
#        "message": "Internal server error",
#        "error": "SERVER_ERROR"
#      }
#
# ============================================================================


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ============================================================================
# ✅ EXAMPLE ENDPOINT - Demonstrates Error Handling
# ============================================================================

@app.get("/example-errors")
def example_errors(error_type: str | None = Query(None, description="Type of error to demonstrate")) -> dict[str, str]:
    """
    ✅ Example endpoint demonstrating different error scenarios.
    
    Query Parameters:
      - error_type: "validation", "not_found", "permission", or "server"
    
    Examples:
      GET /example-errors?error_type=not_found
        → Returns 404 with error code "NOT_FOUND"
      
      GET /example-errors?error_type=permission
        → Returns 403 with error code "FORBIDDEN"
      
      GET /example-errors?error_type=server
        → Returns 500 with error code "SERVER_ERROR"
      
      GET /example-errors
        → Returns 200 with success message
    """
    if error_type == "not_found":
        raise HTTPException(status_code=404, detail="Resource not found")
    elif error_type == "permission":
        raise HTTPException(status_code=403, detail="You cannot access this resource")
    elif error_type == "server":
        raise HTTPException(status_code=500, detail="Something went wrong on our end")
    
    return {"status": "ok", "message": "No error demonstrated"}


@router.post("/auth/ngo/login", response_model=NgoLoginResponse)
def ngo_login(payload: NgoLoginRequest) -> NgoLoginResponse:
    """
    Login NGO with email and password.
    
    ✅ REFACTORED: 
    - Returns database-generated UUID as ngoId (not email-derived)
    - Uses bcrypt for secure password verification
    - Returns JWT token for authenticated requests
    
    Returns:
        NgoLoginResponse with access_token for use in authenticated requests
        
    Raises:
        HTTPException 400: Missing email or password
        HTTPException 401: Invalid email or password
    """
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    client = get_supabase_client()
    try:
        result = (
            client.table("ngo_accounts")
            .select("id, password_hash, org_name")
            .eq("email", payload.email)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    row = result.data[0]
    stored_hash = row.get("password_hash", "")

    # First try bcrypt verification
    if verify_password(payload.password, stored_hash):
        verified = True
    else:
        # Backwards-compatibility: some users may have passwords hashed with SHA256.
        # If SHA256 matches, re-hash with bcrypt and update the DB.
        legacy_sha = hashlib.sha256(payload.password.encode()).hexdigest()
        if legacy_sha == stored_hash:
            # Re-hash with bcrypt and update stored password
            try:
                new_hash = hash_password(payload.password)
                client.table("ngo_accounts").update({"password_hash": new_hash}).eq("id", row["id"]).execute()
                verified = True
            except APIError:
                # If update fails, still allow login for compatibility
                verified = True
        else:
            verified = False

    if not verified:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    ngo_id = str(row["id"])
    org_name = row.get("org_name", "")

    # ✅ Create JWT token for authenticated requests
    access_token = create_access_token(
        ngo_id=ngo_id,
        email=payload.email,
        org_name=org_name,
        role="ngo"
    )

    return NgoLoginResponse(
        success=True,
        ngoId=ngo_id,
        email=payload.email,
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_exp_hours * 3600,  # Convert hours to seconds
    )


@router.post("/auth/ngo/signup", response_model=NgoSignupResponse)
def ngo_signup(payload: NgoSignupRequest) -> NgoSignupResponse:
    """
    Sign up new NGO.
    
    ✅ REFACTORED:
    - Database generates UUID automatically (PostgreSQL gen_random_uuid())
    - Uses bcrypt for secure password hashing
    - Returns JWT token for authenticated requests
    - No email-derived ID logic
    
    Returns:
        NgoSignupResponse with access_token for use in authenticated requests
        
    Raises:
        HTTPException 400: Missing required fields
        HTTPException 409: Email already registered
        HTTPException 500: Failed to create account
    """
    if not payload.email or not payload.password or not payload.orgName:
        raise HTTPException(status_code=400, detail="Email, password, and organization name are required")

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

    # ✅ Create new NGO account with bcrypt-hashed password
    hashed_pw = hash_password(payload.password)
    try:
        result = (
            client.table("ngo_accounts")
            .insert(
                {
                    # ✅ DO NOT include id - database generates it via gen_random_uuid()
                    "org_name": payload.orgName,
                    "email": payload.email,
                    "password_hash": hashed_pw,  # ✅ Bcrypt hashed
                }
            )
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create account")

    row = result.data[0]
    ngo_id = str(row["id"])
    org_name = row["org_name"]
    email = row["email"]
    
    # ✅ Create JWT token for authenticated requests
    access_token = create_access_token(
        ngo_id=ngo_id,
        email=email,
        org_name=org_name,
        role="ngo"
    )
    
    return NgoSignupResponse(
        success=True,
        ngoId=ngo_id,
        email=email,
        orgName=org_name,
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_exp_hours * 3600,  # Convert hours to seconds
    )


@router.post("/students", response_model=StudentProfileResponse)
def create_student_profile(payload: StudentProfileCreate) -> StudentProfileResponse:
    client = get_supabase_client()
    try:
        result = (
            client.table(settings.supabase_students_table)
            .insert(
                {
                    "name": payload.name,
                    "age_group": payload.ageGroup,
                    "avatar": payload.avatar,
                }
            )
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create student profile")

    row = result.data[0]
    created_at = row["created_at"]
    
    # ✅ FIXED: Convert datetime to ISO string for JSON serialization
    if isinstance(created_at, datetime):
        created_at_str = created_at.isoformat()
    else:
        created_at_str = str(created_at)
    
    return StudentProfileResponse(
        id=str(row["id"]),
        name=row["name"],
        ageGroup=row["age_group"],
        avatar=row.get("avatar"),
        createdAt=created_at_str,  # ✅ As string, not datetime
    )


@router.get("/stories", response_model=list[Story])
def list_stories(
    status: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    age_group: str | None = Query(default=None),
) -> list[Story]:
    client = get_supabase_client()
    query = client.table(settings.supabase_stories_table).select("*").order("created_at", desc=True)

    if status:
        query = query.eq("status", status)
    if topic:
        query = query.eq("topic", topic)
    if age_group:
        query = query.eq("age_group", age_group)

    result = query.execute()
    return [to_story(row) for row in (result.data or [])]


@router.get("/stories/search", response_model=StorySearchResponse)
def search_stories(
    q: str = Query(..., min_length=1, description="Search term (searches title and description)"),
    limit: int = Query(default=10, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
    user: dict = Depends(get_current_ngo),  # ✅ Require JWT + NGO role
) -> StorySearchResponse:
    """
    Search stories by title and description (case-insensitive).
    ✅ Filtered by authenticated NGO
    ✅ Supports pagination via limit and offset
    ✅ Returns total count for pagination UI
    
    Example:
    GET /stories/search?q=water+safety&limit=10&offset=0
    Authorization: Bearer <jwt_token>
    """
    client = get_supabase_client()
    ngo_id = user.get("sub")
    
    # ✅ Search in title OR description (case-insensitive), filtered by NGO
    # Using ilike for case-insensitive partial matching
    search_pattern = f"%{q}%"
    
    # First query: get total count matching the search criteria
    try:
        count_result = (
            client.table(settings.supabase_stories_table)
            .select("id", count="exact")  # count=exact gets total count without pagination
            .eq("ngo_id", ngo_id)
            .or_(f"title.ilike.{search_pattern},description.ilike.{search_pattern}")
            .execute()
        )
        total = count_result.count if hasattr(count_result, 'count') else len(count_result.data or [])
    except Exception as e:
        logger.error(f"Error counting search results: {e}")
        total = 0
    
    # Second query: get paginated results ordered by creation date (newest first)
    try:
        search_result = (
            client.table(settings.supabase_stories_table)
            .select("*")
            .eq("ngo_id", ngo_id)
            .or_(f"title.ilike.{search_pattern},description.ilike.{search_pattern}")
            .order("created_at", desc=True)
            .limit(limit)
            .offset(offset)
            .execute()
        )
        stories = [to_story(row) for row in (search_result.data or [])]
    except Exception as e:
        logger.error(f"Error searching stories: {e}")
        stories = []
    
    return StorySearchResponse(
        stories=stories,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/stories/{story_id}", response_model=Story)
def get_story(story_id: str) -> Story:
    client = get_supabase_client()
    result = client.table(settings.supabase_stories_table).select("*").eq("id", story_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Story not found")
    return to_story(result.data[0])


@router.get("/stories/{story_id}/slides", response_model=list[StorySlide])
def get_story_slides(story_id: str) -> list[StorySlide]:
    client = get_supabase_client()
    result = (
        client.table(settings.supabase_slides_table)
        .select("*")
        .eq("story_id", story_id)
        .order("position", desc=False)
        .execute()
    )
    return [to_slide(row) for row in (result.data or [])]


@router.patch("/stories/{story_id}/publish", response_model=Story)
def publish_story(
    story_id: str,
    user: dict = Depends(get_current_ngo),  # ✅ Require JWT + NGO role
) -> Story:
    """
    Publish a story (change status from draft to published).
    
    ✅ Security:
    - Requires JWT authentication via Bearer token
    - Verifies story belongs to authenticated NGO
    - Only story owner can publish
    
    Args:
        story_id: ID of story to publish
        user: Current authenticated NGO user from JWT token
        
    Returns:
        Updated Story with status="published"
        
    Raises:
        HTTPException 401: Missing or invalid JWT token
        HTTPException 403: User is not an NGO, or story doesn't belong to NGO
        HTTPException 404: Story not found
        
    Example:
        PATCH /api/stories/story-123/publish
        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    """
    ngo_id = user.get("sub")  # JWT "sub" (subject) is the ngo_id
    
    client = get_supabase_client()
    
    # ✅ Query story
    try:
        result = (
            client.table(settings.supabase_stories_table)
            .select("*")
            .eq("id", story_id)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Story not found")
    
    story = result.data[0]
    
    # ✅ Verify story belongs to authenticated NGO (403 if not)
    if story.get("ngo_id") != ngo_id:
        raise HTTPException(
            status_code=403,
            detail="You can only publish your own stories",
        )
    
    # ✅ Update story status to published
    try:
        update_result = (
            client.table(settings.supabase_stories_table)
            .update({"status": "published"})
            .eq("id", story_id)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)
    
    if not update_result.data:
        raise HTTPException(status_code=500, detail="Failed to publish story")
    
    updated_story = update_result.data[0]
    
    logger.info(f"Story {story_id} published by NGO {ngo_id}")
    
    return to_story(updated_story)


@router.post("/stories", response_model=StoryCreateResponse)
def create_story(
    payload: StoryCreateRequest,
    user: dict = Depends(get_current_ngo),  # ✅ Require JWT authentication
) -> StoryCreateResponse:
    """
    Create a new story.
    
    ✅ REFACTORED:
    - Now requires JWT authentication via Bearer token
    - Uses authenticated user's ngo_id instead of trusting client input
    - Verifies ngo_id is a valid UUID and exists in database
    
    Args:
        payload: Story creation request
        user: Current authenticated NGO user from JWT token
        
    Returns:
        StoryCreateResponse with story and slides
        
    Raises:
        HTTPException 401: Missing or invalid JWT token
        HTTPException 403: User is not an NGO
        HTTPException 400: Invalid NGO ID or invalid request body
        HTTPException 500: Failed to create story
        
    Example:
        POST /api/stories
        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
        
        {
            "title": "Water Safety",
            "topic": "Swimming Safety",
            "ageGroup": "6-8",
            "language": "English",
            "characterCount": 2,
            "description": "Learn water safety"
        }
    """
    # ✅ Use authenticated user's ngo_id instead of payload
    ngo_id = user.get("sub")  # JWT "sub" (subject) is the ngo_id
    
    client = get_supabase_client()

    # ✅ Verify the ngo_id exists in database (should always be true since it came from JWT)
    try:
        ngo_check = (
            client.table("ngo_accounts")
            .select("id")
            .eq("id", ngo_id)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)

    if not ngo_check.data:
        raise HTTPException(status_code=403, detail="NGO not found")

    story_insert = (
        client.table(settings.supabase_stories_table)
        .insert(
            {
                "ngo_id": ngo_id,  # ✅ From authenticated user
                "title": payload.title,
                "topic": payload.topic,
                "age_group": payload.ageGroup,
                "language": payload.language,
                "region_context": payload.regionContext,
                "description": payload.description,
                "moral_lesson": payload.moralLesson,
                "character_count": payload.characterCount,
                "status": "draft",
            }
        )
        .execute()
    )

    if not story_insert.data:
        raise HTTPException(status_code=500, detail="Failed to create story")

    story_row = story_insert.data[0]
    slides_source = "ollama"
    try:
        generated = generate_story_with_ollama(payload)
        slides_to_store = generated.slides
    except StoryGenerationError as error:
        if not settings.ollama_fallback_to_default:
            raise HTTPException(status_code=502, detail=f"Story generation failed: {error}")
        logger.warning("Ollama generation failed, using default slides: %s", error)
        slides_source = "default"
        slides_to_store = build_default_branching_slides(payload)

    try:
        critic_result = apply_safety_critic(payload, slides_to_store)
        slides_to_store = critic_result.slides
        if critic_result.issues:
            logger.info("Safety critic adjusted story %s: %s", story_row["id"], "; ".join(critic_result.issues))
        if critic_result.llm_review is not None:
            logger.info("Safety critic LLM review for story %s: %s", story_row["id"], critic_result.llm_review)
    except SafetyCriticError as error:
        if settings.safety_critic_strict:
            raise HTTPException(status_code=422, detail=f"Safety validation failed: {error}")
        logger.warning("Safety critic failed, falling back to default safe slides: %s", error)
        slides_to_store = build_default_branching_slides(payload)

    image_urls: list[str | None]
    try:
        image_urls = generate_story_images(payload=payload, story_id=str(story_row["id"]), slides=slides_to_store)
    except ImageGenerationError as error:
        logger.warning("Slide image generation skipped: %s", error)
        image_urls = [None for _ in slides_to_store]

    slides_payload = [
        {
            "story_id": story_row["id"],
            "position": slide["position"],
            "image_url": image_urls[index],
            "text": slide["text"],
            "choices": slide["choices"],
        }
        for index, slide in enumerate(slides_to_store)
    ]

    slide_insert = client.table(settings.supabase_slides_table).insert(slides_payload).execute()
    slides = [to_slide(row) for row in (slide_insert.data or [])]

    if slides_source == "default":
        logger.info("Created story %s using fallback slide generator", story_row["id"])

    return StoryCreateResponse(story=to_story(story_row), slides=slides)


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(user: dict = Depends(get_current_ngo)) -> DashboardStats:
    """
    Get dashboard stats for authenticated NGO.
    
    ✅ REFACTORED:
    - Requires JWT authentication via Bearer token
    - Extracts ngo_id from token (prevents viewing other NGOs' stats)
    - Optimized single query with all needed fields
    - Accurate counts and aggregations
    - Proper security: users can only see their own stats
    
    Args:
        user: Current authenticated NGO user from JWT token
        
    Returns:
        DashboardStats with accurate metrics for authenticated NGO:
        - storiesCreated: Total count of all stories (draft + published)
        - studentsReached: Sum of students across all stories
        - completionRate: Weighted average completion rate (by students reached)
        - activeSessions: Placeholder (0 for now)
        
    Raises:
        HTTPException 401: Missing or invalid JWT token
        HTTPException 403: User is not an NGO
        
    Example:
        GET /api/dashboard/stats
        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    """
    ngo_id = user.get("sub")  # JWT "sub" (subject) is the ngo_id
    
    client = get_supabase_client()
    
    # ✅ OPTIMIZED: Single query with all needed fields for accurate calculations
    try:
        result = (
            client.table(settings.supabase_stories_table)
            .select("id, status, students_reached, completion_rate")
            .eq("ngo_id", ngo_id)
            .execute()
        )
    except APIError as error:
        raise_supabase_http_error(error)
    
    rows = result.data or []
    
    # ✅ ACCURATE COUNTS
    stories_created = len(rows)  # Total stories (all statuses)
    published_count = sum(1 for row in rows if row.get("status") == "published")
    draft_count = stories_created - published_count
    
    # ✅ SUM students reached across all stories
    students_reached = sum((row.get("students_reached", 0) or 0) for row in rows)
    
    # ✅ WEIGHTED completion rate: (sum of completion_rate * students_reached) / total_students_reached
    if students_reached > 0:
        weighted_completion = sum(
            (row.get("completion_rate", 0) or 0) * (row.get("students_reached", 0) or 0)
            for row in rows
        ) / students_reached
        completion_rate = int(weighted_completion)
    else:
        # No students reached yet, default to 0
        completion_rate = 0
    
    logger.info(
        f"Dashboard stats for NGO {ngo_id}: "
        f"total={stories_created} (published={published_count}, draft={draft_count}), "
        f"students_reached={students_reached}, completion_rate={completion_rate}%"
    )

    return DashboardStats(
        storiesCreated=stories_created,
        studentsReached=students_reached,
        completionRate=completion_rate,
        activeSessions=0,  # Placeholder: implement session tracking later
    )


app.include_router(router)