using JugaadVision.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace JugaadVision.App.Services;

/// <summary>
/// Central DI registration for the desktop app (spec §2).
/// </summary>
/// <remarks>
/// The single place that knows the whole service graph. Registrations land here as each layer
/// is built, so no view model has to be rewritten when the graph grows.
/// </remarks>
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddJugaadVisionServices(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        // Storage: AppDbContext (scoped) + the repository implementations.
        services.AddJugaadVisionStorage();

        _ = services.AddSingleton<AppState>();
        return services;
    }
}

/// <summary>
/// Process-wide state that is not settings and not persisted: which models are resident,
/// whether the app is offline, and the current navigation target.
/// </summary>
public sealed class AppState
{
    /// <summary>Set when connectivity is lost (UC-06). The UI surfaces this rather than failing silently.</summary>
    public bool IsOffline { get; set; }

    /// <summary>Human-readable offline reason, shown in the status bar.</summary>
    public string? OfflineReason { get; set; }
}
