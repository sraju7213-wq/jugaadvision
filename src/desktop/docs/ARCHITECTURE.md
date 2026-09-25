# JugaadVision Desktop — Architecture

Companion to `PRODUCT_SPEC.md` (what the product does) and `MODEL_SYSTEM.md` / `AI_ARCHITECTURE.md` (how models and providers behave). This document covers **how the code is organised**: the project graph, what each layer is allowed to know about, and how the composition root wires it together.

This is a standalone native desktop app. `src/desktop/` is C#/.NET and has no relationship to the React web app elsewhere in this repository; nothing in the desktop solution references it.

## 1. Stack Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI framework | Avalonia 12.1.3 (`Avalonia`, `Avalonia.Desktop`, `Avalonia.Themes.Fluent`, `Avalonia.Fonts.Inter`) | Cross-platform XAML. WinUI 3 was rejected: WinUI 3 + MSIX cannot be built on Linux, and this app ships on Linux first. |
| Runtime | .NET 10 (`net10.0`, `Directory.Build.props`) | Single TFM for all seven projects. |
| MVVM | CommunityToolkit.Mvvm 8.4.2 | Source-generated `ObservableObject` / `[ObservableProperty]`; no reflection cost at startup. |
| Persistence | EF Core 10.0.12 + SQLite | `PRODUCT_SPEC.md` UC-04/UC-05 require durable history, projects, library, models and tasks. |
| DI | Microsoft.Extensions.DependencyInjection 10.0.12 | Explicit `ServiceProvider` built in `App.axaml.cs`; no Avalonia locator. |
| Tests | xunit.v3 3.2.2 + Avalonia.Headless.XUnit 12.1.3 | v3 is matched deliberately to `xunit.v3.extensibility.core 3.2.2` that Avalonia 12.1.3 pulls in — see `JugaadVision.Tests.csproj`. |
| Package versions | Central Package Management (`Directory.Packages.props`) | No project may carry a `Version=` attribute on a `PackageReference`. |

Two build properties are load-bearing:

- `TreatWarningsAsErrors=true` (`Directory.Build.props`) — a warning fails the build, so nullable and unused-symbol regressions cannot accumulate. This is the mechanical guard behind "Build | Remains compilable throughout development" in `PRODUCT_SPEC.md` §5.
- `ManagePackageVersionsCentrally=true` — version drift between layers is a build error, not a runtime surprise.

## 2. Solution Layout

Seven projects, one per layer, plus a test project.

```
        ┌───────────────────────────────┐
        │        JugaadVision.App       │  Avalonia views, view models,
        │      (composition root)       │  Program.cs, App.axaml(.cs)
        └───┬───┬───┬───┬───┬───────────┘
            │   │   │   │   │
    ┌───────┘   │   │   │   └────────┐
    ▼           ▼   │   ▼            ▼
┌────────┐  ┌────────┐ │  ┌─────────┐  ┌──────────────┐
│  AI    │  │ Models │ │  │ Storage │  │   Platform   │
└───┬────┘  └───┬────┘ │  └────┬────┘  └──────┬───────┘
    │           │      │       │              │
    └───────────┴──────┴───────┴──────────────┘
                        │
                        ▼
                 ┌─────────────┐
                 │    Core     │  domain entities, enums,
                 │ (innermost) │  abstractions, contracts
                 └─────────────┘  depends on nothing
```

Arrows point from a project to the projects it references. `JugaadVision.Tests` references all six and is omitted from the diagram for clarity.

| Project | Responsibility | Allowed project references |
|---------|----------------|------------------------------|
| `JugaadVision.Core` | Domain entities (`AIModel`, `LocalModel`, `ModelFile`, `AIGeneration`, `AppProject`, `LibraryItem`, `BackgroundTask`, `ProviderConfig`, `AppSettings`), enums (`Enums/*.cs`), ports (`Abstractions/IAIProvider.cs`, `ILocalRuntime.cs`, `IRepositories.cs`, `IPlatformServices.cs`, `IHardwareMonitor.cs`), and request/result contracts (`Generation/GenerationContracts.cs`, `Generation/LoadContracts.cs`) | **none** |
| `JugaadVision.Storage` | EF Core `DbContext`, SQLite provider wiring, fluent API entity configuration, implementations of the `IRepositories.cs` ports, `ISettingsStore` implementation | Core |
| `JugaadVision.Platform` | Linux host integration: `ISecretStore` (Secret Service / libsecret, encrypted-file fallback), `INotificationService`, `IHardwareMonitor` (`/proc`, `lspci`, `nvidia-smi`, sysfs), `ISystemTrayService`, `IFileDialogService` | Core |
| `JugaadVision.AI` | Inference backends: `ILocalRuntime` implementations (llama.cpp, ONNX Runtime) and `IAIProvider` implementations (OpenRouter, HuggingFace, OpenAI-compatible, custom), the provider router, retry/fallback policy, HuggingFace discovery | Core, Storage, Platform |
| `JugaadVision.Models` | Model browser and install lifecycle: catalogue scanning, download with pause/resume (via `ModelFile.DownloadedBytes`), installation, and the mapping from catalogue `AIModel` to runtime-facing `LocalModel` | Core, AI |
| `JugaadVision.App` | Avalonia XAML, view models, `Program.cs` bootstrap, `ServiceCollectionExtensions.cs` composition root | Core, AI, Models, Storage, Platform |
| `JugaadVision.Tests` | xunit.v3 unit and headless-UI tests | all six |

Only `JugaadVision.App` is an executable application (`OutputType=WinExe`); `JugaadVision.Tests` is an executable too, because xunit.v3 test projects are programs rather than libraries.

## 3. The Rule That Core Stays Pure

**Core has no outward dependencies, and never may acquire one.** This is not a convention — it is enforced structurally. `JugaadVision.Core.csproj` has no `PackageReference` and no `ProjectReference` at all; the file contains only a comment stating the rule. Every Core type is a `record`, a `class` with plain properties, or an `enum`. No attributes, no ORM mappings, no serialization contracts, no framework types.

Three consequences that the rest of the design depends on:

1. **Persistence is configured in Storage, not on the entity.** `AIModel` is annotated with nothing; `JugaadVision.Storage` maps it with the EF Core fluent API. The docstring on `AIModel.cs` says this explicitly, and the same convention will hold for every entity.
2. **Ports are declared where the domain needs them, not where they are implemented.** `IAIProvider` lives in `Core/Abstractions/` and its implementations in `JugaadVision.AI`; `ISecretStore` lives in `Core/Abstractions/IPlatformServices.cs` and its implementation in `JugaadVision.Platform`. The dependency always points inward, at the interface.
3. **Expected failures are returned, not thrown.** `AIResponse.Failure(...)` and `LoadResult.Failure(...)` exist so the router can fall back without exception-driven control flow. `IAIProvider`'s contract reserves exceptions for programming errors and `OperationCancelledException`. A method whose failure mode is a bad credential or a rate limit returns a failed result carrying `ErrorCode` and `IsRetryable`.

**Not yet implemented:** an automated guard. The purity rule is currently enforced only by `JugaadVision.Core.csproj` having no reference items — nothing fails the build if a developer adds one. A test that reflects over `JugaadVision.Core.dll` and asserts zero `AssemblyReference`s outside the BCL is the obvious next step, and is listed as such here rather than claimed.

## 4. Dependency Rules Between Layers

The graph is not a free-for-all; two specific edges deserve explanation, because both are the reason the graph is shaped this way.

### Why Models → AI

`JugaadVision.Models` owns model discovery and the install lifecycle. To answer "which local runtimes can load this file, and is the backend present?" it has to ask `ILocalRuntime.IsAvailable` and `ILocalRuntime.SupportsFormat(...)` — and those implementations live in `JugaadVision.AI`, per the docstring on `Core/Abstractions/ILocalRuntime.cs`. The alternative, pushing the availability probe down into Core, would put runtime-format knowledge in the domain layer. The chosen direction keeps runtime detail in `JugaadVision.AI` and lets `Models` query it through the Core-declared interface.

Note what is *not* allowed: `Models` must not reach into a concrete `LlamaCppRuntime` type, and `AI` must not call back into `Models`. The edge is a one-way dependency on an abstraction, not mutual awareness.

### Why AI → Storage and AI → Platform

`JugaadVision.AI` holds the two implementations that need an outward capability:

- **Storage** — a provider's configuration (`ProviderConfig`: base URL, enabled flag, status) is persisted, so `OpenRouterProvider` reads it through `IProviderConfigRepository` and writes health back through `UpsertAsync`. The AI layer never touches a `DbContext`.
- **Platform** — API keys come from `ISecretStore`, never from the database and never from a log line (`PRODUCT_SPEC.md` §5: "Never in plaintext, never in logs"). `CredentialSource` in `Core/Enums/ProviderEnums.cs` enumerates where a secret may live — `Keyring`, `EncryptedFile`, `Ephemeral`, `None` — and SQLite is deliberately not among them.

### The common constraint

No layer may reference `JugaadVision.App`. The dependency graph is a DAG rooted at `Core`; the UI project references everything and nothing references the UI project except the test project. This is what allows `Storage`, `Platform` and `AI` to be tested without constructing a window, and it is what will allow a future headless CLI to reuse them unchanged.

## 5. The `AIModel` / `LocalModel` Boundary

Core defines two model types, and they are not redundant. `Core/Models/LocalModel.cs` states the rationale directly: "Deliberately distinct from `AIModel`. `AIModel` is the catalogue record and carries pricing, licence, and provider metadata; a runtime only needs a path, a format, and the physical limits it will allocate against."

| | `AIModel` | `LocalModel` |
|---|---|---|
| Meaning | Catalogue row: one type for a locally-installed model and for a HuggingFace/OpenRouter listing | Runtime input: an installation on this disk |
| Lives in | `Core/Models/AIModel.cs` | `Core/Models/LocalModel.cs` |
| Identity | `Guid Id`; `ExternalId` is the provider- or catalogue-native identifier | `Guid Id`, documented as "the `AIModel.Id` this installation was created from" |
| Key fields | `PriceInputPerMillion`, `PriceOutputPerMillion`, `License`, `DownloadCount`, `Metadata`, `Files`, `Capabilities`, `State`, `Tier` | `PrimaryFilePath`, `ModelDirectory`, `Format`, `Kind`, `ContextWindow`, `ParameterCountBillions`, `EstimatedMemoryBytes` |
| Derived logic | `IsLocallyExecutable` (`Source == Local && State == Installed`), `RequiresCredential` | none |
| Consumed by | UI, repositories, the router | `ILocalRuntime.LoadModelAsync` and friends |

**Why the split exists:**

- **A runtime must not see provider-shaped fields it must not interpret.** `Metadata` is documented as "shape is provider-specific and never interpreted by Core". Handing a runtime a full `AIModel` invites it to branch on `Tier` or read `PriceInputPerMillion`, and those branches would be wrong — a local model has no price, and a runtime has no opinion about tiers.
- **The router's uniformity is preserved where it matters.** `IAIProvider.DiscoverModelsAsync` returns `IReadOnlyList<AIModel>`, so a cloud catalogue entry and an installed local model are the same shape to the router and to the model browser. The split is at the *runtime boundary*, not at the *router boundary*.
- **`LocalModel` is a pre-flight contract.** `EstimatedMemoryBytes` exists so a load can be checked against free RAM before it starts, so a too-large model fails with a clear message instead of letting the OOM killer end the process (`PRODUCT_SPEC.md` UC-02: "UI never freezes"; `AppSettings.Hardware.PreflightMemory` defaults to `true`).
- **`LoadedModel` closes the loop.** `Core/Generation/LoadContracts.cs` defines the handle a runtime hands back — `ModelId`, an opaque `Handle` ("Never interpret this outside the issuing runtime"), `RuntimeName`, and `MemoryBytes`. It is the third distinct thing: a catalogue record, a disk installation, and a resident handle. `ILocalRuntime` takes `LocalModel` in and returns `LoadedModel`, and the handle only ever goes back to the runtime that issued it.

The mapping from `AIModel` to `LocalModel` is `JugaadVision.Models`' job. That is the layer that owns "install", so that is where the translation belongs. **Not yet implemented** — the mapping code has not been written.

## 6. The Platform Layer

`JugaadVision.Platform` is the host-integration layer, and it exists because the product spec was written for Windows. `PRODUCT_SPEC.md` §4 lists "Windows integration (notifications, system tray, drag/drop, file associations, native file pickers)" and names "Windows Credential Manager (DPAPI-encrypted)" as the credential store; §5 requires the key be "DPAPI-encrypted".

On Linux, none of those mechanisms exist. Rather than scatter `#if` blocks through the AI and UI layers, the project graph routes every host capability through Core-declared interfaces and gives each one a Linux implementation in `JugaadVision.Platform`:

| Interface (declared in `Core/Abstractions/IPlatformServices.cs`) | Linux implementation | Spec mapping |
|---|---|---|
| `ISecretStore` | Secret Service / libsecret keyring; AES-256-GCM encrypted file as fallback, reported honestly via `IsSecureStoreAvailable` | Replaces Credential Manager / DPAPI |
| `INotificationService` | StatusNotifier / `notify-send` | Replaces toast notifications |
| `ISystemTrayService` | System tray icon with an `Activated` event | Replaces `NotifyIcon` |
| `IFileDialogService` | Native GTK file pickers | Replaces `IFileOpenPicker` |
| `IHardwareMonitor` | `/proc`, `lspci`, `nvidia-smi`, sysfs | New; the spec assumed DXGI |

`IHardwareMonitor` lives in its own file, `Core/Abstractions/IHardwareMonitor.cs`, because it is the only port in the group that also has to publish its own return types: `HardwareSnapshot`, `CpuInfo`, `GpuInfo`, `MemoryInfo`, `DiskInfo` are all declared there as records. `GpuInfo.ComputeApi` carries the vendor driver interface ("cuda", "vulkan", "opencl") and `IsUsableForInference` is false when a GPU exists but no driver exposes it for compute — that is how UC-02 falls back to CPU rather than failing.

`FileFilter` is likewise declared in Core, alongside the ports, with prebuilt instances for the app's own file types: `FileFilter.JgvProject` (`.jgvproj`), `FileFilter.Gguf` (`.gguf`), `FileFilter.Image`, `FileFilter.All`.

**Not yet implemented.** `JugaadVision.Platform` currently contains only its `.csproj` and an `obj/` folder — no source files. The interfaces it will implement are already fixed in Core; what does not exist yet is the libsecret call, the procfs parser, the tray implementation.

The same reasoning is why the project is called `Platform` and not `Linux` or `Integration`: it is the seam. If Windows support is added later, the graph does not change — Windows implementations are registered alongside the Linux ones in the same composition root, behind the same Core interfaces.

## 7. The Composition Root and DI Registration

### Where it lives

The composition root is `JugaadVision.App/Services/ServiceCollectionExtensions.cs`, exposed as `AddJugaadVisionServices()`. It is invoked exactly once, in `App.axaml.cs`:

```csharp
public override void OnFrameworkInitializationCompleted()
{
    var services = new ServiceCollection();
    services.AddJugaadVisionServices();
    Services = services.BuildServiceProvider();

    if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
    {
        desktop.MainWindow = new MainWindow();
    }

    base.OnFrameworkInitializationCompleted();
}
```

`App.Services` is the only handle the UI has on the graph. No view model or view constructs a service, and no non-App project references `IServiceCollection` for registration purposes.

### Current state — honestly

**`AddJugaadVisionServices()` is a near-empty stub.** Its entire body is:

```csharp
_ = services.AddSingleton<AppState>();
```

`AppState` lives in the same file and holds `IsOffline` and `OfflineReason`, process-wide state that is neither settings nor persisted. The XML doc on the method says why: the Storage, AI, Models and Platform layers have no concrete services yet, so "Registrations are added here as each layer lands."

No `DbContext`, no repository implementation, no provider, no runtime, and no `IServiceProvider`-resolved view model exists yet. The `App` project references all five other projects and uses only `Core` and its own view models. This document will be updated when the graph stops being a stub; until then, treat any registration list beyond `AppState` as planned.

### How each layer will register

Planned, one extension method per layer, each called from `AddJugaadVisionServices()`:

| Layer | Planned registrations | Rationale |
|-------|----------------------|-----------|
| Storage | `DbContext` (scoped to a connection lifetime), `IModelRepository`, `IGenerationRepository`, `IProjectRepository`, `ILibraryRepository`, `ITaskRepository`, `IProviderConfigRepository`, `ISettingsStore` | Repositories are stateless over the context; register them so the concrete type never leaks upward. |
| Platform | `ISecretStore`, `INotificationService`, `IHardwareMonitor`, `ISystemTrayService`, `IFileDialogService` | Singleton. `ISecretStore` wraps a long-lived keyring connection; `IHardwareMonitor` is polled, so it must not be re-created per call. |
| AI | One registration per `IAIProvider` keyed by `ProviderConfig.ProviderKey` / `IAIProvider.Name` ("openrouter", "huggingface", "custom"), one per `ILocalRuntime` keyed by `Name` ("llamacpp"), the router, the retry policy, `IHttpClientFactory` | `IHttpClientFactory` (not a raw `HttpClient`) so provider calls get pooled handlers and DNS refresh. Both `IAIProvider.Name` and `ProviderConfig.ProviderKey` are documented as matching the DI registration name — that correspondence is the whole point of those doc comments. |
| Models | The model browser service, the download manager, the install/uninstall service | These are the callers of `ILocalRuntime`; they are the only place the `AIModel` → `LocalModel` mapping lives. |
| App | View models as needed, `AppState` (already there) | View models are resolved from `App.Services` once the shell stops constructing its own. |

`MainWindow.axaml` currently instantiates `<vm:MainWindowViewModel />` inline in XAML (`MainWindow.axaml` lines 15–17), and `MainWindowViewModel` has a parameterless constructor. Wiring it through DI is a change to that XAML, and it is a change the existing design already anticipates — `MainWindow.axaml.cs` is a two-line class with no logic to move.

### Conventions

- **`Microsoft.Extensions.Logging.Abstractions` only, in every non-App layer.** `ILogger<T>` is available to Storage, Platform, AI and Models; only `JugaadVision.App` references a concrete logging implementation. This is why `Microsoft.Extensions.Logging.Abstractions` appears as a `PackageReference` in four `.csproj` files and no concrete logger package appears anywhere yet.
- **No service locator.** `App.Services` is reachable, but view models receive their dependencies by constructor. `MainWindowViewModel` currently takes none because it needs none.
- **One `ServiceProvider` per process.** Built once, in `OnFrameworkInitializationCompleted`, and never rebuilt. There is no Avalonia locator and no static container.

## 8. Testing Strategy

`JugaadVision.Tests` mirrors the layer structure with `Core/` and `App/` subdirectories. Current state: **34 tests, all passing** (`dotnet test -c Release`), covering the Core domain logic and the App shell.

| Area | Mechanism | Examples in code |
|------|-----------|------------------|
| Domain entities | Plain xunit.v3 `[Fact]` / `[Theory]` — no Avalonia app needed | `Core/DomainEntityTests.cs`: `ModelFile.DownloadProgress` clamping, `AIModel.IsLocallyExecutable` / `RequiresCredential`, `BackgroundTask.IsTerminal` / `IsResumable`, `AppSettings` defaults |
| Generation contracts | Plain xunit.v3 | `Core/GenerationContractTests.cs`: `AIResponse.Success` / `Failure` retry semantics, `LoadProgress.FromFraction` clamping, `LoadResult` handle propagation, `GenerationRequest.Stream` |
| UI shell | `Avalonia.Headless.XUnit`, `[AvaloniaFact]` | `App/ShellTests.cs`: window title, `MinWidth`/`MinHeight` from `PRODUCT_SPEC.md` §5, sidebar renders 7 items, `PageTitle` binding |
| Theme | `[AvaloniaFact]` against a compiled dictionary | `App/ShellTests.cs` `DarkThemeTests` |

**The headless Avalonia approach is the specific payoff of targeting Linux.** The XAML shell is exercised by real tests on the build machine — no Windows host, no display server, no `Xvfb` dance. `ShellTests` constructs a real `MainWindow`, calls `Show()`, and inspects the resulting control tree.

Two harness behaviours must be respected, and both are already handled in the existing tests:

**Use the logical tree, not the visual tree.** Under headless drawing the visual tree is only partially realised, so `GetVisualDescendants()` does not reach the sidebar `ListBox` even though it is present and bound. `ShellTests` uses `window.GetLogicalDescendants()` (from `Avalonia.LogicalTree`). This is noted in the class docstring so the next person does not "fix" it to the visual tree.

**`StaticResource` lookups silently fall back to default brushes.** Avalonia 12.1.3's headless xunit harness creates a **bare `Application`**. The shell's `Background="{StaticResource JgBackgroundBrush}"` (`MainWindow.axaml` line 13) does not fail loudly there — it resolves to a default brush. A test asserting "the window background is the theme colour" through the live window would therefore be asserting the fallback, not the theme, and would pass even if `DarkTheme.axaml` were deleted.

`DarkThemeTests` avoids this by querying a **compiled `ResourceDictionary`** instead. `App/TestThemeDictionary.axaml` is a `ResourceDictionary` whose `MergedDictionaries` contains a `ResourceInclude` of `avares://JugaadVision.App/Themes/DarkTheme.axaml` — the production theme, compiled in. `App/TestThemeDictionary.axaml.cs` is deliberately empty: it exists only so the compiled XAML loader produces a real dictionary the tests can query without touching `Application.Current`.

The tests reach it through the three-argument `IResourceHost.TryGetResource`, because `ResourceDictionary` does not expose the shorter overload:

```csharp
private static readonly TestThemeDictionary Theme = new();

private static bool TryGet(string key, out object? value) =>
    Theme.TryGetResource(key, theme: null, out value);
```

A `null` theme variant means the default variant, which is what the app uses. This is what makes assertions like `JgBackgroundBrush == #141414` and `JgAccentBrush == #3DDC84` real assertions against the shipped palette, plus a blanket opacity check over every `*Brush` key — a mis-authored translucent brush would otherwise show up as an invisible control.

`JugaadVision.Tests.csproj` references `Avalonia` directly, not only transitively through `JugaadVision.App`, because Avalonia's build props are what auto-glob `**/*.axaml` into the `AvaloniaXaml` item. Without the direct reference, `TestThemeDictionary.axaml` would not compile.

**Planned test layers, not yet written:** EF Core repositories against an in-memory or temp-file SQLite database, `ILocalRuntime` and `IAIProvider` implementations against fakes, and a `Core.dll` purity check as described in §3.

## 9. File Reference

| Concern | Path |
|---------|------|
| Composition root | `JugaadVision.App/Services/ServiceCollectionExtensions.cs` |
| Composition root invocation | `JugaadVision.App/App.axaml.cs` (`OnFrameworkInitializationCompleted`) |
| Avalonia bootstrap | `JugaadVision.App/Program.cs` |
| Application theme merge | `JugaadVision.App/App.axaml` |
| Dark palette | `JugaadVision.App/Themes/DarkTheme.axaml` |
| Shell view model | `JugaadVision.App/ViewModels/MainWindowViewModel.cs` |
| Ports — AI backends | `JugaadVision.Core/Abstractions/IAIProvider.cs`, `ILocalRuntime.cs` |
| Ports — persistence | `JugaadVision.Core/Abstractions/IRepositories.cs` |
| Ports — host services | `JugaadVision.Core/Abstractions/IPlatformServices.cs` |
| Ports — hardware | `JugaadVision.Core/Abstractions/IHardwareMonitor.cs` |
| Generation contracts | `JugaadVision.Core/Generation/GenerationContracts.cs` |
| Load contracts | `JugaadVision.Core/Generation/LoadContracts.cs` |
| Catalogue model | `JugaadVision.Core/Models/AIModel.cs` |
| Runtime model | `JugaadVision.Core/Models/LocalModel.cs` |
| Build policy | `Directory.Build.props` |
| Package versions | `Directory.Packages.props` |
| Domain tests | `JugaadVision.Tests/Core/DomainEntityTests.cs`, `GenerationContractTests.cs` |
| Headless UI + theme tests | `JugaadVision.Tests/App/ShellTests.cs` |
| Compiled test theme | `JugaadVision.Tests/App/TestThemeDictionary.axaml` |
