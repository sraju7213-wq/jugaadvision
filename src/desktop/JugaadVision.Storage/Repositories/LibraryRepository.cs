using JugaadVision.Core.Abstractions;
using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace JugaadVision.Storage.Repositories;

public sealed class LibraryRepository : ILibraryRepository
{
    private readonly AppDbContext _db;

    public LibraryRepository(AppDbContext db) => _db = db;

    public Task<LibraryItem?> GetByIdAsync(Guid id, CancellationToken ct) =>
        _db.LibraryItems.FirstOrDefaultAsync(i => i.Id == id, ct);

    public async Task<IReadOnlyList<LibraryItem>> QueryAsync(
        string? searchText,
        AssetKind? kind,
        LibrarySort sort,
        int skip,
        int take,
        CancellationToken ct)
    {
        IQueryable<LibraryItem> q = _db.LibraryItems;

        if (kind is { } k)
        {
            q = q.Where(i => i.Kind == k);
        }

        if (!string.IsNullOrWhiteSpace(searchText))
        {
            var term = searchText.Trim();
            q = q.Where(i => EF.Functions.Like(i.Name, $"%{term}%"));
        }

        q = sort switch
        {
            LibrarySort.NewestFirst => q.OrderByDescending(i => i.CreatedAt),
            LibrarySort.OldestFirst => q.OrderBy(i => i.CreatedAt),
            LibrarySort.NameAscending => q.OrderBy(i => i.Name),
            LibrarySort.NameDescending => q.OrderByDescending(i => i.Name),
            LibrarySort.LargestFirst => q.OrderByDescending(i => i.SizeBytes),
            LibrarySort.SmallestFirst => q.OrderBy(i => i.SizeBytes),
            _ => q.OrderByDescending(i => i.CreatedAt),
        };

        return await q.Skip(skip).Take(take).ToListAsync(ct).ConfigureAwait(false);
    }

    public async Task UpsertAsync(LibraryItem item, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(item);

        var existing = await _db.LibraryItems.FirstOrDefaultAsync(i => i.Id == item.Id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            _db.LibraryItems.Add(item);
        }
        else
        {
            _db.Entry(existing).SetValuesExceptKey(item);
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var existing = await _db.LibraryItems.FirstOrDefaultAsync(i => i.Id == id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            return false;
        }

        _db.LibraryItems.Remove(existing);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return true;
    }

    public async Task SetFavoriteAsync(Guid id, bool isFavorite, CancellationToken ct)
    {
        // Only the flag is written: loading and re-saving the whole item would race with a
        // rename happening in the UI at the same time.
        var affected = await _db.LibraryItems
            .Where(i => i.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.IsFavorite, isFavorite), ct)
            .ConfigureAwait(false);

        if (affected == 0)
        {
            throw new KeyNotFoundException($"No library item with id {id}.");
        }
    }
}

public sealed class TaskRepository : ITaskRepository
{
    private readonly AppDbContext _db;

    public TaskRepository(AppDbContext db) => _db = db;

    public Task<BackgroundTask?> GetByIdAsync(Guid id, CancellationToken ct) =>
        _db.Tasks.FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<IReadOnlyList<BackgroundTask>> GetRecentAsync(int take, CancellationToken ct) =>
        await _db.Tasks
            .OrderByDescending(t => t.CreatedAt)
            .Take(take)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    /// <summary>
    /// Tasks that survived a crash mid-operation, rehydrated at startup (MODEL_SYSTEM.md).
    /// </summary>
    public async Task<IReadOnlyList<BackgroundTask>> GetResumableAsync(CancellationToken ct) =>
        await _db.Tasks
            .Where(t => t.State == TaskState.Paused || t.State == TaskState.Failed)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task UpsertAsync(BackgroundTask task, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(task);

        var existing = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == task.Id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            _db.Tasks.Add(task);
        }
        else
        {
            _db.Entry(existing).SetValuesExceptKey(task);
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<int> PruneCompletedAsync(DateTimeOffset olderThan, CancellationToken ct) =>
        await _db.Tasks
            .Where(t => (t.State == TaskState.Succeeded || t.State == TaskState.Canceled)
                        && t.CompletedAt != null
                        && t.CompletedAt < olderThan)
            .ExecuteDeleteAsync(ct)
            .ConfigureAwait(false);
}

public sealed class ProviderConfigRepository : IProviderConfigRepository
{
    private readonly AppDbContext _db;

    public ProviderConfigRepository(AppDbContext db) => _db = db;

    public Task<ProviderConfig?> GetByKeyAsync(string providerKey, CancellationToken ct) =>
        _db.ProviderConfigs.FirstOrDefaultAsync(c => c.ProviderKey == providerKey, ct);

    public async Task<IReadOnlyList<ProviderConfig>> GetAllAsync(CancellationToken ct) =>
        await _db.ProviderConfigs
            .OrderBy(c => c.DisplayName)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task UpsertAsync(ProviderConfig config, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(config);

        var existing = await _db.ProviderConfigs
            .FirstOrDefaultAsync(c => c.ProviderKey == config.ProviderKey, ct)
            .ConfigureAwait(false);

        if (existing is null)
        {
            _db.ProviderConfigs.Add(config);
        }
        else
        {
            _db.Entry(existing).SetValuesExceptKey(config);
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<bool> DeleteAsync(string providerKey, CancellationToken ct)
    {
        var existing = await _db.ProviderConfigs
            .FirstOrDefaultAsync(c => c.ProviderKey == providerKey, ct)
            .ConfigureAwait(false);

        if (existing is null)
        {
            return false;
        }

        _db.ProviderConfigs.Remove(existing);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return true;
    }
}
