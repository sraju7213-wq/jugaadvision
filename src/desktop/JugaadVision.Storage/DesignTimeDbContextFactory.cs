using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace JugaadVision.Storage;

/// <summary>
/// Used only by <c>dotnet ef</c> when scaffolding a migration.
/// </summary>
/// <remarks>
/// The design-time factory is required because the application builds its
/// <see cref="AppDbContext"/> inside the DI container, which the EF tooling does not run. It
/// points at a throwaway file so <c>dotnet ef migrations add</c> never touches the user's real
/// database.
/// </remarks>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var path = Path.Combine(Path.GetTempPath(), "jugaadvision-designtime.db");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(SqliteConfiguration.BuildConnectionString(path))
            .Options;

        return new AppDbContext(options);
    }
}
