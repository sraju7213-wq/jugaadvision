# Creative Tool Expansion — Phased Implementation Plan

## Context
JugaadVision is a React + Vite + Tailwind creative prompt toolkit with PromptBuilder as the flagship (Creative Scientist Laboratory Apparatus). Current PromptBuilder already ships: 3-column panoramic layout, 2000-char budgeting, Fusion Lab / Quantum Mutation / Molecular Recombination, Spectral IQ quality gate, and 6 platform engines. Gaps remain across all 4 requested phases. This plan turns the brief into shippable increments without breaking `npm run build`.

## Phase 1 — Creative Tool Expansion (P1)
**Goal:** Make PromptBuilder a programmable creative IDE.

- **1A Advanced AI Integration** — Extend `services/geminiService.ts` + `aiGatewayClient` routing to support multi-persona "Creative Fusion" orchestration. Add `services/creativeFusionService.ts` that fans a concept to 3 personas (Photographer / Painter / CGI) in parallel via `aiGenerateBatch`, then fuses results with a lightweight scorer. Keep existing `aiMolecularRecombination` / `aiQuantumEntropyMutate` as local primitives; new service composes them.
- **1B Template Library** — New `services/templateLibrary.ts` (typed registry + localStorage persistence `jv-templates:v1`). Domain packs: storytelling, coding, scientific-thinking, marketing, anime/concept. Each template has `{ id, domain, title, description, body, variables: string[], forkedFrom?, author }` with `{{variable}}` interpolation + fork/clone/share (clipboard + JSON export). UI: `components/template-library/TemplateGallery.tsx` embedded as right-vault tab and standalone route.
- **1C Interactive Prompt Canvas** — New `components/prompt-builder/InteractiveCanvas.tsx`: drag-drop node canvas (no external deps — pointer events + CSS). Nodes: PromptBlock, LogicGate (AND/OR/NOT), StyleInjector, OutputMerge. Edges serialize to ordered prompt chain. Supports keyboard: arrow move, Delete, Ctrl+Z. Real-time collaboration stubbed via `services/canvasSync.ts` (BroadcastChannel → upgrade path WebSocket/Firebase).
- **1D Dynamic Context Controls** — New `components/prompt-builder/DynamicContextControls.tsx`: sliders for tone (formal↔playful), complexity (minimal↔baroque), creativity (conservative↔quantum), plus retained 2000-char Controller panel with spectral waveform. Values feed `aiGenerateText` temperature + template interpolation weights.

## Phase 2 — Accessibility Overhaul (P2)
**Goal:** WCAG 2.1 AA pass + personalization.

- **2A WCAG Compliance** — Audit `components/PromptBuilder.tsx`, `Navbar`, canvas nodes. Add ARIA roles, `aria-label`, `aria-live` for generation states, focus traps on modals, skip-link, visible focus rings (`:focus-visible`), keyboard order. Lint with `axe-core` in CI.
- **2B Customizable Interface** — Extend `services/settingsStorage.ts` + `css/design-system.css` with themes: default, high-contrast, dyslexia-friendly (OpenDyslexic toggle), font-scale, density. Reuse AppearanceSettings pipeline.
- **2C Voice Commands** — New `hooks/useVoiceCommands.ts` on top of existing `useSpeechToText`: wake-word "Hey Jugaad" → commands (save prompt, switch mode, read back). Graceful fallback when mic denied.
- **2D Guided Tours** — New `components/accessibility/GuidedTour.tsx` (joyride-lite, no deps). Step registry per route; persists completion in localStorage; respects `prefers-reduced-motion`.

## Phase 3 — Advanced Features (P3)
**Goal:** Make prompts durable, measurable, extensible.

- **3A Prompt Version Control** — New `hooks/usePromptVersion.ts` + `services/promptVersionService.ts`: append-only log per prompt `{ id, at, text, parentId, message }` stored alongside `prompt-library`. UI: timeline with diff + rollback; optional Git export (`git patch` format).
- **3B Analytics Dashboard** — New `components/analytics/AnalyticsDashboard.tsx`: local telemetry (iterations, quality grade over time, breakthrough detection = grade jump ≥2), charts with div+CSS (no chart dep). Reads `prompt-library` history.
- **3C API & Extensibility** — New `services/promptApi.ts` + `services/pluginRegistry.ts`: typed REST surface (`/api/prompts` mock via `server/ai/serverHandler.ts` wiring) + plugin manifest `{ id, hooks: ['beforeGenerate','afterGenerate'], run }`. Plugins are pure functions registered at startup — image-gen, code-interp stubs.

## Phase 4 — Testing & Iteration (P4)
**Goal:** Prove quality.

- **4A Accessibility Testing** — Add `axe-core` + Lighthouse CI script `scripts/a11y-audit.mjs`; manual checklist with screen reader (NVDA/VoiceOver) and keyboard-only flows.
- **4B Performance** — Canvas virtualization, debounced autosave (300ms), `React.memo` on chips/nodes, lazy routes already in place. Load test collaboration channel with 20 simulated peers via `k6` script (optional).
- **4C Feedback Loop** — New `components/feedback/FeedbackWidget.tsx` (floating button → POST `/api/feedback` stub → localStorage queue). Dashboard surfaces top requested template domains.

## Tech Stack Alignment
- Frontend: React 19 + TypeScript (keep), React Aria patterns borrowed without extra dep where possible.
- State: Zustand not needed yet; localStorage + lifting state covers P1–P3. Introduce only if canvas graph exceeds 50 nodes.
- AI: Claude/OpenAI via existing `aiGatewayClient` → `server/ai` router; no client keys.
- Testing: Jest + React Testing Library (unit), Playwright/Cypress (E2E later), Storybook for new canvas/template components.
- Collaboration: WebSockets/Firebase deferred; P1 ships BroadcastChannel so local multi-tab works.

## Risks & Mitigations
- Scope blowup → ship P1 as MVP slice (Template Library + Canvas + Controls) behind feature flags, then P2/P3 behind `localStorage` toggles.
- Build breakage from deps → prefer zero-dep implementations; any new dep pinned and guarded.
- A11y regressions → add `eslint-plugin-jsx-a11y` before P2 merge.

## Acceptance Criteria
- `npm run build` passes; no new `any` without reason; ARIA labels on all interactive elements.
- Template Library: create/save/fork/share + variable interpolation works end-to-end.
- Canvas: 3+ nodes chain into a composed prompt that feeds the existing generate pipeline.
- Controls: sliders visibly affect generation temperature/output variation.
- Guided tour completes without trapping focus; dashboard renders with real history.
- Modified `PromptBuilder.tsx` formatting normalized (prettier diff already staged — restored via `--no-verify` not needed).

## Sequencing (this session)
1. Commit formatting restoration (optional).
2. Land `services/templateLibrary.ts` + `TemplateGallery` + wiring into PromptBuilder vault.
3. Land `DynamicContextControls` + `CreativeFusionService` upgrade.
4. Land `InteractiveCanvas` (core).
5. Land a11y patches + GuidedTour + Voice hook.
6. Land version control + analytics + API/plugin stubs.
7. Verify build, open draft PR notes.
