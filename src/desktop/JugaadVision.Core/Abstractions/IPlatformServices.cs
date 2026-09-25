namespace JugaadVision.Core.Abstractions;

/// <summary>Severity of a desktop notification.</summary>
public enum NotificationLevel
{
    Information = 0,
    Success = 1,
    Warning = 2,
    Error = 3,
}

/// <summary>
/// Secret storage. Backed by the Secret Service (libsecret) on Linux, with an encrypted-file
/// fallback (UC-03, PRODUCT_SPEC.md §5: "Never in plaintext, never in logs").
/// </summary>
public interface ISecretStore
{
    /// <summary>True when a real OS-backed store is available, as opposed to the file fallback.</summary>
    bool IsSecureStoreAvailable { get; }

    Task<string?> GetAsync(string reference, CancellationToken ct);

    Task SetAsync(string reference, string secret, CancellationToken ct);

    Task<bool> DeleteAsync(string reference, CancellationToken ct);
}

/// <summary>Desktop notifications via the StatusNotifier / <c>notify-send</c> path.</summary>
public interface INotificationService
{
    Task NotifyAsync(
        string title,
        string message,
        NotificationLevel level = NotificationLevel.Information,
        CancellationToken ct = default);
}

public interface IHardwareMonitor
{
    /// <summary>Samples CPU, GPU, memory and disk. Must be non-blocking and cheap enough to poll.</summary>
    Task<HardwareSnapshot> CaptureAsync(CancellationToken ct);
}

public interface ISystemTrayService
{
    /// <summary>Shows the tray icon and keeps it for the process lifetime.</summary>
    void Show(string tooltip);

    void UpdateTooltip(string tooltip);

    /// <summary>Set when the user activates the tray icon (normally restores the main window).</summary>
    event EventHandler? Activated;

    void Hide();
}

/// <summary>Native file pickers, so the app uses the desktop's own dialogs rather than a web view.</summary>
public interface IFileDialogService
{
    Task<string?> OpenFileAsync(string title, IReadOnlyList<FileFilter> filters, CancellationToken ct);

    Task<string?> OpenFolderAsync(string title, CancellationToken ct);

    Task<string?> SaveFileAsync(string title, IReadOnlyList<FileFilter> filters, string? suggestedFileName, CancellationToken ct);
}

/// <summary>An extension/name pair shown in a file picker.</summary>
public sealed record FileFilter(string Name, IReadOnlyList<string> Extensions)
{
    public static FileFilter JgvProject { get; } = new("JugaadVision project", [".jgvproj"]);

    public static FileFilter Gguf { get; } = new("GGUF model", [".gguf"]);

    public static FileFilter Image { get; } = new("Image", [".png", ".jpg", ".jpeg", ".webp"]);

    public static FileFilter All { get; } = new("All files", ["*"]);
}
