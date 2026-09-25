namespace JugaadVision.Core.Enums;

/// <summary>What an asset in the library is. Determines the preview and the export affordances.</summary>
public enum AssetKind
{
    Unknown = 0,
    Image = 1,
    Text = 2,
    Audio = 3,
    Video = 4,
    Model = 5,
    Project = 6,
}

/// <summary>Sort order for the library grid/list.</summary>
public enum LibrarySort
{
    NewestFirst = 0,
    OldestFirst = 1,
    NameAscending = 2,
    NameDescending = 3,
    LargestFirst = 4,
    SmallestFirst = 5,
}

/// <summary>Which project file a load/save target refers to.</summary>
public enum ProjectFormat
{
    /// <summary>The native <c>.jgvproj</c> container.</summary>
    JgvProj = 0,
}
