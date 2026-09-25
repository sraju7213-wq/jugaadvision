using JugaadVision.Core.Enums;
using JugaadVision.Core.Generation;
using JugaadVision.Core.Models;

namespace JugaadVision.Core.Abstractions;

/// <summary>
/// A local inference backend (spec §4.2 / §17) — llama.cpp, ONNX Runtime, and any future
/// runtime. Implementsations live in <c>JugaadVision.AI</c> (runtimes) and are surfaced to the
/// model browser by <c>JugaadVision.Models</c>.
/// </summary>
/// <remarks>
/// The spec's definition was truncated after <c>LoadModelAsync</c>; the members below it
/// (<c>GenerateAsync</c>, <c>UnloadAsync</c>, <c>WatchLoadAsync</c>) are inferred from UC-02,
/// which requires visible load progress, non-blocking inference, and explicit model release.
/// </remarks>
public interface ILocalRuntime
{
    /// <summary>Stable runtime key used in configuration and DI, e.g. "llamacpp".</summary>
    string Name { get; }

    /// <summary>
    /// False when the runtime's native library or daemon is missing. Checked before the user is
    /// offered the runtime, so a missing backend is never presented as a load failure.
    /// </summary>
    bool IsAvailable { get; }

    /// <summary>Whether this runtime can load the given on-disk format.</summary>
    bool SupportsFormat(ModelFormat format);

    /// <summary>Model kinds this runtime can serve, e.g. text generation only.</summary>
    IReadOnlyCollection<ModelKind> SupportedKinds { get; }

    /// <summary>
    /// Loads a model into memory. Long-running and must not block the caller — pair it with
    /// <see cref="WatchLoadAsync"/> for progress (UC-02).
    /// </summary>
    Task<LoadResult> LoadModelAsync(LocalModel model, CancellationToken ct);

    /// <summary>Streams load progress. Yields until the load completes or the token is cancelled.</summary>
    IAsyncEnumerable<LoadProgress> WatchLoadAsync(LocalModel model, CancellationToken ct);

    /// <summary>Runs one generation against an already-loaded model.</summary>
    Task<GenerateResult> GenerateAsync(LoadedModel model, GenerationRequest request, CancellationToken ct);

    /// <summary>Releases a loaded model and its memory. Must be safe to call twice.</summary>
    Task UnloadAsync(LoadedModel model, CancellationToken ct);

    /// <summary>Models currently resident in this runtime, for the Home screen readout (UC-07).</summary>
    IReadOnlyList<LoadedModel> LoadedModels { get; }
}
