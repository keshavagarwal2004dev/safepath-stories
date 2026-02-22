import hashlib
import re
from pathlib import Path
from typing import Any

from app.config import BASE_DIR, get_settings
from app.schemas import StoryCreateRequest


class ImageGenerationError(RuntimeError):
    pass


_PIPELINE: Any = None
_TORCH: Any = None


def _slugify(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return safe.strip("-") or "scene"


def _load_pipeline() -> tuple[Any, Any]:
    global _PIPELINE, _TORCH

    if _PIPELINE is not None and _TORCH is not None:
        return _PIPELINE, _TORCH

    try:
        import torch  # type: ignore[import-not-found]
        from diffusers import StableDiffusionPipeline  # type: ignore[import-not-found]
    except Exception as exc:
        raise ImageGenerationError("Stable Diffusion dependencies are not installed") from exc

    settings = get_settings()
    try:
        pipeline = StableDiffusionPipeline.from_pretrained(settings.sd15_model_id)
        pipeline = pipeline.to("cpu")
        if hasattr(pipeline, "enable_attention_slicing"):
            pipeline.enable_attention_slicing()
    except Exception as exc:
        raise ImageGenerationError("Failed to load Stable Diffusion 1.5 model") from exc

    _PIPELINE = pipeline
    _TORCH = torch
    return _PIPELINE, _TORCH


def _build_image_prompt(payload: StoryCreateRequest, slide: dict[str, Any]) -> str:
    text = str(slide.get("text", "")).strip()
    text = text[:300]
    region = payload.regionContext or "Indian neighborhood"

    return (
        f"Children's safety story illustration, warm colors, friendly cartoon style, "
        f"non-violent, educational scene, age group {payload.ageGroup}, topic {payload.topic}, "
        f"setting {region}, scene: {text}."
    )


def _image_output_dir() -> Path:
    settings = get_settings()
    output_dir = BASE_DIR / settings.generated_images_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def _public_image_url(filename: str) -> str:
    settings = get_settings()
    base = settings.backend_public_base_url.rstrip("/")
    path = settings.generated_images_url_path.strip("/")
    return f"{base}/{path}/{filename}"


def generate_story_images(
    payload: StoryCreateRequest,
    story_id: str,
    slides: list[dict[str, Any]],
) -> list[str | None]:
    settings = get_settings()
    if not settings.sd15_enabled:
        # ✅ Return placeholder image URLs with gradients and readable text
        # Using loremflickr placeholders that are more reliable
        placeholder_urls = []
        topics_images = {
            "water": ["blue", "cyan", "navy"],
            "fire": ["red", "orange", "yellow"],
            "stranger": ["purple", "violet", "magenta"],
            "bullying": ["green", "emerald", "lime"],
            "body": ["pink", "rose", "coral"],
        }
        
        # Find relevant colors based on topic
        topic_lower = payload.topic.lower() if payload.topic else ""
        for key in topics_images.keys():
            if key in topic_lower:
                colors = topics_images[key]
                break
        else:
            colors = ["blue", "purple", "green", "orange", "red"]
        
        for index in range(len(slides)):
            color = colors[index % len(colors)]
            # Use a more reliable placeholder with background color
            placeholder_url = f"https://images.unsplash.com/photo-1557804506-669714d2e9d8?w=400&h=300&fit=crop"
            placeholder_urls.append(placeholder_url)
        return placeholder_urls

    pipeline, torch = _load_pipeline()
    output_dir = _image_output_dir()
    image_urls: list[str | None] = []

    for index, slide in enumerate(slides):
        position = int(slide.get("position", index + 1))
        prompt = _build_image_prompt(payload, slide)
        prompt_hash = hashlib.sha1(prompt.encode("utf-8")).hexdigest()[:10]
        filename = f"{story_id}-{position}-{_slugify(payload.topic)}-{prompt_hash}.png"
        output_path = output_dir / filename

        if not output_path.exists():
            seed_source = f"{story_id}:{position}:{payload.topic}"
            seed = int(hashlib.sha1(seed_source.encode("utf-8")).hexdigest()[:8], 16)
            generator = torch.Generator(device="cpu").manual_seed(seed)

            try:
                result = pipeline(
                    prompt=prompt,
                    num_inference_steps=settings.sd15_num_inference_steps,
                    guidance_scale=settings.sd15_guidance_scale,
                    width=settings.sd15_width,
                    height=settings.sd15_height,
                    generator=generator,
                )
                result.images[0].save(output_path)
            except Exception as exc:
                raise ImageGenerationError(f"Image generation failed for slide {position}") from exc

        image_urls.append(_public_image_url(filename))

    return image_urls
