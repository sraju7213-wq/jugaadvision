using Microsoft.Extensions.DependencyInjection;

namespace JugaadVision.App.Services;

/// <summary>
/// Central DI registration for the desktop app (spec §2).
/// </summary>
/// <remarks>
/// Intentionally near-empty in this phase: the Storage, AI, Models and Platform layers have no
/// concrete services yet. Registrations are added here as each layer lands, so the composition
/// root is the single place that knows the whole graph.
/// </remarks>
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddJugaadVisionServices(this IServiceCollection services)
    {
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
