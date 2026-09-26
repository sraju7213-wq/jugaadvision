using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;
using JugaadVision.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace JugaadVision.Tests.Storage;

/// <summary>
/// Covers the schema's referential-integrity contract (DATABASE_SCHEMA.md section 7.3).
/// </summary>
/// <remarks>
/// The schema has exactly <em>one</em> foreign key: <c>ModelFiles.ModelId -&gt; Models.Id ON
/// DELETE CASCADE</c>. Every other id-shaped column is a deliberate <em>soft reference</em> with
/// no FK constraint, because history and in-flight work must outlive what they point at and
/// "a cascade cannot ask". These tests pin both halves of that contract: the one cascade must
/// fire, and the soft references must survive a parent delete.
/// </remarks>
public sealed class ReferentialIntegrityTests : IAsyncLifetime
{
    private readonly string _dir = Path.Combine(
        Path.GetTempPath(),
        $"jgv-fk-{Guid.NewGuid():N}");

    private AppDbContext _db = null!;

    public async ValueTask InitializeAsync()
    {
        var ct = TestContext.Current.CancellationToken;
        Directory.CreateDirectory(_dir);

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(SqliteConfiguration.BuildConnectionString(Path.Combine(_dir, "fk.db")))
            .Options;

        _db = new AppDbContext(options);
        await _db.Database.MigrateAsync(ct);
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();

        if (Directory.Exists(_dir))
        {
            Directory.Delete(_dir, recursive: true);
        }
    }

    private static AIModel NewModel(string name) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        Kind = ModelKind.TextGeneration,
        Source = ModelSource.Local,
        State = ModelState.Installed,
    };

    /// <summary>
    /// Runs raw SQL on the context's own connection, as the database sees it.
    /// </summary>
    /// <remarks>
    /// Raw SQL is deliberate: EF Core's change tracker cascades and filters in memory, which
    /// would hide whether the <em>database</em> enforced anything.
    /// </remarks>
    private async Task<T> RawAsync<T>(Func<SqliteConnection, Task<T>> body, CancellationToken ct)
    {
        var connection = (SqliteConnection)_db.Database.GetDbConnection();
        await connection.OpenAsync(ct);
        try
        {
            return await body(connection);
        }
        finally
        {
            await connection.CloseAsync();
        }
    }

    private static async Task<long> ScalarAsync(SqliteConnection connection, string sql, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync(ct));
    }

    private static async Task<int> ExecAsync(SqliteConnection connection, string sql, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return await command.ExecuteNonQueryAsync(ct);
    }

    private Task<long> CountAsync(string table, CancellationToken ct) =>
        RawAsync(c => ScalarAsync(c, $"SELECT COUNT(*) FROM {table};", ct), ct);

    /// <summary>
    /// Deletes the row with the given primary key and asserts exactly one row went.
    /// </summary>
    /// <remarks>
    /// Two things this deliberately does not skip. It reads the stored id text back out of the
    /// database first, because EF Core's SQLite Guid text format is not guaranteed to equal
    /// <see cref="Guid.ToString()"/> and a mismatched WHERE clause would delete nothing and make
    /// the cascade assertions below pass for the wrong reason. And it asserts the affected-row
    /// count, so a silently ineffective DELETE can never be mistaken for a passing cascade test.
    /// </remarks>
    private async Task DeleteByIdAsync(string table, string column, string value, CancellationToken ct)
    {
        var id = await RawAsync(
            async c =>
            {
                await using var select = c.CreateCommand();
                select.CommandText = $"SELECT Id FROM {table} WHERE {column} = $value;";
                select.Parameters.AddWithValue("$value", value);
                return (string?)await select.ExecuteScalarAsync(ct);
            },
            ct);

        Assert.NotNull(id);

        var affected = await RawAsync(
            async c =>
            {
                await using var delete = c.CreateCommand();
                delete.CommandText = $"DELETE FROM {table} WHERE Id = $id;";
                delete.Parameters.AddWithValue("$id", id);
                return await delete.ExecuteNonQueryAsync(ct);
            },
            ct);

        Assert.Equal(1, affected);
    }

    [Fact]
    public async Task ForeignKeys_AreEnforcedOnTheConnection()
    {
        var ct = TestContext.Current.CancellationToken;

        var enabled = await RawAsync(c => ScalarAsync(c, "PRAGMA foreign_keys;", ct), ct);

        Assert.Equal(1L, enabled);
    }

    [Fact]
    public async Task OrphanModelFile_IsRejectedByTheDatabase()
    {
        var ct = TestContext.Current.CancellationToken;

        var orphan = new ModelFile
        {
            Id = Guid.NewGuid(),
            ModelId = Guid.NewGuid(), // no such Models row
            FileName = "orphan.gguf",
            Format = ModelFormat.Gguf,
            TotalBytes = 1,
        };

        _db.ModelFiles.Add(orphan);

        // The single real FK is doing its job: a file row cannot exist without its model.
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync(ct));
    }

    [Fact]
    public async Task DeletingAModel_CascadesToItsFiles()
    {
        var ct = TestContext.Current.CancellationToken;
        var model = NewModel("cascade-target");
        model.Files.Add(new ModelFile
        {
            Id = Guid.NewGuid(),
            FileName = "weights.gguf",
            Format = ModelFormat.Gguf,
            TotalBytes = 1024,
        });
        model.Files.Add(new ModelFile
        {
            Id = Guid.NewGuid(),
            FileName = "config.json",
            Format = ModelFormat.Unknown,
            TotalBytes = 16,
        });

        _db.Models.Add(model);
        await _db.SaveChangesAsync(ct);

        await DeleteByIdAsync("Models", "Name", "cascade-target", ct);

        Assert.Equal(0L, await CountAsync("ModelFiles", ct));
        Assert.Equal(0L, await CountAsync("Models", ct));
    }

    [Fact]
    public async Task DeletingAModel_LeavesItsGenerationsIntact()
    {
        // Section 7.3: Generations.ModelId is a soft reference. The generations outlive the
        // model, which is why AIGeneration.ModelName is denormalised.
        var ct = TestContext.Current.CancellationToken;
        var model = NewModel("in-use");
        _db.Models.Add(model);
        await _db.SaveChangesAsync(ct);

        _db.Generations.Add(new AIGeneration
        {
            Id = Guid.NewGuid(),
            ModelId = model.Id,
            ModelName = "in-use",
            Prompt = "keep me",
            Status = GenerationStatus.Succeeded,
        });
        await _db.SaveChangesAsync(ct);

        await DeleteByIdAsync("Models", "Name", "in-use", ct);

        Assert.Equal(1L, await CountAsync("Generations", ct));
    }

    [Fact]
    public async Task DeletingAModel_LeavesItsDownloadTasksIntact()
    {
        // Section 7.3: the user must not lose the only record of a failed download.
        var ct = TestContext.Current.CancellationToken;
        var model = NewModel("downloading");
        _db.Models.Add(model);
        await _db.SaveChangesAsync(ct);

        _db.Tasks.Add(new BackgroundTask
        {
            Id = Guid.NewGuid(),
            Kind = TaskKind.Download,
            Title = "Downloading downloading",
            ModelId = model.Id,
        });
        await _db.SaveChangesAsync(ct);

        await DeleteByIdAsync("Models", "Name", "downloading", ct);

        Assert.Equal(1L, await CountAsync("Tasks", ct));
    }

    [Fact]
    public async Task DeletingAProject_LeavesItsLibraryItemsIntact()
    {
        // Section 7.3: an asset outlives the project, and the user may want to keep it.
        var ct = TestContext.Current.CancellationToken;
        var project = new AppProject { Id = Guid.NewGuid(), Name = "old project" };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(ct);

        _db.LibraryItems.Add(new LibraryItem
        {
            Id = Guid.NewGuid(),
            Kind = AssetKind.Image,
            Name = "keep.png",
            ProjectId = project.Id,
        });
        await _db.SaveChangesAsync(ct);

        await DeleteByIdAsync("Projects", "Name", "old project", ct);

        Assert.Equal(1L, await CountAsync("LibraryItems", ct));
    }

    [Fact]
    public async Task GuidKeys_AreStoredAsUppercaseDashText()
    {
        // DATABASE_SCHEMA.md section 7.2 prescribes updating BackgroundTask progress with raw
        // SQL from a background writer, which means matching the key by hand. This pins the
        // stored representation so that code cannot silently match zero rows: a raw
        // `WHERE Id = @id` that quietly deletes or updates nothing looks identical to success
        // unless the row count is checked.
        var ct = TestContext.Current.CancellationToken;
        var model = NewModel("guid-format");
        _db.Models.Add(model);
        await _db.SaveChangesAsync(ct);

        var stored = await RawAsync(
            async c =>
            {
                await using var select = c.CreateCommand();
                select.CommandText = "SELECT Id FROM Models WHERE Name = $name;";
                select.Parameters.AddWithValue("$name", "guid-format");
                return (string?)await select.ExecuteScalarAsync(ct);
            },
            ct);

        Assert.NotNull(stored);

        // EF Core's SQLite provider stores Guids as UPPERCASE dash text, not the lowercase
        // form that Guid.ToString() returns. This is a real trap: raw SQL written the obvious
        // way matches zero rows and looks like it succeeded.
        Assert.Equal(model.Id.ToString("D").ToUpperInvariant(), stored);

        // Matching the stored form finds the row.
        Assert.Equal(
            1L,
            await CountWhereIdAsync(model.Id.ToString("D").ToUpperInvariant(), ct));

        // Matching the lowercase form does not, and the count proves it rather than leaving
        // the caller to assume the UPDATE landed.
        Assert.Equal(
            0L,
            await CountWhereIdAsync(model.Id.ToString("D"), ct));
    }

    private Task<long> CountWhereIdAsync(string id, CancellationToken ct) =>
        RawAsync(
            async c =>
            {
                await using var select = c.CreateCommand();
                select.CommandText = "SELECT COUNT(*) FROM Models WHERE Id = $id;";
                select.Parameters.AddWithValue("$id", id);
                return Convert.ToInt64(await select.ExecuteScalarAsync(ct));
            },
            ct);

    [Fact]
    public async Task TheSchemaHasExactlyOneForeignKey()
    {
        // Guards the section 7.3 decision itself. A second FK would silently reintroduce the
        // cascade-that-destroys-history problem, and this is the test that says so.
        var ct = TestContext.Current.CancellationToken;

        var tables = await RawAsync(async c =>
        {
            var names = new List<string>();
            await using var command = c.CreateCommand();
            command.CommandText =
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                names.Add(reader.GetString(0));
            }

            return names;
        }, ct);

        var total = 0;
        foreach (var table in tables)
        {
            total += (int)await CountForeignKeysAsync(table, ct);
        }

        Assert.Equal(1, total);
    }

    private Task<long> CountForeignKeysAsync(string table, CancellationToken ct) =>
        RawAsync(
            c => ScalarAsync(c, $"SELECT COUNT(*) FROM pragma_foreign_key_list('{table}');", ct),
            ct);
}
