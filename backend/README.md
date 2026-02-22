# FastAPI Backend (Supabase)

## 1) Create environment

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 2) Configure env

Copy `.env.example` to `.env` and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (preferred) or `SUPABASE_ANON_KEY`
- `CORS_ORIGINS` (frontend URL, default is `http://localhost:5173`)
- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL_PLANNER` and `OLLAMA_MODEL_STORY`

If you use `SUPABASE_ANON_KEY`, make sure you run `supabase_schema.sql` so required RLS policies for auth/profile flows are created.

### Local model setup (Ollama)

This backend uses a 2-step story pipeline:

1. Planner/context builder (structured JSON)
2. Story + branching slide generator (JSON slides)

Pull the requested model in Ollama:

```powershell
ollama pull hf.co/mistralai/Mistral-7B-Instruct-v0.3
```

Optional alternatives for lightweight planning/generation:

- `phi3:mini`
- `gemma2:2b`

Set model names in `.env` if you want different planner/generator models.

### Safety critic model (deterministic)

The critic step runs as a **rule-based validator** before slides are saved:

- Keyword policy filter (unsafe words are replaced)
- Tone classifier heuristic (overly scary text is softened)
- Rule engine checks (branching choices and trusted-adult guidance)

This is deterministic and safer than relying only on generative checks.

Optional second pass:

- `SAFETY_CRITIC_ENABLE_LLM_REVIEW=true` enables non-blocking Ollama review.
- Core enforcement still remains deterministic.

### Local image generation (Stable Diffusion 1.5 on CPU)

The story pipeline can generate slide images using SD 1.5 locally on CPU with low steps.

In `.env`:

- `SD15_ENABLED=true`
- `SD15_MODEL_ID=runwayml/stable-diffusion-v1-5`
- `SD15_NUM_INFERENCE_STEPS=8` (low-step default for laptops)
- `SD15_WIDTH=384`
- `SD15_HEIGHT=384`

Images are served from:

- `http://127.0.0.1:8000/generated-images/...`

Notes:

- First generation downloads model weights, so it can take time.
- If SD dependencies are missing or generation fails, story creation still succeeds without images.

## 3) Create Supabase tables

Run SQL from `supabase_schema.sql` in Supabase SQL editor.

## 4) Run API

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Health endpoint: `GET http://localhost:8000/health`

## 5) Frontend env

In project root, create `.env` with:

```env
VITE_API_BASE_URL=http://localhost:8000
```