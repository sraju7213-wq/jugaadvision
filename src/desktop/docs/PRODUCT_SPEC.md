# JugaadVision — Product Specification

> **Status:** Phase 1–3 complete (product foundation, domain layer, native shell scaffolding).
> **Platform:** Linux desktop (retargeted from the original Windows/WinUI 3 spec — see §0).

---

## 0. Platform Decision

The original specification targeted **Windows** with WinUI 3, the Windows App SDK, and MSIX
packaging. That target was changed to **Linux** for two reasons:

1. **WinUI 3 and MSIX cannot be built on a Linux machine.** The development host is Arch Linux,
   so the `App` project would have been permanently unverifiable — it could not compile, could
   not be tested, and could not be run.
2. **Everything then becomes testable.** With Avalonia the entire solution — including the UI —
   builds, tests, publishes, and runs on the development machine.

The UI framework is **Avalonia 12.1.3** rather than WinUI 3. This is a deliberate choice, not a
compromise: Avalonia is cross-platform, so C#, .NET, XAML, MVVM and DI all survive the change
intact, and the same solution still runs on Windows later if this becomes a permanent target.
Every non-negotiable from the original spec is preserved except the Windows-specific ones, which
have direct Linux equivalents documented in
[PLATFORM_INTEGRATION.md](PLATFORM_INTEGRATION.md).

| Original (Windows) | Now (Linux) |
|---|---|
| WinUI 3 + Windows App SDK | Avalonia 12.1.3 |
| MSIX installer | AppImage / tar.gz (self-contained publish) |
| Windows Credential Manager + DPAPI | Secret Service (libsecret), AES-256-GCM file fallback |
| System tray (Win32) | StatusNotifier / AppIndicator |
| File associations (registry) | XDG desktop entry + `xdg-mime` |
| Win32 `*_Windows` project | `JugaadVision.Platform` |

## 1. Vision

JugaadVision is a professional **Linux desktop** AI creative and model-management workstation.
It combines AI model discovery, downloading, installation, management, local AI runtime
management, cloud AI providers, AI generation workflows, creative tools, asset management,
projects, generation history, system/hardware monitoring, and background task management into a
single native desktop application.

**Philosophy:** Local-first, desktop-first, AI-first.

## 2. Target Users

| Segment | Description | Primary Needs |
|---------|-------------|---------------|
| Creative Professionals | Artists, designers, filmmakers using AI tools daily | Model flexibility, quality control, batch workflows |
| Developers / Makers | Technical users comfortable with models, runtimes, APIs | Local model hosting, custom endpoints, CLI integration |
| Power End Users | Enthusiasts who want local AI without web dependencies | Offline capability, easy model management, system monitoring |
| Enterprise Teams | Teams managing shared model libraries and provider keys | Centralized config, audit trails, secure key storage |

## 3. Core Use Cases

### UC-01: Discover and Download a Model
- User searches HuggingFace for a GGUF model
- User sees results with real metadata (size, quantization, downloads, license)
- User selects a file, clicks Download
- Download runs in background, UI stays responsive
- User can pause, resume, cancel the download
- On completion, model appears in Installed tab

### UC-02: Run Local AI Generation
- User selects a locally-installed GGUF model
- User enters a prompt, configures parameters
- User clicks Generate
- Model loads in background (progress visible)
- Inference runs on a background thread, UI never freezes
- Result appears in preview, can be saved to Library and History

### UC-03: Use Cloud AI Provider
- User configures an API key for OpenRouter (or HuggingFace, OpenAI-compatible, etc.)
- Key is stored in the Secret Service keyring (libsecret), never in plaintext
- User tests connection to verify
- User selects the provider + model in the Generate workspace
- Generation runs via REST API with automatic retries and fallback

### UC-04: Manage Projects
- User creates a new project
- Project persists prompts, selected model, provider, settings, and assets
- User saves project as `.jgvproj` on the Linux filesystem
- Project appears in Recent Projects on Home
- Opening a `.jgvproj` file launches JugaadVision and loads the project
  (via an XDG desktop entry; see [PLATFORM_INTEGRATION.md](PLATFORM_INTEGRATION.md))

### UC-05: Browse Generation History
- User navigates to History
- All past generations are listed (stored in SQLite)
- User can see prompt, model, provider, parameters, seed, output location
- User can regenerate, reuse settings, copy prompt, open output file, or delete

### UC-06: Work Offline
- With no internet connection, the app does not crash
- Local model management, generation, projects, library, history all work
- HuggingFace search and cloud generation are unavailable
- Offline state is clearly communicated in the UI

### UC-07: Monitor System and Tasks
- Home screen shows CPU, GPU, VRAM, RAM, disk space
- Home screen shows active model, runtime status
- Tasks view shows all background operations with live progress
- User can cancel or retry tasks from the Tasks view

## 4. MVP Definition (First Usable Version)

### Must Have
- Native Avalonia desktop shell with sidebar navigation
- Home screen with quick actions, recent projects/generations, system info
- Generate workspace (3-panel: inputs / preview / settings)
- Model discovery via HuggingFace API
- Model downloads with pause/resume/retry
- Installed model manager (load/unload/inspect/remove)
- Local GGUF inference via llama.cpp (CPU, bundled)
- Cloud provider support (OpenRouter, HuggingFace, OpenAI-compatible, Custom)
- API key security (Secret Service / libsecret)
- SQLite database for history, projects, library, models, tasks
- Library (grid/list, search, sort, filter, favorites, context menu)
- Projects (`.jgvproj`, save/load/recent)
- Generation history
- Global task manager
- Global search (Ctrl+K) + command palette
- Settings (all sections: General, Models, AI Providers, Generation, Hardware, Notifications, Privacy, Advanced)
- Hardware detection (CPU, GPU, VRAM, RAM, disk)
- Linux desktop integration (notifications, tray, drag/drop, file associations, native file pickers)
- Offline handling
- Error UX with actionable dialogs

### Should Have (Post-MVP)
- GPU acceleration for llama.cpp (CUDA/Vulkan)
- Ollama / LM Studio runtime detection
- Image generation workflows (Stable Diffusion, etc.)
- Audio generation
- LLM chat interface
- Workflow builder / batch processing
- LoRA management
- Update system
- AppImage installer + desktop entry

### Won't Have (MVP)
- Mobile app (out of scope — this is a Linux desktop app)
- Web dashboard
- Third-party plugin marketplace

## 5. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Startup time | < 2 seconds (after first run, cached) |
| DPI scaling | 100%, 125%, 150%, 200% (handled by the Wayland/X11 compositor scale) |
| Window sizes | 1280x720 through 4K (enforced as `MinWidth`/`MinHeight` in the shell) |
| Offline support | Full local functionality without internet |
| API key security | Never in plaintext, never in logs, never in the database |
| Model file execution | Never auto-execute downloaded binaries |
| Data persistence | Survives app restart and uninstall (user content in the XDG user data dir) |
| Build | Remains compilable throughout development (`TreatWarningsAsErrors=true`) |
| Test coverage | UI covered by headless Avalonia tests, runnable on the build machine |

## 6. Relationship to the Web App

JugaadVision Desktop is a **separate product** from the existing `jugaadvision.vercel.app` React
web app. It is not a port, a wrapper, or an embed of it, and the two do not share a runtime, a
database, or a codebase. The desktop solution lives in `src/desktop/` with its own solution file
and its own dependency graph.
