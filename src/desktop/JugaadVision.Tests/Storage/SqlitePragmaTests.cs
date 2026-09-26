using JugaadVision.Storage;
using Microsoft.Data.Sqlite;
using Xunit;

namespace JugaadVision.Tests.Storage;

/// <summary>
/// Guards the SQLite connection contract (DATABASE_SCHEMA.md section 8).
/// </summary>
/// <remarks>
/// <c>journal_mode</c> is a property of the database <em>file</em>, but <c>foreign_keys</c>,
/// <c>busy_timeout</c> and <c>synchronous</c> are properties of a single <em>connection</em> and
/// reset to their defaults every time one is opened. Reading them with a different client is
/// therefore meaningless: an unrelated <c>sqlite3</c> connection always reports
/// <c>foreign_keys = 0</c> no matter what the app does. These tests open connections the same
/// way the app does, so they measure the real thing.
/// </remarks>
public sealed class SqlitePragmaTests : IDisposable
{
    private readonly string _dir = Path.Combine(
        Path.GetTempPath(),
        $"jgv-pragma-{Guid.NewGuid():N}");

    private string DbPath => Path.Combine(_dir, "pragma-test.db");

    public void Dispose()
    {
        if (Directory.Exists(_dir))
        {
            Directory.Delete(_dir, recursive: true);
        }

        GC.SuppressFinalize(this);
    }

    /// <summary>Opens a fresh connection, creating the parent directory first.</summary>
    private static SqliteConnection Open(string connectionString)
    {
        // SQLite will not create missing parent directories, and the connection fails with
        // "unable to open database file" rather than anything more descriptive.
        var dataSource = new SqliteConnectionStringBuilder(connectionString).DataSource;
        if (!string.IsNullOrEmpty(dataSource))
        {
            var directory = Path.GetDirectoryName(dataSource);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }
        }

        var connection = new SqliteConnection(connectionString);
        connection.Open();
        return connection;
    }

    /// <summary>
    /// Reads a pragma on its own fresh connection. Only valid for pragmas stored in the
    /// database file (journal_mode); per-connection pragmas reset on every open.
    /// </summary>
    private static object Scalar(string connectionString, string pragma)
    {
        using var connection = Open(connectionString);
        return Scalar(connection, pragma);
    }

    private static object Scalar(SqliteConnection connection, string pragma)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA {pragma};";
        return command.ExecuteScalar()!;
    }

    [Fact]
    public void ConnectionString_RequestsForeignKeysAndBusyTimeout()
    {
        var cs = SqliteConfiguration.BuildConnectionString(DbPath);
        var builder = new SqliteConnectionStringBuilder(cs);

        // Required for the ModelFiles -> Models cascade to work at all.
        Assert.True(builder.ForeignKeys);
        Assert.Equal(5, builder.DefaultTimeout);
        Assert.Equal(SqliteOpenMode.ReadWriteCreate, builder.Mode);
    }

    [Fact]
    public void ConnectionString_TurnsForeignKeysOnForEveryConnection()
    {
        var cs = SqliteConfiguration.BuildConnectionString(DbPath);

        // Asserted on two separate connections: the pragma must be re-applied each time,
        // because connection pooling would otherwise hand back a connection without it.
        Assert.Equal(1L, Scalar(cs, "foreign_keys"));
        Assert.Equal(1L, Scalar(cs, "foreign_keys"));
    }

    [Fact]
    public void ConnectionString_OverridesTheSqliteDefaultOfForeignKeysOff()
    {
        // Sanity check on the premise: without the flag SQLite really does report 0, which is
        // why the previous assertion above is worth making.
        var cs = new SqliteConnectionStringBuilder
        {
            DataSource = DbPath,
            ForeignKeys = false,
        }.ToString();

        Assert.Equal(0L, Scalar(cs, "foreign_keys"));
    }

    [Fact]
    public void JournalMode_IsWal_AndPersistsOnTheFile()
    {
        var cs = SqliteConfiguration.BuildConnectionString(DbPath);

        using (var connection = Open(cs))
        {
            SqliteConfiguration.ApplyTo(connection);
        }

        // journal_mode is stored in the file header, so a brand new connection sees it.
        Assert.Equal("wal", (string)Scalar(cs, "journal_mode"));
    }

    [Fact]
    public void Synchronous_IsNormal_NotFull()
    {
        var cs = SqliteConfiguration.BuildConnectionString(DbPath);

        using var connection = Open(cs);
        SqliteConfiguration.ApplyTo(connection);

        // Read on this same connection: synchronous is per-connection, so a new one would
        // report the default (2 = FULL) and the assertion would prove nothing.
        // 1 = NORMAL, the durability/speed tradeoff documented in section 8.
        Assert.Equal(1L, Scalar(connection, "synchronous"));
    }

    [Fact]
    public void ResolveDatabasePath_HonoursXdgDataHome()
    {
        var original = Environment.GetEnvironmentVariable("XDG_DATA_HOME");
        try
        {
            var temp = Path.Combine(Path.GetTempPath(), $"jgv-xdgdata-{Guid.NewGuid():N}");
            Environment.SetEnvironmentVariable("XDG_DATA_HOME", temp);

            var path = SqliteConfiguration.ResolveDatabasePath();

            Assert.StartsWith(temp, path, StringComparison.Ordinal);
            Assert.EndsWith("jugaadvision.db", path, StringComparison.Ordinal);
            Assert.True(Directory.Exists(Path.GetDirectoryName(path)));
        }
        finally
        {
            Environment.SetEnvironmentVariable("XDG_DATA_HOME", original);
        }
    }

    [Fact]
    public void ResolveDatabasePath_ExplicitOverrideWins()
    {
        var path = SqliteConfiguration.ResolveDatabasePath(DbPath);

        Assert.Equal(Path.GetFullPath(DbPath), path);
    }
}
