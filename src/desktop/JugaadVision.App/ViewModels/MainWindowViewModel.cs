using CommunityToolkit.Mvvm.ComponentModel;

namespace JugaadVision.App.ViewModels;

/// <summary>One entry in the sidebar navigation (UX_SPEC.md navigation map).</summary>
public sealed partial class NavigationItem : ObservableObject
{
    public required string Label { get; init; }

    public required string Glyph { get; init; }

    public NavigationTarget Target { get; init; }

    [ObservableProperty]
    private bool _isSelected;
}

public enum NavigationTarget
{
    Home,
    Generate,
    Models,
    Library,
    History,
    Tasks,
    Settings,
}

/// <summary>
/// Shell view model: owns the navigation list and the current page title. The 3-panel Generate
/// workspace and Home dashboard get their own view models in later phases.
/// </summary>
public sealed partial class MainWindowViewModel : ObservableObject
{
    public MainWindowViewModel()
    {
        Items =
        [
            new NavigationItem { Label = "Home", Glyph = "⌂", Target = NavigationTarget.Home, IsSelected = true },
            new NavigationItem { Label = "Generate", Glyph = "✦", Target = NavigationTarget.Generate },
            new NavigationItem { Label = "Models", Glyph = "◈", Target = NavigationTarget.Models },
            new NavigationItem { Label = "Library", Glyph = "▤", Target = NavigationTarget.Library },
            new NavigationItem { Label = "History", Glyph = "↺", Target = NavigationTarget.History },
            new NavigationItem { Label = "Tasks", Glyph = "⚙", Target = NavigationTarget.Tasks },
            new NavigationItem { Label = "Settings", Glyph = "⚒", Target = NavigationTarget.Settings },
        ];
    }

    public IReadOnlyList<NavigationItem> Items { get; }

    [ObservableProperty]
    private string _pageTitle = "Home";

    [ObservableProperty]
    private string _statusText = "Ready";
}
