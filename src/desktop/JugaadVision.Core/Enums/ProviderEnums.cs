namespace JugaadVision.Core.Enums;

/// <summary>Health of a configured cloud provider, as shown in Settings → AI Providers (UC-03).</summary>
public enum ProviderStatus
{
    /// <summary>No credential stored yet.</summary>
    NotConfigured = 0,

    /// <summary>A credential exists but has not been verified this session.</summary>
    Configured = 1,

    /// <summary>A connectivity test is in flight.</summary>
    Testing = 2,

    /// <summary>Last connectivity test succeeded.</summary>
    Healthy = 3,

    /// <summary>Last connectivity test failed — DNS, TLS, timeout, or refused.</summary>
    Unreachable = 4,

    /// <summary>Provider answered 429; back off before retrying.</summary>
    RateLimited = 5,

    /// <summary>Credential present but rejected (401/403).</summary>
    InvalidCredential = 6,
}

/// <summary>Where a provider's secret actually lives. Never the database, never a log line.</summary>
/// <remarks>PRODUCT_SPEC.md §5 NFR: "API key security | Never in plaintext, never in logs".</remarks>
public enum CredentialSource
{
    /// <summary>Credential is not stored anywhere.</summary>
    None = 0,

    /// <summary>Secret Service / libsecret keyring (the preferred Linux store).</summary>
    Keyring = 1,

    /// <summary>AES-256-GCM encrypted file, used only when no keyring is available.</summary>
    EncryptedFile = 2,

    /// <summary>Supplied per-call by the caller and never persisted.</summary>
    Ephemeral = 3,
}
