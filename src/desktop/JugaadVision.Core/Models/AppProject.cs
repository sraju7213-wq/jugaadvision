namespace JugaadVision.Core.Models;

/// <summary>
/// A persistent project (spec §4.1, UC-04). Serialised to a <c>.jgvproj</c> file on the
/// Linux filesystem, and associated with the app via <c>xdg-mime</c>.
/// </summary>
public sealed class AppProject
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    /// <summary>Path of the backing <c>.jgvproj</c> file. Null for a project that has never been saved.</summary>
    public string? FilePath { get; set; }

    /// <summary>Model the project last used, so reopening restores the working setup.</summary>
    public Guid? ModelId { get; set; }

    public string? ModelName { get; set; }

    /// <summary>Provider the project last used.</summary>
    public string? ProviderKey { get; set; }

    /// <summary>The prompt the project was last working on.</summary>
    public string Prompt { get; set; } = string.Empty;

    /// <summary>Per-project generation settings, layered over the global defaults.</summary>
    public Dictionary<string, string> Settings { get; set; } = [];

    /// <summary>Asset ids belonging to this project.</summary>
    public List<Guid> AssetIds { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset LastOpenedAt { get; set; } = DateTimeOffset.UtcNow;
}
