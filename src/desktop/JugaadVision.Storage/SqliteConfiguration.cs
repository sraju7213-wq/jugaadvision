using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace JugaadVision.Storage;

/// <summary>
/// SQLite database construction: connection string, per-connection pragmas, and XDG paths.
/// </summary>
/// <remarks>
/// Pragma values follow DATABASE_SCHEMA.md §8. The per-connection ones
/// (<c>foreign_keys</c>, <c>busy_timeout</c>) are baked into the connection string rather than
/// executed once, because a pooled connection that is recycled has not re-run them.
/// </remarks>
public static class SqliteConfiguration
{
    /// <summary>
    /// Applies the pragmas a <c>DbConnection</c> must have. Idempotent.
    /// </summary>
    /// <remarks>
    /// Called from <see cref="EnsurePragmasAsync"/> at startup and safe to call again. The
    /// connection string already carries <c>foreign_keys</c> and <c>busy_timeout</c>; this exists
    /// so a context built any other way still gets a correct connection.
    /// </remarks>
    public static void ApplyTo(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            PRAGMA busy_timeout=5000;
            PRAGMA synchronous=NORMAL;
            """;
        command.ExecuteNonQuery();
    }

    /// <summary>
    /// Opens a connection, applies the pragmas, and returns it.
    /// </summary>
    /// <remarks>
    /// <c>journal_mode</c> is a persistent property of the database file, so setting it is only
    /// meaningful on first use; setting it again is harmless.
    /// </remarks>
    public static async Task EnsurePragmasAsync(string connectionString, CancellationToken ct)
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(ct).ConfigureAwait(false);
        ApplyTo(connection);
    }

    /// <summary>
    /// Builds a connection string with the per-connection pragmas already applied.
    /// </summary>
    public static string BuildConnectionString(string databasePath)
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Default,

            // Off by default in SQLite, per connection, and required for the
            // ModelFiles -> Models cascade to work at all.
            ForeignKeys = true,

            // Turns SQLITE_BUSY into a short wait instead of an exception.
            DefaultTimeout = 5,
        };

        return builder.ToString();
    }

    /// <summary>
    /// Resolves the database file under the XDG data directory.
    /// </summary>
    /// <remarks>
    /// <c>$XDG_DATA_HOME/jugaadvision/jugaadvision.db</c>, falling back to
    /// <c>~/.local/share/...</c> when the variable is unset. This satisfies PRODUCT_SPEC §5
    /// "Data persistence | Survives app restart and uninstall".
    /// </remarks>
    public static string ResolveDatabasePath(string? overridePath = null)
    {
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            return Path.GetFullPath(overridePath);
        }

        var xdgDataHome = Environment.GetEnvironmentVariable("XDG_DATA_HOME");

        var root = !string.IsNullOrWhiteSpace(xdgDataHome)
            ? xdgDataHome
            : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".local", "share");

        var directory = Path.Combine(root, "jugaadvision");
        Directory.CreateDirectory(directory);

        return Path.Combine(directory, "jugaadvision.db");
    }
}
