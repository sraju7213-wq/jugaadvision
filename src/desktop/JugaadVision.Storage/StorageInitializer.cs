using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace JugaadVision.Storage;

/// <summary>
/// Brings the SQLite database up to date at startup.
/// </summary>
/// <remarks>
/// <see cref="DbContextOptionsBuilder.UseSqlite"/> stores its configuration lazily, so nothing
/// touches the database file until a context is first resolved. Without an explicit migration
/// step the first page that queries would fail with <c>no such table: Models</c>, so this runs
/// before the main window is shown.
/// </remarks>
public sealed class StorageInitializer
{
    private readonly AppDbContext _db;
    private readonly ILogger<StorageInitializer> _logger;

    public StorageInitializer(AppDbContext db, ILogger<StorageInitializer> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Applies any pending migrations, then applies the per-connection pragmas.
    /// </summary>
    /// <remarks>
    /// Never throws. A storage failure at startup must not stop the app from opening: the user
    /// can still reach Settings and fix the path, and the error is surfaced in the log. A hard
    /// failure here would mean a black window with no explanation.
    /// </remarks>
    public async Task InitializeAsync(CancellationToken ct)
    {
        try
        {
            var pending = (await _db.Database.GetPendingMigrationsAsync(ct).ConfigureAwait(false)).ToList();

            if (pending.Count > 0)
            {
                _logger.LogInformation(
                    "Applying {Count} pending migration(s): {Migrations}",
                    pending.Count,
                    string.Join(", ", pending));
            }

            await _db.Database.MigrateAsync(ct).ConfigureAwait(false);

            await SqliteConfiguration
                .EnsurePragmasAsync(_db.Database.GetConnectionString()!, ct)
                .ConfigureAwait(false);

            _logger.LogInformation("Storage ready at {Path}", _db.Database.GetDbConnection().DataSource);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Storage initialisation failed; the app will start degraded");
        }
    }
}
