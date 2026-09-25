namespace JugaadVision.Tests.App;

/// <summary>
/// Code-behind for <c>TestThemeDictionary.axaml</c>.
/// </summary>
/// <remarks>
/// Deliberately empty: the dictionary exists only so the compiled XAML loader produces a real
/// <see cref="Avalonia.Controls.ResourceDictionary"/> containing the production theme, which
/// the theme tests can then query without going through <c>Application.Current</c>.
/// </remarks>
public partial class TestThemeDictionary : Avalonia.Controls.ResourceDictionary
{
}
