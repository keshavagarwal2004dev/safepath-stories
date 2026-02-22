"""
JWT Authentication and Authorization Module

Provides:
- Bcrypt password hashing and verification
- JWT token generation and verification
- FastAPI middleware for protected routes
- User extraction from tokens
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
import bcrypt
import logging

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Security scheme for Swagger docs
security = HTTPBearer()


# ============================================================================
# PASSWORD HASHING (Bcrypt)
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password (bcrypt hash)
        
    Example:
        >>> hashed = hash_password("mypassword123")
        >>> # $2b$12$... (bcrypt hash)
    """
    # Use 10 rounds for bcrypt (cost factor)
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against its bcrypt hash.
    
    Args:
        password: Plain text password to verify
        hashed: Bcrypt hash to check against
        
    Returns:
        True if password matches, False otherwise
        
    Example:
        >>> hashed = hash_password("mypassword123")
        >>> verify_password("mypassword123", hashed)
        True
        >>> verify_password("wrongpassword", hashed)
        False
    """
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


# ============================================================================
# JWT TOKEN MANAGEMENT
# ============================================================================

class TokenPayload:
    """Represents the payload inside a JWT token."""
    
    def __init__(self, ngo_id: str, email: str, org_name: str, role: str = "ngo"):
        self.ngo_id = ngo_id
        self.email = email
        self.org_name = org_name
        self.role = role
        self.iat = datetime.now(timezone.utc)
        self.exp = self.iat + timedelta(hours=settings.jwt_exp_hours)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JWT encoding."""
        return {
            "sub": self.ngo_id,  # Subject (user ID)
            "email": self.email,
            "org_name": self.org_name,
            "role": self.role,
            "iat": self.iat,
            "exp": self.exp,
        }


def create_access_token(ngo_id: str, email: str, org_name: str, role: str = "ngo") -> str:
    """
    Create a JWT access token.
    
    Args:
        ngo_id: NGO ID (UUID)
        email: NGO email
        org_name: Organization name
        role: User role (default: "ngo")
        
    Returns:
        Encoded JWT token
        
    Example:
        >>> token = create_access_token(
        ...     ngo_id="550e8400-e29b-41d4-a716-446655440000",
        ...     email="ngo@example.com",
        ...     org_name="My NGO"
        ... )
        >>> # eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    """
    payload = TokenPayload(ngo_id=ngo_id, email=email, org_name=org_name, role=role)
    encoded = jwt.encode(
        payload.to_dict(),
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return encoded


def verify_access_token(token: str) -> Dict[str, Any]:
    """
    Verify and decode a JWT access token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload as dictionary
        
    Raises:
        HTTPException: If token is invalid or expired
        
    Example:
        >>> payload = verify_access_token(token)
        >>> print(payload["ngo_id"])
        550e8400-e29b-41d4-a716-446655440000
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )


# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================

async def get_current_user(credentials = Depends(security)) -> Dict[str, Any]:
    """
    FastAPI dependency to extract and verify current user from Bearer token.
    
    Use this in route parameters to require authentication:
        
    Example:
        @router.get("/protected")
        def protected_route(user: Dict[str, Any] = Depends(get_current_user)):
            return {"message": f"Hello {user['email']}"}
    
    Args:
        credentials: HTTP Bearer credentials from HTTPBearer security
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException 401: If token is missing or invalid
        HTTPException 403: If user doesn't have required role
    """
    token = credentials.credentials
    return verify_access_token(token)


async def get_current_ngo(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    FastAPI dependency to extract current NGO user and verify role.
    
    Use this for NGO-only routes:
        
    Example:
        @router.get("/ngo/dashboard")
        def ngo_dashboard(ngo: Dict[str, Any] = Depends(get_current_ngo)):
            return {"org_name": ngo["org_name"]}
    
    Args:
        user: Current user from get_current_user
        
    Returns:
        User payload (verified to be NGO role)
        
    Raises:
        HTTPException 403: If user is not an NGO
    """
    if user.get("role") != "ngo":
        raise HTTPException(
            status_code=403,
            detail="Only NGO accounts can access this resource",
        )
    return user


# ============================================================================
# MIDDLEWARE (Optional - for logging/monitoring)
# ============================================================================

class AuthMiddleware:
    """Middleware to track authenticated requests (optional)."""
    
    async def __call__(self, request: Request, call_next):
        """Log authentication info for monitoring."""
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                token = auth_header[7:]  # Remove "Bearer " prefix
                payload = verify_access_token(token)
                request.state.user = payload
                logger.info(f"Authenticated request from NGO: {payload.get('email')}")
            except HTTPException:
                # Invalid token, but don't block - let the route handle it
                pass
        
        response = await call_next(request)
        return response


# ============================================================================
# TOKEN RESPONSE MODELS (use in schemas.py)
# ============================================================================

from pydantic import BaseModel

class Token(BaseModel):
    """JWT access token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = settings.jwt_exp_hours * 3600  # seconds


class TokenData(BaseModel):
    """Decoded token payload."""
    ngo_id: str
    email: str
    org_name: str
    role: str
