# JugaadVision — Roadmap

Phased implementation tracking for the Linux desktop app. Status is recorded against work that is
**actually committed and verified**, not against intent.

Legend: **DONE** = built and verified · **PARTIAL** = scaffolding only · **SPEC** = specified, not built

---

## Verification Baseline

Everything below "DONE" has been checked on the development host (Arch Linux, Hyprland/Wayland):

| Check | Command | Result |
|---|---|---|
| Debug build, all 7 projects | `dotnet build JugaadVision.sln -c Debug` | 0 warnings, 0 errors |
| Release build, all 7 projects | `dotnet build JugaadVision.sln -c Release` | 0 warnings, 0 errors |
| Test suite | `dotnet test` | 34/34 passing |
| Self-contained publish | `dotnet publish -c Release -r linux-x64 --self-contained true` | succeeds |
| Application launch | `./JugaadVision.App` on the live Wayland session | runs, no crash, no error output |

`TreatWarningsAsErrors=true` is set solution-wide, so a build that emits any warning fails.

---

## Phase 1 — Product Foundation · **DONE**

| Item | Status | Notes |
|---|---|---|
| Product spec | DONE | [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — retargeted to Linux, §0 records the decision |
| Target users, UC-01…UC-07, MVP scope | DONE | Platform-neutral content preserved from the original spec |
| Non-functional requirements | DONE | Updated for XDG paths and compositor DPI scaling |

## Phase 2 — Solution & Architecture · **DONE**

| Item | Status | Notes |
|---|---|---|
| Solution, 7 projects | DONE | `JugaadVision.sln`, classic format (not `.slnx`) |
| Clean Architecture wiring | DONE | Core innermost; verified project references, no cycles |
| Central package management | DONE | All versions in `Directory.Packages.props` |
| Build conventions | DONE | `Directory.Build.props`: nullable, implicit usings, warnings-as-errors |
| `docs/ARCHITECTURE.md` | DONE | Layering, module boundaries, DI composition root |
| `docs/DATABASE_SCHEMA.md` | DONE | EF Core + SQLite mapping, including the collection-mapping decision |
| `docs/AI_ARCHITECTURE.md` | DONE | Provider/router/runtime design, retry classification table |
| `docs/MODEL_SYSTEM.md` | DONE | Model state machine and download lifecycle |
| `docs/PROVIDER_SYSTEM.md` | DONE | Provider extension contract, secret-storage rules |
| `docs/UX_SPEC.md` | DONE | Navigation map, 3-panel Generate workspace, states |
| `docs/PLATFORM_INTEGRATION.md` | DONE | Replaces the Windows doc; Linux equivalents per requirement |

## Phase 3 — Domain Layer · **DONE**

| Item | Status | Notes |
|---|---|---|
| 8 spec §4.1 entities | DONE | `AIModel`, `ModelFile`, `AIGeneration`, `ProviderConfig`, `AppProject`, `LibraryItem`, `BackgroundTask`, `AppSettings` |
| `AIModel` vs `LocalModel` split | DONE | Catalogue record vs runtime-facing install descriptor |
| Enums | DONE | 24 values across 5 files, all zero-valued with an explicit `Unknown`/`None` first member |
| `IAIProvider` | DONE | Signature exactly as the spec states it |
| `ILocalRuntime` | DONE | **Inferred** — see Open Items |
| Generation contracts | DONE | `GenerationRequest`, `GenerationParameters`, `ContentPart`, `AIResponse`, `GenerateResult` |
| Load contracts | DONE | `LoadedModel`, `LoadResult`, `LoadProgress` |
| Repository interfaces | DONE | 6 repositories + `ISettingsStore`, matching the intended query surface |
| Platform service interfaces | DONE | `ISecretStore`, `INotificationService`, `IHardwareMonitor`, `ISystemTrayService`, `IFileDialogService` |
| `HardwareSnapshot` read model | DONE | CPU/GPU/memory/disk for the Home dashboard |

## Phase 4 — Native Shell · **DONE**

| Item | Status | Notes |
|---|---|---|
| Avalonia app host, dark theme | DONE | `RequestedThemeVariant="Dark"`, Fluent base theme |
| Dark palette | DONE | Charcoal `#141414`, surfaces `#1E1E1E`/`#262626`, green accent `#3DDC84` — **tested** |
| Sidebar navigation | DONE | 7 targets, bound to `MainWindowViewModel` — **tested** |
| Top bar + status bar | DONE | Page title and status text bound |
| Window sizing | DONE | 1280x720 minimum per the NFR table — **tested** |
| MVVM view model | DONE | CommunityToolkit.Mvvm source generators |
| DI composition root | PARTIAL | `AddJugaadVisionServices()` exists and builds a provider, but registers only `AppState` |
| Page content | SPEC | Shell shows a placeholder; Home/Generate/Models/Library/History/Tasks/Settings all pending |

## Phase 5 — Test Infrastructure · **DONE**

| Item | Status | Notes |
|---|---|---|
| xunit.v3 | DONE | Pinned `3.2.2` to match `Avalonia.Headless.XUnit`'s `xunit.v3.extensibility.core 3.2.2` |
| Headless Avalonia UI tests | DONE | Real XAML constructed and asserted in-process |
| Domain/contract tests | DONE | Progress clamping, state predicates, response failure paths |
| Theme tests | DONE | Colours read from a compiled `ResourceDictionary`, bypassing a headless-harness quirk |

## Phase 6 — Storage · **SPEC**

Nothing implemented. `JugaadVision.Storage` contains only a project file.

- `AppDbContext` + fluent configuration for all 8 entities
- JSON column converters for the collection-typed properties
- Repository implementations against `IRepositories.cs`
- Initial migration
- WAL / pragma setup, XDG data directory resolution

## Phase 7 — Platform Layer · **SPEC**

Nothing implemented. `JugaadVision.Platform` contains only a project file.

- `ISecretStore` → Secret Service (libsecret), AES-256-GCM file fallback
- `IHardwareMonitor` → `/proc`, `lspci`, `nvidia-smi`, `df`
- `INotificationService` → `notify-send`
- `ISystemTrayService` → StatusNotifier/AppIndicator (GNOME caveat noted in the spec)
- `IFileDialogService` → native GTK file pickers
- `.jgvproj` handling + XDG desktop entry, single-instance path hand-off

## Phase 8 — AI Layer · **SPEC**

Nothing implemented. `JugaadVision.AI` contains only a project file.

- OpenAI-compatible provider (one implementation, N configurations)
- HuggingFace discovery + download client
- Router with cost/availability/preference selection and fallback
- Retry policy: exponential backoff with jitter, per-provider timeout
- llama.cpp local runtime with `ILocalRuntime` + memory pre-flight

## Phase 9 — UI Pages · **SPEC**

- Home dashboard (quick actions, recents, `HardwareSnapshot` readout)
- Generate workspace (3-panel), wired to the router
- Models browser (discover / download / install)
- Library (grid + list, search, sort, favourites)
- History, Tasks, Settings
- Command palette (Ctrl+K)

## Phase 10 — Packaging · **PARTIAL**

- Self-contained `linux-x64` publish: **verified working**
- AppImage assembly, `.desktop` entry, icon: pending
- Updates: post-MVP

---

## Open Items

1. **`ILocalRuntime` members are inferred, not specified.** The pasted spec was truncated
   mid-signature after `LoadModelAsync`. `GenerateAsync`, `UnloadAsync`, `WatchLoadAsync`,
   `LoadedModels` and `SupportedKinds` were derived from UC-02's requirements and need review.
2. **The original spec paste is still incomplete** — everything after §4.2 is missing. The 8
   documents above were written against the code and UC-01…UC-07, not against that text.
3. **`App.axaml.cs` builds a real `ServiceProvider` but registers only `AppState`.** It is a
   deliberate hook, not a working graph.
4. **The untracked React shell** at `src/components/desktop/` (7 files) plus
   `src/css/desktop-shell.css` is untouched and uncommitted. It is a web imitation of a desktop
   shell, which contradicts the spec's "not a port, wrapper, or embed of the web app". It needs
   a decision: delete, or keep as legacy.
5. **GPU offload is effectively unavailable on the dev machine** — Quadro M1000M with 4 GB VRAM
   is too small for useful offload, so local inference is CPU-only here. CUDA/Vulkan work will
   need other hardware to verify.
