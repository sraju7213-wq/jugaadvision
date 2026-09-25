# JugaadVision — Model System

How models are discovered, downloaded, installed, and managed on the Linux desktop app.

**Status:** The domain model, the state machine, and every setting referenced below are
implemented in `JugaadVision.Core` and covered by `JugaadVision.Tests/Core/DomainEntityTests.cs`.
Every service that *acts* on the state machine — catalogue client, download manager, checksum
verifier, directory scanner, installer — is **planned**, not written. See §12.

The retarget from Windows to Linux changes nothing structural here. It changes two things:
storage paths move to XDG (§9), and local inference is CPU-only in practice on the target
hardware (§11).

---

## 1. What a "model" is

One record type, `AIModel`, covers both physically-present local models and catalogue entries
for remote ones. That is deliberate: the router treats them uniformly and never branches on
"is this a real model or just a search result" before it has to.

Two supporting types split the concerns:

| Type | Role | Key fields |
|------|------|-----------|
| `AIModel` | Catalogue record, the thing the browser lists and the state machine tracks | `Id`, `Name`, `Source`, `Format`, `Kind`, `Tier`, `State`, `Files`, `License`, `ContextWindow`, `Quantization`, `ParameterCountBillions` |
| `ModelFile` | One file of a release, tracked independently | `FileName`, `LocalPath`, `SourceUrl`, `TotalBytes`, `DownloadedBytes`, `IsPrimary`, `Checksum`, `Format` |
| `LocalModel` | Runtime-facing view of an *installation* — a path, a format, and the limits it will allocate against | `PrimaryFilePath`, `ModelDirectory`, `ContextWindow`, `EstimatedMemoryBytes` |

`LocalModel` is kept separate from `AIModel` on purpose. `AIModel` carries pricing, licence and
provider metadata; a runtime needs none of that and must not be handed fields it could
accidentally interpret as instructions. `LocalModel.Id` is documented as the `AIModel.Id` the
installation was created from, so there is a 1:1 correspondence and no separate install entity —
`State == Installed` *is* the install record.

`AIModel` is a pure domain type. Persistence is configured with the EF Core fluent API in
`JugaadVision.Storage` so Core carries no EF attribute and no outward dependency.

### Enumerations

`ModelSource` says how a model is executed: `Local`, `HuggingFace`, `Ollama`,
`OpenAICompatible`, `Custom`. `ModelKind` says what it does (`TextGeneration`, `Vision`,
`Embedding`, `Upscale`, …) and therefore which runtime and which workspace may offer it.
`ModelFormat` is the on-disk serialisation (`Gguf` is the MVP target). `ModelTier` is the cost
class and drives router preference.

Two derived properties already encode policy and are unit-tested:

- `IsLocallyExecutable` — `Source == Local && State == Installed`. A HuggingFace entry that
  happens to be in the `Installed` state is *not* executable; only a physical file is.
- `RequiresCredential` — true when the source is a remote API and the tier is paid. A local
  model at `SelfHosted` never prompts for a key.

---

## 2. State machine

```
      Discovered
      │   start download
      ▼
  Downloading  ◀ ─────────────┐
      │   ▲                       │ retry, while AttemptCount < 5
      │   │   resume              │
      │   │                       │
      │   └── error──────────────▶│
      │                          ▼
      │                   Failed ◀────────────────────────┐
      │                                                   │
      │   pause                                           │
      ▼                                                   │
     Paused  ── error ──  ────────────────────────────────┘
      │
      └── resume ─────────────────────────────┐
      │                                       │
      │   all files complete and checksums verified
      │                                       │
      ▼                                       │
  Installed  ◀ ───────────────────────────┘
      │
      │   remove: files deleted, record retained
      ▼
  Removed
      │
      └── re-download ──────────────────▶  Discovered

  cancel / discard from Downloading or Paused  ->  Removed, staged partials deleted
  Failed with AttemptCount >= 5               ->  Restart offered instead of Resume
  the startup scan (§7) may also adopt files   ->  Installed, bypassing the download
```

The scan entry is the one arrow that is not a download. It is a reconciliation, not a
transition: a file the user placed on disk by hand has no `Downloading` history, and the record
is created already `Installed`. That is why `Discovered → Installed` is forbidden as a UI action
but reachable through the scan.

`Failed` is entered from `Downloading` or `Paused`; it is a resting state that the user resolves,
not an automatic one. A failed task stays offered for resume while
`BackgroundTask.AttemptCount < 5` — the fifth failure retires it and the user is told to start
over rather than being offered a resume that has never worked.

### Legal transitions

| From | To | Trigger | Guard |
|------|----|---------|-------|
| — | `Discovered` | Catalogue query returns a model not already known; or the startup scan finds files on disk | `UpsertAsync` keyed on `(Source, ExternalId)` so a re-query is idempotent, not a duplicate |
| `Discovered` | `Downloading` | User presses Download on a selected file | Licence shown first; staging has room; destination path writable |
| `Downloading` | `Paused` | User presses Pause, or the process is about to exit cleanly | Current `DownloadedBytes` flushed to the file and to the row before the transition is written |
| `Downloading` | `Failed` | Non-retryable error (HTTP 404/403, disk full, checksum mismatch) or the 5th retry | `ErrorMessage` recorded on the `BackgroundTask`, and surfaced on the model row |
| `Downloading` | `Installed` | Last file reaches `TotalBytes` **and** verification passes (if `VerifyChecksums`) | Primary file present and loadable; a `LocalModel` view is derivable |
| `Paused` | `Downloading` | User presses Resume | HTTP `Range` request from the recorded offset; server must honour it or the download restarts at 0 and the model returns to `Downloading` with `DownloadedBytes = 0` |
| `Paused` | `Removed` | User presses Cancel | Partial files deleted, `State` becomes `Removed` |
| `Failed` | `Downloading` | User presses Retry | `AttemptCount` incremented, capped at 5 |
| `Failed` | `Removed` | User discards | Partial files deleted |
| `Installed` | `Removed` | User removes the model | Files deleted from disk; **record retained** (§8) |
| `Removed` | `Discovered` | User downloads it again | Treated as a fresh download; no stale byte counts carried over |

Transitions that are **not** legal, and must be rejected rather than silently coerced:

- `Installed → Downloading`. Already on disk. Re-downloading goes `Installed → Removed → Discovered → Downloading`.
- `Discovered → Installed` as a *user action*. Bytes have to move through staging first. The one
  legitimate way a record reaches `Installed` without a download is the startup scan (§7), which
  creates the record already installed.
- `Removed → Installed`. Files are gone; the state must be re-earned.
- `Installed → Failed`. Loading a model is a runtime operation, not a lifecycle failure. A
  runtime that cannot open the file reports it on the generation task; it does not demote the model.

The last two are the ones that matter. `AIModel.State` describes *where the bytes are*, and
nothing else. Load failures belong to the task that attempted the load.

### Which state does each tab show

- **Discover** — `State == Discovered`.
- **Downloading / Tasks** — driven by `BackgroundTask`, not by `ModelQuery`.
- **Installed** — `State == Installed`, which is exactly what `IModelRepository.GetInstalledAsync`
  returns and what the Generate workspace picker consumes.
- **Removed** — filtered out of the default view; reachable from history and the model inspector,
  not a tab of its own. `ModelQuery` has no `IncludeRemoved` flag, so today it is reachable only
  by id. That is a gap, not a design: the filter list is where it will be added.

---

## 3. Per-file download tracking

A GGUF release is rarely one file. It is weights split into shards
(`model-00001-of-00004.gguf`), plus a tokenizer, a config, sometimes a chat template. `AIModel.Files`
is a list, and `ModelFile` tracks each entry independently:

| Field | Why it exists |
|-------|---------------|
| `TotalBytes` | Size from `Content-Length` or catalogue metadata. `0` when the source will not say. |
| `DownloadedBytes` | Bytes durably written. **The resume point.** |
| `IsPrimary` | The one file the runtime actually opens. Exactly one per model; the rest are resolved as siblings via `LocalModel.ModelDirectory`. |
| `Checksum` | SHA-256 or SHA-512, used to verify after transfer. Null when the source publishes none. |
| `Format` | Per file, because a release can be weights + a JSON config + a tokenizer of different formats. |
| `SourceUrl` | Null for files that were already local — a scanned model has bytes and no upstream. |
| `LocalPath` | Null while remote. Set when the file is moved out of staging into the model directory. |
| `DownloadedAt` | Set once, on completion. Not on every chunk write. |

`DownloadProgress` is **derived, never stored**:

```csharp
public double DownloadProgress => TotalBytes <= 0
    ? 0d
    : Math.Clamp((double)DownloadedBytes / TotalBytes, 0d, 1d);
```

Three cases matter, all unit-tested in `DomainEntityTests.cs`:

1. `TotalBytes == 0` (source did not send `Content-Length`, or the file was already local) →
   `0.0`, not a division by zero and not a bogus `1.0` from a sentinel value.
2. `DownloadedBytes > TotalBytes` (a resumed range request that the server answered with more
   than was asked for) → clamped to `1.0`. The progress bar never shows 112%.
3. `DownloadedBytes < 0` (a bad resume offset after a server-side truncate) → clamped to `0.0`.

### Why per-file granularity is what makes resume possible

Because resume is a property of a byte range, and a byte range only exists within a single file.

If the download tracked progress as one aggregate `bytesDownloaded / totalBytes` counter, a crash
would leave an app with a number and no way to act on it. It would know "6.2 GB of 8.1 GB" and
still be unable to say which 6.2 GB — four shards at different offsets, one tokenizer complete, a
config file maybe half-written. The only correct recovery is to restart from zero and re-fetch
8.1 GB. On the target hardware that is a multi-hour loss over a residential uplink.

Per-file tracking turns the aggregate into a set of independent, individually resumable units:

- **Completed files are skipped entirely.** The tokenizer that finished before the crash is not
  re-requested. Only the shards with `DownloadedBytes < TotalBytes` are resumed.
- **Each file resumes at its own offset** with `Range: bytes=<DownloadedBytes>-`, which is what
  the field is for. Shard 2 was interrupted at 1.9 GB and shard 3 at 0.4 GB; both resume
  independently in the same pass.
- **Progress is a real aggregate, not a guess.** Model progress is
  `sum(DownloadedBytes) / sum(TotalBytes)` over files with a known `TotalBytes`, with
  unknown-size files counted as indeterminate rather than assumed complete. Every term in that
  sum is a durable row that survived the crash.
- **Cancellation is a file list, not a truncation point.** Cancel means "these specific files,
  delete these specific partials." There is no single blob to truncate.
- **Verification is per file.** One corrupt shard is re-fetched. The failure is attributable.

The rule that follows: `DownloadedBytes` is only ever advanced to a value that is durably on
disk, and persisted with the same write that fsyncs the file. An in-memory byte counter that
outruns the disk is exactly the bug this design exists to make impossible.

### Progress reporting

`BackgroundTask.Progress` is the model-level fraction, `BytesTransferred` and `TotalBytes` the
model-level byte counts, and `BackgroundTask.Title` names the current file — the documented
example is `"Downloading Llama 3.1 8B (2 of 4 files)"`. The UI therefore has a coarse number for
the bar and a specific file for the status line, without the download manager inventing a second
progress model.

---

## 4. Downloads are background tasks

Downloads are not a special subsystem. They are `BackgroundTask` rows with
`Kind == TaskKind.Download` and `ModelId` pointing at the `AIModel`, alongside
`TaskKind.Generation`, `Scan`, `Install` and `Index`. One Tasks view (UC-07) shows all of them,
and one repository persists them.

That is what makes the crash story work. `BackgroundTask` is documented as the app's *durable*
record of work in flight, written on transition rather than only at the end. So the sequence for
a download is:

1. Write the task row in `Queued` **before** any bytes move.
2. On start, set `State = Running`, `StartedAt`.
3. On every chunk, advance `BytesTransferred` and `Progress`; flush to disk on an interval, not
   per chunk.
4. On pause or failure, write `State = Paused` / `Failed`, `ErrorMessage`, `AttemptCount`,
   `ResumableSince`, and the final `DownloadedBytes` for every `ModelFile`.

Kill the process at any point and the last flushed state is coherent. On next launch,
`ITaskRepository.GetResumableAsync` returns every task in a resumable state, the app matches each
back to its `AIModel`, and the Tasks view shows "interrupted — resume?" with the byte counts
already filled in. Nothing is inferred from partial bytes on disk; the row is the truth.

### Pause

Pause is a cooperative stop, not a kill. Cancel the transfer, let the writer flush and close,
record the true `DownloadedBytes` (which may be slightly ahead of the last flush — the delta is
simply discarded, which is safe because the resume offset is re-derived from the file's real
length on disk), then transition the model to `Paused`. The staged partials are **kept**. Pausing
a 7 GB download of a model the user will want back tomorrow must not cost 7 GB.

### Resume

Resume is legal when `BackgroundTask.IsResumable` holds:

```csharp
public bool IsResumable => State is TaskState.Paused or TaskState.Failed && AttemptCount < 5;
```

A paused task is always resumable. A failed one is resumable until it has failed five times, at
which point the app stops offering Resume and shows Restart — offering the same broken operation
for a sixth time is worse than being explicit. `AttemptCount` is the whole retry policy for
downloads; `GenerationSettings.MaxRetries` governs provider requests and does not apply here.

On resume, the download manager reconciles the row against the filesystem before it opens a
socket: if the staged file is longer than `DownloadedBytes`, the offset moves up to the real
length; if it is shorter, the offset moves down. The row is advisory; the file is authoritative.
A server that ignores `Range` and replies `200` instead of `206` resets that file to
`DownloadedBytes = 0` and truncates the partial rather than concatenating a full body onto a
half file.

### Cancel

Cancel is available from any non-terminal state and is the one destructive transition. The
`TaskState.Canceled` value is terminal — `IsTerminal` is true for `Succeeded` and `Canceled`
only — and the model transitions to `Removed`. Staged partials for that model are deleted. The
`AIModel` record survives; the byte counters do not.

There is no `Paused → Canceled → Resumed` path. Once cancelled, the work is gone and restart is
the only way back. That asymmetry with pause is intentional: pause is a deferral, cancel is a
decision.

`ITaskRepository.PruneCompletedAsync(olderThan)` exists so terminal rows do not accumulate
forever; it is driven by a cutoff, and it only ever touches terminal tasks.

---

## 5. Checksum verification

`ModelSettings.VerifyChecksums` defaults to `true`. When set, after a file reaches
`DownloadedBytes == TotalBytes` and **before** the file is moved out of staging:

1. Hash the staged file (SHA-256 or SHA-512, per `ModelFile.Checksum`).
2. Compare against the expected digest.
3. On match: stamp `DownloadedAt`, clear the staging copy by moving it into the model directory,
   set `LocalPath`.
4. On mismatch: delete the staged file, reset `DownloadedBytes` to 0, and fail. The model goes to
   `Failed` with the mismatch recorded. It does **not** silently retry forever — a corrupt body
   is a hard failure, and the retry counter is what the user sees.

If the source publishes no digest, `Checksum` is null and the file moves through unverified. That
is a real gap, not a silent pass: the model browser shows verification state per file, and a
release with no digests is visibly weaker than one with them.

The hash is computed over the staged copy, before promotion. Verifying after the move would mean
verifying a file already inside the models directory, where a failure requires untangling a
half-installed model from the installed set.

`AdvancedSettings.AllowUntrustedModels` is `false` by default and gates installation from
repositories the user has not vouched for. An untrusted model can be downloaded for inspection
but not installed; checksum verification is the integrity check, and trust is a separate, explicit
user decision that verification does not imply.

---

## 6. Staging directory

Downloads land in a staging area and are promoted into the model directory only after
verification. This exists so that a model directory never contains a half-written file that some
other process — or a crash-recovery scan — could mistake for a complete model.

`ModelSettings.MaxStagingBytes` defaults to 10 GiB (`10L * 1024 * 1024 * 1024`) and is the cap
on total bytes retained by staging before old partials are pruned.

The rule: a new download is refused, with a clear message naming the space, when
`currentStagingBytes + requiredBytes > MaxStagingBytes`. It is refused rather than allowed to
evict something on its own. Silently deleting another model's partial to make room for this one
would destroy resumable work the user may have paused hours ago and intends to finish.

Pruning is therefore explicit and ordered — oldest first, paused-but-not-failed before failed
before orphaned:

1. Partials belonging to models in `Failed` past the attempt limit.
2. Partials whose `AIModel` is `Removed`.
3. Partials older than a cutoff with no `BackgroundTask` in a live state.

A partial belonging to a `Paused` model is never pruned while the user can still resume it.

The cap is 10 GiB because staging is a buffer, not a library. A 47 GB model is downloaded
straight through staging in one pass, and on a machine with 32 GB of RAM and a few hundred GB of
free disk, keeping a 10 GiB ceiling is generous while still bounding the worst case where several
paused 8B models accumulate.

---

## 7. Startup scan

`ModelSettings.ModelDirectories` is the list of directories the app treats as model locations.
`ModelSettings.ScanOnStartup` defaults to `true`.

On launch, if `ScanOnStartup` is set, a `TaskKind.Scan` task walks each directory and
reconciles the filesystem with the database. The scan is what makes the app truthful after the
user does something outside it: copies a GGUF in by hand, deletes a directory, moves a model to
another disk.

Per directory:

- Enumerate files. Recognise `ModelFormat` from the extension *and* the file header, and treat
  disagreement as a reason to distrust the entry rather than to prefer either answer.
- Group shards: `model-00001-of-00004.gguf` and siblings belong to one model, not four. The
  primary file is the shard the runtime opens; the rest are resolved as siblings through
  `LocalModel.ModelDirectory`.
- For each group, match against existing records by `(Source, ExternalId)` where available, then
  by primary file path. A match updates the record in place; a new group becomes a new
  `Discovered`→`Installed` record with `Source = Local`, `SourceUrl = null`,
  `TotalBytes = file size`, `DownloadedBytes = file size`, `DownloadedAt` from the filesystem.
- Files with no record and no upstream are adopted as local. This is the only path by which a
  model reaches `Installed` without a download, and it is why the §2 rule "you cannot skip
  `Downloading` to reach `Installed`" is a UI-state rule, not a database invariant.
- Records with `State == Installed` whose files have vanished are moved to `Removed`, not deleted.
- Directory enumeration is bounded: no recursive walk into nested trees, and no following of
  symlinks out of the configured root. A scan must not be a filesystem-wide search that a user
  did not ask for.

`ScanOnStartup = false` disables the automatic pass; the same scan then runs on demand from
Settings. Scanning is read-mostly: it must be cheap enough to run inside the 2-second startup
target (PRODUCT_SPEC §5), so it records what it finds and defers hashing. Checksums are **not**
re-verified on every startup — a full re-hash of a 47 GB model on each launch would blow the
startup budget. Verification runs at download time, and on demand from the model inspector.

`ModelDirectories` is empty by default. Seeding it is a platform concern: `JugaadVision.Platform`
resolves the XDG path and the app writes it on first run. An empty list means "nothing is
installed here yet", not "scan everything".

---

## 8. What removal does

`Installed → Removed` deletes the model's files from disk and **retains the `AIModel` row**.

The files are removed: every `ModelFile` with a `LocalPath`, the model directory if it is empty
afterwards, and any staging residue. The record is kept, with `State = Removed`, `InstalledAt`
and `LastUsedAt` intact.

The row is retained for four reasons, all of which break if the record is deleted:

1. **Generation history references it.** UC-05 lists every past generation with the model that
   produced it. Deleting the model record turns those rows into dangling ids, and the history
   view either breaks or silently shows "unknown model".
2. **Projects reference it.** A saved `.jgvproj` pins the model that made its assets. On reopen,
   the app can say "Llama 3.1 8B was used here, and it is no longer installed" instead of
   showing a broken selection.
3. **The distinction matters.** `Removed` means "this was here, deliberately uninstalled".
   A record that does not exist means "never seen". A user who removed a 47 GB model to free disk
   and then re-runs the same search should not be told the model is available to download as if
   for the first time.
4. **Re-download is cheaper from a retained record.** Metadata, licence, checksums and the
   file list are already known; the redownload skips discovery.

`State = Removed` also makes the model ineligible everywhere without deleting anything:
`IsLocallyExecutable` is false, `GetInstalledAsync` does not return it, and the Generate picker
cannot select it. The record is inert, not reachable, and costs one row.

A hard delete (`IModelRepository.DeleteAsync`) is a separate, deliberate act for purging
catalogue noise — never the action behind a "Remove" button.

`Removed → Discovered → Downloading` is the re-download path. Byte counters reset; the metadata
carries over. Nothing about the retained record is treated as authoritative about the filesystem,
which is why the scan (§7) is the tiebreaker for a file that vanished behind the app's back.

---

## 9. Linux storage layout

| Purpose | Path | Basis |
|---------|------|-------|
| Installed models | `$XDG_DATA_HOME/jugaadvision/models` (default `~/.local/share/jugaadvision/models`) | Survives app restart; user-owned data, per PRODUCT_SPEC §5 "Data persistence" |
| Download staging | `$XDG_CACHE_HOME/jugaadvision/staging` (default `~/.cache/jugaadvision/staging`) | Disposable by definition; safe for the OS to purge under pressure |
| Bundled runtime | Application install prefix | Not under either of the above — see §10 |
| Database | `$XDG_DATA_HOME/jugaadvision/` | Beside the models, not in config |

Staging goes under `XDG_CACHE_HOME` rather than beside the models for a reason beyond tidiness: it
is the one directory where "cleared by the system" is a recovery mechanism rather than data loss.
A 10 GiB staging cap plus an OS cache purge will never destroy an installed model, and a user who
is desperate for disk has a lever that does not require opening Settings.

`ModelSettings` carries the *policy* (`ModelDirectories`, `MaxStagingBytes`, `ScanOnStartup`,
`VerifyChecksums`); it does not carry the resolved paths. Those come from
`JugaadVision.Platform`, which is the only project that may touch XDG. This keeps Core testable
without a real home directory and keeps path resolution in one place if the layout ever changes.

---

## 10. Security: model files are never executed

PRODUCT_SPEC §5, non-functional requirements:

| Requirement | Target |
|-------------|--------|
| Model file execution | Never auto-execute downloaded binaries |

Concretely, throughout the download and install path:

- A model file is **inert data**. It is opened read-only, hashed as a byte stream, moved with a
  filesystem move. It is never `chmod +x`, never `execve`, never handed to `Process.Start`, and
  never loaded as a shared library. There is no code path in which a file's *content* causes
  execution.
- A `.gguf` file is a container format, not a program. `ModelFormat.Gguf` selects a reader. The
  only native code that ever runs in the process is the bundled runtime's own shared library,
  resolved from the application install prefix — a fixed path in the shipped package, not a path
  derived from a model, a catalogue entry, or anything under the models directory.
- A `ModelSource.Local` record adopted by the scan (§7) is a path the *user* placed on disk. It
  gets no more trust than a downloaded file, and no less: it is read, never run.
- File permissions on staged and installed models are `0644`. Nothing in the model directories is
  executable, so a compromised or careless path elsewhere on the system cannot reach them as
  code.
- `ModelSource.Local` + `State == Installed` is what authorises a *runtime load* — and loading
  means reading a well-known container through a known parser, not executing model content.

The generalisation: the models directory is a data directory. Nothing in the app promotes a file
from data to code, and a model record — however it entered the database — is never a capability to
execute.

---

## 11. Hardware reality: CPU-only inference

The development machine is an Intel HD 530 plus a Quadro M1000M, with 32 GB of RAM. The HD 530 is
integrated graphics with no compute runtime; the Quadro M1000M is a mobile workstation part whose
VRAM is a small fraction of what a useful LLM offload needs. Between them there is not enough
VRAM to hold a meaningful slice of a modern GGUF plus KV cache, so **local inference is CPU-only
in practice on this hardware.**

(The exact per-device VRAM is not hardcoded anywhere — it is read at runtime from
`HardwareSnapshot.Gpus[].TotalMemoryBytes`, populated by `JugaadVision.Platform` from
`lspci`/`nvidia-smi`/sysfs. What matters to this document is the decision the code already
encodes: `GpuInfo.IsUsableForInference` is false when a GPU exists but no driver exposes it for
compute, and UC-02 falls back to CPU.)

What that means for the model system:

- **The bundled runtime is CPU-only in the MVP.** llama.cpp is the planned runtime (UC-02, MVP
  item: "Local GGUF inference via llama.cpp (CPU, bundled)"). GPU acceleration for llama.cpp is
  explicitly post-MVP in PRODUCT_SPEC §4.
- **`HardwareSettings.ForceCpuOnly` defaults to `false`** but the effective behaviour on this
  machine is CPU anyway. The setting exists for correctness on machines that *do* have usable
  VRAM, not to describe this one.
- **`HardwareSettings.PreflightMemory` defaults to `true`**, and this is the setting that carries
  the weight here. With no GPU to fall back on and a 32 GB ceiling, an oversized model either
  thrashes or gets OOM-killed. `LocalModel.EstimatedMemoryBytes` is pre-flighted against
  `HardwareSnapshot.Memory.AvailableBytes` so the load fails with a clear message instead of the
  OOM killer ending the process with no diagnostic. `AIModel.ParameterCountBillions` exists
  specifically to warn *before* the load.
- **Sizing guidance for the browser.** The browser should surface the estimate and the free memory
  next to any download, so a 70B model is visibly a bad fit on a 32 GB box before 40 GB of
  download starts. Quantisation (`AIModel.Quantization`) is the lever that makes 8B-class models
  comfortable here; a Q4_K_M 8B fits in RAM with room for a usable context window, and that is
  the band the MVP targets.
- **Load progress is not optional.** `ILocalRuntime.WatchLoadAsync` exists because a CPU-only
  mmap of a multi-gigabyte GGUF takes long enough that UC-02 requires visible progress and the UI
  thread must never block. `LoadProgress.FromFraction` clamps to `[0, 1]` for the same reason
  `ModelFile.DownloadProgress` does: a progress bar that can exceed 100% is a bug report waiting
  to happen.

None of this changes the model lifecycle. It changes what the app is willing to let you install,
and when it tells you no.

---

## 12. Implemented vs planned

### Implemented (compiles, unit-tested)

| Item | Location |
|------|----------|
| `AIModel`, `ModelFile`, `LocalModel` | `JugaadVision.Core/Models/` |
| `ModelState`, `ModelFormat`, `ModelKind`, `ModelSource`, `ModelTier` | `JugaadVision.Core/Enums/ModelEnums.cs` |
| `TaskKind`, `TaskState` | `JugaadVision.Core/Enums/TaskEnums.cs` |
| `BackgroundTask` with `IsTerminal` / `IsResumable` | `JugaadVision.Core/Models/BackgroundTask.cs` |
| `ModelSettings` — all four fields | `JugaadVision.Core/Models/AppSettings.cs` |
| `IModelRepository`, `ModelQuery`, `ITaskRepository`, `ISettingsStore` | `JugaadVision.Core/Abstractions/IRepositories.cs` |
| `ILocalRuntime` (incl. `WatchLoadAsync`) | `JugaadVision.Core/Abstractions/ILocalRuntime.cs` |
| `IAIProvider.DiscoverModelsAsync` | `JugaadVision.Core/Abstractions/IAIProvider.cs` |
| `LoadResult`, `LoadedModel`, `LoadProgress` | `JugaadVision.Core/Generation/LoadContracts.cs` |
| `FileFilter.Gguf` | `JugaadVision.Core/Abstractions/IPlatformServices.cs` |
| Derived-property tests | `JugaadVision.Tests/Core/DomainEntityTests.cs` |

### Planned — nothing exists yet

`JugaadVision.Models` contains **only** `JugaadVision.Models.csproj`. It has no `.cs` files. The
same is true of `JugaadVision.AI`, `JugaadVision.Platform`, and `JugaadVision.Storage`. Every
layer holds types and interfaces only; `ServiceCollectionExtensions.AddJugaadVisionServices`
registers `AppState` and nothing else, by design, so the composition root is the one place that
will know the whole graph.

Everything in §§3–8 is a specification of what that project must build:

| Planned type | Responsibility |
|--------------|----------------|
| `IModelCatalog` / HuggingFace client | `DiscoverAsync` → `AIModel` + `ModelFile` list; licence and size before download (UC-01) |
| `IModelDownloadService` | Range requests, per-file resume, pause/cancel, `BackgroundTask` transitions |
| `IChecksumVerifier` | SHA-256/SHA-512 over staged files, gated on `VerifyChecksums` |
| `IStagingManager` | Path resolution under `XDG_CACHE_HOME`, `MaxStagingBytes` enforcement, ordered pruning |
| `IModelInstaller` | Promotion from staging to the model directory, `LocalModel` construction |
| `IModelScanner` | Directory walk, shard grouping, DB reconciliation (§7) |
| `IModelRemovalService` | File deletion with record retention (§8) |
| `LlamaCppRuntime : ILocalRuntime` | CPU-only GGUF load, `WatchLoadAsync`, `UnloadAsync` |
| `ModelRepository`, `TaskRepository`, `SettingsStore` | EF Core persistence for the above |
| `XdgPathResolver` | XDG resolution and first-run seeding of `ModelDirectories` |

The state machine itself is not an implementation gap — the enum, its semantics, and its derived
predicates are in Core and tested. What is missing is the code that walks it, and the tests that
drive it through crash and resume. The pieces that must not be improvised, because the domain
types already assume them, are the durable-write ordering (§4), the filesystem-over-row authority
on resume (§4), and the never-execute rule (§10).
