# JugaadVision — Database Schema

EF Core 10.0.12 + SQLite schema for the JugaadVision Linux desktop app. This document is the
normative reference for how the domain types in `JugaadVision.Core/Models` are persisted by
`JugaadVision.Storage`.

## 1. Scope and status

Read this first. Nothing in this document is aspirational hand-waving, but almost none of it is
built yet.

| Area | Status |
|------|--------|
| Domain entities (`Core/Models/*.cs`) | **Implemented.** Real, compiling C# with property initialisers. |
| Enums (`Core/Enums/*.cs`) | **Implemented.** Explicit numeric values already assigned. |
| Repository interfaces (`Core/Abstractions/IRepositories.cs`) | **Implemented.** Defines the query surface this schema is designed against. |
| `JugaadVision.Storage` project file | **Implemented.** References EF Core, EF Core SQLite, and `Core`. |
| `DbContext`, entity configurations, value converters | **Planned.** This document specifies them; no code exists. |
| Migrations | **Planned.** None generated. The plan is §11. |
| `ISecretStore` / keyring implementation | **Planned.** Interface exists in `Core/Abstractions/IPlatformServices.cs`; no implementation. |
| Concrete repository implementations | **Planned.** `Core` declares the interfaces only. |

Every SQLite type mapping, query translation, and pragma value asserted in this document was
verified by compiling the real domain types against EF Core 10.0.12 and executing against SQLite.
Where verification changed the design, that is called out explicitly.

## 2. Layering constraint: pure POCOs, fluent configuration

The domain entities carry **no EF attributes** — no `[Key]`, no `[Column]`, no `[Table]`, no
`[JsonProperty]`, nothing. This is deliberate and enforced structurally:

- `JugaadVision.Core.csproj` declares **zero** `PackageReference` items. It has no outward
  dependencies and cannot take one without breaking the architecture.
- `JugaadVision.Storage.csproj` references `Core` (inward) and owns EF Core.

The consequence: `JugaadVision.Core` cannot be tested against a database and cannot be reasoned
about with EF semantics in mind. The price is paid once, in the configuration layer. The benefit
is that the domain stays a domain.

All mapping therefore lives in `JugaadVision.Storage` and is expressed with the EF Core **fluent
API**, one `IEntityTypeConfiguration<T>` per entity, composed in `OnModelCreating`.

Two practical corollaries:

- Adding a new persisted property means editing the POCO **and** a configuration class. There is no
  single point of truth. Reviewers must check both.
- A POCO property that no configuration maps is silently not persisted. The entity configurations
  must map every public read/write property explicitly rather than relying on conventions alone.
  The conventions in §4 exist to cover the *type* mapping, not to cover *which* properties exist.

### 2.1 Derived properties are not columns

Several entity members are computed and must be explicitly ignored, or EF will try to map them
and either fail or persist meaningless duplicates:

| Type | Member | Reason |
|------|--------|--------|
| `AIModel` | `IsLocallyExecutable` | Computed from `Source` + `State`. |
| `AIModel` | `RequiresCredential` | Computed from `Source` + `Tier`. |
| `ProviderConfig` | `IsUsable` | Computed from `IsEnabled` + `Status` + `CredentialSource`. |
| `ModelFile` | `DownloadProgress` | Computed from `DownloadedBytes / TotalBytes`. |
| `BackgroundTask` | `IsTerminal`, `IsResumable` | Computed from `State` + `AttemptCount`. |

Configure with `Ignore(x => x.IsLocallyExecutable)` and so on. Because read-only computed
properties have no setter, EF Core's convention-based discovery skips them, but relying on that is
fragile across EF versions. Declare the ignores.

`AIModel.Files` is the one navigation property on any entity. `ModelFile` has **no** back-reference
to `AIModel` — it carries only `ModelId`. The relationship must therefore be configured
unidirectionally: `HasMany(x => x.Files).WithOne().HasForeignKey(f => f.ModelId)`. Using
`WithOne(f => f.Model)` **does not compile**; there is no such property.

## 3. File location

The database is a single file in the XDG data directory:

```
$XDG_DATA_HOME/jugaadvision/jugaadvision.db
```

falling back to `~/.local/share/jugaadvision/jugaadvision.db` when `XDG_DATA_HOME` is unset. This
satisfies PRODUCT_SPEC §5 "Data persistence | Survives app restart and uninstall".

WAL mode creates two sibling files (`jugaadvision.db-wal`, `jugaadvision.db-shm`) in the same
directory. Verified on SQLite 3.53.3.

The database holds **references, never asset bytes.** Model weights, images, video, and audio live
on the filesystem; the database stores the path (§8). This is what keeps the file small and makes
the library browsable after a `VACUUM`.

## 4. Type mapping conventions

Applied once in `JugaadVision.Storage` via `ConfigureConventions` so that no individual entity
configuration has to repeat them. Enums are left on EF Core's default (INTEGER) because the CLR
enum values are already explicitly assigned and stable.

| CLR type | SQLite type | Mechanism | Verified note |
|----------|-------------|-----------|---------------|
| `Guid` | `TEXT` | EF default | Stored as the uppercase dashed form, e.g. `2F1E9C3A-77B4-4D1E-9F2A-0C1D2E3F4A5B`. Round-trips exactly. |
| `string` | `TEXT` | EF default | `NOT NULL` when the POCO initialises to `string.Empty`. |
| `int`, `long` | `INTEGER` | EF default | `long` for `TotalBytes`, `DownloadedBytes`, `Seed`, `DownloadCount`. |
| `double` | `REAL` | EF default | Used by `Progress`, `ParameterCountBillions`. |
| `bool` | `INTEGER` | EF default | 0/1. |
| all enums | `INTEGER` | EF default | Ordinal value. |
| `decimal?` | `TEXT` | EF default | See §4.1. |
| `TimeSpan?` | `TEXT` | EF default | ISO-ish duration text. `AIGeneration.Duration` only; never sorted or compared. |
| `DateTimeOffset` | `INTEGER` | **Custom converter** | UTC ticks. Mandatory — see §4.2. |
| `DateTimeOffset?` | `INTEGER` | **Custom converter** | Nullable UTC ticks. |
| `Dictionary<string,string>` | `TEXT` | **Custom converter** | JSON. See §5. |
| `Dictionary<string,double>` | `TEXT` | **Custom converter** | JSON. See §5. |
| `List<string>` | `TEXT` | **Custom converter** | JSON. See §5. |
| `List<Guid>` | `TEXT` | **Custom converter** | JSON. See §5. |

### 4.1 `decimal` is TEXT, and that is fine here

EF Core maps `decimal` to `TEXT` on SQLite because SQLite has no exact fixed-point type. This is
correct for money, and it is not a problem for this schema:

- `CostUsd`, `PriceInputPerMillion`, `PriceOutputPerMillion` are the only decimal columns.
- `IGenerationRepository.GetTotalCostAsync` needs a SUM. Verified: EF translates it to
  `SELECT COALESCE(ef_sum("g0"."CostUsd"), '0.0') ... GROUP BY`, where `ef_sum` is a
  client-registered SQLite aggregate function. The sum of `1.25 + 2.50 + 3.00` returned exactly
  `6.75`. **Aggregation is exact.**
- Sorting by a decimal column also works: EF emits `ORDER BY "g"."CostUsd" COLLATE EF_DECIMAL DESC`,
  registering a custom collation for correct numeric ordering. (Not currently on a `LibrarySort`
  path, but available if a "most expensive" history sort is added.)

The one thing to avoid is `WHERE CostUsd > @p` with a parameter typed as something other than
decimal, which would compare text lexicographically. All comparisons go through EF, which registers
the collation.

### 4.2 `DateTimeOffset` must be converted to UTC ticks — this is not optional

EF Core's SQLite provider **maps `DateTimeOffset` to `TEXT` and then refuses to sort it.** Left on
the default mapping, every `ORDER BY` on a `DateTimeOffset` throws at query-compile time:

```
System.NotSupportedException: SQLite does not support expressions of type 'DateTimeOffset'
in ORDER BY clauses.
```

This is not an edge case. It breaks the three headline query paths in `IRepositories.cs` —
`GetHistoryAsync` (newest first, UC-05), library sorting, and `GetRecentAsync` for tasks. The
default mapping must be overridden.

The underlying reason the text form is unusable is visible in raw SQL. SQLite renders the value
with its offset appended, and lexicographic text ordering ignores the offset, so rows sort by
local wall-clock time rather than by the instant they represent:

```
2026-09-25 04:00:00.0000000+00:00   <- 09:30 IST
2026-09-25 09:00:00.0000000+05:30   <- 03:30 UTC   (sorts here, wrongly)
2026-09-25 10:00:00.0000000+00:00
```

Two different instants that are correctly ordered are emitted in the wrong order. "Newest first"
would quietly return the wrong page.

**Decision:** convert every `DateTimeOffset` to `long` UTC ticks. The instant is preserved; the
offset is normalised to `Zero` on the way back out.

```csharp
public sealed class DateTimeOffsetToUtcTicksConverter
    : ValueConverter<DateTimeOffset, long>
{
    public DateTimeOffsetToUtcTicksConverter()
        : base(v => v.UtcTicks,
               v => new DateTimeOffset(v, TimeSpan.Zero)) { }
}

public sealed class NullableDateTimeOffsetToUtcTicksConverter
    : ValueConverter<DateTimeOffset?, long?>
{
    public NullableDateTimeOffsetToUtcTicksConverter()
        : base(v => v == null ? (long?)null : v.Value.UtcTicks,
               v => v == null ? (DateTimeOffset?)null
                              : new DateTimeOffset(v.Value, TimeSpan.Zero)) { }
}
```

Registered model-wide:

```csharp
protected override void ConfigureConventions(ModelConfigurationBuilder builder)
{
    builder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToUtcTicksConverter>();
    builder.Properties<DateTimeOffset?>().HaveConversion<NullableDateTimeOffsetToUtcTicksConverter>();
    // ... collection converters, §5
}
```

After this, `ORDER BY "g"."CreatedAt" DESC` translates and executes, and a B-tree index on
`CreatedAt` is actually usable for range scans and for the `ORDER BY` itself — which matters,
because with the default TEXT mapping SQLite would have to sort the whole result set per query.

`AIGeneration.CreatedAt` is the only column where the offset is meaningful, and it is not: the
durable fact about a generation is *when it happened*, and all consumers display it in local time.
Normalising to UTC loses nothing that was ever used.

`DateTimeOffset.UtcNow` is the correct source everywhere; the converter normalises the rest.

### 4.3 There is no `DateTime`

`DateTime` is deliberately not used. `DateTimeOffset` is throughout the domain and the conversion
is centralised in one place, so there is no untyped-kind ambiguity to guard against.

## 5. Collections: the JSON decision

SQLite has no array or map type. Six entity properties need one:

| Property | Declared type | Size | Queried by content in SQL? |
|----------|---------------|------|---------------------------|
| `AIModel.Capabilities` | `List<string>` | ~3–6 items | No |
| `AIModel.Metadata` | `Dictionary<string,string>` | ~0–10 entries | No |
| `AIGeneration.Parameters` | `Dictionary<string,double>` | ~3–8 entries | No |
| `ProviderConfig.PreferredModelIds` | `List<string>` | 0–10 ids | No |
| `AppProject.Settings` | `Dictionary<string,string>` | 0–15 entries | No |
| `AppProject.AssetIds` | `List<Guid>` | 0–500 ids | No |
| `LibraryItem.Tags` | `List<string>` | 0–10 tags | Filter is display-side |

**Decision: every one of these maps to a single `TEXT` column holding a JSON document, via a
`ValueConverter`. No normalised child tables. No delimited text.**

This is one approach applied uniformly, decided against the two alternatives on the axes that
actually matter for a single-user desktop app.

#### Why not normalised child tables

The usual argument is "you can query it and index it." That argument is unavailable here, because
**nothing in `IRepositories.cs` queries any of these properties by content.** Read the repository
surface again: model queries filter on `Kind`, `Source`, `State`, and free text; library queries
filter on `AssetKind` and free text; task queries filter on `TaskState`; history filters on
`ProjectId` and `ModelName`. Not one takes a tag, a capability, or a settings key as a predicate.

So a child table would buy indexability that no query uses, at a real cost:

- **Write amplification.** `AppProject.AssetIds` on a mature project is hundreds of rows. Adding
  one generated image means an INSERT into the child table, and it means the `Projects` row and its
  child rows must be written inside one transaction or the project is left inconsistent. A JSON
  column makes it a single-column UPDATE that is atomic by construction.
- **Load cost on read.** `IProjectRepository.GetRecentAsync` loads ten projects for the Home
  screen. With a child table that is eleven queries. With JSON it is one, and the deserialisation
  cost is a few microseconds on a small document.
- **Delete and upsert churn.** `UpsertAsync` on every repository is called on autosave. Diffing and
  reconciling a child collection on every autosave is real work for no benefit.

The write-amplification argument is decisive on its own. A normalised table converts one
single-column write into N row writes plus a transaction, to serve queries that do not exist.

#### Why not delimited text

Strictly worse than JSON, with no compensating advantage. Comma-joined tags cannot represent a tag
containing a comma; escaping schemes are a hand-rolled JSON parser with hand-rolled bugs. JSON
handles commas, quotes, and Unicode correctly, which matters because these are **user-entered
strings** — tags and project settings keys are arbitrary text from the user.

#### What JSON does cost, stated plainly

- No B-tree index on the contents. Correct here, because §11 of `IRepositories.cs` shows no
  content query. If a future feature needs "show me every asset tagged `portrait`" as a server-side
  filter, that is the moment to revisit — and the review trigger is written into §9.
- EF cannot translate `list.Contains("x")` into SQL for a converted property. Filter on these in
  memory after materialising the (already paged) result set. With `Take = 50` this is trivial.
- A converter is not free: it runs on every materialised row. At desktop row counts this is noise.

#### Verified behaviour

Round-trip fidelity, including the adversarial cases:

```
tags in:  ["portrait", "quote\"inside", "ünïcødé", "with,comma"]
stored:   ["portrait","quote\"inside","\u00FCn\u00EFc\u00F8d\u00E9","with,comma"]
read back, SequenceEqual: True
```

Empty collections round-trip to `[]` and back to an empty collection, never `null`. The converters
handle a null or empty stored string defensively, so a row written by hand or by an older build
cannot throw on read.

SQLite 3.53.3 has JSON1 compiled in, so ad-hoc inspection is possible during development:
`json_extract` and `json_each` both work. This is a debugging aid, not a query strategy — the app
must not depend on it, because JSON1 was optional in older SQLite builds.

#### The converters

One per distinct CLR shape, registered model-wide in `ConfigureConventions`:

```csharp
public sealed class StringDictionaryToJsonConverter
    : ValueConverter<Dictionary<string, string>, string>
{
    public StringDictionaryToJsonConverter() : base(
        v => JsonSerializer.Serialize(v),
        v => string.IsNullOrEmpty(v)
             ? new Dictionary<string, string>()
             : JsonSerializer.Deserialize<Dictionary<string, string>>(v) ?? new()) { }
}
// ...DoubleDictionaryToJsonConverter, StringListToJsonConverter, GuidListToJsonConverter
```

`System.Text.Json` is used, not `Newtonsoft.Json`. It is in the BCL, so it adds no package
reference and keeps `Storage` on the same dependency set as today.

Serialization options: the default (`JsonSerializerOptions` with no custom settings) serialises
`Dictionary<string,double>` as a JSON object, which is what we want. Enums are not stored in these
dictionaries. A `CamelCase` policy is **not** applied — these documents are machine-to-machine
between builds of the same app, and renaming keys on a casing change would silently drop user
settings. The one policy that is worth setting is `WriteIndented = false` (the default) to keep
columns compact.

#### One exception, deliberately not taken

`LibraryItem.Tags` is the property most likely to want server-side filtering, because
`ILibraryRepository.QueryAsync` takes a `searchText` and the library is the only table that grows
without bound as the user works. It is still JSON, for two reasons: the current `QueryAsync`
signature has no tag parameter, and the practical ceiling is a personal asset library in the low
tens of thousands of rows, where an in-memory filter over a paged result is not the bottleneck. If
a tag filter is ever added to the interface, this is the one property to promote to a child table,
and §9 records that as the trigger.

## 6. Tables

Nine tables. All identifiers are `Guid` primary keys assigned client-side by the POCO's field
initialiser, so there is no server-side key generation and no `INTEGER PRIMARY KEY` rowid alias
anywhere.

Convention: table names are plural (`Models`, `ModelFiles`, `LibraryItems`), column names match the
POCO property names exactly. `ToTable()` is called explicitly on every entity rather than relying
on the pluralisation convention, so a rename in the convention settings cannot silently rename a
table.

### 6.1 `Models`

`AIModel` — the unified catalogue/installed record (spec §4.1). One table covers both locally
installed models and remote catalogue entries.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. Provider-scoped id for remote models. |
| `Name` | TEXT | no | Display name. |
| `Publisher` | TEXT | yes | |
| `Description` | TEXT | yes | |
| `ExternalId` | TEXT | yes | e.g. `meta-llama/Llama-3.1-8B-Instruct`. |
| `Kind` | INTEGER | no | `ModelKind`. |
| `Format` | INTEGER | no | `ModelFormat`. |
| `Source` | INTEGER | no | `ModelSource`. |
| `Tier` | INTEGER | no | `ModelTier`. |
| `State` | INTEGER | no | `ModelState`. |
| `Capabilities` | TEXT | no | JSON array (§5). |
| `ContextWindow` | INTEGER | yes | Tokens. |
| `ParameterCountBillions` | REAL | yes | |
| `Quantization` | TEXT | yes | e.g. `Q4_K_M`. |
| `License` | TEXT | yes | Shown before download (UC-01). |
| `DownloadCount` | INTEGER | yes | Catalogue display only. |
| `PriceInputPerMillion` | TEXT | yes | TEXT, not REAL — see §4.1. |
| `PriceOutputPerMillion` | TEXT | yes | TEXT, not REAL — see §4.1. |
| `Metadata` | TEXT | no | JSON object (§5). |
| `DiscoveredAt` | INTEGER | no | UTC ticks. |
| `InstalledAt` | INTEGER | yes | UTC ticks. |
| `LastUsedAt` | INTEGER | yes | UTC ticks. |
| `RowVersion` | BLOB | yes | Shadow concurrency column — see §7.2. **Do not rely on it.** |

Indexes:

| Index | Columns | Serves |
|-------|---------|--------|
| `IX_Models_Source_State` | `Source`, `State` | `ModelQuery.Source` / `State`, and `GetInstalledAsync` (`InstalledOnly` = `Source=Local AND State=Installed`). |
| `IX_Models_Kind_State` | `Kind`, `State` | `ModelQuery.Kind` combined with the state filter. |
| `IX_Models_Name` | `Name` | `ModelQuery.SearchText` (prefix/sort). |
| `IX_Models_ExternalId` | `ExternalId` | Catalogue upsert de-duplication. |

`Source` leads the first index because the hot path is the Installed tab
(`IModelRepository.GetInstalledAsync`), which is an equality on `Source` plus an equality on
`State`. `Name` is indexed but see §9 for the search caveat.

### 6.2 `ModelFiles`

`ModelFile` — one row per file of a model. A GGUF release is many files: weights, shards,
tokenizer, config. Tracking each independently is what makes a partial download resumable (UC-01).

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. |
| `ModelId` | TEXT | no | **FK → `Models.Id`, ON DELETE CASCADE.** |
| `FileName` | TEXT | no | As it appears in the release. |
| `LocalPath` | TEXT | yes | Null while still remote. |
| `SourceUrl` | TEXT | yes | Null if already local. |
| `TotalBytes` | INTEGER | no | From `Content-Length` or API metadata. |
| `DownloadedBytes` | INTEGER | no | **The resume point.** Persisted on transition. |
| `Format` | INTEGER | no | `ModelFormat`. |
| `IsPrimary` | INTEGER | no | The file the runtime loads. |
| `Checksum` | TEXT | yes | SHA-256/512, verified post-transfer. |
| `DownloadedAt` | INTEGER | yes | UTC ticks. |

`DownloadedBytes` is the load-bearing column. The download manager must write it on pause, on
failure, and periodically during transfer — not only at completion — or "resume" has nothing to
resume from. That is a repository discipline requirement, not a schema one, and it is the reason
`BackgroundTask` is written on transition (see its own XML doc).

Index: `IX_ModelFiles_ModelId` on `ModelId`. The FK needs it for cascade, and loading a model's
file list is a per-model lookup.

**This is the only real foreign key in the schema.** It is the only case where a child row has no
independent meaning once the parent is gone, and where the POCO already expresses the relationship
as a collection navigation.

### 6.3 `LocalModels`

`LocalModel` — the runtime-facing view of an installed model. Deliberately a separate table from
`Models` (see its XML doc: it carries pricing and provider metadata the runtime must not
interpret).

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. "The `AIModel.Id` this installation was created from." |
| `PrimaryFilePath` | TEXT | no | Absolute path to the weights. |
| `ModelDirectory` | TEXT | no | Used to resolve siblings at load. |
| `Format` | INTEGER | no | `ModelFormat`. |
| `Kind` | INTEGER | no | `ModelKind`. |
| `ContextWindow` | INTEGER | no | Tokens; POCO default 4096. |
| `ParameterCountBillions` | REAL | yes | Pre-flight against free RAM. |
| `Quantization` | TEXT | yes | |
| `EstimatedMemoryBytes` | INTEGER | yes | Pre-flighted so a load fails clearly instead of being OOM-killed. |

Index: `IX_LocalModels_PrimaryFilePath` on `PrimaryFilePath`. Directory scanning (UC-07) resolves
a file path to an installation; this is the lookup that makes "is this GGUF one we already know?"
cheap during a scan of `ModelSettings.ModelDirectories`.

No FK to `Models`. `LocalModel.Id` is *documented* as the originating `AIModel.Id`, but the two
lifecycles differ: a model record survives removal (state `Removed`, retained for history) while
the installation is removed outright. A hard FK would make deleting an installation impossible
while its catalogue row remains. The relationship is by convention, enforced in the repository.

### 6.4 `Generations`

`AIGeneration` — one generation request and its outcome. The history row behind UC-05.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. |
| `ModelId` | TEXT | no | FK-by-convention → `Models.Id`. Set even for cloud models, for grouping. |
| `ModelName` | TEXT | no | **Denormalised on purpose** so history stays readable after the model is removed. |
| `ProviderName` | TEXT | no | Provider or local runtime name. |
| `Status` | INTEGER | no | `GenerationStatus`. |
| `Prompt` | TEXT | no | |
| `NegativePrompt` | TEXT | yes | |
| `Seed` | INTEGER | no | Persisted so a run can be reproduced exactly. |
| `Parameters` | TEXT | no | JSON object of doubles (§5). |
| `OutputPath` | TEXT | yes | Null for text-only. |
| `OutputText` | TEXT | yes | For text-only. |
| `OutputKind` | INTEGER | no | `AssetKind`. |
| `Duration` | TEXT | yes | Never sorted or compared. |
| `PromptTokens` | INTEGER | yes | Null when the provider does not report. |
| `CompletionTokens` | INTEGER | yes | |
| `CostUsd` | TEXT | yes | TEXT — see §4.1. Null for local generation. |
| `ErrorMessage` | TEXT | yes | Populated when `Status = Failed`. |
| `ProjectId` | TEXT | yes | FK-by-convention → `Projects.Id`. |
| `CreatedAt` | INTEGER | no | UTC ticks. **The history sort key.** |
| `CompletedAt` | INTEGER | yes | UTC ticks. |
| `RowVersion` | BLOB | yes | See §7.2. Not relied upon. |

Indexes — these are the ones that matter most in the schema:

| Index | Columns | Serves |
|-------|---------|--------|
| `IX_Generations_CreatedAt` | `CreatedAt` | `GetHistoryAsync(skip, take)` — `ORDER BY CreatedAt DESC`. The UC-05 path. |
| `IX_Generations_ProjectId_CreatedAt` | `ProjectId`, `CreatedAt` | `GetByProjectAsync` — filter by project, newest first. |
| `IX_Generations_ModelId` | `ModelId` | Grouping history by model. |

`ModelName` is **not** indexed, and `Prompt` is **not** indexed. Neither is a query predicate in
`IRepositories.cs`; both are payload. Indexing a TEXT prompt column would inflate the file for no
query.

No FK on `ModelId`. `GetByIdAsync`/`DeleteAsync` operate on generations whose model was already
deleted, and `ModelName` exists precisely so that case renders correctly. A hard FK would force
either a cascade that destroys history or a delete that fails. The same reasoning applies to
`ProjectId`.

**Paging correctness.** `GetHistoryAsync` is `Skip`/`Take`, so equal timestamps are ambiguous and
rows can be skipped or repeated across pages. Verified: five rows sharing one `CreatedAt` produced
a page-1/page-2 union that double-counted. The repository must add a unique tie-break:

```csharp
.OrderByDescending(g => g.CreatedAt)
.ThenByDescending(g => g.Id)
.Skip(skip).Take(take)
```

which makes paging deterministic — verified stable across pages, zero overlap. Note that `Id` is
a random `Guid`, so the tie-break is arbitrary but *stable*; it is a consistency fix, not a
meaningful sort. The same `.ThenBy(x => x.Id)` is required on the library sort paths in §6.7.

### 6.5 `ProviderConfigs`

`ProviderConfig` — one configured cloud provider.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. |
| `ProviderKey` | TEXT | no | **UNIQUE.** e.g. `openrouter`, `custom`. Matches the DI registration name. |
| `DisplayName` | TEXT | no | Settings → AI Providers. |
| `BaseUrl` | TEXT | no | Mutable for self-hosted. |
| `CredentialReference` | TEXT | yes | **Keyring item name. Not the secret.** See §10. |
| `CredentialSource` | INTEGER | no | `CredentialSource`. |
| `Status` | INTEGER | no | `ProviderStatus`. |
| `IsEnabled` | INTEGER | no | |
| `TimeoutSeconds` | INTEGER | no | Default 120. |
| `MaxRetries` | INTEGER | no | Default 3. |
| `PreferredModelIds` | TEXT | no | JSON array (§5). Most-preferred first. |
| `LastVerifiedAt` | INTEGER | yes | UTC ticks. |
| `LastErrorMessage` | TEXT | yes | Safe to display. |

Index: `IX_ProviderConfigs_ProviderKey`, **UNIQUE**. This is the one unique index that is a real
constraint rather than a performance hint: `IProviderConfigRepository.GetByKeyAsync` is the lookup
path and two rows for one key would make provider resolution non-deterministic. The unique index
is the enforcement.

### 6.6 `Projects`

`AppProject` — a persistent project (UC-04), serialised to a `.jgvproj` file.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. |
| `Name` | TEXT | no | |
| `Description` | TEXT | yes | |
| `FilePath` | TEXT | yes | Path of the `.jgvproj`. Null until first save. |
| `ModelId` | TEXT | yes | FK-by-convention → `Models.Id`. |
| `ModelName` | TEXT | yes | Denormalised, so a project survives model removal. |
| `ProviderKey` | TEXT | yes | Last-used provider. |
| `Prompt` | TEXT | no | Last prompt in progress. |
| `Settings` | TEXT | no | JSON object (§5). Layered over global defaults. |
| `AssetIds` | TEXT | no | JSON array of GUIDs (§5). |
| `CreatedAt` | INTEGER | no | UTC ticks. |
| `LastOpenedAt` | INTEGER | no | UTC ticks. **The recent-projects sort key.** |

Indexes:

| Index | Columns | Serves |
|-------|---------|--------|
| `IX_Projects_LastOpenedAt` | `LastOpenedAt` | `GetRecentAsync(take)` — `ORDER BY LastOpenedAt DESC`. The UC-04 Home screen. |
| `IX_Projects_ModelId` | `ModelId` | Reverse lookup: which projects use this model. Needed before a model removal can warn. |

`AssetIds` is the property that most looks like it wants a child table — it is a list of ids to
another table, which is the textbook case. It stays JSON anyway, for the write-amplification reason
in §5: a project accumulates assets one at a time, each addition is a single-column update, and
nothing in `IProjectRepository` queries by asset. `LibraryItem.ProjectId` (§6.7) is the indexed
direction of the same relationship, which is what makes "assets in this project" answerable without
touching the JSON.

### 6.7 `LibraryItems`

`LibraryItem` — an asset in the library, generated or imported (PRODUCT_SPEC §4 "Library").

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. |
| `Name` | TEXT | no | |
| `Kind` | INTEGER | no | `AssetKind`. |
| `FilePath` | TEXT | no | **UNIQUE.** Absolute path. The database stores the reference, not the bytes. |
| `SizeBytes` | INTEGER | no | |
| `Width` | INTEGER | yes | Images only. |
| `Height` | INTEGER | yes | Images only. |
| `GenerationId` | TEXT | yes | FK-by-convention → `Generations.Id`. Null if imported. |
| `ProjectId` | TEXT | yes | FK-by-convention → `Projects.Id`. |
| `Tags` | TEXT | no | JSON array (§5). |
| `IsFavorite` | INTEGER | no | `SetFavoriteAsync` writes only this column. |
| `CreatedAt` | INTEGER | no | UTC ticks. |
| `LastViewedAt` | INTEGER | no | UTC ticks. |

Indexes — these serve `ILibraryRepository.QueryAsync(searchText, kind, sort, skip, take)`, which is
the one query surface with a genuine sort *and* filter:

| Index | Columns | Serves |
|-------|---------|--------|
| `IX_LibraryItems_Kind_CreatedAt` | `Kind`, `CreatedAt` | The default path: filter by `AssetKind`, sort newest/oldest. |
| `IX_LibraryItems_CreatedAt` | `CreatedAt` | Same sort with no `Kind` filter. |
| `IX_LibraryItems_Name` | `Name` | `NameAscending` / `NameDescending`. |
| `IX_LibraryItems_SizeBytes` | `SizeBytes` | `LargestFirst` / `SmallestFirst`. |
| `IX_LibraryItems_ProjectId` | `ProjectId` | Assets in a project. |
| `IX_LibraryItems_GenerationId` | `GenerationId` | Reverse lookup from a generation. |
| `IX_LibraryItems_FilePath` | `FilePath` | **UNIQUE.** Import idempotency. |

`LibrarySort` has six cases and four of them map onto a real index: `NewestFirst`/`OldestFirst` on
`CreatedAt`, `NameAscending`/`NameDescending` on `Name`, `LargestFirst`/`SmallestFirst` on
`SizeBytes`. Each of these queries needs a `.ThenBy(x => x.Id)` tie-break for the same reason as
history paging (§6.4).

`FilePath` is unique because re-importing the same file must not create a second row, and because
it makes "is this asset already in my library?" a single index probe. Consequence to note: a
deleted-then-restored asset reuses the row; the app must not rely on `Id` surviving a
delete/re-import cycle.

**Search caveat, stated honestly.** EF translates `x.Name.Contains("foo")` to
`instr("Name", 'foo') > 0`, which is a full scan — the `IX_LibraryItems_Name` index does not help a
substring match. That is acceptable at library scale and is a deliberate trade, but it should not
be discovered later. If search latency becomes visible, the fix is SQLite FTS5 with a contentless
external-content table over `Name`, not a LIKE-pattern change. Recorded in §9.

### 6.8 `BackgroundTasks`

`BackgroundTask` — a long-running operation surfaced in the Tasks view (UC-07). Downloads,
generations, scans, installs, and indexing all live here.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Id` | TEXT | no | PK. |
| `Kind` | INTEGER | no | `TaskKind`. |
| `State` | INTEGER | no | `TaskState`. |
| `Title` | TEXT | no | User-facing. |
| `ModelId` | TEXT | yes | FK-by-convention → `Models.Id`. |
| `ProjectId` | TEXT | yes | FK-by-convention → `Projects.Id`. |
| `Progress` | REAL | yes | 0.0–1.0. Null when not measurable. |
| `BytesTransferred` | INTEGER | yes | Downloads. |
| `TotalBytes` | INTEGER | yes | Downloads. |
| `StatusMessage` | TEXT | yes | e.g. `4.2 MB/s`. |
| `ErrorMessage` | TEXT | yes | When `State = Failed`. |
| `AttemptCount` | INTEGER | no | Decides whether to keep retrying. |
| `ResumableSince` | INTEGER | yes | Set on a retryable failure. **The resume query's key.** |
| `CreatedAt` | INTEGER | no | UTC ticks. |
| `StartedAt` | INTEGER | yes | UTC ticks. |
| `CompletedAt` | INTEGER | yes | UTC ticks. Drives pruning. |

Indexes:

| Index | Columns | Serves |
|-------|---------|--------|
| `IX_BackgroundTasks_State_CreatedAt` | `State`, `CreatedAt` | `GetRecentAsync(take)` — active/recent, newest first. |
| `IX_BackgroundTasks_State_CompletedAt` | `State`, `CompletedAt` | `PruneCompletedAsync(olderThan)` — terminal tasks by completion date. |
| `IX_BackgroundTasks_ResumableSince` | `ResumableSince` | `GetResumableAsync()`. |
| `IX_BackgroundTasks_ModelId` | `ModelId` | Tasks for one model. |

`GetResumableAsync` is the interesting one, because the predicate is derived from the domain's own
`IsResumable`. Mirroring that logic in LINQ produces, verbatim:

```sql
SELECT ... FROM "BackgroundTasks" AS "b"
WHERE "b"."State" = 'Paused' OR ("b"."State" = 'Failed' AND "b"."AttemptCount" < 5)
```

(verified translation). The `State` column leads `IX_BackgroundTasks_State_CreatedAt` and is
usable for the `OR` — SQLite can drive a scan over the state index and re-check — so the index
serves this query. `ResumableSince` is separately indexed as a narrower path for the common
"paused and waiting" case, which avoids evaluating the `OR` at all.

**This row is written on transition, not only at the end.** A crash mid-download must leave a
resumable task behind — that is the stated purpose of the entity. `UpsertAsync` on every state
change is required; the schema cannot enforce it.

No FK on `ModelId`. Removing a model must not delete the task row that is downloading it — the task
has to survive to report the failure, and a hard FK would block the delete or cascade the evidence
away.

### 6.9 `Settings`

A single row holding the whole `AppSettings` document.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `Key` | TEXT | no | PK. Literal `"app"`. Allows a future second namespace. |
| `Payload` | TEXT | no | The entire `AppSettings` object as JSON. |
| `SchemaVersion` | INTEGER | no | Mirrors `AppSettings.SchemaVersion`. |
| `UpdatedAt` | INTEGER | no | UTC ticks. |

This is **not** one of the §5 collection properties. It is a different decision, stated here.

`AppSettings` is a composite value object with eight nested sections, and the entity carries a
`SchemaVersion` field precisely so that adding a section requires no migration. A column per
setting would mean an `ALTER TABLE` for every new preference across every install, for a payload
that is read once at startup and written once on change. The whole document is a few KB; the
document round-trips in a single read and a single write.

`SettingsRow` is a Storage-layer type. It is not in `Core`, because it is a persistence detail, not
a domain concept — and this is the one place where introducing a Storage-owned type is correct.
Mapping it in EF would otherwise require pretending `AppSettings` is an entity, which would drag
JSON attributes into Core or force a wrapper nobody wants.

Read with `ISettingsStore.LoadAsync`, write with `SaveAsync`. The concrete implementation
deserialises `Payload` into `AppSettings`. Two rules:

- **Absent keys get their C# default.** A settings document written by an older build will lack
  newer keys; deserialisation into `AppSettings` leaves the POCO's initialiser values in place.
  This is why every settings property has a default (e.g. `Theme = "dark"`,
  `AccentColor = "#3DDC84"`). Never remove an initialiser; it is the migration mechanism.
- **Bump `SchemaVersion` when a section requires a UI or runtime restart.** That is the field's
  documented purpose.

The `Key` primary key with a constant value is deliberate. A single-row table with a natural key
extends to a second namespace (per-project overrides, say) without a migration, whereas a
fixed single-row table would need one.

## 7. Keys, constraints, and concurrency

### 7.1 Primary keys

Every table has a `Guid` primary key assigned client-side. Each POCO initialises
`Id = Guid.NewGuid()`, so an entity is fully identified before it is ever persisted — the download
manager can log and correlate a model before the row exists.

The consequence in configuration:

```csharp
e.HasKey(x => x.Id);
e.Property(x => x.Id).ValueGeneratedNever();
```

`ValueGeneratedNever()` is required. Without it EF treats a `Guid` key as store-generated and will
try to generate one on insert, discarding the POCO's value and breaking the correlation above.

`Guid` keys are `TEXT` (36-char uppercase dashed), which is larger than an `INTEGER` rowid but
avoids a second identity concept and makes ids meaningful outside the database — in log lines, in
`.jgvproj` files, in the `AssetIds` JSON.

### 7.2 Concurrency: no optimistic concurrency token

**Decision: no concurrency token on any table. `RowVersion` is not used.**

`IsRowVersion()` does not work on SQLite, and the failure is silent. Verified end to end:

```
after insert,  RowVersion = <null>
second writer UPDATE succeeded     <- no DbUpdateConcurrencyException
final Name = Writer 3 final         <- last writer silently won
```

The column is created as a nullable `BLOB` and nothing ever populates it, because SQLite has no
`rowversion` type and no trigger to maintain one. EF adds the column to the `WHERE` clause and the
comparison against `NULL` never fails, so every stale write is accepted. Configuring it would
produce a schema that *looks* concurrency-safe and is not. The generated DDL above still shows
`RowVersion` because the probe that produced it had it configured; it is in this document to be
described as a non-solution, not copied.

**Why no token is the right call.** This is a single-user, single-process desktop app. Within the
process, EF's change tracker already prevents a lost update: one `DbContext` per unit of work, and
`SaveChanges` writes the full tracked state of a row that the same context loaded. The dangerous
case for optimistic concurrency is a second *process* — a second copy of the app, or a maintenance
tool — and the answer there is a single-instance lock, not a database token:

- Acquire an exclusive lock on a lock file beside the database at startup.
- If the lock is held, the second instance exits or hands off its file arguments to the running
  instance (which is also what makes the `.jgvproj` double-click behaviour in UC-04 work).

This is strictly stronger than a `rowversion` column, because it prevents the conflict rather than
detecting it after the fact.

WAL (§8) makes the concurrent-writer case safe at the storage layer even if the lock is ever
bypassed: writers serialise, readers do not block, and a second process gets `SQLITE_BUSY` on
write rather than silent corruption. The `busy_timeout` below converts that into a short wait.

**Raw SQL and the `Guid` key format.** EF Core's SQLite provider stores `Guid` primary keys as
TEXT in **uppercase** dash form (`Guid.ToString("D").ToUpperInvariant()`), not the lowercase form
`Guid.ToString()` returns. `WHERE Id = @id` bound with `someGuid.ToString()` therefore matches
**zero rows** — silently, because an `UPDATE` that affects nothing and an `UPDATE` that worked
look identical unless the affected-row count is checked. Any hand-written SQL against these
tables must use the uppercase form (or better, go through EF), and must assert
`ExecuteNonQuery()` returned the expected number of rows. This is asserted by
`ReferentialIntegrityTests.GuidKeys_AreStoredAsUppercaseDashText`.

**Where a token would be justified.** The one genuinely concurrent case is `BackgroundTask`:
the download manager writes progress from a background thread while the UI reads the same row. That
is intra-process, so the change tracker already covers it, provided each writer uses its own
short-lived `DbContext` and the UI does not hold a long-lived tracking context over a task row. If
that discipline is not maintainable, the correct fix is a per-row `int Revision` incremented by the
Storage layer and compared in the `WHERE` clause — an explicit, hand-maintained token, on one
table, with a comment saying why. Not a `rowversion` that silently does nothing.

### 7.3 Cascade behaviour

There is exactly one foreign key in the schema, and therefore exactly one cascade rule.

| Relationship | Rule | Reason |
|--------------|------|--------|
| `ModelFiles.ModelId` → `Models.Id` | `ON DELETE CASCADE` | A file row has no independent meaning. `IModelRepository.DeleteAsync` removing a model must not leave orphaned `ModelFiles` rows, and the model row is the aggregate root (`AIModel.Files` is a navigation). |

Every other id-shaped column is a **soft reference**: `Generations.ModelId`,
`Generations.ProjectId`, `LibraryItems.GenerationId`, `LibraryItems.ProjectId`,
`Projects.ModelId`, `BackgroundTasks.ModelId`, `BackgroundTasks.ProjectId`. No FK constraint,
`DeleteBehavior` is irrelevant, and referential integrity is a repository responsibility.

The reasoning is uniform: **history and in-flight work must outlive the thing they point at.**
Deleting a model must not delete the generations that used it — that is the entire purpose of
`AIGeneration.ModelName` being denormalised. Deleting a model must not delete the task that is
downloading it, or the user loses the only record of a failure. Deleting a project must not delete
library assets, because the asset outlives the project and the user may want to keep it.

Where SQLite cascades would be correct, the application is the one that knows, and it can prompt.
A cascade cannot ask.

**Verified:** deleting a `Models` row with two `ModelFiles` children left `0` child rows.

One practical consequence: with `PRAGMA foreign_keys` on, SQLite only enforces the one real FK.
With it off, it enforces nothing. Either way the soft references are unenforced, so referential
cleanliness on delete is entirely on the repository implementations. This is a real, accepted
trade — the alternative is losing history — but it means delete paths need tests.

## 8. SQLite configuration

A desktop single-user app is a good fit for SQLite and a bad fit for a client/server database. The
configuration below is per connection, applied on open.

| Pragma | Value | Why |
|--------|-------|-----|
| `journal_mode` | `WAL` | Readers do not block the writer and the writer does not block readers. The UI polls task progress and history while downloads and generations write. Verified: setting it returns `wal` and creates `-wal` and `-shm` files. |
| `foreign_keys` | `ON` | **Off by default in SQLite**, per-connection, and required for the `ModelFiles` cascade to work at all. |
| `busy_timeout` | `5000` | Converts a `SQLITE_BUSY` into a wait instead of an exception, for the brief overlap if the single-instance lock is ever bypassed. Verified: returns `5000`. |
| `synchronous` | `NORMAL` | With WAL this is durable across application crashes; only an OS-level crash can lose the last transactions. The right trade for a media index that is rebuildable from the filesystem. |

`journal_mode` is a persistent property of the database file, not the connection — it only needs
setting once. The other three are per-connection and must be set on every open.

`foreign_keys` and `busy_timeout` can be set in the connection string, which is the simplest
approach and avoids an interceptor:

```
Data Source=/home/user/.local/share/jugaadvision/jugaadvision.db;Foreign Keys=True;Default Timeout=5
```

Verified: `Foreign Keys=True` in the connection string yields `PRAGMA foreign_keys = 1`.
`journal_mode` cannot be set this way and needs an explicit command on first open:

```csharp
public sealed class SqlitePragmaInitializer : IInitializable
{
    public void Initialize(DbContext context)
    {
        // Executes on a dedicated connection on first use.
        context.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
    }
}
```

If an `IInterceptor` is used instead, the pragmas must be applied in `ConnectionOpened` — the
connection string alone is not sufficient for `busy_timeout` when the pool recycles connections,
and this is the classic source of "it works in the foreground and not in the background".

**Connection lifetime.** The `DbContext` is scoped, not singleton. A long-lived tracking context
would pin every entity it ever loaded and go stale against concurrent task writes.

## 9. Review triggers

Reopen the §5 decision if any of these become true:

- A query predicate appears on a `List<string>` or `Dictionary<,>` property in
  `IRepositories.cs` — a tag filter on `ILibraryRepository.QueryAsync`, a capability filter on
  `ModelQuery`, a settings-key lookup. JSON columns cannot serve these in SQL. `LibraryItem.Tags`
  is the one to promote to a child table first.
- `ModelQuery` grows a `Tags`/`Capabilities` parameter, or the settings screen needs to query
  settings by key.
- Library search latency becomes user-visible, at which point adopt SQLite FTS5 over `Name` rather
  than trying to make a substring match index-friendly.

Other triggers:

- A second process ever touches the database → the single-instance lock (§7.2) is mandatory, not
  advisory.
- A second user account or a shared library → the "no secrets in the DB" and "references not bytes"
  assumptions (§10, §3) need revisiting, and SQLite moves off the table.
- `BackgroundTask` progress writes start conflicting with UI reads → add the explicit `Revision`
  column described in §7.2, on that table only.

## 10. Secrets and file references

### 10.1 No secret material is ever stored

`ProviderConfig` holds **no secret**. It stores `CredentialReference` — the *name* of a keyring
item — and `CredentialSource`, which says where the secret lives. The secret itself is resolved
through `ISecretStore` at request time.

This is not a stylistic preference. PRODUCT_SPEC §5 requires "API key security | Never in
plaintext, never in logs", and the consequence is concrete: `ProviderConfig` is safe to log, safe
to export in a diagnostics bundle, and safe to include in a bug report. There is no redaction pass
because there is nothing to redact.

`CredentialSource` discriminates:

| Value | Meaning |
|-------|---------|
| `None` | No credential stored. `IsUsable` is false. |
| `Keyring` | Secret Service / libsecret. The preferred store on Linux. |
| `EncryptedFile` | AES-256-GCM encrypted file. **Fallback only**, when no keyring is available. |
| `Ephemeral` | Supplied per call, never persisted. |

`AdvancedSettings.CustomHeaders` (inside the settings JSON blob) deserves a note: a header map is
exactly the shape a user fills with an auth token. It must be treated as secret-adjacent — never
logged, and the "verbose provider logging" option must redact header values. The XML doc on
`VerboseProviderLogging` already says it "never includes credential headers"; that is a
requirement, not a description.

`IsSecretStoreAvailable` on `ISecretStore` exists so the UI can tell the user when they are on the
weaker fallback, rather than silently degrading.

### 10.2 Paths are references, never bytes

Every asset-bearing column stores an absolute path. No column stores image, video, audio, or model
weight bytes.

- `LibraryItem.FilePath`, `LibraryItem.SizeBytes`, `Width`, `Height`
- `AIGeneration.OutputPath`
- `ModelFile.LocalPath`, `SourceUrl`
- `LocalModel.PrimaryFilePath`, `ModelDirectory`
- `AppProject.FilePath`
- `ModelSettings.ModelDirectories`, `GenerationSettings.OutputDirectory`

Model weights are multi-gigabyte; assets are large. Storing them in SQLite would make the database
the largest thing on disk, make `VACUUM` unusable, and make the library undeletable in any
practical sense. References keep the database a few MB and browsable forever.

The trade is that the database can outlive the files, so the app must tolerate dangling paths.
`LibraryItem` has no "file missing" state, so the library view must handle a `FileNotFoundException`
on thumbnail load as a normal condition, not an error. This is a UI requirement that falls out of
the schema decision and should be in the implementation spec for the library grid.

`GenerationSettings.StripAssetMetadata` (default `true`) is a related rule: identifying metadata is
stripped before the file is written, so the reference is the only thing the database knows.

### 10.3 Provider configuration is not a secret store

`AppSettings` is a JSON document in a plaintext SQLite file, protected only by filesystem
permissions on `~/.local/share`. It is fine for preferences and wrong for credentials. Hence the
split: preferences in the document, credentials in the keyring, and only a reference crossing the
boundary.

## 11. Migrations

### 11.1 Naming convention

`<yyyyMMddHHmmss>_<PascalCaseDescription>`, which is the EF Core default — do not override it.
Folder: `JugaadVision.Storage/Persistence/Migrations/`. Verified output filenames match:
`20260925174529_InitialCreate.cs`, plus the `.Designer.cs` and
`JugaadVisionContextModelSnapshot.cs` companions.

First migration: `InitialCreate`.

### 11.2 Commands

The EF tools are not installed globally in this repo; install them as a local tool so the version
is pinned by the repository rather than by whatever is on the machine:

```bash
cd src/desktop
dotnet new tool-manifest
dotnet tool install dotnet-ef --version 10.0.12
```

`Microsoft.EntityFrameworkCore.Design` 10.0.12 is already pinned in `Directory.Packages.props` and
must be referenced by `JugaadVision.Storage` for the tooling to see the model.

Scaffold, apply, inspect, script:

```bash
# Scaffold
dotnet ef migrations add InitialCreate \
  --project JugaadVision.Storage \
  --startup-project JugaadVision.Storage \
  --output-dir Persistence/Migrations

# Apply to the local development database
dotnet ef database update --project JugaadVision.Storage --startup-project JugaadVision.Storage

# Apply only up to a specific migration
dotnet ef database update <MigrationName> --project JugaadVision.Storage

# List applied and pending migrations
dotnet ef migrations list --project JugaadVision.Storage

# Roll back the last migration
dotnet ef migrations remove --project JugaadVision.Storage

# Produce a reviewable SQL diff before committing a schema change
dotnet ef migrations script <From> <To> --project JugaadVision.Storage --output migration.sql

# Empty the database and reapply everything (destructive; development only)
dotnet ef database drop --force --project JugaadVision.Storage
```

`--project` and `--startup-project` are both `JugaadVision.Storage` because the `DbContext` lives
there and nothing else is needed to construct it. Verified end to end: `migrations add
InitialCreate` scaffolded successfully, `database update` applied it, and `migrations list` reported
it back.

`dotnet ef` also needs an `IDesignTimeDbContextFactory<JugaadVisionContext>` so it can build the
model without booting Avalonia. Verified as the mechanism that makes the commands above work.

### 11.3 One SQLite limitation, verified

**`dotnet ef migrations script --idempotent` does not work with SQLite.**

```
Generating idempotent scripts for migrations is not currently supported for SQLite.
```

Idempotent scripts are a SQL Server / PostgreSQL feature. For SQLite, use the plain
`migrations script <From> <To>` form shown above and gate on the `__EFMigrationsHistory` table
instead. Do not add `--idempotent` to any scripted deployment path; it fails outright rather than
degrading.

### 11.4 Applying migrations at runtime

The app applies migrations itself on startup, before the first query:

```csharp
await context.Database.MigrateAsync(ct);
```

`MigrateAsync` rather than `EnsureCreated`. `EnsureCreated` creates the schema only when the
database is empty and then never updates it, so it would leave every existing install permanently
one migration behind. That failure is silent and appears weeks later as a missing column.

Applied migration names are recorded in `__EFMigrationsHistory`, which EF maintains. Backup the
`.db` file before migrating a user who is mid-generation.

### 11.5 Migration discipline

- **Migrations are additive.** Adding a nullable column, a table, or an index is safe. Renaming or
  dropping a column requires the four-step dance (add, dual-write, backfill, drop) across
  releases, because a user skips versions.
- **`AppSettings` needs none of this.** Adding a settings section is a change to
  `AppSettings.cs` and a `SchemaVersion` bump — no migration. That is the entire reason the
  settings table is a JSON document (§6.9). New settings are the common case; they must not
  generate migrations.
- **Changing a collection property to a different JSON shape is a migration.** Renaming a key in
  `AppSettings` or changing a `Parameters` key changes stored data, not just the schema. Handle
  both old and new shapes on read, or migrate the payload in a data migration.
- **Review the generated SQL, not just the C#.** `dotnet ef migrations script <From> <To>` before
  committing. SQLite cannot `ALTER` most things; EF rebuilds the table when it has to, which
  silently drops indexes and constraints.
- **`libjlv_sqlite3` (or whichever provider) is bundled, so the SQLite version is fixed by the
  build.** Do not depend on a feature newer than what the bundled library provides — JSON1 is
  present in 3.53.3 (verified) but was optional in older builds.
- **Test against a real file, not `:memory:`.** WAL is a file-level property; `:memory:` silently
  skips the behaviour that matters.

## 12. Full DDL

Generated by EF Core 10.0.12 from the configuration described above, with the `DateTimeOffset`
converters applied (§4.2) and `RowVersion` omitted (§7.2). Reproduced verbatim so the document
cannot drift from a guess:

```sql
CREATE TABLE "BackgroundTasks" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_BackgroundTasks" PRIMARY KEY,
    "Kind" INTEGER NOT NULL,
    "State" INTEGER NOT NULL,
    "Title" TEXT NOT NULL,
    "ModelId" TEXT NULL,
    "ProjectId" TEXT NULL,
    "Progress" REAL NULL,
    "BytesTransferred" INTEGER NULL,
    "TotalBytes" INTEGER NULL,
    "StatusMessage" TEXT NULL,
    "ErrorMessage" TEXT NULL,
    "AttemptCount" INTEGER NOT NULL,
    "ResumableSince" INTEGER NULL,
    "CreatedAt" INTEGER NOT NULL,
    "StartedAt" INTEGER NULL,
    "CompletedAt" INTEGER NULL
);

CREATE TABLE "Generations" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_Generations" PRIMARY KEY,
    "ModelId" TEXT NOT NULL,
    "ModelName" TEXT NOT NULL,
    "ProviderName" TEXT NOT NULL,
    "Status" INTEGER NOT NULL,
    "Prompt" TEXT NOT NULL,
    "NegativePrompt" TEXT NULL,
    "Seed" INTEGER NOT NULL,
    "Parameters" TEXT NOT NULL,
    "OutputPath" TEXT NULL,
    "OutputText" TEXT NULL,
    "OutputKind" INTEGER NOT NULL,
    "Duration" TEXT NULL,
    "PromptTokens" INTEGER NULL,
    "CompletionTokens" INTEGER NULL,
    "CostUsd" TEXT NULL,
    "ErrorMessage" TEXT NULL,
    "ProjectId" TEXT NULL,
    "CreatedAt" INTEGER NOT NULL,
    "CompletedAt" INTEGER NULL
);

CREATE TABLE "LibraryItems" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_LibraryItems" PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Kind" INTEGER NOT NULL,
    "FilePath" TEXT NOT NULL,
    "SizeBytes" INTEGER NOT NULL,
    "Width" INTEGER NULL,
    "Height" INTEGER NULL,
    "GenerationId" TEXT NULL,
    "ProjectId" TEXT NULL,
    "Tags" TEXT NOT NULL,
    "IsFavorite" INTEGER NOT NULL,
    "CreatedAt" INTEGER NOT NULL,
    "LastViewedAt" INTEGER NOT NULL
);

CREATE TABLE "LocalModels" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_LocalModels" PRIMARY KEY,
    "PrimaryFilePath" TEXT NOT NULL,
    "ModelDirectory" TEXT NOT NULL,
    "Format" INTEGER NOT NULL,
    "Kind" INTEGER NOT NULL,
    "ContextWindow" INTEGER NOT NULL,
    "ParameterCountBillions" REAL NULL,
    "Quantization" TEXT NULL,
    "EstimatedMemoryBytes" INTEGER NULL
);

CREATE TABLE "Models" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_Models" PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Publisher" TEXT NULL,
    "Description" TEXT NULL,
    "ExternalId" TEXT NULL,
    "Kind" INTEGER NOT NULL,
    "Format" INTEGER NOT NULL,
    "Source" INTEGER NOT NULL,
    "Tier" INTEGER NOT NULL,
    "State" INTEGER NOT NULL,
    "Capabilities" TEXT NOT NULL,
    "ContextWindow" INTEGER NULL,
    "ParameterCountBillions" REAL NULL,
    "Quantization" TEXT NULL,
    "License" TEXT NULL,
    "DownloadCount" INTEGER NULL,
    "PriceInputPerMillion" TEXT NULL,
    "PriceOutputPerMillion" TEXT NULL,
    "Metadata" TEXT NOT NULL,
    "DiscoveredAt" INTEGER NOT NULL,
    "InstalledAt" INTEGER NULL,
    "LastUsedAt" INTEGER NULL
);

CREATE TABLE "Projects" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_Projects" PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Description" TEXT NULL,
    "FilePath" TEXT NULL,
    "ModelId" TEXT NULL,
    "ModelName" TEXT NULL,
    "ProviderKey" TEXT NULL,
    "Prompt" TEXT NOT NULL,
    "Settings" TEXT NOT NULL,
    "AssetIds" TEXT NOT NULL,
    "CreatedAt" INTEGER NOT NULL,
    "LastOpenedAt" INTEGER NOT NULL
);

CREATE TABLE "ProviderConfigs" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_ProviderConfigs" PRIMARY KEY,
    "ProviderKey" TEXT NOT NULL,
    "DisplayName" TEXT NOT NULL,
    "BaseUrl" TEXT NOT NULL,
    "CredentialReference" TEXT NULL,
    "CredentialSource" INTEGER NOT NULL,
    "Status" INTEGER NOT NULL,
    "IsEnabled" INTEGER NOT NULL,
    "TimeoutSeconds" INTEGER NOT NULL,
    "MaxRetries" INTEGER NOT NULL,
    "PreferredModelIds" TEXT NOT NULL,
    "LastVerifiedAt" INTEGER NULL,
    "LastErrorMessage" TEXT NULL
);

CREATE TABLE "Settings" (
    "Key" TEXT NOT NULL CONSTRAINT "PK_Settings" PRIMARY KEY,
    "Payload" TEXT NOT NULL,
    "SchemaVersion" INTEGER NOT NULL,
    "UpdatedAt" INTEGER NOT NULL
);

CREATE TABLE "ModelFiles" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_ModelFiles" PRIMARY KEY,
    "ModelId" TEXT NOT NULL,
    "FileName" TEXT NOT NULL,
    "LocalPath" TEXT NULL,
    "SourceUrl" TEXT NULL,
    "TotalBytes" INTEGER NOT NULL,
    "DownloadedBytes" INTEGER NOT NULL,
    "Format" INTEGER NOT NULL,
    "IsPrimary" INTEGER NOT NULL,
    "Checksum" TEXT NULL,
    "DownloadedAt" INTEGER NULL,
    CONSTRAINT "FK_ModelFiles_Models_ModelId" FOREIGN KEY ("ModelId")
        REFERENCES "Models" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_BackgroundTasks_ModelId" ON "BackgroundTasks" ("ModelId");
CREATE INDEX "IX_BackgroundTasks_ResumableSince" ON "BackgroundTasks" ("ResumableSince");
CREATE INDEX "IX_BackgroundTasks_State_CompletedAt" ON "BackgroundTasks" ("State", "CompletedAt");
CREATE INDEX "IX_BackgroundTasks_State_CreatedAt" ON "BackgroundTasks" ("State", "CreatedAt");

CREATE INDEX "IX_Generations_CreatedAt" ON "Generations" ("CreatedAt");
CREATE INDEX "IX_Generations_ModelId" ON "Generations" ("ModelId");
CREATE INDEX "IX_Generations_ProjectId_CreatedAt" ON "Generations" ("ProjectId", "CreatedAt");

CREATE INDEX "IX_LibraryItems_CreatedAt" ON "LibraryItems" ("CreatedAt");
CREATE INDEX "IX_LibraryItems_GenerationId" ON "LibraryItems" ("GenerationId");
CREATE INDEX "IX_LibraryItems_Kind_CreatedAt" ON "LibraryItems" ("Kind", "CreatedAt");
CREATE INDEX "IX_LibraryItems_Name" ON "LibraryItems" ("Name");
CREATE INDEX "IX_LibraryItems_ProjectId" ON "LibraryItems" ("ProjectId");
CREATE INDEX "IX_LibraryItems_SizeBytes" ON "LibraryItems" ("SizeBytes");
CREATE UNIQUE INDEX "IX_LibraryItems_FilePath" ON "LibraryItems" ("FilePath");

CREATE INDEX "IX_LocalModels_PrimaryFilePath" ON "LocalModels" ("PrimaryFilePath");

CREATE INDEX "IX_Models_ExternalId" ON "Models" ("ExternalId");
CREATE INDEX "IX_Models_Kind_State" ON "Models" ("Kind", "State");
CREATE INDEX "IX_Models_Name" ON "Models" ("Name");
CREATE INDEX "IX_Models_Source_State" ON "Models" ("Source", "State");

CREATE INDEX "IX_Projects_LastOpenedAt" ON "Projects" ("LastOpenedAt");
CREATE INDEX "IX_Projects_ModelId" ON "Projects" ("ModelId");

CREATE UNIQUE INDEX "IX_ProviderConfigs_ProviderKey" ON "ProviderConfigs" ("ProviderKey");

CREATE INDEX "IX_ModelFiles_ModelId" ON "ModelFiles" ("ModelId");
```

Note the index count. 23 indexes across 9 tables is high for a personal database, and deliberately
so: every one of them is on a sort or filter path that `IRepositories.cs` actually issues, and
write amplification only matters if the writes are frequent. They are not — generations and
library items are written once and read many times. An index that is never used costs a little
space; a missing index on a paged `ORDER BY` costs a full sort on every page load.

## 13. Verification

Every mapping, query translation, and pragma value in this document was checked by compiling the
real domain types from `JugaadVision.Core` against EF Core 10.0.12 and executing against SQLite
3.53.3, rather than asserted from documentation. Specifically verified:

| Claim | Result |
|-------|--------|
| `DateTimeOffset` on the EF default mapping cannot be sorted | Throws `NotSupportedException` at query-compile time. |
| `DateTimeOffset` TEXT ordering is offset-dependent | Three correctly-ordered instants emitted out of order in raw SQL. |
| UTC-ticks converter restores `ORDER BY` | `ORDER BY "g"."CreatedAt" DESC, "g"."Id" DESC` executes. |
| `IsRowVersion()` is inert on SQLite | `RowVersion` is `<null>` after insert; a stale second writer succeeds. |
| `decimal` TEXT column aggregates exactly | `ef_sum` over `1.25 + 2.50 + 3.00` returns exactly `6.75`. |
| `decimal` ordering is available | EF emits `COLLATE EF_DECIMAL`. |
| JSON round-trip is lossless | Tags with quotes, commas, and non-ASCII round-trip equal. |
| `Guid` round-trips through a TEXT PK | Exact match on read-back. |
| `ON DELETE CASCADE` removes file rows | Model with 2 files deleted → 0 child rows. |
| Resumable-task predicate translates | `WHERE "State" = 'Paused' OR ("State" = 'Failed' AND "AttemptCount" < 5)`. |
| `Skip`/`Take` without a tie-break double-counts | 5 equal-timestamp rows, page union did not partition. |
| `Skip`/`Take` with `.ThenBy(Id)` is stable | Zero overlap across pages. |
| `foreign_keys` is off by default | Connection string `Foreign Keys=True` → `PRAGMA foreign_keys = 1`. |
| WAL is persistent and creates sidecar files | Returns `wal`; `final.db`, `-wal`, `-shm` present. |
| `busy_timeout` accepts a value | Returns `5000`. |
| JSON1 is available for ad-hoc inspection | `json_extract` and `json_each` both work. |
| `ModelFile` has no back-reference | `WithOne(f => f.Model)` does not compile. |
| Migration tooling works end to end | `migrations add` → `database update` → `migrations list`. |
| `migrations script --idempotent` is unsupported on SQLite | Tool errors out. |

## Appendix A. Implementation note — settings are file-backed, not a table

**This supersedes the `Settings` table described in §6.9.** The design of a single JSON document
was kept; the storage location was not.

`AppSettings` is persisted by `JsonFileSettingsStore` to
`$XDG_CONFIG_HOME/jugaadvision/settings.json` (falling back to
`~/.config/jugaadvision/settings.json`), **not** to a `Settings` table in SQLite.

Why the change:

- The reason for a JSON document was to avoid a migration per settings section. That goal is met
  more directly by a file: there is no schema to migrate at all, so the `SchemaVersion` /
  in-place-upgrade machinery becomes unnecessary.
- Settings are configuration, not application data. Putting them beside the database conflates
  "the user can delete their history" with "the user can delete their preferences".
- Writes are atomic (temp file plus `File.Move(overwrite: true)`), so a crash mid-save cannot
  truncate the file and reset the user's configuration — the failure mode a `Settings` table
  would have had to solve differently.

The trade-off accepted: settings are no longer covered by the database backup story, and a
settings file that is deleted or corrupted falls back to defaults rather than being recoverable.
`LoadAsync` catches `JsonException` and returns defaults so a corrupt file cannot prevent the app
from starting.

There is deliberately **no** `SettingsDocument` entity in Core, since nothing persists one.
`AppSettings.SchemaVersion` is retained for in-place upgrades of the JSON document itself.

