using JugaadVision.Core.Abstractions;
using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace JugaadVision.Storage.Repositories;

public sealed class ModelRepository : IModelRepository
{
    private readonly AppDbContext _db;

    public ModelRepository(AppDbContext db) => _db = db;

    public Task<AIModel?> GetByIdAsync(Guid id, CancellationToken ct) =>
        _db.Models.Include(m => m.Files).FirstOrDefaultAsync(m => m.Id == id, ct);

    public async Task<IReadOnlyList<AIModel>> QueryAsync(ModelQuery query, CancellationToken ct)
    {
        IQueryable<AIModel> q = _db.Models;

        if (query.InstalledOnly)
        {
            q = q.Where(m => m.Source == ModelSource.Local && m.State == ModelState.Installed);
        }

        if (query.State is { } state)
        {
            q = q.Where(m => m.State == state);
        }

        if (query.Kind is { } kind)
        {
            q = q.Where(m => m.Kind == kind);
        }

        if (query.Source is { } source && !query.InstalledOnly)
        {
            q = q.Where(m => m.Source == source);
        }

        if (!string.IsNullOrWhiteSpace(query.SearchText))
        {
            var term = query.SearchText.Trim();
            q = q.Where(m => EF.Functions.Like(m.Name, $"%{term}%")
                        || (m.Publisher != null && EF.Functions.Like(m.Publisher, $"%{term}%")));
        }

        q = query.Sort switch
        {
            LibrarySort.NewestFirst => q.OrderByDescending(m => m.DiscoveredAt),
            LibrarySort.OldestFirst => q.OrderBy(m => m.DiscoveredAt),
            LibrarySort.NameAscending => q.OrderBy(m => m.Name),
            LibrarySort.NameDescending => q.OrderByDescending(m => m.Name),
            _ => q.OrderByDescending(m => m.DiscoveredAt),
        };

        return await q
            .Include(m => m.Files)
            .Skip(query.Skip)
            .Take(query.Take)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task UpsertAsync(AIModel model, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(model);

        // The collection navigation makes a plain existence check unreliable, so the decision is
        // made on the key alone and the tracked graph is reconciled below.
        var existing = await _db.Models.FirstOrDefaultAsync(m => m.Id == model.Id, ct).ConfigureAwait(false);

        if (existing is null)
        {
            _db.Models.Add(model);
        }
        else
        {
            _db.Entry(existing).SetValuesExceptKey(model);
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task UpsertRangeAsync(IReadOnlyList<AIModel> models, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(models);

        if (models.Count == 0)
        {
            return;
        }

        // Discovery returns pages of dozens at a time, so this resolves the whole batch in one
        // query and saves once, rather than a round trip per model.
        var ids = models.Select(m => m.Id).ToList();

        var existing = await _db.Models
            .Where(m => ids.Contains(m.Id))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var byId = existing.ToDictionary(m => m.Id);

        foreach (var model in models)
        {
            if (byId.TryGetValue(model.Id, out var found))
            {
                _db.Entry(found).SetValuesExceptKey(model);
            }
            else
            {
                _db.Models.Add(model);
            }
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var existing = await _db.Models.FirstOrDefaultAsync(m => m.Id == id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            return false;
        }

        _db.Models.Remove(existing);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return true;
    }

    public async Task<IReadOnlyList<AIModel>> GetInstalledAsync(CancellationToken ct) =>
        await _db.Models
            .Include(m => m.Files)
            .Where(m => m.Source == ModelSource.Local && m.State == ModelState.Installed)
            .OrderBy(m => m.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
}
