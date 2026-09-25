namespace JugaadVision.Core.Models;

/// <summary>
/// All persisted settings (spec §4.1, §33), grouped into sections that mirror the
/// Settings screen in UX_SPEC.md. Serialised as a single JSON document in the settings table
/// so adding a section does not require a schema migration.
/// </summary>
public sealed class AppSettings
{
    /// <summary>Bumped when a settings change requires the UI or a runtime to restart.</summary>
    public int SchemaVersion { get; set; } = 1;

    public GeneralSettings General { get; set; } = new();

    public ModelSettings Models { get; set; } = new();

    public GenerationSettings Generation { get; set; } = new();

    public HardwareSettings Hardware { get; set; } = new();

    public NotificationSettings Notifications { get; set; } = new();

    public PrivacySettings Privacy { get; set; } = new();

    public AdvancedSettings Advanced { get; set; } = new();
}

public sealed class GeneralSettings
{
    /// <summary>"dark" is the only supported theme in the MVP; the field exists so light can be added later.</summary>
    public string Theme { get; set; } = "dark";

    /// <summary>Accent colour as a hex string. The product default is the green accent.</summary>
    public string AccentColor { get; set; } = "#3DDC84";

    /// <summary>Set on first run to skip the welcome flow on subsequent launches.</summary>
    public bool HasCompletedOnboarding { get; set; }

    /// <summary>Whether to restore the window geometry from the previous session.</summary>
    public bool RestoreWindowState { get; set; } = true;
}

public sealed class ModelSettings
{
    /// <summary>Directories scanned for installed models (UC-07 / MODEL_SYSTEM.md).</summary>
    public List<string> ModelDirectories { get; set; } = [];

    /// <summary>Whether new downloads are checksum-verified after transfer.</summary>
    public bool VerifyChecksums { get; set; } = true;

    /// <summary>Whether scanning runs automatically at startup.</summary>
    public bool ScanOnStartup { get; set; } = true;

    /// <summary>Maximum bytes retained by the download staging area before old partials are pruned.</summary>
    public long MaxStagingBytes { get; set; } = 10L * 1024 * 1024 * 1024;
}

public sealed class GenerationSettings
{
    public int DefaultMaxTokens { get; set; } = 1024;

    public double DefaultTemperature { get; set; } = 0.7;

    public double DefaultTopP { get; set; } = 0.95;

    /// <summary>Per-request timeout in seconds, applied by the retry policy.</summary>
    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>Retry attempts for transient failures (429, 5xx, transient network).</summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>Whether a failed request may fall through to the next provider in the router's list.</summary>
    public bool AllowProviderFallback { get; set; } = true;

    /// <summary>Directory generated assets are written to. Defaults to the XDG user data dir when null.</summary>
    public string? OutputDirectory { get; set; }
}

public sealed class HardwareSettings
{
    /// <summary>Restrict runtime selection to the CPU even when a usable GPU is present.</summary>
    public bool ForceCpuOnly { get; set; }

    /// <summary>Thread count for local inference. Null means "let the runtime decide".</summary>
    public int? ThreadCount { get; set; }

    /// <summary>VRAM budget in bytes for GPU offload. Null means unlimited.</summary>
    public long? VramBudgetBytes { get; set; }

    /// <summary>Refuse to load a model whose estimate exceeds available RAM.</summary>
    public bool PreflightMemory { get; set; } = true;
}

public sealed class NotificationSettings
{
    public bool NotifyOnGenerationComplete { get; set; } = true;

    public bool NotifyOnDownloadComplete { get; set; } = true;

    public bool NotifyOnError { get; set; } = true;

    /// <summary>Whether the tray icon is shown at all.</summary>
    public bool ShowTrayIcon { get; set; } = true;

    /// <summary>Whether closing the main window hides to tray instead of exiting.</summary>
    public bool MinimizeToTray { get; set; }
}

public sealed class PrivacySettings
{
    /// <summary>Master switch for any telemetry. Off by default, and there is no telemetry in the MVP.</summary>
    public bool AllowTelemetry { get; set; }

    /// <summary>Whether prompts may be sent to cloud providers at all.</summary>
    public bool AllowCloudGeneration { get; set; } = true;

    /// <summary>Strip identifying metadata from generated assets before they are written to disk.</summary>
    public bool StripAssetMetadata { get; set; } = true;

    /// <summary>Hours of generation history to retain. Zero means keep everything.</summary>
    public int HistoryRetentionDays { get; set; }
}

public sealed class AdvancedSettings
{
    /// <summary>Emit verbose provider request/response traces. Never includes credential headers.</summary>
    public bool VerboseProviderLogging { get; set; }

    /// <summary>Allow models from untrusted repositories to be installed. Off by default.</summary>
    public bool AllowUntrustedModels { get; set; }

    /// <summary>Custom base URL override applied to every provider unless it defines its own.</summary>
    public string? GlobalBaseUrlOverride { get; set; }

    /// <summary>Extra headers sent to every provider request.</summary>
    public Dictionary<string, string> CustomHeaders { get; set; } = [];
}
