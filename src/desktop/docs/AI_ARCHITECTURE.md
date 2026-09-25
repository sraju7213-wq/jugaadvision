# AI Architecture — Provider Abstraction, Router, Local Runtime

Companion to PRODUCT_SPEC.md. Section references (`§3 UC-02`) point at that document; class and file references point at source under `src/desktop/`.

Scope: how a prompt in the Generate workspace becomes a result, whether it runs on the user's own machine or a cloud API, and what happens when the first attempt fails.

---

## 0. Implementation status (read first)

| Layer | State | Location |
|-------|-------|----------|
| Contracts and interfaces | **Implemented** | `JugaadVision.Core/Abstractions`, `JugaadVision.Core/Generation`, `JugaadVision.Core/Models` |
| `IAIProvider` implementations (OpenRouter, HuggingFace, OpenAI-compatible, custom) | **Planned** | `JugaadVision.AI/Providers/` — directory does not exist yet |
| `ILocalRuntime` implementations (llama.cpp) | **Planned** | `JugaadVision.AI/Runtimes/` — directory does not exist yet |
| Router (`IAIRouter` / `ProviderRouter`) | **Planned** | `JugaadVision.AI/Routing/` — not yet defined as a type |
| Retry / timeout / cancellation policy | **Planned** | `JugaadVision.AI/Infrastructure/` |

`JugaadVision.AI.csproj` today references `Microsoft.Extensions.Http`, `Microsoft.Extensions.Logging.Abstractions`, and `Microsoft.Extensions.Options`, and project-references Core, Storage, and Platform. It contains no `.cs` files. Everything in sections 2 through 7 below is a design commitment against contracts that exist today, not a description of running code. Where this document names a type that does not exist yet, it says **planned**.

### 0.1 Open item: the inferred tail of `ILocalRuntime`

> **This needs user review before implementation.**

PRODUCT_SPEC.md §3 UC-02 requires three things of local inference: "Model loads in background (progress visible)", "Inference runs on a background thread, UI never freezes", and — via §4 Must Have "Installed model manager (load/unload/inspect/remove)" — an explicit way to release a model.

The specification's `ILocalRuntime` definition was **truncated mid-signature**, cut off after `LoadModelAsync`. The members after it in `JugaadVision.Core/Abstractions/ILocalRuntime.cs` are **inferred, not specified**:

| Member | Inferred from | Confidence |
|--------|---------------|------------|
| `GenerateAsync(LoadedModel, GenerationRequest, CancellationToken)` | UC-02 "Inference runs on a background thread" | High — mirrors `IAIProvider.GenerateAsync` |
| `UnloadAsync(LoadedModel, CancellationToken)` | §4 "Installed model manager (load/unload/...)" | High |
| `WatchLoadAsync(LocalModel, CancellationToken)` → `IAsyncEnumerable<LoadProgress>` | UC-02 "progress visible" plus "UI never freezes" | Medium — an `IProgress<LoadProgress>` callback was an equally valid reading; the async-enumerable form was chosen because it composes with `await foreach` on a background thread and needs no SynchronizationContext marshalling |
| `LoadedModels` | UC-07 "Home screen shows active model, runtime status" | High |
| `SupportedKinds` | §4 "Local GGUF inference via llama.cpp (CPU, bundled)" — a CPU GGUF text runtime serves exactly one kind | Medium — will need widening for the post-MVP image and audio runtimes (§4 Should Have) |

If any of these are wrong, they are cheap to change now and expensive after `JugaadVision.AI` builds on them. The `WatchLoadAsync` shape in particular is the one most worth a decision.

---

## 1. The shape of the system

```
   Generate workspace (Avalonia view-model)
            |
            |  GenerationRequest  (provider-neutral, immutable record)
            v
   +-----------------------+
   |      AI Router        |  picks a backend, owns retry + fallback
   +-----------------------+
        |            |
        | local      | cloud
        v            v
   +----------+   +----------------+
   |  ILocal  |   |   IAIProvider  |   OpenRouter / HuggingFace /
   |  Runtime |   |                |   OpenAI-compatible / custom
   |(llama.cpp)|  +----------------+
   +----------+          |
        |                 v
        |          HttpClient  ->  ISecretStore (libsecret)
        v
   native lib / daemon
```

Two seams, one request type. `GenerationRequest` (`GenerationContracts.cs`) carries no provider-specific fields, so the same record is handed to a local runtime or posted to a REST endpoint without translation. This is the reason `GenerationRequest` is a `sealed record` with `init`-only properties: a retry can hand the identical instance to a second provider with no risk of partial mutation by the first.

Three assemblies, one direction of dependency:

- `JugaadVision.Core` — domain types and interfaces only. No I/O, no `HttpClient`, no native interop. Referenced by everything.
- `JugaadVision.AI` — all AI implementation: providers, runtimes, the router, the retry policy. References Core, Storage, Platform.
- `JugaadVision.App` — Avalonia shell. References Core; reaches implementations through DI.

Nothing in Core names a provider, a runtime, or `HttpClient`. That is what keeps the abstraction honest: a future provider is a new class in `JugaadVision.AI`, never a `switch` in Core.

---

## 2. `IAIProvider` — the cloud seam

`JugaadVision.Core/Abstractions/IAIProvider.cs`. One implementation per provider, registered in DI under its `Name`.

| Member | Contract | Notes |
|--------|----------|-------|
| `string Name` | Stable key used in configuration and DI, e.g. `"openrouter"` | Matches `ProviderConfig.ProviderKey` |
| `bool IsConfigured()` | A usable credential is resolvable | **Must never perform I/O.** It gates the Settings list and the router's candidate set, and is called on the UI path |
| `Task<IReadOnlyList<AIModel>> DiscoverModelsAsync(ct)` | Models this provider can serve | UC-01. Feeds the model browser |
| `Task<AIResponse> GenerateAsync(GenerationRequest, ct)` | Runs one generation | UC-03 |
| `Task<bool> TestConnectionAsync(ct)` | Verifies credential and reachability | Returns `false` rather than throwing; drives `ProviderStatus` |

### 2.1 Failures are returned, not thrown

This is the single most important convention in the design, and it is stated in the interface's own remarks.

> Providers return expected failures as `AIResponse` with `Succeeded = false`. Exceptions are reserved for programming errors and `OperationCanceledException`, which always propagates.

The reason is the router. Falling back from a rate-limited OpenRouter to a local llama.cpp model is **expected business flow**, not an error path. If a provider threw, the router would need `try`/`catch` per candidate, and the distinction between "the provider failed" and "our code is broken" would be lost inside a `catch (Exception)`. Returning failures keeps the candidate loop flat:

```csharp
foreach (var candidate in candidates)
{
    var result = await candidate.Provider.GenerateAsync(request, ct);
    if (result.Succeeded) return result;
    if (!settings.AllowProviderFallback) return result;
    // record result.ErrorCode against candidate.Config, try the next one
}
```

Exceptions remain for:

- `OperationCanceledException` — always propagates, never converted to a failed `AIResponse`, because a user cancel is not a provider failure and must not trigger a fallback to a different backend.
- Programming errors — a null dereference, an unrecognised `ModelSource`, a malformed response shape. These are bugs; they surface as crashes with a stack trace, not as a silent "provider unavailable" that the router walks past.

`IAIProvider.IsConfigured()` follows the same rule by returning a bool rather than throwing when no credential exists.

### 2.2 Provider configuration

`JugaadVision.Core/Models/ProviderConfig.cs`. Holds **no secret material** — only `CredentialReference`, the opaque handle resolved through `ISecretStore` (`IPlatformServices.cs`, backed by Secret Service / libsecret on Linux with an AES-256-GCM encrypted-file fallback per `CredentialSource`).

PRODUCT_SPEC.md §5 requires "API key security | Never in plaintext, never in logs". That requirement is why `ProviderConfig` is a separate entity from the secret, and why the entity is documented as safe to log, export, and back up. No field on it can leak a key.

Router-relevant members:

| Member | Default | Router use |
|--------|---------|-------------|
| `IsEnabled` | `true` | Hard filter on the candidate set |
| `IsUsable` | computed | `IsEnabled && Status != NotConfigured && CredentialSource != None` — the second filter |
| `Status` | `NotConfigured` | Third filter, plus a signal to skip known-bad providers |
| `TimeoutSeconds` | `120` | Per-attempt timeout, section 4.2 |
| `MaxRetries` | `3` | Retry attempts for that provider, section 4.3. `0` disables retries |
| `PreferredModelIds` | `[]` | Ordered preference, section 3.2 |

`ProviderStatus` (`ProviderEnums.cs`) is a UI-facing health enum, not a routing decision in itself: `NotConfigured`, `Configured`, `Testing`, `Healthy`, `Unreachable`, `RateLimited`, `InvalidCredential`. The router reads it to skip providers; Settings → AI Providers (UC-03) renders it.

### 2.3 Base URL resolution

`ProviderConfig.BaseUrl` is mutable because self-hosted and custom endpoints depend on it. Precedence, highest first:

1. `AdvancedSettings.GlobalBaseUrlOverride` — applied to every provider that does not define its own.
2. `ProviderConfig.BaseUrl` — per-provider.
3. A built-in default for well-known providers.

`AdvancedSettings.CustomHeaders` are merged into every request. A header whose name matches the credential header is rejected, not silently overridden — a custom header must never be able to exfiltrate or replace the key.

---

## 3. The Router

**Planned.** No router type exists in the solution yet. This section is the contract Core and `JugaadVision.AI` are being written against.

The router is the only component that knows both local and cloud exist. It takes a `GenerationRequest`, resolves it to an ordered candidate list, and runs the retry/fallback loop until something succeeds or the candidates are exhausted.

### 3.1 Candidate selection

Candidates come from the selected `AIModel` in the Generate workspace, resolved against the installed providers and runtimes. A model is a candidate only if all of the following hold:

1. It is reachable — `AIModel.IsLocallyExecutable` for a local model (`Source == Local && State == Installed`), or a provider whose `ProviderConfig.IsUsable` holds.
2. Its format is supported — for local, some `ILocalRuntime` with `IsAvailable == true` reports `SupportsFormat(model.Format)`.
3. Its kind is supported — for local, that runtime lists the kind in `SupportedKinds`.
4. Privacy permits it — `PrivacySettings.AllowCloudGeneration` is `true` for any cloud candidate. With it off, cloud candidates are excluded entirely and the router reports that it has no candidate rather than falling back to a provider the user disallowed.
5. Offline permits it — no reachable network means no cloud candidate (UC-06: "HuggingFace search and cloud generation are unavailable", communicated in the UI rather than failing at request time).

### 3.2 Ordering

Explicit user selection wins outright. If the user picked a provider and model in the Generate workspace (UC-03: "User selects the provider + model in the Generate workspace"), that pair is the sole candidate and the router does not reorder it. Preference among several equally eligible candidates — a model usable by more than one backend, or a family of models where the user did not pin one — is decided in this order, highest first:

1. **`ProviderConfig.PreferredModelIds` order.** The provider's own ordered list of model ids, most-preferred first. This is the user expressing a preference once in Settings rather than per generation.
2. **Local-first when the model is local and already resident.** A resident model in an `ILocalRuntime.LoadedModels` entry costs nothing to use: no load wait, no per-token charge, no data leaving the machine (PRODUCT_SPEC §1 "Local-first"). A cold local model is still preferred over a paid cloud model, but the load time is shown up front rather than discovered mid-run.
3. **Availability.** `ProviderStatus.Healthy` first, then `Configured`, then `Unreachable` and `RateLimited` last. `InvalidCredential` and `NotConfigured` are filtered out in 3.1, not merely deprioritised.
4. **Cost.** `AIModel.Tier` (`Free` before `Paid` before `SelfHosted` before `Enterprise`), then `PriceInputPerMillion` / `PriceOutputPerMillion` for models within the same tier. Local and `SelfHosted` models carry null pricing and sort as zero-cost.
5. **Stability tiebreak.** `AIModel.LastUsedAt` descending, so repeated work stays on the model that was working. Deterministic and stable, which matters for a router the user will try to reason about from the UI.

The cost estimate implied by 4 is computed from the request before dispatch and shown in the UI, so a paid candidate never runs unannounced.

### 3.3 Fallback

`GenerationSettings.AllowProviderFallback` (default `true`) is the switch. When it is off, a failed candidate is returned to the user immediately, with its `ErrorMessage` and `ErrorCode` intact. When it is on, the router moves to the next candidate under these rules:

- **Only on failure, never on partial success.** A response with `Succeeded = true` and empty text is a success. The router does not second-guess an empty result.
- **A non-retryable failure is still a fallback trigger.** A 400 from a mistyped model id will not improve on retry against the same provider, but a different provider may not share that error. Fallback is about a different backend, not the same one again.
- **Every attempt is recorded.** `AIGeneration` stores `ProviderName`, `Duration`, `ErrorMessage`, `PromptTokens`, `CompletionTokens`, and `CostUsd` (UC-05), so a run that fell through two providers shows two attempts in History rather than one opaque failure.
- **Cancellation short-circuits.** A cancelled `ct` ends the loop. The router never falls back *because* a user cancelled.
- **Cost of a failed attempt still counts.** A provider that bills for a request it then fails to complete has still charged the user. The aggregate `CostUsd` shown after a fallback run sums every attempt, not just the successful one.

The router's own output is an `AIResponse`. When every candidate fails, the router returns the failure from the *last* candidate (most recent information) with an error code that names the aggregate, not a single provider.

---

## 4. Retry, timeout, and cancellation

**Planned.** Policy lives in `JugaadVision.AI/Infrastructure/`, wrapping whichever `HttpClient` the provider was constructed with. The `Microsoft.Extensions.Http` reference in `JugaadVision.AI.csproj` exists for this.

### 4.1 `IsRetryable` drives everything

`AIResponse.IsRetryable` is the provider's verdict on whether the same request could plausibly succeed. The provider classifies at the point of failure, where the HTTP status and body are in hand; the retry policy does not re-derive it. Core's contract test `FailureResponse_CanBeMarkedRetryable_ForRouterFallback` pins the mechanism.

### 4.2 Retryability classification

| Condition | `ErrorCode` | `IsRetryable` | Router / retry action |
|-----------|-----------|----------------|------------------------|
| 400 Bad Request — malformed body, bad parameter, unknown model id | `invalid_request` | No | Fail the candidate immediately. A retry sends the identical request and fails identically. Fall through to the next provider, which may not share the constraint. |
| 401 Unauthorized | `invalid_credential` | No | Fail the candidate. Set `ProviderStatus.InvalidCredential`; prompt the user in Settings. Retrying a rejected key is pointless and, at volume, looks like credential stuffing. |
| 403 Forbidden | `invalid_credential` | No | Same as 401. |
| 404 Not Found — wrong base URL or wrong model path | `not_found` | No | Fail the candidate. Usually a `BaseUrl` configuration error, which the user must fix. |
| 408 Request Timeout | `timeout` | Yes | Retry with backoff. |
| 409 Conflict | `conflict` | No | Fail the candidate. |
| 413 Payload Too Large — prompt exceeds the provider's context | `payload_too_large` | No | Fail the candidate and surface the token counts so the user can shorten the prompt. A smaller context window on the next provider may succeed — that is fallback, not retry. |
| 422 Unprocessable Content | `invalid_request` | No | Fail the candidate. |
| 429 Too Many Requests | `rate_limited` | Yes | Retry with backoff. Honour `Retry-After` when the provider sends one, capped at 30s. Set `ProviderStatus.RateLimited`; the router deprioritises this provider for subsequent candidates in the same run. |
| 500 Internal Server Error | `server_error` | Yes | Retry with backoff. |
| 501 Not Implemented | `not_implemented` | No | Fail the candidate. The endpoint will not start working on a second attempt. |
| 502 Bad Gateway / 504 Gateway Timeout | `upstream_error` | Yes | Retry with backoff. An intermediary is failing, not the provider. |
| 503 Service Unavailable | `unavailable` | Yes | Retry with backoff. Honour `Retry-After`. |
| 529 Overloaded (Anthropic-style) | `overloaded` | Yes | Retry with backoff. |
| DNS resolution failure | `dns_failure` | Yes | Retry with backoff. Transient network. |
| TCP connect refused | `connection_refused` | Yes | Retry with backoff. |
| TLS handshake failure | `tls_failure` | Yes | Retry once, then fail. A second identical failure suggests a certificate or proxy configuration problem the user must see. |
| Socket timeout / no bytes within the attempt timeout | `timeout` | Yes | Retry with backoff. |
| Credential not resolvable from the secret store | `invalid_credential` | No | Fail the candidate and flag the config as broken. |
| Malformed or unparseable response body | `invalid_response` | No | Fail the candidate. A provider returning garbage is a provider bug; retrying multiplies the cost. |
| Local runtime reports the model is not loaded | `model_not_loaded` | Yes (once) | The router loads the model and retries once. See 5.3. |
| Local model file missing or unreadable on disk | `model_missing` | No | Fail with a message naming the path. The user must reinstall. |
| Out of memory during a local load | `out_of_memory` | No | Fail with the pre-flight message. See 5.4. |
| Cancellation | — | — | `OperationCanceledException` propagates. Never becomes an `AIResponse`, never retries, never falls back. |

The dividing line: **transient conditions retry, permanent conditions fall through.** A retry is only ever issued against the same provider with the same request. Anything that would need a different request, a different configuration, or a human decision is a failure, and the router moves on or stops.

### 4.3 Backoff

Exponential with full jitter, over attempts bounded by `ProviderConfig.MaxRetries` (default `3`, `0` disables retries):

```
delay(attempt) = random(0, min(cap, base * 2^(attempt - 1)))

base = 500 ms
cap  = 30 s
```

Attempt 1 waits up to 500 ms, attempt 2 up to 1 s, attempt 3 up to 2 s, attempt 4 up to 4 s, and so on until the cap. `Retry-After` from a 429 or 503 replaces the computed delay when present, capped at 30 s so a hostile or misconfigured header cannot park a request indefinitely.

Full jitter rather than fixed exponential: when several users or several workspace tabs hit the same rate limit, fixed backoff re-synchronises them into a thundering herd on the same retry boundary. Randomising across the whole interval spreads the load.

A **hard request cap** bounds the total work per generation: retries across all providers for one `GenerationRequest` may not exceed 10 HTTP requests. Without it, a `MaxRetries = 3` on four candidates would be up to sixteen requests for one prompt, with sixteen chances to be billed. When the cap is reached, the router stops retrying and either falls through to the next provider or returns the failure, depending on `AllowProviderFallback`. The cap is counted per generation, not per provider.

### 4.4 Timeout

Effective timeout for one attempt, highest precedence first:

1. `GenerationRequest.TimeoutSeconds` — per-request override, for a known-long render.
2. `ProviderConfig.TimeoutSeconds` — per-provider, default `120`.
3. `GenerationSettings.TimeoutSeconds` — the global default, also `120`.

Clamped to `[5, 900]` seconds. The floor stops a typo from producing instant timeouts; the ceiling stops a hang from outliving the session.

Timeout is per attempt, not per generation. A generation with three retries can therefore run for `4 x TimeoutSeconds` in the worst case, bounded by the hard request cap of 4.3.

A timeout is a **retryable** failure (`timeout` in 4.2) but is also one of the strongest fallback triggers: a request that timed out against a slow provider is a good candidate for a faster one, and waiting through three backoffs to fail again is wasted user time. The router surfaces the elapsed time in the UI when it gives up on a candidate, so "it was slow" is distinguishable from "it was broken".

### 4.5 Cancellation

Discipline, applied at every layer:

- Every `IAIProvider` and `ILocalRuntime` method takes a `CancellationToken` as its last parameter. None of them has an overload without one.
- The UI's Cancel button cancels a `CancellationTokenSource` created per generation, linked to the app-lifetime token so shutdown cancels in-flight work too.
- That token flows to `HttpClient` (via `SendAsync`), to the local runtime's inference loop (checked between decode steps, so a cancel lands within one token's latency rather than at the end of the run), and to `IAsyncEnumerable<LoadProgress>` enumeration in `WatchLoadAsync` (`WithCancellation`, plus `[EnumeratorCancellation]` on the parameter).
- **Cancel aborts immediately.** No backoff sleep survives a cancel: the backoff delay is `Task.Delay(d, ct)`, so a cancelled token ends the wait rather than letting it run to term. No further retry is issued. No fallback is attempted. The router returns whatever was in flight as a cancelled operation.
- `OperationCanceledException` is never caught-and-converted by any layer below the UI. Where a provider's `catch` block filters exceptions, it re-throws `OperationCanceledException` before handling anything else.
- Cancellation is not an error state. It does not set `AIGeneration.Status` to `Failed` with an error message, does not trigger a notification, and does not count against the request cap. It is recorded as cancelled.
- Local inference holds a runtime-level lock for the duration of a generation. Cancelling frees the lock immediately so the next queued request is not blocked behind a dead one.

---

## 5. `ILocalRuntime` — the local seam

`JugaadVision.Core/Abstractions/ILocalRuntime.cs`. Implementations live in `JugaadVision.AI/Runtimes/` (**planned**; llama.cpp is the MVP target per PRODUCT_SPEC §4). The model browser in `JugaadVision.Models` surfaces runtimes to the user; the runtime itself knows nothing about the browser.

| Member | Contract | Notes |
|--------|----------|-------|
| `string Name` | Stable runtime key, e.g. `"llamacpp"` | Matches DI registration |
| `bool IsAvailable` | The runtime's native library or daemon exists | Checked **before** the runtime is offered to the user, so a missing backend is never presented as a load failure |
| `bool SupportsFormat(ModelFormat)` | Can load this on-disk format | Router filter, 3.1 |
| `IReadOnlyCollection<ModelKind> SupportedKinds` | Model kinds served | Router filter, 3.1 |
| `Task<LoadResult> LoadModelAsync(LocalModel, ct)` | Loads into memory | Long-running; must not block the caller |
| `IAsyncEnumerable<LoadProgress> WatchLoadAsync(LocalModel, ct)` | Streams load progress | Yields until the load completes or the token is cancelled |
| `Task<GenerateResult> GenerateAsync(LoadedModel, GenerationRequest, ct)` | One generation against a loaded model | See 5.5 |
| `Task UnloadAsync(LoadedModel, ct)` | Releases model and memory | **Must be safe to call twice** |
| `IReadOnlyList<LoadedModel> LoadedModels` | Currently resident | UC-07 Home readout |

`IsAvailable` and `SupportsFormat` are separate on purpose. A llama.cpp build may be present but built without the GPU backend; the runtime is available, supports GGUF, and will decline the offload — three distinct states, and only `IsAvailable` answers whether the runtime exists at all.

### 5.1 Load → generate → unload

The lifecycle is explicit, and UC-02 plus §4 "Installed model manager (load/unload/inspect/remove)" together imply all three states are user-visible rather than implicit.

```
   ModelState.Installed                (on disk, not resident)
            |
            |  LoadModelAsync + WatchLoadAsync
            v
   LoadProgress stream  --->  Generate workspace progress bar / Tasks view
            |
            v
   LoadResult.Succeeded  ->  LoadedModel  (resident, holds memory)
            |
            |  GenerateAsync, repeatable
            v
   GenerateResult (text and/or OutputPath)
            |
            |  UnloadAsync, explicit or via the model manager
            v
   memory released  ->  back to ModelState.Installed
```

Unloading does not change `ModelState`. A model that is installed on disk and not resident is still `Installed`; residency is runtime state, held by `ILocalRuntime.LoadedModels`, not a lifecycle state on the record. The UI shows both: "Installed" in the model browser, and the active-model readout on Home (UC-07) driven by `LoadedModels`.

`UnloadAsync` being safe to call twice matters because unload is reached from three places — the model manager's unload action, an app-shutdown path, and a memory-pressure eviction. Racing callers must not be able to double-free. It should be idempotent: the second call is a no-op returning success, not an error.

### 5.2 Load progress

`LoadProgress` is a `readonly record struct (double Fraction, string Stage, string Message)`, with `FromFraction` clamping the fraction to `[0, 1]` so a miscounted progress source cannot drive a bar past its end.

`WatchLoadAsync` exists because loading a multi-gigabyte GGUF takes long enough that a bare `await` on `LoadModelAsync` would leave UC-02's "progress visible" unsatisfied and tie the UI to the load's completion. The two methods are separate deliberately: the caller awaits one for the result, enumerates the other for the updates, and neither has to know how the other is implemented.

Stages reported by the llama.cpp runtime, in order:

| Stage | Fraction | What is happening |
|-------|----------|-------------------|
| `validate` | 0.00–0.02 | File exists, is readable, GGUF magic matches |
| `mmap` | 0.02–0.15 | Memory-mapped, tensor metadata parsed, context allocated |
| `weights` | 0.15–0.90 | Weights faulted in from disk — the long phase, and the one that benefits from a real progress bar |
| `graph` | 0.90–0.98 | Compute graph built for the configured context and batch |
| `ready` | 1.00 | Handle issued |

The enumeration runs on a background thread with no SynchronizationContext dependency. The consumer — an Avalonia view-model — marshals to the UI thread itself. This keeps the runtime free of UI-framework types and testable without a dispatcher.

`WatchLoadAsync` on a model that is already resident yields a single `ready` at 1.0 and completes. A cancelled load is a cancelled enumeration; the caller discards the partial handle.

### 5.3 Not-loaded handling

`GenerateAsync` receives a `LoadedModel`. If the runtime no longer holds that handle — evicted, unloaded from the model manager while the request was queued, or the process restarted — the runtime returns a `GenerateResult` failure with a `model_not_loaded` error, and the router loads the model and retries once. One retry, not a loop: a model that evaporates between queue and dispatch is a bug worth surfacing, not a condition to paper over.

### 5.4 Memory pre-flight

`HardwareSettings.PreflightMemory` (default `true`) governs a check that runs **before** `LoadModelAsync`.

Without it, loading a 70B model on a 16 GB machine does not produce a handled failure. The kernel OOM killer ends the process, and the user loses their unsaved prompt, their open project, and their place. A clean refusal is strictly better than a kill.

The check:

1. Read the current `HardwareSnapshot` from `IHardwareMonitor` — `MemoryInfo.AvailableBytes`, and `GpuInfo.FreeMemoryBytes` per candidate device. It is a sampled reading, not a reservation, which is why this is a pre-flight and not a guarantee.
2. Take the estimate from `LocalModel.EstimatedMemoryBytes`. When null, derive it from `ParameterCountBillions` and `Quantization` and mark the UI estimate as approximate.
3. Apply `HardwareSettings.VramBudgetBytes` as a cap on the GPU-offload portion when GPU offload is in play and `ForceCpuOnly` is false. With `ForceCpuOnly` true, the entire estimate must fit in system RAM.
4. Compare against available memory with a headroom factor of 1.2 — a runtime's working set exceeds its weight footprint, and the shortfall should be refused here rather than discovered at 90% progress.
5. If it does not fit, **do not call the runtime.** Return a failure naming the model, the estimate, the available memory, and the headroom-adjusted requirement, with the concrete remedy (a smaller quantisation, a smaller model, freeing memory, enabling GPU offload).

`PreflightMemory = false` skips the check and lets the runtime try. That is a deliberate escape hatch for a user who knows their machine better than the estimate — and it is off-by-default-safe in the other direction, since the default is `true`.

The same estimate is what the UI shows before a run starts, so a model that will not fit is visible as unselectable with its reason, rather than as a failure discovered after the user has typed a prompt.

### 5.5 Streaming versus blocking

Two distinct things are called streaming, and conflating them would be a design error.

**Model load streaming** — `WatchLoadAsync`, section 5.2. Progress telemetry about a long operation. Coarse, monotonic, not content.

**Generation streaming** — incremental output tokens or image-diffusion steps. Fine-grained, and genuinely latency-sensitive.

The contract for generation streaming is `GenerationParameters.Stream` (exposed as `GenerationRequest.Stream`), defaulting to `false`. It is a request, not a guarantee: providers that cannot stream ignore it and return a complete result, and the UI is built to render a completed response identically to a streamed one. Nothing in Core depends on tokens arriving incrementally.

The gap to close, **planned**: `IAIProvider.GenerateAsync` and `ILocalRuntime.GenerateAsync` both return a single `AIResponse` / `GenerateResult`, and neither returns a stream. So today the only representable outcome is blocking generation. True streaming needs either a new `IAsyncEnumerable<AIResponse>` overload on each interface, or a delta callback parameter. Neither shape is in the contracts as they stand today — this is an open design item, parallel to the 0.1 truncation issue, and it is the same class of problem: the contract is not yet sufficient for a requirement UC-02 implies ("Result appears in preview" reads naturally as progressive appearance, though it is satisfied by a completed result too).

Recommended resolution, for review: add a `GenerateStreamingAsync(..., Func<StreamDelta, CancellationToken>, CancellationToken)` alongside the existing blocking methods rather than changing their return types, so blocking callers are unaffected and the callback is trivially mockable in tests. The existing methods then become one-line wrappers that collect the deltas.

Until then: **blocking, and honest about it.** The UI must not promise streaming. PRODUCT_SPEC §4 places GPU-accelerated llama.cpp in Should Have (Post-MVP), and streaming is not an MVP Must Have, so blocking is a defensible MVP state — as long as the interface docs do not imply otherwise.

Blocking generation still satisfies UC-02's "UI never freezes", because `GenerateAsync` is awaited on a background thread with a continuation that marshals the result to the UI thread. The UI stays responsive to Cancel and to navigation for the whole run.

---

## 6. Cancellation and threading in the local runtime

The llama.cpp runtime is native, CPU- and memory-bound, and does not care about .NET's thread pool. Three rules follow.

**Never block the UI thread.** `LoadModelAsync` and `GenerateAsync` are awaited from a view-model on a background thread. `ILocalRuntime`'s own documentation requires the load to be non-blocking; UC-02 requires the same of inference ("Inference runs on a background thread, UI never freezes").

**Never block a thread-pool thread either, for the whole run.** A multi-minute local generation holds a runtime-internal lock; pinning a pool thread for that duration risks starvation across the app, which also runs downloads and hardware polling. A dedicated long-running task per runtime, sized `HardwareSettings.ThreadCount` (null meaning "let the runtime decide"), is the right shape for llama.cpp's own internal threading.

**Serialise per runtime, queue across runtimes.** llama.cpp contexts are not reentrant. The MVP runs one generation at a time per runtime, with additional requests queued. `ThreadCount` configures the inference threads *within* one generation, not concurrent generations. Concurrent generations across different runtimes are independent and run in parallel.

**Cancel promptly.** The native decode loop is a `while` that is not itself cancellation-aware, so the managed wrapper sets a flag between token emissions and the native side checks it. Worst-case cancellation latency is one token's decode time, which is milliseconds on CPU and less on GPU. The alternative — letting a cancelled run finish decoding the remaining `MaxTokens` and throwing the output away — wastes the machine and, on a battery-powered laptop, the user's charge.

**Thread safety of the contract members.** `LoadedModels` is read by the Home screen (UC-07) while generations mutate it. It must return a snapshot, not a live view, so a reader iterating it cannot throw mid-enumeration. `UnloadAsync` called from the eviction path while a generation holds the handle must not free memory under a running inference; it defers to the generation's completion.

---

## 7. Credential handling

`ISecretStore` (`IPlatformServices.cs`) is the only path to a secret. On Linux it is Secret Service / libsecret (`CredentialSource.Keyring`, the preferred store), with an AES-256-GCM encrypted-file fallback (`CredentialSource.EncryptedFile`) when no keyring is available, and `Ephemeral` for a per-call key that is never persisted.

Rules:

- A provider resolves its key through `ISecretStore` per request, inside the `HttpClient` header assembly. It is never held in a field, never cached in a static, never written to a record.
- `IAIProvider.IsConfigured()` checks resolvability without performing I/O on the UI path. It may report `false`; it must not throw because the keyring is locked.
- `AdvancedSettings.VerboseProviderLogging` emits request and response traces with credential headers stripped. PRODUCT_SPEC §5 is "never in logs" without exception.
- `ProviderConfig` holds `CredentialReference` — the keyring item name, not the secret — so the entity is safe to log, export, and back up.
- HTTP tracing (`HttpClient` diagnostics, `ActivitySource`) is disabled for the credential header specifically. A general `HttpClient` logging configuration will happily log headers.

---

## 8. Enumerating backpressure

`IAIProvider.DiscoverModelsAsync` and `ILocalRuntime.WatchLoadAsync` are the two members that can produce unbounded output — a provider with thousands of models, or a load that emits progress faster than a slow UI can render.

`DiscoverModelsAsync` returns a materialised `IReadOnlyList<AIModel>`. The model browser paginates that list at the view layer; the provider does not stream it, because the list is bounded in practice by a provider's catalogue and a streamed catalogue would complicate the browser for no benefit.

`WatchLoadAsync` streams and must be throttled at the source. The llama.cpp runtime emits a progress update at most every 100 ms, and only when the fraction has changed by at least 0.005. Emitting on every byte of a multi-gigabyte read would put tens of thousands of items through an enumerator to move a progress bar that cannot show them. The consumer side applies the same discipline: the Tasks view (UC-07) coalesces updates to the UI thread at a fixed cadence rather than dispatching one UI operation per item.

`GenerateAsync` is not a streaming member (5.5), so there is no backpressure concern in the current contracts.

---

## 9. Diagnostics

Every generation is recorded as an `AIGeneration` row (UC-05): `ModelId`, `ModelName`, `ProviderName`, `Status`, `Prompt`, `NegativePrompt`, `Seed`, `Parameters`, `OutputPath`, `OutputText`, `OutputKind`, `Duration`, `PromptTokens`, `CompletionTokens`, `CostUsd`, `ErrorMessage`, `ProjectId`, `CreatedAt`, `CompletedAt`.

The AI layer additionally emits structured logs carrying: the provider `Name`, the `AIModel.Id` and `AIModel.ExternalId`, the attempt number, the `AIResponse.ErrorCode`, `AIResponse.IsRetryable`, the elapsed `Duration`, and the routing decision — which candidates were considered, which won, and which were skipped and why. That last one is what makes a surprising routing outcome debuggable by the user rather than opaque to the developer.

Secrets never appear in any of this (section 7).

---

## 10. Error UX

PRODUCT_SPEC §4 Must Have: "Error UX with actionable dialogs". `AIResponse.ErrorMessage` is documented as "Safe to show in a dialog" — safe because the provider writes it, not because the UI sanitises it. A provider must render a provider error into plain user-facing prose and put the machine-readable form in `ErrorCode`.

| `ErrorCode` | What the user sees |
|-------------|---------------------|
| `invalid_credential` | "OpenRouter rejected this API key." with a link to Settings → AI Providers |
| `rate_limited` | "OpenRouter is rate limiting this key. Retrying — attempt 2 of 3." with a Cancel action |
| `timeout` | "The request took longer than 120 s and was stopped." with a longer-timeout option |
| `model_not_loaded` | "Qwen2.5-7B was not in memory. Loading it and trying again." |
| `out_of_memory` | "This model needs about 24 GB; 11 GB is free." with the remedies from 5.4 named |
| `model_missing` | "The file at ~/models/qwen.gguf is missing." with a reinstall action |
| `network_unavailable` | "No network connection. Local models still work." (UC-06) |
| `no_candidate` | "No usable backend for this model. Check the provider key or install a local runtime." |
| `unhandled` | Anything else, with the message and a copy-details action |

A cancelled run shows no error dialog at all. It is not an error.

---

## 11. Offline behaviour

UC-06 requires that the app not crash without a network and that local functionality keeps working. Concretely, in the AI layer:

- The router treats "no network" as a filter, not a failure. Cloud candidates are removed from the set before dispatch (3.1), so there is no request to fail and no backoff to wait through.
- A local-only candidate list produces a normal local generation.
- A request with no local candidate returns the `no_candidate` message from section 10, not a network stack trace.
- `DiscoverModelsAsync` and `TestConnectionAsync` are the only members that can be blocked by connectivity, and both surface `ProviderStatus.Unreachable` rather than throwing.
- `AdvancedSettings.VerboseProviderLogging` traces make offline diagnosis possible without a second tool.

---

## 12. What is deliberately not designed here

Stated so these are decisions rather than omissions:

- **A plugin or third-party provider marketplace.** PRODUCT_SPEC §4 Won't Have (MVP).
- **A provider protocol beyond OpenAI-compatible.** Most hosted providers expose `/chat/completions`; one well-built implementation covers the MVP set. A provider that does not will get its own class, not a protocol layer.
- **Concurrent generation within one runtime.** llama.cpp contexts are not reentrant; the MVP serialises (section 6).
- **True output streaming.** The contracts cannot yet express it (5.5). Blocking generation is the MVP behaviour.
- **Automatic model swapping on memory pressure.** Pre-flight refuses an oversized load with a clear message (5.4). Silently unloading a model the user loaded, mid-session, is a worse surprise than a refusal. Eviction is explicit, from the model manager.
- **Prompt routing or model selection by content.** The router picks a backend for a model the user chose. It is not a quality arbiter, and PRODUCT_SPEC gives it no quality objective to optimise.

---

## 13. Test seams

`JugaadVision.Tests` can exercise this layer without a network, a GPU, or a native library, because the seams are already in the contracts:

- A fake `IAIProvider` returning scripted `AIResponse` values — including a `Succeeded = false, IsRetryable = true` followed by a success — exercises the router's retry-then-fallback loop deterministically. `GenerationContractTests.FailureResponse_CanBeMarkedRetryable_ForRouterFallback` already pins the flag's role.
- A fake `ILocalRuntime` returning a scripted `LoadProgress` sequence exercises progress handling, including a stream that yields nothing and one that throws mid-enumeration.
- The hard request cap (4.3), the `IsRetryable` classification table (4.2), and the routing order (3.2) are all pure functions of injected inputs and are directly unit-testable. They are the highest-value tests in this layer, because they are the parts where a wrong answer is a silent wrong answer.
- `CancellationToken` discipline is testable with a `TaskCompletionSource`-gated fake: cancel and assert that no further provider call is issued.

---

## 14. Open items for review

1. **The inferred tail of `ILocalRuntime`** (section 0.1) — the specification was truncated after `LoadModelAsync`. `GenerateAsync`, `UnloadAsync`, `WatchLoadAsync`, `LoadedModels`, and `SupportedKinds` are inferred from UC-02 and §4, not specified. `WatchLoadAsync`'s async-enumerable shape is the least certain of the five.
2. **Generation streaming has no contract** (5.5). `GenerationParameters.Stream` exists and is a request, but neither `GenerateAsync` returns a stream. Blocking is the MVP behaviour; a delta-callback overload is the recommended fix.
3. **The 1.2 headroom factor in memory pre-flight** (5.4) is a judgement call, not a measured constant. It should be tuned against real loads on the target hardware.
4. **The hard request cap of 10** (4.3) is likewise a judgement call. It trades user-visible patience against per-generation cost.
5. **`AIModel.RequiresCredential` under-reports for free-tier cloud models.** In `AIModel.cs` the expression is `Source is (OpenAICompatible or Custom or HuggingFace) && Tier is (Paid or Enterprise)`. The operator precedence is *not* the problem — `is` patterns bind tighter than `&&`, so this parses as the two-clause conjunction it looks like, and the `&& Tier is (Paid or Enterprise)` clause is genuinely intended. The consequence is that a `Free`-tier HuggingFace or OpenAI-compatible model evaluates to `RequiresCredential == false`, even though fetching or serving it still needs a token. Verified by evaluating the expression directly:

   | Source | Tier | `RequiresCredential` | Expected |
   |--------|------|----------------------|----------|
   | `HuggingFace` | `Paid` | `true` | `true` |
   | `HuggingFace` | `Free` | **`false`** | `true` — a token is still required |
   | `OpenAICompatible` | `Free` | **`false`** | `true` — a token is still required |
   | `Local` | `Paid` | `false` | `false` |

   The `Tier` clause appears to have been meant for cost reporting ("is this a *billable* model"), which is a different question from "does this need a credential". Either the `Tier` conjunct should be dropped, or this should be split into two properties. Not changed here — it is outside the scope of this document — but it must be resolved before the router uses `RequiresCredential` for candidate filtering, since a free-tier cloud model would currently be routed as though it needed no key.
