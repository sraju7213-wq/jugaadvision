using JugaadVision.Core.Enums;

namespace JugaadVision.Core.Generation;

/// <summary>Sampling and output-shaping settings for a single generation.</summary>
/// <remarks>
/// A record with init-only properties so a request is immutable once constructed and can be
/// safely retried by the retry policy without risking partial mutation.
/// </remarks>
public sealed record GenerationParameters
{
    public int MaxTokens { get; init; } = 1024;

    public double Temperature { get; init; } = 0.7;

    public double TopP { get; init; } = 0.95;

    public int? TopK { get; init; }

    public IReadOnlyList<string> StopSequences { get; init; } = [];

    /// <summary>Null lets the provider choose and returns a generated seed in the response.</summary>
    public long? Seed { get; init; }

    // Image-workflow parameters. Ignored by text-only models.
    public int? Width { get; init; }

    public int? Height { get; init; }

    public int? Steps { get; init; }

    public double? GuidanceScale { get; init; }

    /// <summary>Ask a text model to emit JSON that parses. Requires a supporting provider.</summary>
    public bool JsonMode { get; init; }

    /// <summary>Request incremental delivery. Providers that cannot stream ignore this.</summary>
    public bool Stream { get; init; }

    public static GenerationParameters Default { get; } = new();
}

/// <summary>One piece of a multimodal input.</summary>
public sealed record ContentPart
{
    public string? Text { get; init; }

    /// <summary>Absolute path to an image on disk, for vision models.</summary>
    public string? ImagePath { get; init; }

    /// <summary>Inline image bytes, base64-encoded, when the image is not on disk.</summary>
    public string? ImageBase64 { get; init; }

    public string? MimeType { get; init; }

    public static ContentPart FromText(string text) => new() { Text = text };

    public static ContentPart FromImage(string path, string mimeType = "image/png") =>
        new() { ImagePath = path, MimeType = mimeType };
}

/// <summary>
/// A generation request, as handed to <c>IAIProvider.GenerateAsync</c> and
/// <c>ILocalRuntime.GenerateAsync</c>. Carries no provider-specific fields, so the router can
/// build one of these from a UI request and hand it to whichever backend wins routing.
/// </summary>
public sealed record GenerationRequest
{
    public required Guid ModelId { get; init; }

    public required string ModelName { get; init; }

    public required string Prompt { get; init; }

    public string? NegativePrompt { get; init; }

    public GenerationParameters Parameters { get; init; } = GenerationParameters.Default;

    /// <summary>Additional multimodal input, for vision models. Ignored by text-only backends.</summary>
    public IReadOnlyList<ContentPart> Input { get; init; } = [];

    /// <summary>Where a file output should be written. Null lets the caller choose a default.</summary>
    public string? OutputDirectory { get; init; }

    public Guid? ProjectId { get; init; }

    /// <summary>Overrides the global timeout for this request only.</summary>
    public int? TimeoutSeconds { get; init; }

    /// <summary>True when the caller wants partial output delivered via the returned stream.</summary>
    public bool Stream => Parameters.Stream;
}

/// <summary>
/// The outcome of a provider generation. Returned rather than thrown for expected failures
/// (rate limits, auth errors, timeouts) so the router can decide on fallback without
/// exception-driven control flow.
/// </summary>
public sealed record AIResponse
{
    public required bool Succeeded { get; init; }

    /// <summary>Inline text output, for text generations.</summary>
    public string? Text { get; init; }

    /// <summary>Absolute path of the written asset, for file-producing generations.</summary>
    public string? OutputPath { get; init; }

    public AssetKind OutputKind { get; init; } = AssetKind.Text;

    public int? PromptTokens { get; init; }

    public int? CompletionTokens { get; init; }

    public decimal? CostUsd { get; init; }

    public TimeSpan? Duration { get; init; }

    /// <summary>The seed actually used, when the provider chose one.</summary>
    public long? Seed { get; init; }

    /// <summary>User-facing failure text. Safe to show in a dialog.</summary>
    public string? ErrorMessage { get; init; }

    /// <summary>Stable machine-readable failure code, e.g. "rate_limited", "invalid_credential".</summary>
    public string? ErrorCode { get; init; }

    /// <summary>
    /// True when retrying the same request could plausibly succeed. Drives the retry/fallback
    /// policy in AI_ARCHITECTURE.md; a 400 is not retryable, a 429 or 503 is.
    /// </summary>
    public bool IsRetryable { get; init; }

    public static AIResponse Success(
        string? text = null,
        string? outputPath = null,
        AssetKind outputKind = AssetKind.Text,
        int? promptTokens = null,
        int? completionTokens = null,
        decimal? costUsd = null,
        TimeSpan? duration = null,
        long? seed = null) => new()
        {
            Succeeded = true,
            Text = text,
            OutputPath = outputPath,
            OutputKind = outputKind,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            CostUsd = costUsd,
            Duration = duration,
            Seed = seed,
        };

    public static AIResponse Failure(
        string errorMessage,
        string? errorCode = null,
        bool isRetryable = false,
        TimeSpan? duration = null) => new()
        {
            Succeeded = false,
            ErrorMessage = errorMessage,
            ErrorCode = errorCode,
            IsRetryable = isRetryable,
            Duration = duration,
        };
}

/// <summary>The outcome of a local runtime generation.</summary>
public sealed record GenerateResult
{
    public required bool Succeeded { get; init; }

    public string? Text { get; init; }

    public string? OutputPath { get; init; }

    public AssetKind OutputKind { get; init; } = AssetKind.Text;

    public int? PromptTokens { get; init; }

    public int? CompletionTokens { get; init; }

    /// <summary>Tokens per second, measured by the runtime. Displayed in the generation inspector.</summary>
    public double? TokensPerSecond { get; init; }

    public TimeSpan? Duration { get; init; }

    public string? ErrorMessage { get; init; }

    public static GenerateResult Success(
        string? text = null,
        string? outputPath = null,
        AssetKind outputKind = AssetKind.Text,
        int? promptTokens = null,
        int? completionTokens = null,
        double? tokensPerSecond = null,
        TimeSpan? duration = null) => new()
        {
            Succeeded = true,
            Text = text,
            OutputPath = outputPath,
            OutputKind = outputKind,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            TokensPerSecond = tokensPerSecond,
            Duration = duration,
        };

    public static GenerateResult Failure(string errorMessage) => new()
    {
        Succeeded = false,
        ErrorMessage = errorMessage,
    };
}
