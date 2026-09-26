using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;
using JugaadVision.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace JugaadVision.Tests.Storage;

/// <summary>
/// Creates a real SQLite database in a temp directory for each test class instance.
/// </summary>
/// <remarks>
/// These are integration tests against actual SQLite, not an in-memory provider: the whole
/// point of the UTC-ticks converter is how the <em>real</em> SQLite provider sorts timestamps,
/// and an in-memory provider would not exercise that. The database file is deleted on dispose.
/// </remarks>
public sealed class SqliteDatabase : IAsyncDisposable
{
    private readonly string _path;

    public SqliteDatabase()
    {
        _path = Path.Combine(Path.GetTempPath(), $"jgv-test-{Guid.NewGuid():N}.db");
        ConnectionString = SqliteConfiguration.BuildConnectionString(_path);
    }

    public string ConnectionString { get; }

    public AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(ConnectionString)
            .Options;

        var context = new AppDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>Returns the value of a pragma on a fresh connection.</summary>
    public string ReadPragma(string name)
    {
        using var connection = new SqliteConnection(ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA {name};";
        return command.ExecuteScalar()?.ToString() ?? "<null>";
    }

    public async ValueTask DisposeAsync()
    {
        SqliteConnection.ClearAllPools();

        foreach (var suffix in new[] { "", "-wal", "-shm" })
        {
            var file = _path + suffix;
            if (File.Exists(file))
            {
                try
                {
                    File.Delete(file);
                }
                catch (IOException)
                {
                    // A leftover temp file is not worth failing a test over.
                }
            }
        }

        await Task.CompletedTask;
    }
}

/// <summary>
/// Proves the schema decisions in DATABASE_SCHEMA.md actually hold against real SQLite.
/// </summary>
public sealed class SchemaTests
{
    /// <summary>xUnit v3's per-test token, so a cancelled test stops database work promptly.</summary>
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task DateTimeOffsetColumns_AreIntegerTicks_NotText()
    {
        await using var db = new SqliteDatabase();
        await using var context = db.CreateContext();

        // The default SQLite mapping is TEXT, and sorting one throws at query-compile time.
        // Assert the storage type so a future refactor that drops the converter fails here.
        var createdAtType = ColumnType(context, "Generations", "CreatedAt");
        var completedAtType = ColumnType(context, "Generations", "CompletedAt");

        Assert.Equal("INTEGER", createdAtType);
        Assert.Equal("INTEGER", completedAtType);
    }

    [Fact]
    public void ConnectionString_EnablesForeignKeys()
    {
        // foreign_keys is OFF by default per connection, and the ModelFiles cascade silently
        // does nothing without it.
        var builder = new SqliteConnectionStringBuilder(
            SqliteConfiguration.BuildConnectionString("/tmp/does-not-matter.db"));

        Assert.True(builder.ForeignKeys);
    }

    [Fact]
    public async Task PragmaHelper_EnablesWalAndForeignKeys()
    {
        await using var db = new SqliteDatabase();

        await SqliteConfiguration.EnsurePragmasAsync(db.ConnectionString, Ct);

        Assert.Equal("wal", db.ReadPragma("journal_mode"), ignoreCase: true);
        Assert.Equal("1", db.ReadPragma("foreign_keys"));
        Assert.Equal("5000", db.ReadPragma("busy_timeout"));
    }

    [Fact]
    public void DatabasePath_RespectsTheXdgDataDirectory()
    {
        var original = Environment.GetEnvironmentVariable("XDG_DATA_HOME");
        try
        {
            var temp = Path.Combine(Path.GetTempPath(), $"jgv-xdg-{Guid.NewGuid():N}");
            Environment.SetEnvironmentVariable("XDG_DATA_HOME", temp);

            var path = SqliteConfiguration.ResolveDatabasePath();

            Assert.StartsWith(temp, path, StringComparison.Ordinal);
            Assert.EndsWith("jugaadvision.db", path, StringComparison.Ordinal);
        }
        finally
        {
            Environment.SetEnvironmentVariable("XDG_DATA_HOME", original);
        }
    }

    [Fact]
    public void DatabasePath_AcceptsAnExplicitOverride()
    {
        var path = SqliteConfiguration.ResolveDatabasePath("/tmp/custom-jgv.db");

        Assert.Equal("/tmp/custom-jgv.db", path);
    }

    [Fact]
    public void RowVersion_IsNotPresent()
    {
        // IsRowVersion() is a silent no-op on SQLite: the column is created, never populated,
        // and concurrent writes silently overwrite each other. DATABASE_SCHEMA.md §7.2.
        Assert.DoesNotContain(typeof(AIModel).GetProperties(), p => p.Name == "RowVersion");
        Assert.DoesNotContain(typeof(AIGeneration).GetProperties(), p => p.Name == "RowVersion");
        Assert.DoesNotContain(typeof(BackgroundTask).GetProperties(), p => p.Name == "RowVersion");
    }

    private static string ColumnType(AppDbContext context, string table, string column)
    {
        var connection = context.Database.GetDbConnection();

        // GetDbConnection returns the connection without opening it; pragma_table_info needs a
        // live connection.
        var opened = false;
        if (connection.State != System.Data.ConnectionState.Open)
        {
            connection.Open();
            opened = true;
        }

        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = $"SELECT type FROM pragma_table_info('{table}') WHERE name = '{column}';";
            return command.ExecuteScalar()?.ToString() ?? "<missing>";
        }
        finally
        {
            if (opened)
            {
                connection.Close();
            }
        }
    }
}

/// <summary>
/// Round-trips the value converters. A converter that silently drops data is invisible until a
/// user loses their tags, so each shape is asserted in both directions.
/// </summary>
public sealed class ValueConverterTests
{
    /// <summary>xUnit v3's per-test token, so a cancelled test stops database work promptly.</summary>
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task StringDictionary_SurvivesARoundTrip()
    {
        await using var db = new SqliteDatabase();
        await using var context = db.CreateContext();

        var model = new AIModel
        {
            Name = "converter test",
            Metadata = { ["quant"] = "Q4_K_M", ["ctx"] = "8192" },
        };

        context.Models.Add(model);
        await context.SaveChangesAsync(Ct);

        await using var verify = db.CreateContext();
        var loaded = await verify.Models.FirstAsync(m => m.Id == model.Id, Ct);

        Assert.Equal(2, loaded.Metadata.Count);
        Assert.Equal("Q4_K_M", loaded.Metadata["quant"]);
        Assert.Equal("8192", loaded.Metadata["ctx"]);
    }

    [Fact]
    public async Task DoubleDictionary_SurvivesARoundTrip()
    {
        await using var db = new SqliteDatabase();
        await using var context = db.CreateContext();

        var generation = new AIGeneration
        {
            ModelId = Guid.NewGuid(),
            ModelName = "m",
            ProviderName = "p",
            Prompt = "hello",
            Parameters = { ["temperature"] = 0.7, ["top_p"] = 0.95 },
        };

        context.Generations.Add(generation);
        await context.SaveChangesAsync(Ct);

        await using var verify = db.CreateContext();
        var loaded = await verify.Generations.FirstAsync(g => g.Id == generation.Id, Ct);

        Assert.Equal(2, loaded.Parameters.Count);
        Assert.Equal(0.7d, loaded.Parameters["temperature"], precision: 6);
    }

    [Fact]
    public async Task StringList_SurvivesARoundTrip()
    {
        await using var db = new SqliteDatabase();
        await using var context = db.CreateContext();

        var item = new LibraryItem
        {
            Name = "tagged",
            FilePath = "/tmp/a.png",
            Tags = { "portrait", "draft" },
        };

        context.LibraryItems.Add(item);
        await context.SaveChangesAsync(Ct);

        await using var verify = db.CreateContext();
        var loaded = await verify.LibraryItems.FirstAsync(i => i.Id == item.Id, Ct);

        Assert.Equal(["portrait", "draft"], loaded.Tags);
    }

    [Fact]
    public async Task GuidList_SurvivesARoundTrip()
    {
        await using var db = new SqliteDatabase();
        await using var context = db.CreateContext();

        var a = Guid.NewGuid();
        var b = Guid.NewGuid();

        var project = new AppProject { Name = "p", AssetIds = { a, b } };

        context.Projects.Add(project);
        await context.SaveChangesAsync(Ct);

        await using var verify = db.CreateContext();
        var loaded = await verify.Projects.FirstAsync(p => p.Id == project.Id, Ct);

        Assert.Equal([a, b], loaded.AssetIds);
    }

    [Fact]
    public async Task NullOrEmptyCollections_LoadAsEmptyRatherThanNull()
    {
        await using var db = new SqliteDatabase();
        await using var context = db.CreateContext();

        context.Models.Add(new AIModel { Name = "bare" });
        await context.SaveChangesAsync(Ct);

        await using var verify = db.CreateContext();
        var loaded = await verify.Models.FirstAsync(m => m.Name == "bare", Ct);

        Assert.NotNull(loaded.Metadata);
        Assert.Empty(loaded.Metadata);
        Assert.NotNull(loaded.Capabilities);
        Assert.Empty(loaded.Capabilities);
    }

    [Fact]
    public async Task Timestamps_KeepTheirInstantAcrossAUtcConversion()
    {
        await using var db = new SqliteDatabase();
        await using var context = db.CreateContext();

        // 10:00 at +02:00 and 08:00 UTC are the same instant.
        var withOffset = new DateTimeOffset(2026, 3, 1, 10, 0, 0, TimeSpan.FromHours(2));

        var generation = new AIGeneration
        {
            ModelId = Guid.NewGuid(),
            ModelName = "m",
            ProviderName = "p",
            Prompt = "p",
            CreatedAt = withOffset,
        };

        context.Generations.Add(generation);
        await context.SaveChangesAsync(Ct);

        await using var verify = db.CreateContext();
        var loaded = await verify.Generations.FirstAsync(g => g.Id == generation.Id, Ct);

        Assert.Equal(withOffset.UtcTicks, loaded.CreatedAt.UtcTicks);
        Assert.Equal(withOffset, loaded.CreatedAt.ToUniversalTime());
    }
}
