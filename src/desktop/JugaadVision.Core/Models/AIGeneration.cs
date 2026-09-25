using JugaadVision.Core.Enums;

namespace JugaadVision.Core.Models;

/// <summary>
/// One generation request and its outcome (spec §4.1). This is the history row behind UC-05:
/// it records enough to re-run the generation exactly, and enough to explain what happened.
/// </summary>
public sealed class AIGeneration
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Foreign key to <see cref="AIModel.Id"/>. Set even for cloud models, for grouping history.</summary>
    public Guid ModelId { get; set; }

    /// <summary>Model name captured at generation time, so history stays readable if the model is removed.</summary>
    public string ModelName { get; set; } = string.Empty;

    /// <summary>Name of the provider that served this generation, or a local runtime name.</summary>
    public string ProviderName { get; set; } = string.Empty;

    public GenerationStatus Status { get; set; } = GenerationStatus.Pending;

    public string Prompt { get; set; } = string.Empty;

    /// <summary>Negative prompt, for image workflows.</summary>
    public string? NegativePrompt { get; set; }

    /// <summary>
    /// Seed used for this run. Persisted so a generation can be reproduced exactly (UC-05 "reuse settings").
    /// </summary>
    public long Seed { get; set; }

    /// <summary>Free-form sampling parameters (temperature, top_p, steps, guidance, width, height…).</summary>
    public Dictionary<string, double> Parameters { get; set; } = [];

    /// <summary>Absolute path of the primary output asset. Null for text-only generations.</summary>
    public string? OutputPath { get; set; }

    /// <summary>Inline text output, for text-only generations.</summary>
    public string? OutputText { get; set; }

    public AssetKind OutputKind { get; set; } = AssetKind.Text;

    /// <summary>Wall-clock duration, measured by the caller.</summary>
    public TimeSpan? Duration { get; set; }

    /// <summary>Tokens in / tokens out, when the provider reports usage. Null for local runtimes that do not.</summary>
    public int? PromptTokens { get; set; }

    public int? CompletionTokens { get; set; }

    /// <summary>Actual cost in USD. Null for local generation.</summary>
    public decimal? CostUsd { get; set; }

    /// <summary>Failure detail when <see cref="Status"/> is <see cref="GenerationStatus.Failed"/>.</summary>
    public string? ErrorMessage { get; set; }

    /// <summary>Owning project, when the generation was started from one.</summary>
    public Guid? ProjectId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? CompletedAt { get; set; }
}
