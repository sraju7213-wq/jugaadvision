using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace JugaadVision.Storage;

/// <summary>
/// Registers the storage layer with the DI container.
/// </summary>
public static class StorageServiceCollectionExtensions
{
    /// <summary>
    /// Adds the <see cref="AppDbContext"/> and every repository implementation.
    /// </summary>
    /// <param name="services">The container being built.</param>
    /// <param name="databasePath">
    /// Overrides the database location. Null resolves the XDG data directory at resolve time.
    /// </param>
    public static IServiceCollection AddJugaadVisionStorage(
        this IServiceCollection services,
        string? databasePath = null)
    {
        ArgumentNullException.ThrowIfNull(services);

        // Scoped, never singleton. A long-lived tracking context would pin every entity it ever
        // loaded and go stale against the background task writer. See DATABASE_SCHEMA.md §8.
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlite(SqliteConfiguration.BuildConnectionString(
                databasePath ?? SqliteConfiguration.ResolveDatabasePath())));

        services.AddScoped<Core.Abstractions.IModelRepository, Repositories.ModelRepository>();
        services.AddScoped<Core.Abstractions.IGenerationRepository, Repositories.GenerationRepository>();
        services.AddScoped<Core.Abstractions.IProjectRepository, Repositories.ProjectRepository>();
        services.AddScoped<Core.Abstractions.ILibraryRepository, Repositories.LibraryRepository>();
        services.AddScoped<Core.Abstractions.ITaskRepository, Repositories.TaskRepository>();
        services.AddScoped<Core.Abstractions.IProviderConfigRepository, Repositories.ProviderConfigRepository>();
        services.AddSingleton<Core.Abstractions.ISettingsStore, Repositories.JsonFileSettingsStore>();
        services.AddScoped<StorageInitializer>();

        return services;
    }
}
