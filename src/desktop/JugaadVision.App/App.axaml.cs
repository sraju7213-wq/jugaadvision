using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using JugaadVision.App.Services;
using JugaadVision.Storage;
using Microsoft.Extensions.DependencyInjection;
using System.Diagnostics;

namespace JugaadVision.App;

public partial class App : Application
{
    /// <summary>
    /// Composition root. The service graph is built once here and exposed to the view models
    /// (spec §2: "Dependencies injected via Microsoft.Extensions.DependencyInjection in App.xaml.cs").
    /// </summary>
    public IServiceProvider? Services { get; private set; }

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // The service graph is built once here and exposed to the view models
        // (spec section 2: "Dependencies injected via Microsoft.Extensions.DependencyInjection
        // in App.xaml.cs").
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddJugaadVisionServices();
        Services = services.BuildServiceProvider();

        // Migrations must run before the first query. Avalonia's startup path is synchronous,
        // so this blocks briefly on a local SQLite file; it is a few milliseconds on an
        // up-to-date database and is the only reason the window is delayed.
        InitialiseStorage();

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow();
        }

        base.OnFrameworkInitializationCompleted();
    }

    private void InitialiseStorage()
    {
        if (Services is null)
        {
            return;
        }

        try
        {
            using var scope = Services.CreateScope();
            var initializer = scope.ServiceProvider.GetRequiredService<StorageInitializer>();
            initializer.InitializeAsync(CancellationToken.None).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            // StorageInitializer already swallows and logs its own failures; this catches the
            // case where the container itself could not resolve, which must still not stop
            // the app from opening.
            Debug.WriteLine($"Storage initialisation skipped: {ex.Message}");
        }
    }
}
