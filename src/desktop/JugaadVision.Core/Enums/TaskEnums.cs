namespace JugaadVision.Core.Enums;

/// <summary>What a background task is doing. Mirrors the Tasks view in UX_SPEC.md.</summary>
public enum TaskKind
{
    Unknown = 0,
    Download = 1,
    Generation = 2,

    /// <summary>Walking the model directories looking for new files.</summary>
    Scan = 3,
    Install = 4,
    Index = 5,
}

/// <summary>
/// Lifecycle of a <see cref="BackgroundTask"/>. Tasks are never silently dropped:
/// <see cref="Paused"/> and <see cref="Failed"/> are both resumable states.
/// </summary>
public enum TaskState
{
    Queued = 0,
    Running = 1,
    Paused = 2,
    Succeeded = 3,
    Failed = 4,
    Canceled = 5,
}

/// <summary>Outcome of a single generation, recorded in history (UC-05).</summary>
public enum GenerationStatus
{
    Pending = 0,
    Running = 1,
    Succeeded = 2,
    Failed = 3,
    Canceled = 4,
}
