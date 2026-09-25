using JugaadVision.Core.Enums;

namespace JugaadVision.Core.Models;

/// <summary>
/// A single file belonging to a model (spec §4.1). A GGUF release is usually many files —
/// the weights plus shards, tokenizer, and config — and the download manager tracks each one
/// independently so a partial download is resumable (UC-01).
/// </summary>
public sealed class ModelFile
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Owning model. Set by the persistence layer when materialising from EF Core.</summary>
    public Guid ModelId { get; set; }

    /// <summary>File name as it appears in the release, e.g. "model-00001-of-00004.gguf".</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>Absolute path once installed. Null while the file is still remote.</summary>
    public string? LocalPath { get; set; }

    /// <summary>Absolute source URL for downloads; null for files that were already local.</summary>
    public string? SourceUrl { get; set; }

    /// <summary>Size in bytes, as reported by the source (via Content-Length or API metadata).</summary>
    public long TotalBytes { get; set; }

    /// <summary>Bytes written so far. The resume point for a paused download.</summary>
    public long DownloadedBytes { get; set; }

    public ModelFormat Format { get; set; } = ModelFormat.Unknown;

    /// <summary>True for the file the runtime actually loads; the rest are supporting shards/config.</summary>
    public bool IsPrimary { get; set; }

    /// <summary>SHA-256 or SHA-512 digest used to verify the download after transfer.</summary>
    public string? Checksum { get; set; }

    public DateTimeOffset? DownloadedAt { get; set; }

    /// <summary>0.0–1.0. Derived from the two byte counts; never stored independently.</summary>
    public double DownloadProgress => TotalBytes <= 0
        ? 0d
        : Math.Clamp((double)DownloadedBytes / TotalBytes, 0d, 1d);
}
