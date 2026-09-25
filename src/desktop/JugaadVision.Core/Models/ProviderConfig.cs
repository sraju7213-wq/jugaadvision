using JugaadVision.Core.Enums;

namespace JugaadVision.Core.Models;

/// <summary>
/// Configuration for one cloud provider (spec §4.1). Holds no secret material — only the
/// <em>reference</em> to the credential, which lives in the OS keyring (UC-03).
/// </summary>
/// <remarks>
/// PRODUCT_SPEC.md §5 NFR: "API key security | Never in plaintext, never in logs".
/// This entity is therefore safe to log, export, and back up.
/// </remarks>
public sealed class ProviderConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Stable provider key, e.g. "openrouter", "huggingface", "custom". Matches the DI registration name.</summary>
    public string ProviderKey { get; set; } = string.Empty;

    /// <summary>User-facing name shown in Settings → AI Providers.</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>Base URL of the API. Mutable for self-hosted and custom endpoints.</summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// Opaque handle for the secret — the keyring item name, not the secret. Resolved through
    /// <c>ISecretStore</c>. Never contains key material.
    /// </summary>
    public string? CredentialReference { get; set; }

    public CredentialSource CredentialSource { get; set; } = CredentialSource.None;

    public ProviderStatus Status { get; set; } = ProviderStatus.NotConfigured;

    public bool IsEnabled { get; set; } = true;

    /// <summary>Per-request timeout in seconds. Capped by the retry policy in AI_ARCHITECTURE.md.</summary>
    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>Maximum retry attempts for a transient failure. Set to 0 to disable retries.</summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>Preferred model ids for this provider, most-preferred first. Consumed by the router.</summary>
    public List<string> PreferredModelIds { get; set; } = [];

    /// <summary>Last time <c>TestConnectionAsync</c> returned true.</summary>
    public DateTimeOffset? LastVerifiedAt { get; set; }

    /// <summary>Last error seen during a connectivity test. Safe to display to the user.</summary>
    public string? LastErrorMessage { get; set; }

    /// <summary>True when a credential is resolvable and the provider is enabled.</summary>
    public bool IsUsable => IsEnabled && Status != ProviderStatus.NotConfigured && CredentialSource != CredentialSource.None;
}
