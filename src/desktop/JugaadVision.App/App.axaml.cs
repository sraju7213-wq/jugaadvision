using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using JugaadVision.App.Services;
using Microsoft.Extensions.DependencyInjection;

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
        // RegisterServices is a stub for now: the repositories, providers and runtimes land in
        // later phases. Keeping the hook here means no view model has to be rewritten when
        // the graph becomes real.
        var services = new ServiceCollection();
        services.AddJugaadVisionServices();
        Services = services.BuildServiceProvider();

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow();
        }

        base.OnFrameworkInitializationCompleted();
    }
}
