using JugaadVision.Core.Enums;

namespace JugaadVision.Core.Models;

/// <summary>
/// A long-running operation surfaced in the Tasks view (spec §4.1, UC-07).
/// </summary>
/// <remarks>
/// Downloads and generations both run here. The row is the app's durable record of work in
/// flight, so it is written on transition rather than only at the end — an app crash mid-download
/// still leaves a resumable task behind.
/// </remarks>
public sealed class BackgroundTask
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public TaskKind Kind { get; set; } = TaskKind.Unknown;

    public TaskState State { get; set; } = TaskState.Queued;

    /// <summary>User-facing title, e.g. "Downloading Llama 3.1 8B (2 of 4 files)".</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Model this task operates on, for downloads and installs.</summary>
    public Guid? ModelId { get; set; }

    /// <summary>Project this task belongs to, when applicable.</summary>
    public Guid? ProjectId { get; set; }

    /// <summary>0.0–1.0. Null when the operation has no meaningful measure of completion.</summary>
    public double? Progress { get; set; }

    /// <summary>Bytes transferred so far, for downloads.</summary>
    public long? BytesTransferred { get; set; }

    public long? TotalBytes { get; set; }

    /// <summary>Free-form status line shown under the title, e.g. "4.2 MB/s".</summary>
    public string? StatusMessage { get; set; }

    /// <summary>Failure detail when <see cref="State"/> is <see cref="TaskState.Failed"/>.</summary>
    public string? ErrorMessage { get; set; }

    /// <summary>Number of failed attempts so far, used to decide whether to keep retrying.</summary>
    public int AttemptCount { get; set; }

    /// <summary>
    /// Set when a retryable failure happened, so the pause/resume affordance can pick the task back up.
    /// </summary>
    public DateTimeOffset? ResumableSince { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>True while the task should still be considered live by the Tasks view.</summary>
    public bool IsTerminal => State is TaskState.Succeeded or TaskState.Canceled;

    /// <summary>True when the user can legitimately press Resume rather than Restart.</summary>
    public bool IsResumable => State is TaskState.Paused or TaskState.Failed && AttemptCount < 5;
}
