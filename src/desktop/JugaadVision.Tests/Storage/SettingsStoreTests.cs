using JugaadVision.Core.Abstractions;
using JugaadVision.Core.Models;
using JugaadVision.Storage;
using JugaadVision.Storage.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace JugaadVision.Tests.Storage;

/// <summary>
/// Covers the file-backed settings store.
/// </summary>
public sealed class SettingsStoreTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), $"jgv-settings-{Guid.NewGuid():N}");

    private string Path_ => Path.Combine(_dir, "settings.json");

    private JsonFileSettingsStore Store() => new(Path_);

    public void Dispose()
    {
        if (Directory.Exists(_dir))
        {
            Directory.Delete(_dir, recursive: true);
        }

        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task MissingFile_LoadsProductDefaults()
    {
        var settings = await Store().LoadAsync(TestContext.Current.CancellationToken);

        Assert.Equal("dark", settings.General.Theme);
        Assert.Equal("#3DDC84", settings.General.AccentColor);
        Assert.False(settings.Privacy.AllowTelemetry);
    }

    [Fact]
    public async Task Settings_SurviveARoundTrip()
    {
        var ct = TestContext.Current.CancellationToken;
        var store = Store();

        var original = new AppSettings();
        original.General.Theme = "dark";
        original.General.AccentColor = "#FF0055";
        original.Generation.DefaultTemperature = 0.2;
        original.Generation.DefaultMaxTokens = 4096;
        original.Hardware.ForceCpuOnly = true;
        original.Advanced.CustomHeaders["X-Trace"] = "on";

        await store.SaveAsync(original, ct);

        var loaded = await store.LoadAsync(ct);

        Assert.Equal("#FF0055", loaded.General.AccentColor);
        Assert.Equal(0.2, loaded.Generation.DefaultTemperature);
        Assert.Equal(4096, loaded.Generation.DefaultMaxTokens);
        Assert.True(loaded.Hardware.ForceCpuOnly);
        Assert.Equal("on", loaded.Advanced.CustomHeaders["X-Trace"]);
    }

    [Fact]
    public async Task Booleans_RoundTripAsJsonBooleans_NotStringsOrIntegers()
    {
        var ct = TestContext.Current.CancellationToken;
        var store = Store();

        // Every AppSettings default is true for these three, so flipping them proves the value
        // actually round-trips rather than being silently re-defaulted on load.
        var original = new AppSettings();
        original.Models.ScanOnStartup = false;
        original.Notifications.MinimizeToTray = false;
        original.Privacy.StripAssetMetadata = false;

        await store.SaveAsync(original, ct);

        var raw = await File.ReadAllTextAsync(Path_, ct);

        // camelCase per the store's JsonNamingPolicy, and a real JSON boolean.
        Assert.Contains("\"scanOnStartup\": false", raw, StringComparison.Ordinal);
        Assert.Contains("\"minimizeToTray\": false", raw, StringComparison.Ordinal);

        var loaded = await store.LoadAsync(ct);
        Assert.False(loaded.Models.ScanOnStartup);
        Assert.False(loaded.Notifications.MinimizeToTray);
        Assert.False(loaded.Privacy.StripAssetMetadata);
    }

    [Fact]
    public async Task SchemaVersion_IsPersisted_ForInPlaceUpgrades()
    {
        var ct = TestContext.Current.CancellationToken;
        var store = Store();

        var original = new AppSettings { SchemaVersion = 7 };
        await store.SaveAsync(original, ct);

        var raw = await File.ReadAllTextAsync(Path_, ct);
        Assert.Contains("\"schemaVersion\": 7", raw, StringComparison.Ordinal);

        Assert.Equal(7, (await store.LoadAsync(ct)).SchemaVersion);
    }

    [Fact]
    public async Task CorruptFile_FallsBackToDefaultsInsteadOfThrowing()
    {
        var ct = TestContext.Current.CancellationToken;

        Directory.CreateDirectory(_dir);
        await File.WriteAllTextAsync(Path_, "{ this is not json", ct);

        // A broken settings file must never stop the app from starting.
        var settings = await Store().LoadAsync(ct);

        Assert.Equal("dark", settings.General.Theme);
    }

    [Fact]
    public async Task EmptyFile_FallsBackToDefaults()
    {
        var ct = TestContext.Current.CancellationToken;

        Directory.CreateDirectory(_dir);
        await File.WriteAllTextAsync(Path_, string.Empty, ct);

        var settings = await Store().LoadAsync(ct);

        Assert.Equal("dark", settings.General.Theme);
    }

    [Fact]
    public async Task Save_LeavesNoTempFileBehind()
    {
        var ct = TestContext.Current.CancellationToken;
        var store = Store();

        await store.SaveAsync(new AppSettings(), ct);

        Assert.True(File.Exists(Path_));
        Assert.False(File.Exists(Path_ + ".tmp"));
    }

    [Fact]
    public async Task Save_CreatesMissingDirectories()
    {
        var ct = TestContext.Current.CancellationToken;

        Assert.False(Directory.Exists(_dir));

        await Store().SaveAsync(new AppSettings(), ct);

        Assert.True(File.Exists(Path_));
    }

    [Fact]
    public void DefaultPath_RespectsXdgConfigHome()
    {
        var original = Environment.GetEnvironmentVariable("XDG_CONFIG_HOME");
        try
        {
            var temp = Path.Combine(Path.GetTempPath(), $"jgv-xdgcfg-{Guid.NewGuid():N}");
            Environment.SetEnvironmentVariable("XDG_CONFIG_HOME", temp);

            var path = JsonFileSettingsStore.ResolveDefaultPath();

            Assert.StartsWith(temp, path, StringComparison.Ordinal);
            Assert.EndsWith("settings.json", path, StringComparison.Ordinal);
        }
        finally
        {
            Environment.SetEnvironmentVariable("XDG_CONFIG_HOME", original);
        }
    }
}

/// <summary>
/// Covers the DI wiring. A missing registration is a runtime crash in the app, so it is
/// asserted at startup instead.
/// </summary>
public sealed class ServiceRegistrationTests
{
    private static ServiceProvider BuildProvider() =>
        new ServiceCollection()
            .AddJugaadVisionStorage($"/tmp/jgv-di-test-{Guid.NewGuid():N}.db")
            .BuildServiceProvider();

    [Fact]
    public void EveryRepositoryResolves()
    {
        // A missing registration is a runtime crash in the app, so it is asserted here.
        using var provider = BuildProvider();
        using var scope = provider.CreateScope();
        var sp = scope.ServiceProvider;

        Assert.IsType<ModelRepository>(sp.GetRequiredService<IModelRepository>());
        Assert.IsType<GenerationRepository>(sp.GetRequiredService<IGenerationRepository>());
        Assert.IsType<ProjectRepository>(sp.GetRequiredService<IProjectRepository>());
        Assert.IsType<LibraryRepository>(sp.GetRequiredService<ILibraryRepository>());
        Assert.IsType<TaskRepository>(sp.GetRequiredService<ITaskRepository>());
        Assert.IsType<ProviderConfigRepository>(sp.GetRequiredService<IProviderConfigRepository>());
        Assert.IsType<JsonFileSettingsStore>(sp.GetRequiredService<ISettingsStore>());
    }

    [Fact]
    public void DbContext_IsScopedNotSingleton()
    {
        // A long-lived tracking context would pin every entity it loaded and go stale against
        // the background task writer. See DATABASE_SCHEMA.md section 8.
        var services = new ServiceCollection();
        services.AddJugaadVisionStorage($"/tmp/jgv-di-test-{Guid.NewGuid():N}.db");

        var registrations = services
            .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                        || d.ServiceType == typeof(AppDbContext))
            .ToList();

        Assert.NotEmpty(registrations);
        Assert.All(registrations, r =>
            Assert.Equal(ServiceLifetime.Scoped, r.Lifetime));
    }
}
