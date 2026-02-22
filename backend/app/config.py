from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    debug: bool = True  # ✅ Set to False in production to hide error details
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080"

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None

    supabase_stories_table: str = "stories"
    supabase_slides_table: str = "story_slides"
    supabase_students_table: str = "student_profiles"

    ollama_enabled: bool = True
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model_planner: str = "hf.co/mistralai/Mistral-7B-Instruct-v0.3"
    ollama_model_story: str = "hf.co/mistralai/Mistral-7B-Instruct-v0.3"
    ollama_request_timeout_seconds: int = 120
    ollama_fallback_to_default: bool = True

    safety_critic_enabled: bool = True
    safety_critic_strict: bool = False
    safety_critic_max_text_length: int = 320
    safety_critic_max_scary_terms_per_slide: int = 2
    safety_critic_enable_llm_review: bool = False
    safety_critic_review_model: str = "hf.co/mistralai/Mistral-7B-Instruct-v0.3"

    backend_public_base_url: str = "http://127.0.0.1:8000"
    generated_images_dir: str = "generated_images"
    generated_images_url_path: str = "generated-images"

    sd15_enabled: bool = False
    sd15_model_id: str = "runwayml/stable-diffusion-v1-5"
    sd15_num_inference_steps: int = 8
    sd15_guidance_scale: float = 6.0
    sd15_width: int = 384
    sd15_height: int = 384

    jwt_secret_key: str = "your-secret-key-change-in-production"  # ⚠️ Must be set via .env in production
    jwt_algorithm: str = "HS256"
    jwt_exp_hours: int = 24

    @property
    def supabase_key(self) -> str | None:
        return self.supabase_service_role_key or self.supabase_anon_key

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()