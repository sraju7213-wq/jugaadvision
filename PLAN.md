# JugaadVision Image-to-Prompt Fix & Free Vision Model Setup — Plan

## Root-Cause Analysis (current state)

The image-to-prompt flow in JugaadVision:

```
src/components/ImageToPrompt.tsx
  → generateStructuredVisionPrompt (packages/services/src/ai-gateway/geminiService.ts)
    → aiAnalyzeVision (packages/services/src/ai-gateway/aiGatewayClient.ts)
      → POST /api/ai/vision  (services/api/src/ai/serverHandler.ts)
        → aiRouter.execute  (services/api/src/ai/router/router.ts)
          → provider order: preferredProvider → custom → openrouter
            → OpenRouterAdapter.discoverModels (free vision models: Qwen-VL, Gemini, Pixtral, etc.)
              → adapter.generate → OpenRouter /chat/completions
```

**Why it underperforms:**
- The router has only two adapters (`custom` self-hosted endpoint, `openrouter`). The free OpenRouter models (Qwen-VL, Pixtral, etc.) are slow, rate-limited, and often return hallucinated/inaccurate structured JSON.
- The structured JSON output depends on the model actually following the strict JSON schema — fragile across models.
- No per-image reference to the user's original image is kept — the prompt is generated from a compressed image blob in memory.
- The `geminiService.ts` is misnamed (it's a generic vision service, not Gemini-specific).
- The system prompt for structured vision is robust but model-agnostic; it doesn't specialize the role for accurate image-to-prompt generation.

## Goal

1. Fix image-to-prompt so it generates accurate, production-ready prompts from a given image.
2. Set up a vision model from a free site.
3. Use the user's Chrome to go to that site and generate an API key.
4. Configure the backend to use that API.
5. Test end-to-end until the flow works and returns accurate prompts.

## Approach

- **Free provider:** Hugging Face Inference API (already has `HUGGINGFACE_API_KEY` in `.env.example`). Free vision-language models: `HuggingFaceM4/idefics2-8b`, `unsloth/Llama-3.2-11B-Vision-Instruct`, `Salesforce/blip-image-captioning-large`.
- **Browser step:** Open Hugging Face tokens page in the user's Chrome via hermes browser tools, create a read-only API token.
- **Backend:** Add a `huggingface` adapter to the AI router, load `HUGGINGFACE_API_KEY` from the server environment, and wire it into the vision request path.
- **Testing:** Run a full image-to-prompt request against the configured vision model and verify the returned prompt quality.

## Phases

### Phase 1: Diagnose & Fix Prompt Accuracy (code)

1. Improve the vision-system prompt in `geminiService.ts` to specialize the role (art-director + prompt architect) and add accuracy-focused instructions.
2. Harden the JSON extraction (handle schemas + text wrapping).
3. Add a fallback quality-check on the assembled prompt (length, completeness).
4. Verify no regressions in typecheck/build.

### Phase 2: Free Vision Provider Setup (browser + backend)

1. Open Hugging Face in the user's Chrome (browser tool) → tokens page.
2. Create a read-only API token.
3. Note the token (masked in logs; keep in mind).
4. Set `HUGGINGFACE_API_KEY` in the server environment so the running API server picks it up.
5. Add `HuggingFaceAdapter` to `services/api/src/ai/adapters/` + register in `router.ts` + `keyPool.ts` + `types.ts`.
6. Add `HUGGINGFACE_API_KEY`/`CLOUDFLARE_API_TOKEN` env handling to the keyPool.
7. Rebuild the API bundle (`npm run build:api`).

### Phase 3: End-to-End Test

1. Hit `/api/ai/health` — confirm Hugging Face provider is healthy.
2. POST a test vision request (`{"prompt": "...", "imageBase64": "...", "taskType": "vision"}`) to `/api/ai/vision`.
3. Verify: response contains a structured prompt, model name, provider name.
4. If the test fails, diagnose (token, network, model name) and fix.
5. Report: provider status, latency, and a sample prompt generated from the test image.

## Verification commands

- `npm run typecheck` — TypeScript passes.
- `npm run build:api` — serverless bundle builds.
- `curl -s http://127.0.0.1:3001/api/ai/health` — health check.
- `curl -X POST ... /api/ai/vision` — image-to-prompt test.

## Risks / Notes

- The running API server on port 3001 is `freellmapi`. The actual JugaadVision serverless routes are bundled separately (`services/api/api-src/[...slug].ts`). The `freellmapi` server at 3001 is a separate custom endpoint; the JugaadVision app currently routes its `/api/*` calls to the Vercel/remote backend.
- The `.env` file contains secrets; never print them. Only the token fingerprint is logged.
- Free HF models are accessed via the Inference API (`https://api-inference.huggingface.co/models/{repo_id}`). A model like `HuggingFaceM4/idefics2-8b` returns text, not necessarily structured JSON — so the adapter must send the vision request as a chat-completions-format message and parse the text result.
