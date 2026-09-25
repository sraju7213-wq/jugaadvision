using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.LogicalTree;
using Avalonia.Media;
using Xunit;
using JgApp = JugaadVision.App;
using JgVm = JugaadVision.App.ViewModels;

namespace JugaadVision.Tests.App;

/// <summary>
/// Proves the Avalonia UI is instantiable and interactive under the headless test platform.
/// </summary>
/// <remarks>
/// This is the payoff of targeting Linux: the XAML shell is covered by real tests on the
/// build machine, with no Windows host or display server required.
/// <para>
/// Control lookup uses the <em>logical</em> tree. Under headless drawing the visual tree is
/// only partially realised, so <c>GetVisualDescendants()</c> does not reach the sidebar
/// ListBox even though it is present and bound.
/// </para>
/// </remarks>
public sealed class ShellTests
{
    [AvaloniaFact]
    public void MainWindow_Constructs_WithExpectedTitle()
    {
        var window = new JgApp.MainWindow();

        Assert.Equal("JugaadVision", window.Title);
    }

    [AvaloniaFact]
    public void MainWindow_RespectsTheSpecifiedMinimumWindowSize()
    {
        var window = new JgApp.MainWindow();

        // PRODUCT_SPEC.md §5: window sizes 1280x720 through 4K.
        Assert.Equal(1280d, window.MinWidth);
        Assert.Equal(720d, window.MinHeight);
    }

    [AvaloniaFact]
    public void MainWindow_RendersSidebarNavigationWithoutThrowing()
    {
        var window = new JgApp.MainWindow();
        window.Show();

        var listBox = window.GetLogicalDescendants()
            .OfType<ListBox>()
            .FirstOrDefault();

        Assert.NotNull(listBox);
        Assert.Equal(7, listBox.ItemCount);
    }

    [AvaloniaFact]
    public void MainWindow_BindsPageTitleToTheViewModel()
    {
        var window = new JgApp.MainWindow();
        window.Show();

        var vm = Assert.IsType<JgVm.MainWindowViewModel>(window.DataContext);
        Assert.Equal("Home", vm.PageTitle);
    }

    [AvaloniaFact]
    public void MainWindow_OpensWithHomeSelected()
    {
        var vm = new JgVm.MainWindowViewModel();

        var home = Assert.Single(vm.Items, i => i.Target == JgVm.NavigationTarget.Home);
        Assert.True(home.IsSelected);

        // Every navigation target is represented exactly once.
        Assert.Equal(7, vm.Items.Select(i => i.Target).Distinct().Count());
    }
}

/// <summary>
/// Verifies the shipped dark theme, querying a compiled dictionary that includes the
/// production theme file directly.
/// </summary>
/// <remarks>
/// These deliberately do not go through <see cref="Application.Current"/>. Avalonia 12.1.3's
/// headless xunit harness creates a bare Application, and the shell's <c>StaticResource</c>
/// lookups silently fall back to default brushes there instead of failing loudly — so a
/// window-background assertion would be testing the fallback, not the theme.
/// </remarks>
public sealed class DarkThemeTests
{
    private static readonly TestThemeDictionary Theme = new();

    /// <summary>
    /// <see cref="Avalonia.Controls.ResourceDictionary"/> exposes only the three-argument
    /// IResourceHost.TryGetResource, so the theme-variant argument is threaded through here.
    /// A null variant means "the default variant", which is what the app uses.
    /// </summary>
    private static bool TryGet(string key, out object? value) =>
        Theme.TryGetResource(key, theme: null, out value);

    [AvaloniaFact]
    public void Background_IsCharcoal()
    {
        Assert.True(TryGet("JgBackgroundBrush", out var value));
        Assert.Equal(Color.Parse("#141414"), Assert.IsAssignableFrom<ISolidColorBrush>(value).Color);
    }

    [AvaloniaFact]
    public void Accent_IsTheProductGreen()
    {
        Assert.True(TryGet("JgAccentBrush", out var value));
        Assert.Equal(Color.Parse("#3DDC84"), Assert.IsAssignableFrom<ISolidColorBrush>(value).Color);
    }

    [AvaloniaFact]
    public void Surfaces_AreDeepNeutral()
    {
        Assert.True(TryGet("JgSurfaceBrush", out var surface));
        Assert.True(TryGet("JgSurfaceRaisedBrush", out var raised));

        Assert.Equal(Color.Parse("#1E1E1E"), Assert.IsAssignableFrom<ISolidColorBrush>(surface).Color);
        Assert.Equal(Color.Parse("#262626"), Assert.IsAssignableFrom<ISolidColorBrush>(raised).Color);
    }

    [AvaloniaFact]
    public void EverySemanticStatusColour_IsDefined()
    {
        foreach (var key in new[] { "JgSuccessBrush", "JgWarningBrush", "JgErrorBrush" })
        {
            Assert.True(TryGet(key, out _), $"missing theme resource: {key}");
        }
    }

    [AvaloniaFact]
    public void EveryBrush_IsFullyOpaque()
    {
        // A mis-authored brush in the theme would otherwise surface as an invisible control.
        foreach (var key in Theme.Keys.OfType<string>().Where(k => k.EndsWith("Brush", StringComparison.Ordinal)))
        {
            Assert.True(TryGet(key, out var value), $"unresolved: {key}");

            var brush = Assert.IsAssignableFrom<ISolidColorBrush>(value);
            Assert.Equal(1d, brush.Opacity, precision: 3);
        }
    }
}
