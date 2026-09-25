# JugaadVision — UX Specification (Linux desktop)

Companion to `PRODUCT_SPEC.md`. That document states *what* the product is; this one states *how the
Linux desktop shell is laid out and how the user moves through it*.

Status: the shell exists and is tested. `MainWindow.axaml` currently renders a "Shell scaffolded"
placeholder in the page host where the seven destinations will appear. Everything below is the design
those pages are built to; nothing here is shipped yet. Placeholder states are called out inline
wherever they apply.

Stack: Avalonia 12.1.3, XAML, CommunityToolkit.Mvvm, Linux-first (X11/Wayland), standalone
application. This is not an embed of the existing React web app, and it does not assume Windows
APIs.

---

## 1. Shell anatomy

The window is a single `Window` (`MainWindow.axaml`, `Title="JugaadVision"`, `1440x900`, minimum
`1280x720`) laid out as three horizontal bands:

```
+--------------------------------------------------------------------------+
|                                                                    48px |
|  Top bar: page title, search affordance, window-scoped actions          |
+--------------------------------------------------------------------------+
|                                                                        |
|  Sidebar (232px)  |  Page host (24px inset)                           |
|  Brand           |                                                   |
|  Nav list        |  <the selected destination renders here>          |
|                  |                                                   |
+--------------------------------------------------------------------------+
|  Status bar                                                        26px |
+--------------------------------------------------------------------------+
```

Real structure in the current file:

- `Window` root, `Background="{StaticResource JgBackgroundBrush}"`, `x:CompileBindings="True"`.
- Outer `Grid RowDefinitions="*,26"`.
- `SplitView` in row 0: `OpenPaneLength="{StaticResource JgSidebarWidth}"`, `PanePlacement="Left"`,
  `DisplayMode="Inline"`, `Background="{StaticResource JgSurfaceBrush}"`.
- `SplitView.Pane` holds the brand block and the nav `ListBox` bound to `Items`.
- Content `Grid RowDefinitions="48,*"` — top bar border, then the page host.
- Row 1 of the outer grid is the status bar border with `StatusText`.

### 1.1 Avalonia 12 API constraints

These were verified by reflection against Avalonia.Controls 12.1.3. They are the failure modes most
likely to waste an implementation pass:

- `SplitView` sizes its pane with **`OpenPaneLength` / `CompactPaneLength`**. There is no
  `PaneWidth` property; binding one is a compile error, not a warning.
- `SplitViewDisplayMode` is exactly `Inline`, `CompactInline`, `Overlay`, `CompactOverlay`.
  `PanePlacement` is exactly `Left`, `Right`, `Top`, `Bottom`.
- Compiled bindings are **on by default** in Avalonia 12. Every element containing a `{Binding}`
  needs an explicit `x:DataType`; without it the binding silently fails to resolve under
  `x:CompileBindings="True"`.
- `Grid.RowDefinitions` takes a **literal string** such as `"48,*"`. It cannot be given a
  `StaticResource`, so the 48 / 26 metrics are written literally here even though the same values
  exist as `JgTopBarHeight` / `JgStatusBarHeight` in the theme.

### 1.2 Responsive behaviour

`MinWidth` 1280 pins the three-band layout. The split is derived, not hard-coded:

| Window width | Sidebar | Page host |
|---|---|---|
| 1280–1439 | `OpenPaneLength` 232, `DisplayMode="Inline"` | 1048px minus 48px inset |
| 1440–1919 | 232, `Inline` | remainder |
| 1920+ | 232, `Inline` | remainder, content max-width 1600px centred |

The `DisplayMode` switch to `CompactInline` is not planned for the MVP: `PRODUCT_SPEC.md` §5 requires
1280x720 through 4K, and 232px + a 3-panel workspace still fits at 1280. The switch is available if a
later minimum-width increase is ever needed.

---

## 2. Navigation map

Seven destinations, declared as `NavigationTarget` in
`JugaadVision.App/ViewModels/MainWindowViewModel.cs` and instantiated in the `Items` list. The glyphs
below are the literals in the constructor, not proposals.

| # | Label | Glyph | Target | Purpose | Primary use cases |
|---|---|---|---|---|---|
| 1 | Home | `⌂` | `NavigationTarget.Home` | Landing dashboard: quick actions, recent projects and generations, live hardware readout | UC-04, UC-07 |
| 2 | Generate | `✦` | `NavigationTarget.Generate` | Three-panel generation workspace: inputs / preview / settings | UC-02, UC-03 |
| 3 | Models | `◈` | `NavigationTarget.Models` | Discovery, download, install and management of models | UC-01, UC-02 |
| 4 | Library | `▤` | `NavigationTarget.Library` | Asset browser over everything generated or imported | UC-05 |
| 5 | History | `↺` | `NavigationTarget.History` | Every past generation, with the fields needed to re-run it | UC-05 |
| 6 | Tasks | `⚙` | `NavigationTarget.Tasks` | Background operation queue with live progress, pause/resume/cancel/retry | UC-01, UC-07 |
| 7 | Settings | `⚒` | `NavigationTarget.Settings` | Eight sections mirroring `AppSettings` | all |

Selection model, as implemented: `NavigationItem.IsSelected` is an `[ObservableProperty]` on each
item, `Home` is `IsSelected = true` at construction, and `PageTitle` / `StatusText` are
`[ObservableProperty]` fields on `MainWindowViewModel` defaulting to `"Home"` and `"Ready"`. The
sidebar `ListBox` binds `ItemsSource="{Binding Items}"` with a `DataTemplate x:DataType="vm:NavigationItem"`
rendering `Glyph` (18px fixed-width, `JgTextSecondaryBrush`) and `Label` (13.5px,
`JgTextPrimaryBrush`).

Selection is single-select and exclusive: selecting an item clears the other six. The `Target` enum,
not the `Label`, is what drives page resolution, so a future localisation pass can change the label
without touching routing. Every target appears exactly once, which `ShellTests` asserts.

### 2.1 Page host contract

The `Border Grid.Row="1" Margin="24"` currently holding the placeholder becomes a `ContentControl`
whose content is selected by `Target`. Selection change updates `PageTitle` to the target's display
name in the same operation — title and content can never disagree. Home is restored on every launch
(there is no session-restore route in the MVP); the last project, if any, is what the user reopens
deliberately from Home.

---

## 3. Per-page layouts

All sketches are ASCII. Indentation is proportional; exact pixel values come from §7.

### 3.1 Home

```
+--------------------------------------------------------------------------------+
| Home                                                                            |
+--------------------------------------------------------------------------------+
| QUICK ACTIONS                                                                 |
| +----------------+ +----------------+ +----------------+ +----------------+ |
| | New project    | | New generation | | Import model   | | Open .jgvproj  | |
| | +------------+ | | +------------+ | | +------------+ | | +------------+ | |
| | |             | | |             | | |             | | |             | | |
| | +------------+ | | +------------+ | | +------------+ | | +------------+ | |
| +----------------+ +----------------+ +----------------+ +----------------+ |
|                                                                                |
| RECENT PROJECTS (6)                        RECENT GENERATIONS (6)              |
| +----------------------------------------+ +---------------------------------+ |
| | portrait-refresh     .jgvproj  2d ago | | sunset-render      succeeded 4m  | |
| | product-shots        .jgvproj  5d ago | | caption-batch      succeeded 1h  | |
| | music-notes          unsaved    9d ago | | draft-alt-text    failed    3h  | |
| +----------------------------------------+ +---------------------------------+ |
|                                                                                |
| SYSTEM                                                   captured 14:32:07    |
| +----------------+ +----------------+ +----------------+ +----------------+ |
| | CPU            | | GPU            | | Memory         | | Disk           | |
| | 8c/16t         | | (none found)   | | 12.4/31.1 GiB  | | /home 84/512GB | |
| | load 0.34      | | CPU-only       | |                 | | / 22/48 GB     | |
| +----------------+ +----------------+ +----------------+ +----------------+ |
|                                                                                |
| RUNTIME                                                                [ Tasks ]|
| llamacpp  ready   0 models resident                                            |
+--------------------------------------------------------------------------------+
```

Content, mapped to real types:

- **Quick actions** — the four verbs that start work rather than navigate: create project, new
  generation (jumps to `Generate` with a blank request), import a model file via
  `IFileDialogService.OpenFileAsync` with `FileFilter.Gguf`, open a `.jgvproj` via `FileFilter.JgvProject`.
- **Recent projects** — `IProjectRepository.GetRecentAsync`, rendering `AppProject.Name`,
  `AppProject.FilePath` (or "unsaved" when null, which is a real state on the entity),
  `AppProject.LastOpenedAt`.
- **Recent generations** — `IGenerationRepository.GetHistoryAsync(0, 6)`, rendering `AIGeneration.ModelName`,
  `GenerationStatus`, and a relative timestamp. A failed row shows its `ErrorMessage` truncated to one
  line and is clickable into History, not a dead end.
- **System** — `IHardwareMonitor.CaptureAsync` returning `HardwareSnapshot`:
  `Cpu` (`CpuInfo.ModelName`, `PhysicalCoreCount`, `LogicalCoreCount`, `LoadAverage` as a 0.0–1.0 bar),
  `Gpus` (`GpuInfo.Name`, `TotalMemoryBytes`/`FreeMemoryBytes`, `ComputeApi`,
  `IsUsableForInference`), `Memory` (`MemoryInfo.TotalBytes`, `AvailableBytes`, computed `UsedBytes`),
  `Disks` (`DiskInfo.MountPoint`, `FileSystem`, `TotalBytes`, `FreeBytes`, computed `UsedBytes`).
  `CapturedAt` is always rendered, because a stale reading presented as a live one is worse than no
  reading.
- **Runtime** — `ILocalRuntime.LoadedModels`, plus `ILocalRuntime.IsAvailable` so a missing backend
  is named as missing rather than shown as a load failure.

`HardwareSnapshot.HasGpu` is false on a machine with no GPU. The GPU tile then reads "No GPU
detected — inference will run on CPU" in `JgTextSecondaryBrush`. It is never blank and never an error
state: this is a valid configuration, not a fault. A GPU that exists but has no compute-capable driver
(`HasGpu` true, `GpuInfo.IsUsableForInference` false) is a different case and is rendered as a warning
chip, because UC-02 will silently fall back to CPU and the user should know before waiting on it.

### 3.2 Generate — three-panel workspace

`PRODUCT_SPEC.md` §4 mandates the 3-panel split: inputs / preview / settings. This is the one page
that is not a single scrolling column.

```
+--------------- 320px -----------+-------------------------*------------------------+ 300px ---+
| INPUTS                        | PREVIEW                                               | SETTINGS  |
|                               |                                                      |           |
| Provider                      |  +--------------------------------------------+  | Model     |
| +-------------------------+  |  |                                            |  | +---------+ |
| | Local runtime        v  |  |  |          output surface                    |  | | llamacpp| |
| +-------------------------+  |  |   (image / text / audio / empty)           |  | +---------+ |
|                               |  |                                            |  | Runtime  |
| Model                         |  |                                            |  | threads  |
| +-------------------------+  |  |                                            |  | [   8   ]| |
| | Llama 3.1 8B Q4_K_M   v  |  |                                            |  | VRAM bud.| |
| +-------------------------+  |  |                                            |  | [ auto ]| |
|                               |  +--------------------------------------------+  |           |
| Prompt                        |                                                      | Max tokens|
| +-------------------------+  |  tokens 412 in / 388 out   4.2 s   seed 8812   | [ 1024  ]|
| |                          |  |                                                      | [   ]    |
| |                          |  |                                                      | Temp     |
| |                          |  +--------------------------------------------+  | [ 0.70 ]|
| |                          |  [ Save to library ] [ Open file ] [ Copy ]   | Top P    |
| +-------------------------+  |  [ Regenerate ] [ Reuse settings ]             | [ 0.95 ]|
|                               |                                                      | [   ]    |
| Attachments (vision models)  |                                                      | Stop seq |
| [+ image] [+ image]          |                                                      | [  ]     |
|                               |                                                      |           |
|                               |                                                      | cost est. |
|                               |                                                      | $0.0000  |
|                               |                                                      | (local)  |
+-------------------------------+------------------------------------------------------+-----------+
| [ Generate  Ctrl+Enter ]                                      [ Cancel task ]          |
+------------------------------------------------------------------------------------------------+
```

Panel widths: inputs fixed 320, settings fixed 300, preview takes the remainder (`*`) and absorbs all
resize. Fixed side panels keep the prompt and the parameter sliders in the same physical place across
window resizes, which is what makes repeated parameter work possible. Below 1280 the panels would not
fit, but 1280 is the enforced minimum, so there is no collapsed-panel case to design.

**Inputs panel** builds a `GenerationRequest`: `Prompt` / `NegativePrompt` (the latter shown only when
the selected `ModelKind` is an image kind), `Input` as `ContentPart` values (image attachments appear
only for `ModelKind.Vision`), and `OutputDirectory` when the project overrides the default. The
provider combo is populated from configured `IAIProvider` instances plus installed local runtimes.

**Settings panel** edits a `GenerationParameters`: `MaxTokens`, `Temperature`, `TopP`, `TopK`,
`StopSequences`, `Seed` (blank means let the provider choose; the chosen seed comes back in
`AIResponse.Seed` and is shown in the preview footer), plus `Width`, `Height`, `Steps`,
`GuidanceScale` for image kinds and `JsonMode` / `Stream` where supported. Defaults are seeded from
`GenerationSettings` on first open. The cost estimate is `AIModel.PriceInputPerMillion` /
`PriceOutputPerMillion` against the current max tokens, and reads "Local — no API cost" for a
`ModelSource.Local` model rather than "$0.00", because the two are different facts.

**Preview panel** renders `AIResponse.OutputPath` (image, audio, video) or `AIResponse.Text` (text),
followed by the metadata footer: `PromptTokens`, `CompletionTokens`, `Duration`, `Seed`, `CostUsd`.
Actions write the result to `ILibraryRepository` (which also files the `AIGeneration` row for UC-05),
open the file with the desktop's default handler, or copy the text.

The bottom action bar spans all three panels. `Ctrl+Enter` submits from anywhere in the workspace,
including mid-prompt, because a user typing a prompt should not have to move the mouse to start it.
While a generation is running the primary button becomes a cancellable progress state driven by its
`BackgroundTask` row, so the same work is visible in Tasks regardless of which page the user is on.

### 3.3 Models

```
+--------------------------------------------------------------------------------+
| Models                                                                           |
+--------------------------------------------------------------------------------+
| [ search HuggingFace models...          ]  Kind [All v] [Installed][Discovered]  |
+--------------------------------------------------------------------------------+
| RESULT   name                        quant    size     ctx    licence  state   []   |
| -------- --------------------------- -------- ------- ------ -------- ------- ---- |
| 412      meta-llama/Llama-3.1-8B      Q4_K_M   4.7 GB  8192   apache   disc. [x]   |
| 1180     TheBloke/Mistral-7B-v0.2     Q5_K_M   5.1 GB  32768   mit     inst. [x]   |
| 96       microsoft/Phi-3.5-mini      Q4_0     2.3 GB  128k    mit     inst. [x]   |
| 23310    StabilityAI/sdxl-turbo      fp16     6.9 GB  -       creat.  disc. [ ]   |
|                                                                                |
| Selected: meta-llama/Llama-3.1-8B-Instruct                                    |
| 4 files · 4.7 GB total · 2.1 GB downloaded                                   |
| +--------------------------------------------------------------------------+  |
| | Q4_K_M  model-00001-of-00004.gguf    1.9 GB / 1.9 GB   [succeeded]       |  |
| | Q4_K_M  model-00002-of-00004.gguf    1.4 GB / 1.4 GB   [succeeded]       |  |
| | tokenizer.json                      7.1 MB / 7.1 MB   [succeeded]       |  |
| | config.json                          664 B / 664 B    [running  41%]     |  |
| +--------------------------------------------------------------------------+  |
| [ Download  1.4 GB remaining ]  [ Pause ] [ Cancel ] [ Load into runtime ]    |
+--------------------------------------------------------------------------------+
```

Two tabs share the surface: **Discover** (HuggingFace results, UC-01) and **Installed** (local
`AIModel` records where `State == ModelState.Installed`, with load/unload/inspect/remove).

The result grid carries the metadata UC-01 actually names: size, quantization, download count, and
license. License is shown *before* the download button, not buried in a detail pane, because it is the
one field that determines whether the user is allowed to do what they are about to do.

The detail pane lists individual `ModelFile` entries with their own progress, because a GGUF release
is many files and per-file state is what makes pause/resume meaningful. Every long operation is a
`BackgroundTask` row, so the Tasks page is always a complete picture rather than a subset.

Download states map 1:1 to `ModelState`: `Discovered`, `Downloading`, `Paused`, `Installed`, `Failed`,
`Removed`. The `Discovered` and `Downloading` states get distinct labels; `Downloading` never shows
"Failed" for a not-yet-started file.

### 3.4 Library

```
+--------------------------------------------------------------------------------+
| Library                                                                           |
+--------------------------------------------------------------------------------+
| [ search assets... ]  Kind [All v]  Sort [Newest v]  [Favourites only]  | grid list|
| 42 assets · 1.2 GB                                                        [ Import ]|
+--------------------------------------------------------------------------------+
| +------------+ +------------+ +------------+ +------------+ +------------+ +--------+
| | img        | | img        | | text       | | img        | | audio     | | img    |
| | sunset.png | | draft.md   | | prompt.txt | | layout.png | | take.wav  | | x.png   |
| | image      | | text       | | text       | | image      | | audio     | | image   |
| | 2.1 MB     | | 18 KB      | | 4 KB        | | 890 KB     | | 12 MB     | | 340 KB  |
| | 2d ago     | | 2d ago     | | 3d ago     | | 5d ago     | | 1w ago    | | 1w ago  |
| +------------+ +------------+ +------------+ +------------+ +------------+ +--------+
| 6 of 42                                                                  [ Prev ]|
+--------------------------------------------------------------------------------+
```

Toggles between a thumbnail grid and a dense list, both over the same
`ILibraryRepository.QueryAsync(searchText, kind, sort, skip, take)`. Sort options are the
`LibrarySort` values. Each tile shows `LibraryItem.Name`, `Kind`, `SizeBytes`, `CreatedAt`, and a
favourite star bound to `SetFavoriteAsync`.

Context menu per item: open, open containing folder, copy path, rename, add tag, favourite/unfavourite,
attach to project, delete. `AssetKind` determines the preview and which of those are meaningful — a
`Model` tile does not offer "attach to project", and the delete confirmation states that the file on
disk is removed, not just the database row, because the entity stores a path rather than the bytes.

### 3.5 History

```
+--------------------------------------------------------------------------------+
| History                                                                           |
+--------------------------------------------------------------------------------+
| [ search prompts... ]  Status [All v]  Model [All v]        1,284 generations     |
+                                                                                |
| when        model              provider   status      tokens    cost   seed  [] |
| ----------- ------------------ ---------- ----------- -------- ------ ------ --- |
| 4m ago      Llama 3.1 8B       llamacpp   succeeded   412/388   -      8812 [x]|
| 1h ago      gpt-4o-mini        openrouter succeeded   210/96    $0.004  -    [x]|
| 3h ago      SDXL turbo         openrouter failed      -         -      -    [ ]|
| 1d ago      Mistral 7B Q5      llamacpp   canceled    88/12     -      4401 [x]|
|                                                                                |
| +--------------------------------- detail -----------------------------------+ |
| | prompt        "A weathered brass compass on sand, warm rim light..."       | |
| | negative     (none)                                                     | |
| | parameters    temperature 0.7 · top_p 0.95 · max_tokens 1024 · seed 8812 | |
| | duration      4.2 s                                                          | |
| | output        ~/Pictures/jugaadvision/2026-09-25/sunset-8812.png          | |
| | [ Regenerate ] [ Reuse settings ] [ Copy prompt ] [ Open output ] [Delete] | |
| +--------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------+
```

Every column is a field on `AIGeneration`, which is explicitly designed to hold "enough to re-run the
generation exactly, and enough to explain what happened". `ModelName` is captured at generation time
rather than joined live, so a history row stays readable after its model is removed — the same reason
`Seed` is persisted.

`Regenerate` reopens the request in the Generate workspace prefilled and routed to a **new**
generation row; `Reuse settings` copies parameters into the current project without running. The two
are deliberately separate actions, and the labels say which is which, because silently charging a
user for a paid provider on a "re-run" click is the failure this page is most able to cause.

Failed rows keep their `ErrorMessage` visible in the detail pane with a `Retry` action rather than
collapsing to a bare status word.

### 3.6 Tasks

```
+--------------------------------------------------------------------------------+
| Tasks                                              2 active · 1 needs attention  |
| [ All ] [ Active ] [ Failed ] [ Downloads ] [ Generations ]      [ Clear finished ]|
+--------------------------------------------------------------------------------+
| +----------------------------------------------------------------------------+ |
| | v  Downloading Llama 3.1 8B (3 of 4 files)                                  | |
| |    [############------------------]  58%   4.2 MB/s   2.1 of 4.7 GB           | |
| |    [Pause] [Cancel]                                                          | |
| +----------------------------------------------------------------------------+ |
| +----------------------------------------------------------------------------+ |
| | v  Generating sunset-render (llamacpp)                                       | |
| |    [========------------------------]  33%   stage: decode   21.4 tok/s        | |
| |    [Cancel]                                                                   | |
| +----------------------------------------------------------------------------+ |
| +----------------------------------------------------------------------------+ |
| !  config.json download failed  attempt 2 of 5   connection reset by peer        | |
| |    [Retry] [Cancel] [Show details]                                             | |
| +----------------------------------------------------------------------------+ |
| +----------------------------------------------------------------------------+ |
| | o  Scan of ~/models completed   1,204 files indexed   3m ago                 | |
| +----------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------+
```

Rows are `BackgroundTask` records. State maps to the `TaskState` enum: `Queued`, `Running`, `Paused`,
`Succeeded`, `Failed`, `Canceled`. The affordances are driven by the entity's own predicates rather
than recomputed in the view — `IsTerminal` decides whether Pause/Retry/Cancel appear at all, and
`IsResumable` decides whether the button says Resume or Restart. A failed task past
`AttemptCount` 5 stops offering Resume, because the copy would be a lie at that point.

Progress renders from `Progress` when present and from `BytesTransferred` / `TotalBytes` when it is
not; `StatusMessage` is the free-form line under the title ("4.2 MB/s", "stage: decode"). Succeeded
and canceled tasks collapse to a single summary line so a long generation history does not push the
live work off screen.

`GetResumableAsync` is read at startup, so work interrupted by a crash or a reboot reappears here as
paused rather than vanishing. That is the whole reason `BackgroundTask` is written on state
transition instead of only at completion.

### 3.7 Settings

Eight sections, one-to-one with `AppSettings` properties:

```
+--------------------------------------------------------------------------------+
| Settings                                                                         |
+-------------------------------+------------------------------------------------+
|  General            <         |  General                                         |
|  Models                       |  +----------------------------------------------+ |
|  AI Providers                 |  | Theme            [ dark        v]             | |
|  Generation                   |  | Accent colour    [#3DDC84]                    | |
|  Hardware                     |  | Restore window   [x]                          | |
|  Notifications                |  | Skip onboarding  [ ]                          | |
|  Privacy                      |  +----------------------------------------------+ |
|  Advanced                     |                                                |
|                               |  Changes save automatically. Restart-required   |
|                               |  changes are marked inline.                     |
+-------------------------------+------------------------------------------------+
```

| Section | Backing type | Notable controls |
|---|---|---|
| General | `GeneralSettings` | `Theme` (dark is the only MVP option), `AccentColor`, `RestoreWindowState`, `HasCompletedOnboarding` |
| Models | `ModelSettings` | `ModelDirectories` list with add/remove, `VerifyChecksums`, `ScanOnStartup`, `MaxStagingBytes` |
| AI Providers | `ProviderConfig` | per-provider key entry, `TestConnectionAsync`, `ProviderStatus` chip, `CredentialSource` indicator |
| Generation | `GenerationSettings` | `DefaultMaxTokens`, `DefaultTemperature`, `DefaultTopP`, `TimeoutSeconds`, `MaxRetries`, `AllowProviderFallback`, `OutputDirectory` |
| Hardware | `HardwareSettings` | `ForceCpuOnly`, `ThreadCount`, `VramBudgetBytes`, `PreflightMemory` |
| Notifications | `NotificationSettings` | the four toggles, `ShowTrayIcon`, `MinimizeToTray` |
| Privacy | `PrivacySettings` | `AllowTelemetry`, `AllowCloudGeneration`, `StripAssetMetadata`, `HistoryRetentionDays` |
| Advanced | `AdvancedSettings` | `VerboseProviderLogging`, `AllowUntrustedModels`, `GlobalBaseUrlOverride`, `CustomHeaders` |

Settings save on change through `ISettingsStore`; there is no Save button and therefore no unsaved
state to lose. A setting that requires a restart is marked inline at the point of change rather than
in a global banner, so the user knows which control they just have to restart for.

The AI Providers section is where `CredentialSource` earns its place in the UI: a stored key reads
"Stored in keyring" or, when no keyring is available, "Stored in encrypted file — no system keyring
found", and a key that is set in the entry field but not yet saved reads "Unsaved". The key itself is
never rendered back, and no control in the app can copy it into a log. `ProviderStatus` distinguishes
`Unreachable` (network) from `InvalidCredential` (rejected), because the fix is different in each case.

`AllowUntrustedModels` defaults off. It gates installation of models from untrusted repositories, and
the gate is stated in plain words next to the toggle, since `PRODUCT_SPEC.md` §5 requires that
downloaded binaries are never auto-executed.

---

## 4. Global search and command palette

One surface, opened with **Ctrl+K**, that covers both jobs from a single input field. This is the
`Global search (Ctrl+K) + command palette` line in `PRODUCT_SPEC.md` §4.

```
+--------------------------------------------------------------------------------+
| >                                                                            x  |
+--------------------------------------------------------------------------------+
| SUGGESTED                                                                      |
|   Generate a new image                                       Ctrl+N             |
|   Download a model                                                                   |
|   Open recent project: portrait-refresh                                          |
|                                                                                |
| COMMANDS                                                                      |
|   Generate > New generation                                                      |
|   Models > Discover models                                                        |
|   Models > Manage installed models                                                |
|   Library > Open library                                                          |
|   Settings > General                                                              |
|                                                                                |
| RESULTS  (assets)                                                                |
|   sunset-8812.png                          image · 2.1 MB · 2d ago                |
|   sunset-prompt.txt                        text · 4 KB · 2d ago                  |
|                                                                                |
| COMMANDS  (models)                                                               |
|   Llama 3.1 8B Q4_K_M                      llamacpp · installed · 4.7 GB          |
|                                                                                |
| up/down navigate    enter run    esc close    ctrl+p recent    ? shortcuts         |
+--------------------------------------------------------------------------------+
```

Behaviour:

- Opens focused, on top of whatever page is showing, dimming the page behind it. Navigation state is
  preserved — closing the palette returns to the same page and scroll position.
- Grouped results: **Suggested**, **Commands**, then **Results** subdivided by kind (assets, models,
  projects, generations). Group headers are static text, not filter chips; the palette is a jump
  target, not a browsing tool.
- Fuzzy subsequence matching on the query, ranked prefix matches above word-boundary matches above
  scattered matches. Ties break on recency, so the thing used most recently is first among equals.
- `Enter` runs the highlighted row and closes. `Escape` closes without running. `Tab` moves between
  groups without leaving the input.
- `Ctrl+P` inside the palette re-roots it at recent projects, the most common jump that is not a
  command. `?` opens the shortcut sheet from the palette footer.
- Every command shown is one the current state permits. With no model installed, "Load model into
  runtime" is not offered; with no network, HuggingFace search commands are shown disabled with the
  reason ("requires a connection") rather than hidden, so the feature's absence is explicable.

The palette is the only overlay in the app. Error dialogs and the about box are modal windows, not
overlays, so a modal can never appear on top of the palette and produce an unreachable control.

---

## 5. Status bar and offline state

The 26px band at the bottom of the window, currently a single `TextBlock` bound to
`MainWindowViewModel.StatusText` (default `"Ready"`). It becomes a fixed three-region row:

```
+--------------------------------------------------------------------------------+
| Ready · llamacpp ready · 0 models resident                    2 active tasks   |
+--------------------------------------------------------------------------------+
```

| Region | Content | Source |
|---|---|---|
| Left | Current activity, starting from `StatusText` | `MainWindowViewModel.StatusText` |
| Centre | Runtime and residency summary | `ILocalRuntime.LoadedModels`, `ILocalRuntime.IsAvailable` |
| Right | Active task count and aggregate progress | `ITaskRepository.GetRecentAsync` |

The status bar is informational only. It never hosts a control the user has to click to recover from
anything, because a bar 26px tall is the worst place in the app to put a decision. The right-hand
count is a hyperlink to Tasks and nothing more.

### 5.1 Communicating offline state (UC-06)

UC-06 requires that with no internet connection the app does not crash, local functionality keeps
working, and the offline state is "clearly communicated". Four surfaces carry that state, at four
different levels of urgency:

**1. Status bar, persistent.** The right region gains an `Offline` chip in `JgWarningBrush` with a
label, not a colour change alone — the state is a word, because a status bar is 26px tall and
colour-only signalling is not accessible. The chip is not a button; the app has nothing to retry, it
simply has no network.

**2. Top bar, when a navigation target depends on the network.** Models → Discover, and the
HuggingFace search command, render a persistent inline banner:

```
| ⚠  No connection. Downloading and searching are unavailable.        Learn more |
```

Local models, local generation, projects, library, history and tasks are unaffected and stay
navigable. Nothing is disabled globally; the offline state narrows capability, it does not lock the
app.

**3. In-place, at the point of failure.** A search submitted while offline resolves to an empty state,
not a dialog — an expected consequence, not an error:

```
+----------------------------------------------+
|  No connection                               |
|  Searching HuggingFace needs a connection.  |
|  Installed models are still available below.  |
|  [ Show installed ]                          |
+----------------------------------------------+
```

**4. Destructive-action guard.** Any action that would silently do nothing while offline (a download,
a cloud generation) is disabled at the control, with a tooltip carrying the reason. Silently
accepting a click that will not work is the failure mode UC-06 is really about.

Recovered connectivity is announced once, in the status bar, with a `JgSuccessBrush` "Back online"
label that fades after a few seconds. It does not re-trigger anything the user cancelled while
offline.

---

## 6. Keyboard shortcuts

Global bindings belong to the window, so they work from any page. Local bindings (a grid's arrow-key
navigation, the palette's own keys) take precedence while their control has focus.

| Shortcut | Action | Scope |
|---|---|---|
| `Ctrl+K` | Open global search / command palette | global |
| `Ctrl+1` … `Ctrl+7` | Jump to Home, Generate, Models, Library, History, Tasks, Settings | global |
| `Ctrl+N` | New generation | global |
| `Ctrl+Shift+N` | New project | global |
| `Ctrl+O` | Open `.jgvproj` or asset file picker | global |
| `Ctrl+S` | Save project / save current asset | global |
| `Ctrl+Enter` | Run generation from anywhere in the Generate workspace | Generate |
| `Ctrl+Shift+Enter` | Run generation and add to the current project | Generate |
| `Escape` | Cancel the running generation, or close the topmost dialog | contextual |
| `Ctrl+B` | Toggle sidebar | global |
| `Ctrl+F` | Focus the current page's search or filter field | contextual |
| `Ctrl+,` | Settings | global |
| `Ctrl+W` | Close window (hide to tray when `MinimizeToTray` is on) | global |
| `F1` | Keyboard shortcut sheet | global |
| `F5` | Re-capture the hardware snapshot (Home) | Home |
| `F6` | Cycle panes in the Generate workspace | Generate |
| `Delete` | Delete the selected item, after confirmation | Models, Library, History |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle forward / back through the last visited destinations | global |
| `↑` `↓` | Move the selection in the focused list or grid | contextual |
| `?` | Shortcut sheet, from inside the palette | palette |

`Ctrl+1`–`Ctrl+7` are positional and match the sidebar order exactly, so the seventh target is always
Tasks. `Ctrl+B` toggles `SplitView.IsPaneOpen`; when collapsed the pane keeps its compact width via
`CompactPaneLength` — the property to set there is not `PaneWidth`, which does not exist.

The shortcut sheet (`F1`) renders the same table, filtered to what the current page supports.

---

## 7. Dark theme tokens

The complete palette lives in `JugaadVision.App/Themes/DarkTheme.axaml`, merged into
`Application.Resources` by `App.axaml` and paired with `RequestedThemeVariant="Dark"` and
`<FluentTheme />`. One file re-themes the whole app. These are the real keys and values, not targets.

### 7.1 Surfaces

| Key | Value | Used for |
|---|---|---|
| `JgBackgroundBrush` | `#141414` | window background, page host background |
| `JgSurfaceBrush` | `#1E1E1E` | sidebar pane, top bar, status bar |
| `JgSurfaceRaisedBrush` | `#262626` | cards, list rows, dialog bodies, inputs |
| `JgBorderBrush` | `#333333` | 1px separators and control outlines |

### 7.2 Text

| Key | Value | Used for |
|---|---|---|
| `JgTextPrimaryBrush` | `#ECECEC` | titles, body copy, nav labels, primary values |
| `JgTextSecondaryBrush` | `#9E9E9E` | subtitles, units, secondary metadata, status bar |
| `JgTextDisabledBrush` | `#5A5A5A` | disabled controls, placeholder text, unavailable actions |

### 7.3 Accent and status

| Key | Value | Used for |
|---|---|---|
| `JgAccentBrush` | `#3DDC84` | primary actions, selected nav row, focus ring, progress fill |
| `JgAccentMutedBrush` | `#1F7A4D` | accent at rest: inactive progress track, muted accent fills |
| `JgSuccessBrush` | `#3DDC84` | `TaskState.Succeeded`, `GenerationStatus.Succeeded`, healthy provider |
| `JgWarningBrush` | `#E8B84B` | offline chip, `ModelState.Paused`, `ProviderStatus.RateLimited` |
| `JgErrorBrush` | `#E85A5A` | `TaskState.Failed`, `GenerationStatus.Failed`, invalid credential |

### 7.4 Metrics

| Key | Value | Used for |
|---|---|---|
| `JgSidebarWidth` | `232` | `SplitView.OpenPaneLength` |
| `JgTopBarHeight` | `48` | top bar row (written literally in `RowDefinitions`) |
| `JgStatusBarHeight` | `26` | status bar row (written literally in `RowDefinitions`) |
| `JgCornerRadius` | `6` | cards, buttons, inputs, dialogs |

`DarkThemeTests` asserts the surface, background and accent values, that all three status brushes
exist, and that every `*Brush` resource is fully opaque. A new token must be added to
`DarkTheme.axaml`; there is no second place to define a colour.

### 7.5 Derived usage rules

- Text on `JgBackgroundBrush`, `JgSurfaceBrush` and `JgSurfaceRaisedBrush` is `JgTextPrimaryBrush`
  (contrast at or above 7:1); secondary text on those surfaces is at or above 4.5:1.
- `JgAccentBrush` is a background, not a text colour, on dark surfaces. Body text on an accent-filled
  control is `#141414`.
- Progress bars use `JgAccentBrush` for the fill and `JgAccentMutedBrush` for the track, so an
  in-progress bar is distinguishable from a complete one without relying on the fill alone.
- State is never signalled by colour alone. Every status colour is paired with a text label or an
  icon glyph, per WCAG 1.4.1.
- Glyphs in the sidebar are the Unicode characters already in `MainWindowViewModel` and render in
  `JgTextSecondaryBrush`, unselected. The selected row takes a `JgAccentBrush` left edge and
  `JgTextPrimaryBrush` label.

---

## 8. States: loading, empty, error

`PRODUCT_SPEC.md` §4 requires "Error UX with actionable dialogs". An actionable error names what
happened, what it means, and offers at least one concrete next step. An error message that only
describes the failure is not actionable and does not ship.

### 8.1 Loading

| Case | Treatment |
|---|---|
| First load of a page | Skeleton placeholders at the final layout's shape, so nothing reflows when data lands |
| Refresh of loaded data | Content stays, dimmed to `JgSurfaceRaisedBrush`; no skeleton flash |
| Background refresh | No indicator at all; content updates in place |
| Long operation (load, download, generation) | Determinate `ProgressBar` in the panel that started it, mirrored as a `BackgroundTask` row in Tasks |
| Indeterminate operation | Indeterminate bar plus a stage word from `LoadProgress.Stage` — never a bare spinner |
| Anything longer than 10 s | Spinner is joined by a sentence saying what is happening and roughly how long it may take |
| Blocking the UI | Never. The shell stays interactive; only the initiating control shows a pending state |

### 8.2 Empty

Empty states answer three questions: what this is, why it is empty, and what to do next. Each one
carries a primary action.

| Surface | Heading | Body | Action |
|---|---|---|---|
| Home, no projects | "No projects yet" | "A project holds a model, a prompt and its assets." | `New project` |
| Home, no generations | "No generations yet" | "Run a model locally to see results here." | `New generation` |
| Generate, no model selected | "Select a model" | "Choose a local model or a configured cloud provider to begin." | `Browse models` |
| Generate, prompt empty | "Nothing to generate" | "Enter a prompt in the inputs panel." | focus the prompt field |
| Generate, no result | "No output yet" | "The result of your run appears here." | `Generate` |
| Models, discover, no results | "No models match “{query}”" | "Try a different search term or clear the kind filter." | `Clear filters` |
| Models, installed, empty | "No models installed" | "Download a GGUF model or import a file from disk." | `Discover models` / `Import file` |
| Library, empty | "Your library is empty" | "Generated assets and imported files are collected here." | `Import files` / `New generation` |
| Library, search, no hits | "No assets match “{query}”" | "Search covers names, tags and file paths." | `Clear search` |
| History, empty | "No history yet" | "Every generation is recorded here so you can re-run it." | `New generation` |
| Tasks, empty | "No background tasks" | "Downloads and generations run here so the app stays responsive." | none (informational) |
| Settings, provider not configured | "{Provider} is not configured" | "Add an API key to use {Provider} for cloud generation." | `Add key` |

The Tasks empty state is the one without an action, because an empty task queue is the desired state
and offering a button there would be noise.

### 8.3 Error

Errors are presented in the place they occurred whenever the place can absorb them, so the user keeps
their context. A modal dialog is reserved for errors that block the current operation and require a
decision.

**In-place, non-blocking:**

- A failed search: the input keeps its text, a one-line message appears beneath it.
- A failed generation: the preview panel shows the failure with `Retry` and `Cancel`; the workspace
  and the prompt survive intact.
- A failed task: the Tasks row turns to the failed presentation with `Retry`.
- A failed image thumbnail in the Library: a placeholder tile with the file name, not a broken layout.

**Modal, blocking.** Title states the failure. Body states the cause in one sentence. Buttons are the
concrete next steps, most likely first. Every dialog offers a safe dismissal.

| Situation | Title | Body | Buttons |
|---|---|---|---|
| Model load out of memory | "Not enough memory to load this model" | "{Model} needs about {n} GB. {m} GB is free. Close another model, or lower the context window in Settings › Hardware." | `Close a model` · `Open Hardware settings` · `Cancel` |
| Download failed | "Download failed" | "{Reason}. {n} of {total} bytes were saved, so the download can resume." | `Retry` · `Pause` · `Close` |
| Provider rate limited | "{Provider} rate limit reached" | "Retrying in {n} seconds. You can wait, or switch to another provider." | `Wait` · `Switch provider` · `Run locally` |
| Invalid credential | "{Provider} rejected the API key" | "Check the key in Settings › AI Providers and test the connection." | `Open settings` · `Close` |
| Disk full | "Not enough disk space" | "{Mount} has {n} GB free. {path} needs about {m} GB." | `Open output settings` · `Close` |
| Project file unreadable | "Cannot open this project" | "{Path} is not a valid JugaadVision project ({reason})." | `Open another` · `Close` |
| Untrusted model blocked | "This model is from an untrusted source" | "Installing it is off by default. Turn on “Allow untrusted models” in Settings › Advanced to continue." | `Open settings` · `Close` |
| Unhandled exception | "Something went wrong" | "An unexpected error occurred. The details have been written to {log path}." | `Copy details` · `Open logs` · `Close` |

Rules that apply to every error:

- The technical message and the user-facing message are different strings. `ErrorMessage` on
  `AIResponse`, `LoadResult` and `BackgroundTask` is written to be shown; the raw exception goes to
  the log, never to a dialog.
- `AIResponse.ErrorCode` and `IsRetryable` drive which buttons appear, so a non-retryable 400 offers
  no `Retry`. The codebase already returns expected failures rather than throwing them so this
  decision is available.
- No error mentions a credential, and none can: secrets live in `ISecretStore`, never in a message.
- Every error is also logged to the `BackgroundTask` history even when shown in place, so the Tasks
  page remains a complete account of what the app did.
- Failures also fire `INotificationService` at `NotificationLevel.Error` when
  `NotificationSettings.NotifyOnError` is on, so a user working in another window still learns about it.
