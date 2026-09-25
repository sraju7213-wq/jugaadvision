# JugaadVision — Provider System

## 1. Scope

This document specifies the cloud AI provider architecture: the contract a provider implements, how
providers are registered, how their configuration is stored, how credentials are held, how health is
reported, and how models are discovered and merged with what is already installed.

It is the companion to `PRODUCT_SPEC.md` (vision, use cases, MVP definition, NFRs) and to
`AI_ARCHITECTURE.md` (routing, retry, fallback). Where those documents state a goal, this one states
the mechanism.

The governing use case is UC-03: *the user configures an API key for OpenRouter, HuggingFace, an
OpenAI-compatible endpoint, or a custom endpoint; the key is stored in the OS credential store; the
user tests the connection; the user picks a provider and model in the Generate workspace; generation
runs over REST with automatic retries and provider fallback.*

The governing non-functional requirement is PRODUCT_SPEC.md §5:

> API key security | Never in plaintext, never in logs

Section 7 of this document is the design that satisfies it. That requirement is treated as absolute
and is not subject to a debug flag.

## 2. Status: what exists today

The AI project contains **interfaces only**. There is no provider implementation, no HTTP client, no
secret store implementation, and no router in the repository today. The design below is specified
against the contracts that do exist, so that implementations can be written against a fixed surface.

| Element | Location | State |
|---------|----------|-------|
| `IAIProvider` | `JugaadVision.Core/Abstractions/IAIProvider.cs` | Implemented (interface) |
| `ProviderConfig` | `JugaadVision.Core/Models/ProviderConfig.cs` | Implemented (entity) |
| `ProviderStatus`, `CredentialSource` | `JugaadVision.Core/Enums/ProviderEnums.cs` | Implemented (enums) |
| `ISecretStore` | `JugaadVision.Core/Abstractions/IPlatformServices.cs` | Implemented (interface) |
| `IProviderConfigRepository` | `JugaadVision.Core/Abstractions/IRepositories.cs` | Implemented (interface) |
| `AIResponse`, `GenerationRequest`, `GenerationParameters` | `JugaadVision.Core/Generation/GenerationContracts.cs` | Implemented (records) |
| `AdvancedSettings.VerboseProviderLogging` | `JugaadVision.Core/Models/AppSettings.cs` | Implemented (setting) |
| `JugaadVision.AI` | project | Empty; references Core, Storage, Platform |
| Provider implementations | `JugaadVision.AI` | Planned |
| Router, retry policy, fallback | `JugaadVision.AI` | Planned (see `AI_ARCHITECTURE.md`) |
| `SecretServiceSecretStore` | `JugaadVision.Platform` | Planned |
| `EncryptedFileSecretStore` | `JugaadVision.Platform` | Planned |
| `RedactingHttpMessageHandler` | `JugaadVision.AI` | Planned |
| `ProviderRegistry`, `ProviderOptions` | `JugaadVision.AI` | Planned |

`JugaadVision.AI.csproj` already carries `Microsoft.Extensions.Http`, `Microsoft.Extensions.Logging.Abstractions`
and `Microsoft.Extensions.Options`, and references Core, Storage and Platform. The dependency direction
is fixed: **AI depends on Core, Storage and Platform; Core depends on nothing.** Provider code never
appears in `JugaadVision.Core`, which is what keeps the domain free of HTTP and of secret material.

### 2.1 Divergence from PRODUCT_SPEC.md, recorded

PRODUCT_SPEC.md was written for the Windows target and names Windows Credential Manager and DPAPI
(§4 UC-03, §4 Must Have, §5 NFR). The shipped solution is Linux-first and Avalonia-based
(`Directory.Packages.props`: *"cross-platform: Linux now, Windows later"*; `JugaadVision.Platform.csproj`:
*"replaces the Windows-only integration project"*). `ProviderEnums.cs` already resolves this:
`CredentialSource.Keyring` is documented as *"Secret Service / libsecret keyring (the preferred Linux
store)"*.

This document follows the code, not the original Windows wording. DPAPI is not a Linux primitive and
there is no drop-in equivalent; the Secret Service is the Linux answer to the same requirement, and
`PRODUCT_SPEC.md` needs a follow-up edit to say so. The requirement itself — never plaintext, never in
logs — is unchanged and is what §7 implements.

## 3. The provider contract

One interface, one implementation per backend. `IAIProvider`:

```csharp
public interface IAIProvider
{
    string Name { get; }                                    // stable key, e.g. "openrouter"
    bool IsConfigured();                                    // I/O-free
    Task<IReadOnlyList<AIModel>> DiscoverModelsAsync(CancellationToken ct);
    Task<AIResponse> GenerateAsync(GenerationRequest request, CancellationToken ct);
    Task<bool> TestConnectionAsync(CancellationToken ct);
}
```

Four rules make the contract safe to extend and safe to route against.

**1. `Name` is a stable identity, not a label.** It matches the `ProviderKey` in `ProviderConfig` and
the DI registration name. It is persisted in history (`AIGeneration.ProviderName`) and read back years
later. It never changes once shipped, and never derives from `DisplayName`, which the user can edit.

**2. Expected failures are returned, not thrown.** `AIResponse.Succeeded = false` carries an
`ErrorCode`, a user-safe `ErrorMessage`, and `IsRetryable`. This is deliberate: the router must be able
to walk a fallback chain without exception-driven control flow, and a rate limit is a routing input,
not a bug. Exceptions are reserved for programming errors and `OperationCanceledException`, which
always propagates.

**3. `IsConfigured()` performs no I/O.** It answers "is a credential resolvable" from cached
configuration state so the UI can grey out a provider without a keyring round-trip on every keystroke.
The real resolution happens inside `GenerateAsync` and `TestConnectionAsync`.

**4. Requests are provider-neutral.** `GenerationRequest` carries no provider-specific fields, so the
router builds one from the UI and hands it to whichever backend wins. A provider that cannot honour a
parameter ignores it (`GenerationParameters` documents `Stream`, `JsonMode`, and the image fields as
ignorable). A provider that needs something the contract lacks extends `AIModel.Metadata`, which is
provider-scoped and never interpreted by Core.

## 4. MVP provider set

PRODUCT_SPEC.md §4 Must Have: *"Cloud provider support (OpenRouter, HuggingFace, OpenAI-compatible,
Custom)"*.

| Provider key | Transport | Credential | Notes |
|--------------|-----------|------------|-------|
| `openrouter` | HTTPS, OpenAI-shaped `/chat/completions` | `Authorization: Bearer` | Aggregator; model catalogue is OpenRouter's own; per-model pricing feeds the cost estimate |
| `huggingface` | HTTPS, HF Inference API | `Authorization: Bearer` | Also the model *discovery* source for UC-01; a generation provider only where inference is enabled for the token |
| `openai-compatible` | HTTPS, any `/v1` base URL | `Authorization: Bearer` | The generic client. Base URL is user-set |
| `custom` | HTTPS, any base URL | `Bearer` or custom header | Same client as `openai-compatible`; adds a configurable header name and non-Bearer auth shapes |

`openai-compatible` and `custom` are the same code path with a different base URL and a wider auth
shaped. See §11.

## 5. The registration contract

**Adding a provider must not require touching the router.** The router knows only `IAIProvider`,
`ProviderConfig` and `ProviderStatus`; it contains no provider names, no `switch`, and no
provider-specific type checks. This is the rule that makes the system extensible, and it is enforced
by review, not by the compiler.

Registration is a composition-root concern. `JugaadVision.App/Services/ServiceCollectionExtensions.cs`
is the single place that knows the whole graph, and it is where providers are added:

```csharp
services.AddHttpClient<IaiProvider, OpenRouterProvider>((sp, http) =>
{
    var cfg  = sp.GetRequiredService<IOptions<ProviderOptions>>().Value;
    var cred = sp.GetRequiredService<ICredentialResolver>();
    http.AddHttpMessageHandler(sp.GetRequiredService<RedactingHttpMessageHandler>());

    http.BaseAddress               = new Uri(cfg.BaseUrl);
    http.Timeout                   = TimeSpan.FromSeconds(cfg.TimeoutSeconds);
    http.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer", cred.Resolve(cfg));
    http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
});
```

`IHttpClientFactory` is used rather than a shared `HttpClient` instance so that per-provider timeouts,
base addresses and headers stay isolated, and so a rotated credential is picked up on the next request
without restarting the process.

Each provider's own behaviour is described by a small descriptor so Settings and the model browser can
render it without a second switch statement:

```csharp
public sealed record ProviderDescriptor(
    string Key,            // "openrouter" — stable, matches ProviderConfig.ProviderKey
    string DisplayName,    // user-visible
    string DefaultBaseUrl,
    string AuthScheme,     // "bearer" | "header" | "none"
    string DefaultAuthHeader,
    bool SupportsStreaming,
    bool SupportsJsonMode,
    bool SupportsVision,
    bool SupportsCostReporting);
```

`ProviderDescriptor` is data, so adding a provider does not mean editing the Settings view, the
Generate workspace picker, or the router. All three enumerate descriptors.

The layering rule, enforced by the project references in `JugaadVision.AI.csproj`:

```
App  ->  AI  ->  { Core, Storage, Platform }
                  Storage -> Core
                  Platform -> Core
```

Core references nothing. That is what lets a new provider be added without touching domain types, and
it is the reason `ProviderConfig` can promise to be safe to log (§7.1).

## 6. Per-provider configuration

`ProviderConfig` is the persisted row, keyed by `ProviderKey` through `IProviderConfigRepository`. It
holds everything a provider needs to run except the secret.

| Field | Default | Purpose |
|-------|---------|---------|
| `ProviderKey` | — | Stable identity, matches the DI registration and `Descriptor.Key` |
| `DisplayName` | — | Shown in Settings → AI Providers; user-editable, never used for lookup |
| `BaseUrl` | descriptor default | **Mutable.** Self-hosted gateways, proxies, and regional endpoints all work because this is settable |
| `CredentialReference` | null | Opaque handle to the secret — the keyring item name. Never key material |
| `CredentialSource` | `None` | Which store holds the secret (§7) |
| `Status` | `NotConfigured` | Health, surfaced in Settings (§8) |
| `IsEnabled` | true | User killswitch; independent of health |
| `TimeoutSeconds` | 120 | Per-request timeout; `GenerationRequest.TimeoutSeconds` overrides for one call |
| `MaxRetries` | 3 | Attempts for a transient failure; 0 disables retries for this provider |
| `PreferredModelIds` | empty | Router preference, most-preferred first |
| `LastVerifiedAt` | null | When `TestConnectionAsync` last returned true |
| `LastErrorMessage` | null | Last connectivity-test failure; safe to display |

`IsUsable` is the single gate the router checks before it will route to a provider:

```csharp
IsEnabled && Status != NotConfigured && CredentialSource != None
```

Two consequences are worth stating plainly. First, a provider whose last test failed is still routed
to unless it was disabled — a machine that was offline overnight should recover without a manual
re-test. Second, `PreferredModelIds` is a *hint to the router*, not a filter; the router's own
cost/availability rules can and do override it, and a user who pins a model expects that pinning to be
respected when the model is actually servable.

`AdvancedSettings.GlobalBaseUrlOverride` applies to every provider that does not define its own base
URL — the air-gap and enterprise-proxy lever. `AdvancedSettings.CustomHeaders` adds headers to every
provider request; §7.4 constrains what may appear in it.

Multiple configurations of the same implementation are first-class. Each is its own `ProviderConfig`
row with its own `Id`, `BaseUrl`, credential reference, timeout and retry policy. A studio with an
internal vLLM gateway on `gpu-a.internal` and a second on `gpu-b.internal` is two rows and one
implementation.

## 7. Credential security

This is the section PRODUCT_SPEC.md §5 constrains. The design has one principle:

> **A secret is a runtime value. It is never a field, never a column, and never a string that reaches a
> log sink.**

### 7.1 What never leaves the keyring

`ProviderConfig` holds `CredentialReference` — the *name of a keyring item* — and a `CredentialSource`
enum. It does not hold the key, a hash of the key, a length, or a last-four-digits hint. This is
stated in the entity's own doc comment and it is the reason the entity is described as safe to log,
export and back up.

Consequences, all deliberate:

- The SQLite database (`JugaadVision.Storage`, EF Core) contains no secret column. A stolen `.db` file
  yields endpoints, model preferences and history, and no usable key.
- Settings export and project export (`.jgvproj`, UC-04) carry the reference. A reference is
  meaningless on another machine, which is the correct behaviour.
- `AIGeneration` records `ProviderName` and cost, never the credential used.

`CredentialReference` is namespaced by provider, so two OpenAI-compatible gateways on the same machine
do not collide:

```
jugaadvision/provider/{ProviderKey}/{ConfigId}/api-key
```

`ConfigId` rather than `ProviderKey` alone, because a provider key can legitimately have several
configurations with different keys.

### 7.2 Linux store: Secret Service / libsecret

The primary path. `ISecretStore.IsSecureStoreAvailable` is true; `CredentialSource.Keyring`.

Implementation: D-Bus Secret Service API, reached through libsecret. The app holds no long-lived D-Bus
connection of its own and spawns no helper process; the platform's own Secret Service provider (GNOME
Keyring, KWallet, KeePassXC, `gnome-keyring-daemon`) does the storage, and unlocking is the desktop's
business — the app never asks for, handles, or caches a keyring password.

```csharp
public sealed class SecretServiceSecretStore : ISecretStore
{
    public bool IsSecureStoreAvailable { get; }   // Secret Service present AND unlocked

    public Task<string?> GetAsync(string reference, CancellationToken ct);
    public Task SetAsync(string reference, string secret, CancellationToken ct);
    public Task<bool> DeleteAsync(string reference, CancellationToken ct);
}
```

Rules:

- Secrets are `Set` with `MemoryProtection` (not stored to swap where the platform honours it) and are
  held in memory only for the duration of one request.
- `IsSecureStoreAvailable` is false while the keyring is locked. A locked keyring is not an error; the
  app prompts the user to unlock and retries once. A second failure is reported as a plain,
  actionable message.
- A `GetAsync` that returns null is *not* `InvalidCredential` — it means the item is gone, and the
  provider moves `Configured -> NotConfigured` with "Credential not found in keyring".

### 7.3 Fallback: AES-256-GCM encrypted file

Used **only** when `IsSecureStoreAvailable` is false. `CredentialSource.EncryptedFile`.

Format, one file under the app data directory:

```
~/.local/share/jugaadvision/secrets/store.jgvsecret
```

- AES-256-GCM, fresh 96-bit nonce per record, 128-bit authentication tag.
- Every record binds its `reference` as GCM *additional authenticated data*, so a record cannot be
  silently moved under a different provider's name.
- File mode `0600`, directory `0700`.
- The whole file is one AEAD blob with a per-record framing header, not a concatenation of independent
  blobs, so truncation and reordering are detected on open.

**Where the master key comes from.** In priority order, the first available wins, and which one is in
use is recorded on `CredentialSource`-adjacent config so Settings can tell the user honestly:

1. **Session-unlocked master key.** The user sets a passphrase at first use. It is stretched with
   Argon2id (m=64 MiB, t=3, p=1) against a per-store 16-byte salt stored in the file header, producing
   the 256-bit master key. **The passphrase is never written anywhere.** It is entered once per app
   session, held in a non-pinnable buffer, and zeroed on lock. This is the only option that is safe
   against an attacker who already has read access to the file.

2. **Kernel session keyring** (`keyctl` user-session keyring). The master key is generated randomly and
   added to the session keyring; it is bound to the login session and does not survive logout. Lower
   friction, and weaker: it protects against at-rest theft of the file, but not against an attacker who
   is already running as this user.

Option 1 is what a managed or shared machine should be pushed to. Option 2 is a convenience for a
single-user desktop.

**If neither is available.** That is: no Secret Service, and the user declines to set a passphrase, or
no session keyring is reachable. The honest answer is that there is nowhere safe to put a key, and the
app says so rather than improvising:

- The provider is **not persisted**. `ProviderConfig.IsEnabled` stays false and Settings shows
  *"No secure credential store available — this provider cannot save a key."*
- The only working mode is `CredentialSource.Ephemeral`: the key is supplied per session from the
  Generate workspace, held in memory, and discarded on exit. The status bar shows the provider as
  ephemeral so the user is never surprised that a key did not survive a restart.
- The app does **not** write a plaintext key "just this once", and it does not auto-generate a
  machine-side key stored next to the ciphertext, which would be security theatre: anyone who can read
  the file can read that key too.

`Ephemeral` exists for the same reason in every other case — a shared kiosk session, a demo machine, a
borrowed laptop where the key should die with the process.

### 7.4 Redaction: making the NFR structural

The requirement is that an `Authorization` header can never be emitted. Relying on every future call
site to remember not to log a header does not satisfy "never". The design makes emission impossible
rather than merely discouraged, at four layers.

**Layer 1 — the secret is a header value assembled at send time, not a value in scope.** The
`ICredentialResolver` returns the secret to exactly one place: the request builder. No provider class
holds a secret field, so there is nothing for a log statement to capture by accident. This is why
`ProviderConfig` has no `ApiKey` property to redact.

**Layer 2 — a redaction handler on every `HttpClient`.** `RedactingHttpMessageHandler` wraps the
pipeline on all provider clients:

```csharp
internal static class Redactor
{
    // Header names matched case-insensitively; the value is replaced, never truncated.
    static readonly string[] Sensitive =
    {
        "authorization", "proxy-authorization", "x-api-key", "api-key",
        "x-goog-api-key", "cookie", "set-cookie", "x-auth-token",
    };

    public static HttpRequestMessage Scrub(HttpRequestMessage request);
    public static string ScrubUrl(string url);        // query-string api_key= / token= / key=
    public static string ScrubBody(string body);      // "api_key": "..." / "access_token": "..."
}
```

`Scrub` produces a *loggable clone*: same method, same URI, same non-sensitive headers, sensitive header
values replaced with `***`. The `HttpClient` logs `Scrub`bed requests and responses; nothing else in the
stack ever sees the original.

**Layer 3 — scrub the string, not just the object.** Provider error text is the second leak path, and
the more likely one: a gateway echoes a rejected token in its response body
(`{"error":"invalid key sk-or-v1-abc…"}`), and that body lands in `AIResponse.ErrorMessage` and
`ProviderConfig.LastErrorMessage`, both of which are shown in a dialog and written to the database. So:

- Every `ErrorMessage` and `LastErrorMessage` passes through `Redactor.ScrubBody` before it leaves the
  provider.
- `Redactor.ScrubBody` also matches **token-shaped** values, not just labelled ones: a `sk-`-prefixed
  or `hf_`-prefixed run of ≥20 characters is redacted wherever it appears, including in an
  unlabelled provider error string. This is deliberate belt-and-braces — the label-based pass is
  defeated by a provider that does not use standard field names.
- If a redaction pass would leave the message empty, a generic message is substituted. Losing detail is
  acceptable; leaking a key is not.

**Layer 4 — `VerboseProviderLogging` does not widen the aperture.** `AdvancedSettings.VerboseProviderLogging`
is documented in `AppSettings.cs` as *"Never includes credential headers"*, and that is enforced rather
than promised:

- It controls **verbosity, not redaction**. Every log line, at every level, is emitted through the
  redacting sink.
- It logs the scrubbed request and response: method, scrubbed URL, scrubbed headers, status code,
  latency, token counts, and the first 2 KiB of the scrubbed body. It does **not** log
  `request.Headers.Authorization` in any form, and it does not log an unredacted body.
- It does not log the resolved secret, the keyring reference contents, or `AdvancedSettings.CustomHeaders`
  values (§7.5).
- Turning it on is therefore safe to recommend to a user who is debugging an endpoint, which is the
  point of the flag.

`TreatWarningsAsErrors` is on solution-wide (`Directory.Build.props`), and a test asserts that
`VerboseProviderLogging` with a live handler emits no substring of the active credential (§13).

### 7.5 The CustomHeaders trap

`AdvancedSettings.CustomHeaders` is a user-editable `Dictionary<string, string>` sent on every provider
request. A user who pastes a token into it has put a secret into `AppSettings` — which is serialised as
a single JSON document in the settings table, i.e. **plaintext in the database**. That is exactly what
§7.1 forbids, reached through a legitimate-looking door.

Rules, to be implemented with the settings screen:

- Header names matching `Redactor.Sensitive` are rejected at the point of entry with an inline message
  naming the supported alternative. Auth belongs in the credential store, not in a header dictionary.
- Header **values** are never logged, at any verbosity, even when the name is innocuous.
- The Settings UI offers the custom-header list only under Advanced, with a warning that the contents
  are stored unencrypted in the app database, so the user makes the trade knowingly.
- The same guard applies to the `Custom` provider's configurable auth header name: the *name* is
  configuration, the *value* comes from `ISecretStore` like any other credential.

### 7.6 Lifecycle of a secret

| Event | Action |
|-------|--------|
| User pastes a key in Settings | `ISecretStore.SetAsync(reference, key)`; `CredentialSource` set; `Status` → `Configured`; the in-memory key is dropped immediately |
| Request is made | `GetAsync(reference)`; secret lives for one request; no caching across requests |
| Key rotated by provider | 401 → `InvalidCredential`; app prompts for a new key; old item `DeleteAsync`'d, not overwritten in place, so a stale secret is not retained |
| User disables a provider | Key is **kept** (disabling is not a delete) |
| User deletes a provider | `DeleteAsync(reference)` then delete the row; the Settings action is labelled as removing the key, not just the provider |
| App exits | Nothing to clear for `Keyring`. For `EncryptedFile` the session master key is zeroed |
| App crashes mid-request | The secret was never in a field, only in a header on a request object that becomes garbage; it is not written to any crash dump we control |

## 8. Health: `ProviderStatus` and `TestConnectionAsync`

`ProviderConfig.Status` is what Settings → AI Providers renders, and what the router reads before
spending a user's money on a provider that will not answer.

### 8.1 The lifecycle

```
                    ┌───────────────────────────────┐
                    │                               ▼
  NotConfigured ──► Configured ──► Testing ──► Healthy
        ▲                │            │            │
        │ credential     │            │            │ transient failure
        │ removed        │            │            ▼
        └────────────────┘            └──────►  Unreachable
                                                RateLimited
                                                InvalidCredential
```

| State | Entered when | UI |
|-------|--------------|-----|
| `NotConfigured` | `CredentialSource == None`, or the keyring item has gone | "Add API key" |
| `Configured` | A credential exists but has not been verified this session | "Not tested" + Test button |
| `Testing` | A connectivity test is in flight | Spinner; buttons disabled |
| `Healthy` | `TestConnectionAsync` returned true; `LastVerifiedAt` stamped | Green |
| `Unreachable` | DNS, TLS, connection refused, or timeout | Retry, plus the base URL so a typo is visible |
| `RateLimited` | Provider answered 429 | Shows the retry-after the provider supplied |
| `InvalidCredential` | 401 or 403 | "Key rejected" + replace-key action. Never auto-retried |

`Testing` is a real state, not a spinner over `Configured`, so a hung test is visible and cancellable
rather than looking like a frozen screen.

`InvalidCredential` is terminal until the key changes: it must not be retried, and the router must skip
the provider until the user acts. That is why it is distinct from `Unreachable` — a 401 is not a network
problem and retrying it burns rate-limit budget for nothing.

### 8.2 What `TestConnectionAsync` does

It performs the cheapest authenticated round trip the provider supports — OpenRouter `/api/v1/key`,
OpenAI `/v1/models`, a HEAD on the base URL — with a short fixed timeout independent of
`ProviderConfig.TimeoutSeconds`, because a test that takes two minutes is not a test. It returns `false`
rather than throwing on failure (per `IAIProvider`'s contract), and the caller maps the concrete failure
onto `Status` and `LastErrorMessage`.

`ISecretStore` is touched here too: a `null` secret is reported as `NotConfigured`, never as
`InvalidCredential`, because a missing key and a rejected key need different user actions.

### 8.3 Mapping real failures to status

The mapping is explicit because "it didn't work" is not actionable. Each row states the signal, the
resulting status, retryability, and what the user is told.

| Signal from the transport | `Status` | `ErrorCode` | `IsRetryable` | User sees |
|---|---|---|---|---|
| `HttpRequestException`, DNS failure | `Unreachable` | `unreachable` | yes | "Cannot reach {host}. Check the base URL and your network." |
| `HttpRequestException` on TLS | `Unreachable` | `tls_error` | yes | "TLS handshake failed for {host}." — never the certificate body, which can contain a hostname and org |
| `TaskCanceledException` with the timeout token | `Unreachable` | `timeout` | yes | "Provider did not respond within {n}s." |
| `HttpRequestException` after `MaxRetries` | `Unreachable` | `unreachable` | yes, next request | Attempts exhausted, with the count |
| HTTP 401 | `InvalidCredential` | `invalid_credential` | **no** | "API key was rejected by {provider}." |
| HTTP 403 | `InvalidCredential` | `invalid_credential` | **no** | "Key is valid but not permitted for this model or account." — 403 is usually scope, not a bad key |
| HTTP 429 with `Retry-After` | `RateLimited` | `rate_limited` | yes, after the stated delay | "Rate limited. Retrying after {n}s." |
| HTTP 429 without `Retry-After` | `RateLimited` | `rate_limited` | yes, exponential backoff | "Rate limited by {provider}." |
| HTTP 402 / insufficient credit | `RateLimited` | `insufficient_quota` | **no** | "Account balance exhausted. Top up or use another provider." — a quota problem is not a rate limit; conflating them produces an app that backs off against a bill that will not clear |
| HTTP 5xx (500, 502, 503, 529) | `Unreachable` | `server_error` | yes | "{provider} reported a server error." |
| HTTP 4xx other than above (400, 404, 422) | `Unreachable` | `bad_request` | **no** | "The provider rejected the request: {scrubbed}." — a 400 is a contract mismatch, and repeating it is pointless |
| Response is not JSON, or schema is unrecognised | `Unreachable` | `protocol_error` | no | "Unexpected response from {host}." |
| Secret Service unavailable or locked | `NotConfigured` | `keyring_unavailable` | no | "Unlock your keyring to use saved keys, or re-enter the key." |
| `GetAsync` returns null | `NotConfigured` | `credential_missing` | no | "Saved key not found in the keyring." |
| Offline (`AppState.IsOffline`, UC-06) | unchanged | — | — | Status is **not** overwritten. An offline machine must not turn a `Healthy` provider into `Unreachable` |

Two rows deserve emphasis. The offline row: degrading health on connectivity loss would make Settings
lie about a key that is perfectly good, and would make the router drop providers the moment a laptop
lid closed. Status is therefore only changed by an actual test, and the offline condition is shown
separately in the status bar, as UC-06 requires. The `insufficient_quota` row: it is mapped to
`RateLimited` because both suppress traffic, but it is marked non-retryable and gets a distinct
message, because the remedy is different in kind.

Every message placed into `ProviderConfig.LastErrorMessage` or `AIResponse.ErrorMessage` is redacted
per §7.4 before it is stored or displayed.

## 9. Generation, retry and fallback

`GenerateAsync` returns an `AIResponse`; it does not throw for expected failures. The mapping from
failure to `ErrorCode` is the table in §8.3, so health state and error codes cannot drift apart.

The router, on receiving a failure:

1. If `IsRetryable` and attempts remain, retry the same provider with exponential backoff, honouring
   `Retry-After` when the provider sent one. `ProviderConfig.MaxRetries` bounds this; `0` disables it.
2. If exhausted and `GenerationSettings.AllowProviderFallback`, move to the next candidate in the
   router's ordering — which consults `IsUsable`, `Status`, `PreferredModelIds`, and cost.
3. If no candidate remains, return the last `AIResponse` failure to the UI. One provider's outage is
   visible in Settings and, if it recurs, the router stops spending retries on it.

`OperationCanceledException` propagates untouched at every layer, because user cancellation must not be
retried against another provider.

Cost accounting: providers that report usage populate `AIResponse.PromptTokens`, `CompletionTokens` and
`CostUsd`; `IGenerationRepository.GetTotalCostAsync` aggregates them for the Home dashboard. Where a
provider reports tokens but not cost, cost is derived from `AIModel.PriceInputPerMillion` /
`PriceOutputPerMillion` and marked as an estimate, rather than silently recorded as zero.

## 10. Model discovery and merging

`DiscoverModelsAsync` is UC-01's catalogue step, run per provider. It returns `AIModel` records, the same
type used for locally-installed models — which is what lets the router treat a local GGUF and a remote
OpenRouter model as peers in one picker.

Identity and reconciliation:

- `AIModel.Id` is a local `Guid`; `AIModel.ExternalId` is the provider-native id
  (`meta-llama/Llama-3.1-8B-Instruct`, an OpenRouter slug). `AIModel.Source` records the provider kind.
- A discovered model is matched against an existing row on `(Source, ExternalId)`. This is what makes
  rediscovery idempotent and prevents the catalogue from filling with duplicates every time Settings is
  opened.

**Merge rule — a discovered model never overwrites installation state.** The merge is field-wise and
side-specific, and the reason is that discovery and installation have different authority:

| Field | On re-discovery of an existing row | On discovery colliding with an **installed** local model |
|-------|------------------------------------|--------------------------------------------------------|
| `Name`, `Description`, `Publisher`, `License`, `DownloadCount` | Updated from the catalogue — the catalogue is fresher | Updated |
| `ContextWindow`, `ParameterCountBillions`, `Quantization` | Updated when non-null; a null in the response never clears a known value | Updated when non-null |
| `PriceInputPerMillion`, `PriceOutputPerMillion` | Updated — pricing changes and affects the pre-run cost estimate | Updated |
| `Capabilities` | Unioned, never replaced; capabilities are only ever added | Unioned |
| `State` | **Never touched** | **Never touched** — stays `Installed` |
| `InstalledAt`, `LastUsedAt`, `Files` | **Never touched** | **Never touched** — a catalogue response has no local files and must not empty the list |
| `Metadata` | Merged per key | Merged per key |

The installed-local case is the one that matters. An installed model is the result of a download the
user paid for in time and disk space; a catalogue refresh that reset `State` to `Discovered` or cleared
`Files` would make an installed model look uninstalled in the Installed tab, and worse, invite a
redownload. Catalogue data refreshes the *description* of a model; it never rewrites what exists on
disk. `IsLocallyExecutable` reads `Source == Local && State == Installed` and is therefore stable
across discovery runs.

Pruning: models that have disappeared from a catalogue are marked, not deleted. A row with generation
history keeps its record so UC-05 history stays resolvable, and a row with no history and no local
files is removed on the next sweep.

`RequiresCredential` on `AIModel` derives from `Source` and `Tier`, and drives a warning in the picker
before a run consumes a paid key — the same signal the router uses to prefer a free or local
alternative.

## 11. One implementation, N configurations

`openai-compatible` and `custom` are the **same code path**. `OpenAiCompatibleProvider` is written once;
the difference between the two is a `BaseUrl` in `ProviderConfig` and a wider auth shape in the
descriptor.

- `openai-compatible`: `BaseUrl` points at any server speaking the OpenAI REST shape — vLLM, Ollama's
  OpenAI surface, LM Studio, llama.cpp's server, Groq, Together, Fireworks, an internal gateway.
  Auth is `Authorization: Bearer`.
- `custom`: the same client, plus a configurable auth header name and non-Bearer schemes (API key in
  `X-API-Key`, a query parameter, no auth at all for a LAN endpoint). The auth *value* still comes from
  `ISecretStore`; only the header *name* is configuration (§7.5).

The implication is worth stating as a design property rather than an implementation detail: **the
provider axis and the configuration axis are orthogonal.** One `IAIProvider` implementation covers every
OpenAI-shaped endpoint in existence; adding one costs a `ProviderConfig` row, not a class. A user with
three internal gateways and no cloud provider has three rows and zero custom code.

The same reasoning caps the MVP surface. `openrouter` and `huggingface` are separate implementations
only because their model catalogues, auth quirks and usage endpoints are not OpenAI-shaped. Everything
that is OpenAI-shaped is a configuration.

## 12. Enterprise use

PRODUCT_SPEC.md §2 lists Enterprise Teams as a target segment needing *"Centralized config, audit
trails, secure key storage"*. All three are already partially served by the design above, and none of
them require a separate enterprise build.

**Secure key storage.** The whole point of the reference-indirection in §7.1 is that the secret lives
in the enterprise credential store (GNOME Keyring, KWallet, or an enterprise-managed Secret Service
provider on a managed Linux desktop) rather than in an app database the IT team has to reason about.
An administrator can audit "which secrets does this app hold" by querying the keyring, and the answer
is a set of opaque item names.

**Centralized config.** `IProviderConfigRepository` holds rows keyed by `ProviderKey`, and every
non-secret field — `BaseUrl`, `IsEnabled`, `TimeoutSeconds`, `MaxRetries`, `PreferredModelIds` — is
plain data. A team can define a standard provider set (an approved internal gateway, a rate-limited
shared OpenRouter key, a self-hosted vLLM cluster) as configuration and apply it across machines. The
`BaseUrl` override and `AllowUntrustedModels` switches exist to let a team pin every client to approved
infrastructure.

`CredentialSource.Ephemeral` is the natural fit for a shared workstation: the key is injected per
session from the operator's own credential and never persisted to the machine.

**Audit trails.** `AIGeneration` already records provider name, model, prompt, parameters, seed, token
counts, cost, duration and timestamp, and is queryable through `IGenerationRepository`. That is a
per-generation usage trail. Extending it to a security audit trail — who changed a provider's base URL
or disabled a key, when, and on which machine — needs a config-change log that does not exist yet
(PRODUCT_SPEC §4 lists no such requirement for the MVP). When added it inherits §7 automatically: the
log records `ProviderKey`, `ConfigId` and the *presence* of a credential, never its value. Note also
that prompts are content, and under some jurisdictions prompt text is itself sensitive; an enterprise
retention policy should be able to bound the history window (`PrivacySettings.HistoryRetentionDays`
exists for this) without touching the provider layer.

## 13. Verification

`JugaadVision.Tests` is xunit.v3 with `Avalonia.Headless.XUnit`. The provider system is only as good as
these tests, and each of the claims in §7 and §8 gets one:

| Test | Asserts |
|------|---------|
| `ProviderConfigNeverHoldsSecretMaterial` | No string property on `ProviderConfig` accepts a value that appears in a test key; `CredentialReference` holds the item name only |
| `SerializedProviderConfigExcludesSecrets` | Round-trips `ProviderConfig` through the persistence serializer and asserts the key substring is absent |
| `RedactorScrubsHeaders` | Every name in `Redactor.Sensitive`, case-varied, is replaced; `Authorization` is never emitted |
| `RedactorScrubsUnlabelledTokens` | An `sk-`/`hf_`-prefixed token inside an otherwise unlabelled provider error body is redacted |
| `VerboseLoggingNeverEmitsCredential` | A live handler with `VerboseProviderLogging = true` and a stubbed response containing the key produces no log line containing any substring of the key |
| `CustomHeadersRejectsAuthNames` | A `CustomHeaders` entry named `Authorization` is rejected with a user-facing reason |
| `FallbackStoreRefusesWithoutKey` | With no Secret Service and no passphrase set, `SetAsync` persists nothing and the provider stays `Ephemeral` |
| `EncryptedFileIsBoundToItsReference` | A record moved to a different provider's reference fails the GCM tag check |
| `StatusMapping` | Table-driven: each transport signal in §8.3 produces the documented `Status`, `ErrorCode` and `IsRetryable` |
| `OfflineDoesNotDegradeStatus` | With `AppState.IsOffline`, a test that never runs leaves `Status == Healthy` |
| `DiscoveryDoesNotResetInstalledState` | Re-discovering a model already `Installed` preserves `State`, `Files` and `InstalledAt` |
| `DiscoveryIsIdempotent` | Two discovery runs over the same catalogue produce one row per `(Source, ExternalId)` |
| `ResponseIsReturnedNotThrown` | A 429 yields `Succeeded = false` with `IsRetryable = true`; no exception escapes `GenerateAsync` |
| `RouterIgnoresInvalidCredential` | A provider in `InvalidCredential` is skipped without a request being sent |

## 14. What is deliberately not built

- **No plugin marketplace.** PRODUCT_SPEC.md §4 Won't Have says so. Extensibility is by source, in the
  composition root — not by runtime-loaded assemblies.
- **No provider-side code execution.** A custom provider is a base URL and a credential, nothing more.
  It cannot run in-process code, which keeps the threat model to "sends a request to a URL the user
  typed".
- **No shared/team secret sync.** Secrets stay on the machine that holds them (§12). The reference
  indirection would permit a centrally-issued credential later; nothing in this design blocks it, and
  nothing implements it.
- **No cost pre-authorisation or spend caps.** `CostUsd` is recorded after the fact. A hard cap is a
  billing-feature question, not an architecture one, and would need a provider-side quota API per
  provider.
- **No streaming in the MVP.** `GenerationParameters.Stream` and `Descriptor.SupportsStreaming` exist
  so the capability can be declared, but `AIResponse` is a single completed result. Adding streaming
  means extending the response contract, which is a Core change and therefore a deliberate one.
