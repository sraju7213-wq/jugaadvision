using JugaadVision.Core.Enums;

namespace JugaadVision.Core.Models;

/// <summary>
/// The unified model record (spec §4.1). One type covers both locally-installed models and
/// catalogue entries for cloud/HuggingFace models, which is what lets the router treat them uniformly.
/// </summary>
/// <remarks>
/// Persistence is configured in <c>JugaadVision.Storage</c> with the EF Core fluent API rather than
/// attributes, so this stays a pure domain type with no outward dependency.
/// </remarks>
public sealed class AIModel
{
    /// <summary>Stable local identity. For remote models this is the provider-scoped id.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Display name, e.g. "Llama 3.1 8B Instruct".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Publisher or organisation, when known.</summary>
    public string? Publisher { get; set; }

    /// <summary>One-line description shown in the model browser.</summary>
    public string? Description { get; set; }

    /// <summary>Provider- or catalogue-native identifier, e.g. "meta-llama/Llama-3.1-8B-Instruct".</summary>
    public string? ExternalId { get; set; }

    public ModelKind Kind { get; set; } = ModelKind.Unknown;

    public ModelFormat Format { get; set; } = ModelFormat.Unknown;

    public ModelSource Source { get; set; } = ModelSource.Unknown;

    public ModelTier Tier { get; set; } = ModelTier.Unknown;

    public ModelState State { get; set; } = ModelState.Discovered;

    /// <summary>Files that make up this model. Empty for catalogue-only entries.</summary>
    public List<ModelFile> Files { get; set; } = [];

    /// <summary>Capability flags, e.g. "vision", "tools", "json-mode".</summary>
    public List<string> Capabilities { get; set; } = [];

    /// <summary>Context window in tokens, when the source declares one.</summary>
    public int? ContextWindow { get; set; }

    /// <summary>Parameter count in billions, when known. Used to warn before an oversized load.</summary>
    public double? ParameterCountBillions { get; set; }

    /// <summary>Quantisation label, e.g. "Q4_K_M".</summary>
    public string? Quantization { get; set; }

    /// <summary>Licence identifier, e.g. "apache-2.0". Shown before download (UC-01).</summary>
    public string? License { get; set; }

    /// <summary>Download count from the source catalogue. Display only.</summary>
    public long? DownloadCount { get; set; }

    /// <summary>Price per 1M input tokens, in USD. Null for local/self-hosted models.</summary>
    public decimal? PriceInputPerMillion { get; set; }

    /// <summary>Price per 1M output tokens, in USD. Null for local/self-hosted models.</summary>
    public decimal? PriceOutputPerMillion { get; set; }

    /// <summary>Free-form provider metadata; shape is provider-specific and never interpreted by Core.</summary>
    public Dictionary<string, string> Metadata { get; set; } = [];

    public DateTimeOffset DiscoveredAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? InstalledAt { get; set; }

    public DateTimeOffset? LastUsedAt { get; set; }

    /// <summary>True when this model can be executed by a local runtime on this machine.</summary>
    public bool IsLocallyExecutable => Source == ModelSource.Local && State == ModelState.Installed;

    /// <summary>True when executing this model consumes a paid API key.</summary>
    public bool RequiresCredential => Source is ModelSource.OpenAICompatible or ModelSource.Custom or ModelSource.HuggingFace
                                      && Tier is ModelTier.Paid or ModelTier.Enterprise;
}
