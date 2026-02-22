import json
import re
from dataclasses import dataclass
from typing import Any
from urllib import error as url_error
from urllib import request as url_request

from app.config import get_settings
from app.schemas import StoryCreateRequest


@dataclass
class StoryGenerationResult:
    context: dict[str, Any]
    slides: list[dict[str, Any]]


class StoryGenerationError(RuntimeError):
    pass


def _extract_first_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        raise StoryGenerationError("Model returned empty response")

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise StoryGenerationError("No JSON object found in model response")

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise StoryGenerationError("Invalid JSON returned by model") from exc

    if not isinstance(parsed, dict):
        raise StoryGenerationError("Model response JSON root must be an object")
    return parsed


def _ollama_generate_json(model: str, prompt: str) -> dict[str, Any]:
    settings = get_settings()
    endpoint = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = url_request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with url_request.urlopen(req, timeout=settings.ollama_request_timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except (url_error.URLError, TimeoutError) as exc:
        raise StoryGenerationError("Cannot reach Ollama server") from exc

    try:
        response_payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise StoryGenerationError("Invalid response from Ollama") from exc

    response_text = response_payload.get("response", "")
    if not isinstance(response_text, str):
        raise StoryGenerationError("Unexpected Ollama payload format")

    return _extract_first_json_object(response_text)


def _parse_age_value(age_group: str) -> int:
    numbers = [int(n) for n in re.findall(r"\d+", age_group)]
    if not numbers:
        return 8
    if len(numbers) == 1:
        return numbers[0]
    return (numbers[0] + numbers[1]) // 2


def build_default_context(payload: StoryCreateRequest) -> dict[str, Any]:
    return {
        "age": _parse_age_value(payload.ageGroup),
        "location": payload.regionContext or "school playground",
        "character": {
            "skin": "brown",
            "hair": "short black",
            "clothes": "school uniform",
        },
        "topic": payload.topic,
    }


def build_default_branching_slides(payload: StoryCreateRequest) -> list[dict[str, Any]]:
    guidance_text = payload.moralLesson or "Say no, move to safety, and tell a trusted adult immediately."
    return [
        {
            "position": 1,
            "text": f"{payload.title} begins in {payload.regionContext or 'a familiar neighborhood'} where children are learning how to stay safe.",
            "choices": None,
        },
        {
            "position": 2,
            "text": f"A tricky situation appears around {payload.topic.lower()}. What should the child do?",
            "choices": [
                {"id": "a", "text": guidance_text, "correct": True},
                {"id": "b", "text": "Keep it secret and stay quiet.", "correct": False},
            ],
        },
        {
            "position": 3,
            "text": f"The child makes a safe choice and learns: {guidance_text}",
            "choices": None,
        },
    ]


def _validate_context(context: dict[str, Any], payload: StoryCreateRequest) -> dict[str, Any]:
    age = context.get("age")
    if not isinstance(age, int):
        age = _parse_age_value(payload.ageGroup)

    location = context.get("location")
    if not isinstance(location, str) or not location.strip():
        location = payload.regionContext or "school playground"

    topic = context.get("topic")
    if not isinstance(topic, str) or not topic.strip():
        topic = payload.topic

    character = context.get("character")
    if not isinstance(character, dict):
        character = {}

    skin = character.get("skin") if isinstance(character.get("skin"), str) else "brown"
    hair = character.get("hair") if isinstance(character.get("hair"), str) else "short black"
    clothes = character.get("clothes") if isinstance(character.get("clothes"), str) else "school uniform"

    return {
        "age": age,
        "location": location,
        "character": {
            "skin": skin,
            "hair": hair,
            "clothes": clothes,
        },
        "topic": topic,
    }


def _normalize_choices(raw_choices: Any) -> list[dict[str, Any]] | None:
    if raw_choices is None:
        return None
    if not isinstance(raw_choices, list):
        return None

    normalized: list[dict[str, Any]] = []
    for idx, choice in enumerate(raw_choices):
        if not isinstance(choice, dict):
            continue
        text = choice.get("text")
        correct = choice.get("correct")
        if not isinstance(text, str) or not text.strip() or not isinstance(correct, bool):
            continue

        raw_id = choice.get("id")
        if isinstance(raw_id, str) and raw_id.strip():
            choice_id = raw_id.strip()
        else:
            choice_id = chr(ord("a") + idx)

        normalized.append({"id": choice_id, "text": text.strip(), "correct": correct})

    if not normalized:
        return None
    return normalized


def _validate_and_normalize_slides(raw_payload: dict[str, Any], payload: StoryCreateRequest) -> list[dict[str, Any]]:
    raw_slides = raw_payload.get("slides")
    if not isinstance(raw_slides, list) or not raw_slides:
        raise StoryGenerationError("Model did not return valid slides list")

    slides: list[dict[str, Any]] = []
    for idx, raw_slide in enumerate(raw_slides[:8]):
        if not isinstance(raw_slide, dict):
            continue

        text = raw_slide.get("text")
        if not isinstance(text, str) or not text.strip():
            continue

        choices = _normalize_choices(raw_slide.get("choices"))
        if choices and not any(choice["correct"] for choice in choices):
            choices[0]["correct"] = True

        slides.append(
            {
                "position": idx + 1,
                "text": text.strip(),
                "choices": choices,
            }
        )

    if len(slides) < 3:
        raise StoryGenerationError("Model returned too few valid slides")

    has_branch = any(slide["choices"] for slide in slides)
    if not has_branch:
        guidance_text = payload.moralLesson or "Say no and tell a trusted adult."
        slides.insert(
            min(1, len(slides)),
            {
                "position": 2,
                "text": f"A risky moment appears about {payload.topic.lower()}. What is the safest choice?",
                "choices": [
                    {"id": "a", "text": guidance_text, "correct": True},
                    {"id": "b", "text": "Ignore warning signs and go alone.", "correct": False},
                ],
            },
        )
        slides = slides[:8]
        for index, slide in enumerate(slides):
            slide["position"] = index + 1

    return slides


def generate_story_with_ollama(payload: StoryCreateRequest) -> StoryGenerationResult:
    settings = get_settings()
    if not settings.ollama_enabled:
        raise StoryGenerationError("Ollama generation is disabled")

    planner_prompt = (
        "You are a planner that converts NGO input into child-safe structured context for a safety story. "
        "Return ONLY valid JSON with this exact shape: "
        '{"age": number, "location": string, "character": {"skin": string, "hair": string, "clothes": string}, "topic": string}. '
        "Do not include markdown or extra keys.\n\n"
        f"NGO Input:\n"
        f"- title: {payload.title}\n"
        f"- topic: {payload.topic}\n"
        f"- age_group: {payload.ageGroup}\n"
        f"- language: {payload.language}\n"
        f"- region_context: {payload.regionContext or 'not provided'}\n"
        f"- character_count: {payload.characterCount}\n"
        f"- description: {payload.description}\n"
        f"- moral_lesson: {payload.moralLesson or 'not provided'}"
    )

    planner_output = _ollama_generate_json(settings.ollama_model_planner, planner_prompt)
    context = _validate_context(planner_output, payload)

    generator_prompt = (
        "You generate branching, age-appropriate child safety stories as JSON. "
        "Return ONLY valid JSON with this exact shape: "
        '{"slides": [{"position": number, "text": string, "choices": null | [{"id": string, "text": string, "correct": boolean}]}]}. '
        "Rules: 4 to 6 slides, simple language, at least one slide with exactly 2 choices (one correct=true and one correct=false), "
        "no violence, focus on safe behavior and trusted adults, output in the requested language.\n\n"
        f"Story metadata:\n"
        f"- title: {payload.title}\n"
        f"- topic: {payload.topic}\n"
        f"- age_group: {payload.ageGroup}\n"
        f"- language: {payload.language}\n"
        f"- moral_lesson: {payload.moralLesson or 'Use safe choices and tell a trusted adult.'}\n"
        f"- region_context: {payload.regionContext or 'not provided'}\n"
        f"- context_json: {json.dumps(context)}"
    )

    story_output = _ollama_generate_json(settings.ollama_model_story, generator_prompt)
    slides = _validate_and_normalize_slides(story_output, payload)

    return StoryGenerationResult(context=context, slides=slides)
