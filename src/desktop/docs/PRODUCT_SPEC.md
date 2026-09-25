# JugaadVision — Product Specification

## 1. Vision

JugaadVision is a professional Windows desktop AI creative and model-management workstation. It combines AI model discovery, downloading, installation, management, local AI runtime management, cloud AI providers, AI generation workflows, creative tools, asset management, projects, generation history, system/hardware monitoring, and background task management into a single native Windows application.

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
- Key is stored in Windows Credential Manager (DPAPI-encrypted)
- User tests connection to verify
- User selects the provider + model in the Generate workspace
- Generation runs via REST API with automatic retries and fallback

### UC-04: Manage Projects
- User creates a new project
- Project persists prompts, selected model, provider, settings, and assets
- User saves project as `.jgvproj` on Windows filesystem
- Project appears in Recent Projects on Home
- Opening a `.jgvproj` file launches JugaadVision and loads the project

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
- Native WinUI 3 desktop shell with NavigationView
- Home screen with quick actions, recent projects/generations, system info
- Generate workspace (3-panel: inputs / preview / settings)
- Model discovery via HuggingFace API
- Model downloads with pause/resume/retry
- Installed model manager (load/unload/inspect/remove)
- Local GGUF inference via llama.cpp (CPU, bundled)
- Cloud provider support (OpenRouter, HuggingFace, OpenAI-compatible, Custom)
- API key security (Windows Credential Manager)
- SQLite database for history, projects, library, models, tasks
- Library (grid/list, search, sort, filter, favorites, context menu)
- Projects (.jgvproj, save/load/recent)
- Generation history
- Global task manager
- Global search (Ctrl+K) + command palette
- Settings (all sections: General, Models, AI Providers, Generation, Hardware, Notifications, Privacy, Advanced)
- Hardware detection (CPU, GPU, VRAM, RAM, disk)
- Windows integration (notifications, system tray, drag/drop, file associations, native file pickers)
- Offline handling
- Error UX with actionable dialogs

### Should Have (Post-MVP)
- GPU acceleration for llama.cpp (CUDA)
- Ollama / LM Studio runtime detection
- Image generation workflows (Stable Diffusion, etc.)
- Audio generation
- LLM chat interface
- Workflow builder / batch processing
- LoRA management
- Update system
- MSIX installer + desktop installer

### Won't Have (MVP)
- Mobile app (out of scope — this is Windows desktop only)
- Web dashboard
- Third-party plugin marketplace

## 5. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Startup time | < 2 seconds (after first run, cached) |
| DPI scaling | 100%, 125%, 150%, 200% |
| Window sizes | 1280x720 through 4K |
| Offline support | Full local functionality without internet |
| API key security | Never in plaintext, never in logs, DPAPI-encrypted |
| Model file execution | Never auto-execute downloaded binaries |
| Data persistence | Survives app restart and uninstall (user content in `%LOCALAPPDATA%`) |
| Build | Remains compilable throughout development |
