using JugaadVision.Core.Abstractions;
using JugaadVision.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace JugaadVision.Storage.Repositories;

public sealed class GenerationRepository : IGenerationRepository
{
    private readonly AppDbContext _db;

    public GenerationRepository(AppDbContext db) => _db = db;

    public Task<AIGeneration?> GetByIdAsync(Guid id, CancellationToken ct) =>
        _db.Generations.FirstOrDefaultAsync(g => g.Id == id, ct);

    /// <summary>
    /// The UC-05 history path: paged, newest first.
    /// </summary>
    /// <remarks>
    /// Ordering is on <c>CreatedAt</c>, which is stored as UTC ticks. That is exactly why the
    /// converter in <c>ConfigureConventions</c> is mandatory: on EF's default SQLite mapping this
    /// <c>OrderBy</c> throws at query-compile time rather than returning wrong data.
    /// </remarks>
    public async Task<IReadOnlyList<AIGeneration>> GetHistoryAsync(int skip, int take, CancellationToken ct) =>
        await _db.Generations
            .OrderByDescending(g => g.CreatedAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task<IReadOnlyList<AIGeneration>> GetByProjectAsync(Guid projectId, CancellationToken ct) =>
        await _db.Generations
            .Where(g => g.ProjectId == projectId)
            .OrderByDescending(g => g.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task AddAsync(AIGeneration generation, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(generation);

        _db.Generations.Add(generation);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task UpdateAsync(AIGeneration generation, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(generation);

        _db.Generations.Update(generation);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var existing = await _db.Generations.FirstOrDefaultAsync(g => g.Id == id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            return false;
        }

        _db.Generations.Remove(existing);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return true;
    }

    /// <summary>
    /// Total spend across all generations that recorded a cost.
    /// </summary>
    /// <remarks>
    /// <c>decimal</c> is stored as TEXT in SQLite, so this must go through EF, which registers
    /// the collation. A hand-written <c>SUM()</c> in raw SQL would compare text and be wrong.
    /// See DATABASE_SCHEMA.md §4.1.
    /// </remarks>
    public async Task<decimal> GetTotalCostAsync(CancellationToken ct)
    {
        var costs = await _db.Generations
            .Where(g => g.CostUsd != null)
            .Select(g => g.CostUsd!.Value)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        decimal total = 0m;
        foreach (var cost in costs)
        {
            total += cost;
        }

        return total;
    }
}

public sealed class ProjectRepository : IProjectRepository
{
    private readonly AppDbContext _db;

    public ProjectRepository(AppDbContext db) => _db = db;

    public Task<AppProject?> GetByIdAsync(Guid id, CancellationToken ct) =>
        _db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IReadOnlyList<AppProject>> GetRecentAsync(int take, CancellationToken ct) =>
        await _db.Projects
            .OrderByDescending(p => p.LastOpenedAt)
            .Take(take)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task UpsertAsync(AppProject project, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(project);

        var existing = await _db.Projects.FirstOrDefaultAsync(p => p.Id == project.Id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            _db.Projects.Add(project);
        }
        else
        {
            _db.Entry(existing).SetValuesExceptKey(project);
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var existing = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            return false;
        }

        _db.Projects.Remove(existing);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return true;
    }
}
