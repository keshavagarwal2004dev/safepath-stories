import json
import re
from dataclasses import dataclass
from typing import Any
from urllib import error as url_error
from urllib import request as url_request

from app.config import get_settings
from app.schemas import StoryCreateRequest


@dataclass
class SafetyCriticResult:
    slides: list[dict[str, Any]]
    issues: list[str]
    llm_review: dict[str, Any] | None = None


class SafetyCriticError(RuntimeError):
    pass


UNSAFE_REPLACEMENTS = {
    "kill": "hurt",
    "killing": "hurting",
    "dead": "unsafe",
    "blood": "danger",
    "weapon": "dangerous object",
    "gun": "dangerous object",
    "knife": "sharp object",
    "abduct": "take away",
    "kidnap": "take away",
    "nude": "inappropriate",
    "sex": "inappropriate",
}

SCARY_TERMS = {
    "kidnap",
    "abduct",
    "blood",
    "dead",
    "die",
    "weapon",
    "gun",
    "knife",
    "attack",
    "violence",
}

TRUSTED_ADULT_TERMS = {
    "trusted adult",
    "teacher",
    "parent",
    "mother",
    "father",
    "guardian",
    "caregiver",
    "police",
    "counselor",
}


def _sanitize_text(text: str) -> tuple[str, list[str]]:
    updated = text
    changes: list[str] = []

    for bad, replacement in UNSAFE_REPLACEMENTS.items():
        pattern = re.compile(rf"\\b{re.escape(bad)}\\b", flags=re.IGNORECASE)
        if pattern.search(updated):
            updated = pattern.sub(replacement, updated)
            changes.append(f"replaced unsafe term '{bad}'")

    return updated.strip(), changes


def _count_scary_terms(text: str) -> int:
    value = text.lower()
    return sum(1 for term in SCARY_TERMS if re.search(rf"\\b{re.escape(term)}\\b", value))


def _has_trusted_adult_reference(slides: list[dict[str, Any]]) -> bool:
    for slide in slides:
        text = str(slide.get("text", "")).lower()
        if any(term in text for term in TRUSTED_ADULT_TERMS):
            return True

        choices = slide.get("choices")
        if isinstance(choices, list):
            for choice in choices:
                if not isinstance(choice, dict):
                    continue
                choice_text = str(choice.get("text", "")).lower()
                if any(term in choice_text for term in TRUSTED_ADULT_TERMS):
                    return True

    return False


def _coerce_two_choice_branch(slides: list[dict[str, Any]]) -> None:
    for slide in slides:
        choices = slide.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            continue

        first_two = choices[:2]
        for index, choice in enumerate(first_two):
            if not isinstance(choice, dict):
                first_two[index] = {
                    "id": "a" if index == 0 else "b",
                    "text": "Choose the safer option.",
                    "correct": index == 0,
                }
                continue

            choice["id"] = str(choice.get("id") or ("a" if index == 0 else "b"))
            choice["text"] = str(choice.get("text") or "Choose the safer option.").strip()
            choice["correct"] = bool(choice.get("correct", index == 0))

        if first_two[0]["correct"] == first_two[1]["correct"]:
            first_two[0]["correct"] = True
            first_two[1]["correct"] = False

        slide["choices"] = first_two
        return

    slides.insert(
        min(1, len(slides)),
        {
            "position": 2,
            "text": "A risky moment appears. What is the safest choice?",
            "choices": [
                {"id": "a", "text": "Move away and tell a trusted adult.", "correct": True},
                {"id": "b", "text": "Go alone and keep it secret.", "correct": False},
            ],
        },
    )


def _run_optional_llm_review(payload: StoryCreateRequest, slides: list[dict[str, Any]]) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.safety_critic_enable_llm_review:
        return None

    endpoint = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
    prompt = (
        "You are a child-safety reviewer. Review story slides for age appropriateness and safety guidance. "
        "Return ONLY valid JSON with this shape: "
        '{"approved": boolean, "risk_flags": [string], "notes": string}. '
        "Do not include markdown.\n\n"
        f"topic: {payload.topic}\n"
        f"age_group: {payload.ageGroup}\n"
        f"slides_json: {json.dumps(slides)}"
    )

    request_payload = {
        "model": settings.safety_critic_review_model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.0},
    }

    req = url_request.Request(
        endpoint,
        data=json.dumps(request_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with url_request.urlopen(req, timeout=settings.ollama_request_timeout_seconds) as response:
            raw = response.read().decode("utf-8")
        body = json.loads(raw)
        response_text = body.get("response", "{}")
        parsed = json.loads(response_text)
        if isinstance(parsed, dict):
            return parsed
    except (url_error.URLError, json.JSONDecodeError, TimeoutError):
        return {"approved": False, "risk_flags": ["llm_review_unavailable"], "notes": "LLM review unavailable"}

    return {"approved": False, "risk_flags": ["llm_review_invalid"], "notes": "Invalid LLM review payload"}


def apply_safety_critic(payload: StoryCreateRequest, slides: list[dict[str, Any]]) -> SafetyCriticResult:
    settings = get_settings()
    if not settings.safety_critic_enabled:
        return SafetyCriticResult(slides=slides, issues=[])

    if not slides:
        raise SafetyCriticError("No slides available for safety validation")

    fixed_slides: list[dict[str, Any]] = []
    issues: list[str] = []

    for index, slide in enumerate(slides):
        text = str(slide.get("text", "")).strip()
        if not text:
            if settings.safety_critic_strict:
                raise SafetyCriticError(f"Slide {index + 1} has empty text")
            text = "The child stays calm and chooses a safe action."
            issues.append(f"slide_{index + 1}: filled missing text")

        sanitized_text, changes = _sanitize_text(text)
        issues.extend([f"slide_{index + 1}: {item}" for item in changes])

        scary_count = _count_scary_terms(sanitized_text)
        if scary_count > settings.safety_critic_max_scary_terms_per_slide:
            issues.append(f"slide_{index + 1}: tone too intense, softened")
            sanitized_text = "A confusing moment happens, but the child remembers safe rules and seeks help."

        if len(sanitized_text) > settings.safety_critic_max_text_length:
            sanitized_text = sanitized_text[: settings.safety_critic_max_text_length].rstrip() + "..."
            issues.append(f"slide_{index + 1}: trimmed long text")

        normalized = {
            "position": index + 1,
            "text": sanitized_text,
            "choices": slide.get("choices"),
        }

        raw_choices = normalized.get("choices")
        if isinstance(raw_choices, list):
            cleaned_choices: list[dict[str, Any]] = []
            for choice_idx, choice in enumerate(raw_choices[:2]):
                if not isinstance(choice, dict):
                    continue
                choice_text, choice_changes = _sanitize_text(str(choice.get("text", "")))
                issues.extend([f"slide_{index + 1}_choice_{choice_idx + 1}: {item}" for item in choice_changes])
                cleaned_choices.append(
                    {
                        "id": str(choice.get("id") or ("a" if choice_idx == 0 else "b")),
                        "text": choice_text or "Choose the safer option.",
                        "correct": bool(choice.get("correct", choice_idx == 0)),
                    }
                )
            normalized["choices"] = cleaned_choices if cleaned_choices else None

        fixed_slides.append(normalized)

    _coerce_two_choice_branch(fixed_slides)

    for idx, slide in enumerate(fixed_slides):
        slide["position"] = idx + 1

    if not _has_trusted_adult_reference(fixed_slides):
        fixed_slides[-1]["text"] = f"{fixed_slides[-1]['text']} Then the child tells a trusted adult like a parent or teacher."
        issues.append("added trusted adult guidance")

    llm_review = _run_optional_llm_review(payload, fixed_slides)

    return SafetyCriticResult(slides=fixed_slides, issues=issues, llm_review=llm_review)
