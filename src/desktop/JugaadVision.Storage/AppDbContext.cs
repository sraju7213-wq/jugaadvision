using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;
using JugaadVision.Storage.Converters;
using Microsoft.EntityFrameworkCore;

namespace JugaadVision.Storage;

/// <summary>
/// The application's SQLite context.
/// </summary>
/// <remarks>
/// The domain entities in <c>JugaadVision.Core</c> carry no EF attributes whatsoever — no
/// <c>[Key]</c>, no <c>[Column]</c>, no <c>[Table]</c>. Every mapping is configured here with
/// the fluent API so Core stays a pure domain project with no outward dependency, which is what
/// lets the Clean Architecture rule "Core depends on nothing" actually hold.
/// </remarks>
public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<AIModel> Models => Set<AIModel>();

    public DbSet<ModelFile> ModelFiles => Set<ModelFile>();

    public DbSet<AIGeneration> Generations => Set<AIGeneration>();

    public DbSet<ProviderConfig> ProviderConfigs => Set<ProviderConfig>();

    public DbSet<AppProject> Projects => Set<AppProject>();

    public DbSet<LibraryItem> LibraryItems => Set<LibraryItem>();

    public DbSet<BackgroundTask> Tasks => Set<BackgroundTask>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        // Applied model-wide so no individual property can forget the ticks conversion.
        // Without this, every ORDER BY on a timestamp throws at query-compile time.
        builder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToUtcTicksConverter>();
        builder.Properties<DateTimeOffset?>().HaveConversion<NullableDateTimeOffsetToUtcTicksConverter>();

        // JSON columns. One converter per CLR shape; see DATABASE_SCHEMA.md §5.
        builder.Properties<Dictionary<string, string>>().HaveConversion<StringDictionaryToJsonConverter>();
        builder.Properties<Dictionary<string, double>>().HaveConversion<DoubleDictionaryToJsonConverter>();
        builder.Properties<List<string>>().HaveConversion<StringListToJsonConverter>();
        builder.Properties<List<Guid>>().HaveConversion<GuidListToJsonConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
