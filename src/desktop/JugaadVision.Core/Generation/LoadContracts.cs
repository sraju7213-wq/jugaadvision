using JugaadVision.Core.Models;

namespace JugaadVision.Core.Generation;

/// <summary>
/// A handle to a model that a runtime has resident in memory. Opaque to callers — the only
/// meaningful operation is to pass it back to the same runtime that produced it.
/// </summary>
public sealed record LoadedModel
{
    /// <summary>Identity of the backing <see cref="LocalModel"/>.</summary>
    public required Guid ModelId { get; init; }

    /// <summary>Runtime-assigned handle. Never interpret this outside the issuing runtime.</summary>
    public required string Handle { get; init; }

    /// <summary>Name of the runtime holding the model, for diagnostics and unload routing.</summary>
    public required string RuntimeName { get; init; }

    /// <summary>Resident memory attributed to this model, in bytes.</summary>
    public long MemoryBytes { get; init; }

    public DateTimeOffset LoadedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>The outcome of loading a model into a runtime.</summary>
public sealed record LoadResult
{
    public required bool Succeeded { get; init; }

    /// <summary>The resident handle. Null on failure.</summary>
    public LoadedModel? Model { get; init; }

    public string? ErrorMessage { get; init; }

    public TimeSpan? Duration { get; init; }

    /// <summary>Resident memory after the load, in bytes. Drives the VRAM/RAM readout on Home (UC-07).</summary>
    public long? MemoryBytes { get; init; }

    public static LoadResult Success(LoadedModel model, TimeSpan? duration = null, long? memoryBytes = null) => new()
    {
        Succeeded = true,
        Model = model,
        Duration = duration,
        MemoryBytes = memoryBytes ?? model.MemoryBytes,
    };

    public static LoadResult Failure(string errorMessage, TimeSpan? duration = null) => new()
    {
        Succeeded = false,
        ErrorMessage = errorMessage,
        Duration = duration,
    };
}

/// <summary>Incremental progress emitted while a model loads.</summary>
/// <remarks>
/// Loading a multi-gigabyte GGUF takes long enough that UC-02 requires visible progress, and
/// the UI thread must never block waiting for it.
/// </remarks>
public readonly record struct LoadProgress(double Fraction, string Stage, string Message)
{
    public static LoadProgress FromFraction(double fraction, string stage, string message) =>
        new(Math.Clamp(fraction, 0d, 1d), stage, message);
}
