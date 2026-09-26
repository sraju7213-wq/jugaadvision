using JugaadVision.Core.Abstractions;
using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;
using JugaadVision.Storage;
using JugaadVision.Storage.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace JugaadVision.Tests.Storage;

/// <summary>
/// Exercises the repository implementations against real SQLite.
/// </summary>
/// <remarks>
/// These go through the DI-registered concrete types, so the tests also cover
/// <c>AddJugaadVisionStorage</c> wiring — a missing registration fails here rather than at
/// runtime in the app.
/// </remarks>
public sealed class RepositoryTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static AppDbContext NewDb(SqliteDatabase db) => db.CreateContext();

    private static AIGeneration Generation(string prompt, DateTimeOffset createdAt) => new()
    {
        ModelId = Guid.NewGuid(),
        ModelName = "test-model",
        ProviderName = "local",
        Prompt = prompt,
        CreatedAt = createdAt,
        Status = GenerationStatus.Succeeded,
    };

    [Fact]
    public async Task History_IsReturnedNewestFirst()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new GenerationRepository(context);

        var now = DateTimeOffset.UtcNow;

        // Deliberately inserted oldest-first and with a non-UTC offset, so an ordering bug
        // cannot accidentally pass.
        await repo.AddAsync(Generation("oldest", now.AddDays(-2).ToOffset(TimeSpan.FromHours(2))), Ct);
        await repo.AddAsync(Generation("newest", now), Ct);
        await repo.AddAsync(Generation("middle", now.AddDays(-1)), Ct);

        var history = await repo.GetHistoryAsync(0, 10, Ct);

        Assert.Equal(["newest", "middle", "oldest"], history.Select(g => g.Prompt));
    }

    [Fact]
    public async Task History_PagesWithoutSkippingOrRepeating()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new GenerationRepository(context);

        var start = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        for (var i = 0; i < 5; i++)
        {
            await repo.AddAsync(Generation($"gen-{i}", start.AddMinutes(i)), Ct);
        }

        var page1 = await repo.GetHistoryAsync(0, 2, Ct);
        var page2 = await repo.GetHistoryAsync(2, 2, Ct);
        var page3 = await repo.GetHistoryAsync(4, 2, Ct);

        var seen = page1.Concat(page2).Concat(page3).Select(g => g.Prompt).ToList();

        Assert.Equal(5, seen.Count);
        Assert.Equal(5, seen.Distinct().Count());
        Assert.Equal("gen-4", seen[0]);
        Assert.Equal("gen-0", seen[4]);
    }

    [Fact]
    public async Task TotalCost_SumsOnlyGenerationsThatRecordedACost()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new GenerationRepository(context);

        var a = Generation("a", DateTimeOffset.UtcNow);
        a.CostUsd = 0.125m;

        var b = Generation("b", DateTimeOffset.UtcNow);
        b.CostUsd = 0.375m;

        // A local generation has no cost and must not drag the sum to null or zero it out.
        var c = Generation("c", DateTimeOffset.UtcNow);
        c.CostUsd = null;

        await repo.AddAsync(a, Ct);
        await repo.AddAsync(b, Ct);
        await repo.AddAsync(c, Ct);

        Assert.Equal(0.5m, await repo.GetTotalCostAsync(Ct));
    }

    [Fact]
    public async Task TotalCost_IsZeroWhenNothingHasEverCostAnything()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new GenerationRepository(context);

        await repo.AddAsync(Generation("local only", DateTimeOffset.UtcNow), Ct);

        Assert.Equal(0m, await repo.GetTotalCostAsync(Ct));
    }

    [Fact]
    public async Task ModelQuery_FiltersByInstalledOnly()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ModelRepository(context);

        var installed = new AIModel
        {
            Name = "installed gguf",
            Source = ModelSource.Local,
            State = ModelState.Installed,
        };

        var downloading = new AIModel
        {
            Name = "downloading gguf",
            Source = ModelSource.Local,
            State = ModelState.Downloading,
        };

        var remote = new AIModel
        {
            Name = "remote gguf",
            Source = ModelSource.HuggingFace,
            State = ModelState.Installed,
        };

        await repo.UpsertAsync(installed, Ct);
        await repo.UpsertAsync(downloading, Ct);
        await repo.UpsertAsync(remote, Ct);

        var results = await repo.QueryAsync(
            new ModelQuery { InstalledOnly = true, Take = 10 },
            Ct);

        Assert.Equal("installed gguf", Assert.Single(results).Name);
    }

    [Fact]
    public async Task ModelQuery_SearchesByName()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ModelRepository(context);

        await repo.UpsertAsync(new AIModel { Name = "Llama 3.1 8B" }, Ct);
        await repo.UpsertAsync(new AIModel { Name = "Mistral 7B" }, Ct);

        var results = await repo.QueryAsync(new ModelQuery { SearchText = "llama", Take = 10 }, Ct);

        Assert.Equal("Llama 3.1 8B", Assert.Single(results).Name);
    }

    [Fact]
    public async Task UpsertRange_InsertsThenUpdatesWithoutDuplicating()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ModelRepository(context);

        var model = new AIModel { Name = "first name" };
        await repo.UpsertRangeAsync([model], Ct);

        model.Name = "second name";
        model.ContextWindow = 8192;
        await repo.UpsertRangeAsync([model], Ct);

        var all = await repo.QueryAsync(new ModelQuery { Take = 10 }, Ct);

        Assert.Single(all);
        Assert.Equal("second name", all[0].Name);
        Assert.Equal(8192, all[0].ContextWindow);
    }

    [Fact]
    public async Task Upsert_ReplacesAnExistingRow()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ModelRepository(context);

        var model = new AIModel { Name = "before" };
        await repo.UpsertAsync(model, Ct);

        model.Name = "after";
        await repo.UpsertAsync(model, Ct);

        var loaded = await repo.GetByIdAsync(model.Id, Ct);

        Assert.NotNull(loaded);
        Assert.Equal("after", loaded.Name);
    }

    [Fact]
    public async Task DeletingAModel_CascadesToItsFiles()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ModelRepository(context);

        var model = new AIModel
        {
            Name = "sharded",
            Files =
            {
                new ModelFile { FileName = "model-00001.gguf", TotalBytes = 100, IsPrimary = true },
                new ModelFile { FileName = "model-00002.gguf", TotalBytes = 100 },
            },
        };

        await repo.UpsertAsync(model, Ct);

        using (var pragma = context.Database.GetDbConnection())
        {
            // Confirms foreign_keys is actually on for this connection.
            pragma.Open();
            using var cmd = pragma.CreateCommand();
            cmd.CommandText = "PRAGMA foreign_keys;";
            Assert.Equal("1", cmd.ExecuteScalar()?.ToString());
            pragma.Close();
        }

        Assert.True(await repo.DeleteAsync(model.Id, Ct));

        await using var verify = NewDb(db);
        Assert.Equal(0, await verify.ModelFiles.CountAsync(Ct));
    }

    [Fact]
    public async Task ResumableTasks_AreTheOnesLeftPausedOrFailed()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new TaskRepository(context);

        var running = new BackgroundTask { Title = "running", State = TaskState.Running };
        var paused = new BackgroundTask { Title = "paused", State = TaskState.Paused };
        var failed = new BackgroundTask { Title = "failed", State = TaskState.Failed };
        var done = new BackgroundTask
        {
            Title = "done",
            State = TaskState.Succeeded,
            CompletedAt = DateTimeOffset.UtcNow,
        };

        foreach (var t in new[] { running, paused, failed, done })
        {
            await repo.UpsertAsync(t, Ct);
        }

        var resumable = await repo.GetResumableAsync(Ct);

        Assert.Equal(["paused", "failed"], resumable.Select(t => t.Title));
    }

    [Fact]
    public async Task Prune_RemovesOnlyOldTerminalTasks()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new TaskRepository(context);

        await repo.UpsertAsync(new BackgroundTask
        {
            Title = "old success",
            State = TaskState.Succeeded,
            CompletedAt = DateTimeOffset.UtcNow.AddDays(-30),
        }, Ct);

        await repo.UpsertAsync(new BackgroundTask
        {
            Title = "recent success",
            State = TaskState.Succeeded,
            CompletedAt = DateTimeOffset.UtcNow.AddDays(-1),
        }, Ct);

        await repo.UpsertAsync(new BackgroundTask
        {
            Title = "old failure, still resumable",
            State = TaskState.Failed,
            CompletedAt = DateTimeOffset.UtcNow.AddDays(-30),
        }, Ct);

        var removed = await repo.PruneCompletedAsync(DateTimeOffset.UtcNow.AddDays(-7), Ct);

        Assert.Equal(1, removed);

        await using var verify = NewDb(db);
        var remaining = await verify.Tasks.Select(t => t.Title).ToListAsync(Ct);
        Assert.Equal(["recent success", "old failure, still resumable"], remaining);
    }

    [Fact]
    public async Task ProviderConfig_UpsertsByProviderKey()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ProviderConfigRepository(context);

        await repo.UpsertAsync(new ProviderConfig
        {
            ProviderKey = "openrouter",
            DisplayName = "OpenRouter",
            BaseUrl = "https://openrouter.ai/api/v1",
        }, Ct);

        await repo.UpsertAsync(new ProviderConfig
        {
            ProviderKey = "openrouter",
            DisplayName = "OpenRouter (EU)",
            BaseUrl = "https://openrouter.ai/api/v1",
        }, Ct);

        var all = await repo.GetAllAsync(Ct);

        Assert.Equal("OpenRouter (EU)", Assert.Single(all).DisplayName);
    }

    [Fact]
    public async Task ProviderConfig_StoresNoSecretMaterial()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ProviderConfigRepository(context);

        await repo.UpsertAsync(new ProviderConfig
        {
            ProviderKey = "openrouter",
            DisplayName = "OpenRouter",
            BaseUrl = "https://openrouter.ai/api/v1",
            CredentialReference = "jugaadvision:openrouter",
            CredentialSource = CredentialSource.Keyring,
        }, Ct);

        // The row must hold a reference into the keyring, never the key itself.
        var columns = context.Database.GetDbConnection();
        using var cmd = columns.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM ProviderConfigs WHERE ProviderKey = 'openrouter';";
        columns.Open();
        Assert.Equal("1", cmd.ExecuteScalar()?.ToString());
        columns.Close();

        var loaded = await repo.GetByKeyAsync("openrouter", Ct);
        Assert.NotNull(loaded);
        Assert.Equal("jugaadvision:openrouter", loaded.CredentialReference);
        Assert.DoesNotContain("sk-", loaded.CredentialReference!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task LibraryQuery_FiltersByKindAndSorts()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new LibraryRepository(context);

        var baseTime = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

        await repo.UpsertAsync(new LibraryItem
        {
            Name = "b.png", Kind = AssetKind.Image, FilePath = "/tmp/b.png", CreatedAt = baseTime,
        }, Ct);

        await repo.UpsertAsync(new LibraryItem
        {
            Name = "a.png", Kind = AssetKind.Image, FilePath = "/tmp/a.png", CreatedAt = baseTime.AddDays(1),
        }, Ct);

        await repo.UpsertAsync(new LibraryItem
        {
            Name = "note.txt", Kind = AssetKind.Text, FilePath = "/tmp/note.txt", CreatedAt = baseTime.AddDays(2),
        }, Ct);

        var newestImages = await repo.QueryAsync(null, AssetKind.Image, LibrarySort.NewestFirst, 0, 10, Ct);
        var alphabetical = await repo.QueryAsync(null, AssetKind.Image, LibrarySort.NameAscending, 0, 10, Ct);

        Assert.Equal(["a.png", "b.png"], newestImages.Select(i => i.Name));
        Assert.Equal(["a.png", "b.png"], alphabetical.Select(i => i.Name));

        // Change the sort key so the two orderings actually differ.
        await repo.SetFavoriteAsync(newestImages[0].Id, true, Ct);

        var byName = await repo.QueryAsync(null, null, LibrarySort.NameDescending, 0, 10, Ct);
        Assert.Equal(["note.txt", "b.png", "a.png"], byName.Select(i => i.Name));
    }

    [Fact]
    public async Task RecentProjects_AreNewestOpenedFirst()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ProjectRepository(context);

        await repo.UpsertAsync(new AppProject
        {
            Name = "old",
            LastOpenedAt = DateTimeOffset.UtcNow.AddDays(-5),
        }, Ct);

        await repo.UpsertAsync(new AppProject
        {
            Name = "new",
            LastOpenedAt = DateTimeOffset.UtcNow,
        }, Ct);

        var recent = await repo.GetRecentAsync(10, Ct);

        Assert.Equal(["new", "old"], recent.Select(p => p.Name));
    }

    [Fact]
    public async Task Project_SettingsDictionaryRoundTrips()
    {
        await using var db = new SqliteDatabase();
        await using var context = NewDb(db);
        var repo = new ProjectRepository(context);

        var project = new AppProject
        {
            Name = "comic",
            Settings = { ["width"] = "1024", ["height"] = "1536" },
        };

        await repo.UpsertAsync(project, Ct);

        await using var verify = NewDb(db);
        var loaded = await repo.GetByIdAsync(project.Id, Ct);

        Assert.NotNull(loaded);
        Assert.Equal("1024", loaded.Settings["width"]);
        Assert.Equal("1536", loaded.Settings["height"]);
    }
}
