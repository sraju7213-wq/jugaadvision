using JugaadVision.Core.Enums;

namespace JugaadVision.Core.Models;

/// <summary>
/// The runtime-facing view of a model that is installed on this machine.
/// </summary>
/// <remarks>
/// Deliberately distinct from <see cref="AIModel"/>. <see cref="AIModel"/> is the catalogue
/// record and carries pricing, licence, and provider metadata; a runtime only needs a path,
/// a format, and the physical limits it will allocate against. Keeping them separate stops
/// runtime code from depending on provider-shaped fields it must not interpret.
/// </remarks>
public sealed class LocalModel
{
    /// <summary>The <see cref="AIModel.Id"/> this installation was created from.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Absolute path to the primary weights file.</summary>
    public string PrimaryFilePath { get; set; } = string.Empty;

    /// <summary>Directory containing the model, used to resolve sibling files at load time.</summary>
    public string ModelDirectory { get; set; } = string.Empty;

    public ModelFormat Format { get; set; } = ModelFormat.Unknown;

    public ModelKind Kind { get; set; } = ModelKind.TextGeneration;

    /// <summary>Maximum context window this installation was configured for, in tokens.</summary>
    public int ContextWindow { get; set; } = 4096;

    /// <summary>Parameter count in billions, when known. Used to pre-flight a load against free RAM.</summary>
    public double? ParameterCountBillions { get; set; }

    public string? Quantization { get; set; }

    /// <summary>
    /// Approximate resident memory required to load, in bytes. Pre-flighted against available RAM
    /// so a load fails with a clear message instead of the OOM killer ending the process.
    /// </summary>
    public long? EstimatedMemoryBytes { get; set; }
}
