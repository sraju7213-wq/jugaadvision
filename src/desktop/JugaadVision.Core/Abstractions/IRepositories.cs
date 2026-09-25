using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;

namespace JugaadVision.Core.Abstractions;

/// <summary>Criteria for listing models, backing the browser's search/filter/sort controls.</summary>
public sealed record ModelQuery
{
    public string? SearchText { get; init; }

    public ModelKind? Kind { get; init; }

    public ModelSource? Source { get; init; }

    public ModelState? State { get; init; }

    public LibrarySort Sort { get; init; } = LibrarySort.NewestFirst;

    public int Skip { get; init; }

    public int Take { get; init; } = 50;

    /// <summary>True when the query should only return models installed on this machine.</summary>
    public bool InstalledOnly { get; init; }
}

public interface IModelRepository
{
    Task<AIModel?> GetByIdAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<AIModel>> QueryAsync(ModelQuery query, CancellationToken ct);

    Task UpsertAsync(AIModel model, CancellationToken ct);

    Task UpsertRangeAsync(IReadOnlyList<AIModel> models, CancellationToken ct);

    Task<bool> DeleteAsync(Guid id, CancellationToken ct);

    /// <summary>Models that are loaded and executable right now, for the Generate workspace picker.</summary>
    Task<IReadOnlyList<AIModel>> GetInstalledAsync(CancellationToken ct);
}

public interface IGenerationRepository
{
    Task<AIGeneration?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>Paged history for UC-05, newest first.</summary>
    Task<IReadOnlyList<AIGeneration>> GetHistoryAsync(int skip, int take, CancellationToken ct);

    Task<IReadOnlyList<AIGeneration>> GetByProjectAsync(Guid projectId, CancellationToken ct);

    Task AddAsync(AIGeneration generation, CancellationToken ct);

    Task UpdateAsync(AIGeneration generation, CancellationToken ct);

    Task<bool> DeleteAsync(Guid id, CancellationToken ct);

    /// <summary>Total spend on cloud generations, for the Home dashboard.</summary>
    Task<decimal> GetTotalCostAsync(CancellationToken ct);
}

public interface IProjectRepository
{
    Task<AppProject?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>Recently opened projects, for the Home screen (UC-04).</summary>
    Task<IReadOnlyList<AppProject>> GetRecentAsync(int take, CancellationToken ct);

    Task UpsertAsync(AppProject project, CancellationToken ct);

    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public interface ILibraryRepository
{
    Task<LibraryItem?> GetByIdAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<LibraryItem>> QueryAsync(
        string? searchText,
        AssetKind? kind,
        LibrarySort sort,
        int skip,
        int take,
        CancellationToken ct);

    Task UpsertAsync(LibraryItem item, CancellationToken ct);

    Task<bool> DeleteAsync(Guid id, CancellationToken ct);

    Task SetFavoriteAsync(Guid id, bool isFavorite, CancellationToken ct);
}

public interface ITaskRepository
{
    Task<BackgroundTask?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>Active and recent tasks for the Tasks view (UC-07).</summary>
    Task<IReadOnlyList<BackgroundTask>> GetRecentAsync(int take, CancellationToken ct);

    /// <summary>Tasks in a resumable state, reloaded at startup so interrupted work is not lost.</summary>
    Task<IReadOnlyList<BackgroundTask>> GetResumableAsync(CancellationToken ct);

    Task UpsertAsync(BackgroundTask task, CancellationToken ct);

    /// <summary>Terminal tasks older than the cutoff, for periodic pruning.</summary>
    Task<int> PruneCompletedAsync(DateTimeOffset olderThan, CancellationToken ct);
}

public interface IProviderConfigRepository
{
    Task<ProviderConfig?> GetByKeyAsync(string providerKey, CancellationToken ct);

    Task<IReadOnlyList<ProviderConfig>> GetAllAsync(CancellationToken ct);

    Task UpsertAsync(ProviderConfig config, CancellationToken ct);

    Task<bool> DeleteAsync(string providerKey, CancellationToken ct);
}

public interface ISettingsStore
{
    Task<AppSettings> LoadAsync(CancellationToken ct);

    Task SaveAsync(AppSettings settings, CancellationToken ct);
}
