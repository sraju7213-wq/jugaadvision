namespace JugaadVision.Core.Abstractions;

/// <summary>
/// Read-only view of the machine's resources, backing the Home screen (UC-07).
/// Populated by <c>JugaadVision.Platform</c> from /proc, lspci, nvidia-smi and sysfs.
/// </summary>
public sealed record HardwareSnapshot
{
    public CpuInfo? Cpu { get; init; }

    public IReadOnlyList<GpuInfo> Gpus { get; init; } = [];

    public MemoryInfo? Memory { get; init; }

    public IReadOnlyList<DiskInfo> Disks { get; init; } = [];

    /// <summary>When the snapshot was taken, so the UI can show staleness.</summary>
    public DateTimeOffset CapturedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>True when no GPU was detected — the UI shows a CPU-only notice rather than a blank panel.</summary>
    public bool HasGpu => Gpus.Count > 0;
}

public sealed record CpuInfo
{
    public string ModelName { get; set; } = string.Empty;

    public int PhysicalCoreCount { get; set; }

    public int LogicalCoreCount { get; set; }

    /// <summary>Current load, 0.0–1.0 across all logical cores.</summary>
    public double LoadAverage { get; set; }

    public string? Architecture { get; set; }
}

public sealed record GpuInfo
{
    public string Name { get; set; } = string.Empty;

    public string? Vendor { get; set; }

    public long TotalMemoryBytes { get; set; }

    public long FreeMemoryBytes { get; set; }

    /// <summary>Vendor driver interface, e.g. "cuda", "vulkan", "opencl". Null when none is usable.</summary>
    public string? ComputeApi { get; set; }

    /// <summary>False when the GPU exists but no driver exposes it for compute (UC-02 falls back to CPU).</summary>
    public bool IsUsableForInference { get; set; }
}

public sealed record MemoryInfo
{
    public long TotalBytes { get; set; }

    public long AvailableBytes { get; set; }

    public long UsedBytes => Math.Max(0, TotalBytes - AvailableBytes);
}

public sealed record DiskInfo
{
    public string MountPoint { get; set; } = string.Empty;

    public string FileSystem { get; set; } = string.Empty;

    public long TotalBytes { get; set; }

    public long FreeBytes { get; set; }

    public long UsedBytes => Math.Max(0, TotalBytes - FreeBytes);
}
