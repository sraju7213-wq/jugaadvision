using JugaadVision.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace JugaadVision.Storage.Configuration;

public sealed class GenerationConfiguration : IEntityTypeConfiguration<AIGeneration>
{
    public void Configure(EntityTypeBuilder<AIGeneration> builder)
    {
        builder.ToTable("Generations");
        builder.HasKey(g => g.Id);

        builder.Property(g => g.ModelName).IsRequired().HasMaxLength(512);
        builder.Property(g => g.ProviderName).IsRequired().HasMaxLength(128);
        builder.Property(g => g.Prompt).IsRequired();
        builder.Property(g => g.NegativePrompt).HasMaxLength(8192);
        builder.Property(g => g.OutputText);
        builder.Property(g => g.OutputPath).HasMaxLength(4096);
        builder.Property(g => g.ErrorMessage).HasMaxLength(4096);

        builder.Property(g => g.CostUsd).HasColumnType("TEXT");

        // TimeSpan? keeps the EF default TEXT mapping (DATABASE_SCHEMA.md §4): it is only ever
        // read back for display, never sorted or compared.

        // IGenerationsRepository.GetHistoryAsync is the UC-05 path: paged, newest first.
        // Without this index every page load is a full sort.
        builder.HasIndex(g => g.CreatedAt).HasDatabaseName("IX_Generations_CreatedAt");
        builder.HasIndex(g => new { g.ProjectId, g.CreatedAt }).HasDatabaseName("IX_Generations_ProjectId_CreatedAt");
        builder.HasIndex(g => g.ModelId).HasDatabaseName("IX_Generations_ModelId");
    }
}

public sealed class ProviderConfigConfiguration : IEntityTypeConfiguration<ProviderConfig>
{
    public void Configure(EntityTypeBuilder<ProviderConfig> builder)
    {
        builder.ToTable("ProviderConfigs");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ProviderKey).IsRequired().HasMaxLength(128);
        builder.Property(c => c.DisplayName).IsRequired().HasMaxLength(256);
        builder.Property(c => c.BaseUrl).IsRequired().HasMaxLength(2048);
        builder.Property(c => c.CredentialReference).HasMaxLength(512);
        builder.Property(c => c.LastErrorMessage).HasMaxLength(4096);

        builder.Ignore(c => c.IsUsable);

        // The provider key is the natural identity: one row per provider, upserted by key.
        builder.HasIndex(c => c.ProviderKey)
            .IsUnique()
            .HasDatabaseName("IX_ProviderConfigs_ProviderKey");
    }
}

public sealed class ProjectConfiguration : IEntityTypeConfiguration<AppProject>
{
    public void Configure(EntityTypeBuilder<AppProject> builder)
    {
        builder.ToTable("Projects");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).IsRequired().HasMaxLength(512);
        builder.Property(p => p.Description).HasMaxLength(4096);
        builder.Property(p => p.FilePath).HasMaxLength(4096);
        builder.Property(p => p.ModelName).HasMaxLength(512);
        builder.Property(p => p.ProviderKey).HasMaxLength(128);
        builder.Property(p => p.Prompt);

        // IProjectRepository.GetRecentAsync — the Home screen's recent list.
        builder.HasIndex(p => p.LastOpenedAt).HasDatabaseName("IX_Projects_LastOpenedAt");
    }
}

public sealed class LibraryItemConfiguration : IEntityTypeConfiguration<LibraryItem>
{
    public void Configure(EntityTypeBuilder<LibraryItem> builder)
    {
        builder.ToTable("LibraryItems");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Name).IsRequired().HasMaxLength(512);
        builder.Property(i => i.FilePath).IsRequired().HasMaxLength(4096);
        builder.Property(i => i.SizeBytes).HasColumnType("INTEGER");

        // ILibraryRepository.QueryAsync sorts and pages; favourites are a filter.
        builder.HasIndex(i => i.CreatedAt).HasDatabaseName("IX_LibraryItems_CreatedAt");
        builder.HasIndex(i => i.IsFavorite).HasDatabaseName("IX_LibraryItems_IsFavorite");
        builder.HasIndex(i => i.Kind).HasDatabaseName("IX_LibraryItems_Kind");
    }
}

public sealed class BackgroundTaskConfiguration : IEntityTypeConfiguration<BackgroundTask>
{
    public void Configure(EntityTypeBuilder<BackgroundTask> builder)
    {
        builder.ToTable("Tasks");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Title).IsRequired().HasMaxLength(512);
        builder.Property(t => t.StatusMessage).HasMaxLength(1024);
        builder.Property(t => t.ErrorMessage).HasMaxLength(4096);
        builder.Property(t => t.Progress).HasColumnType("REAL");
        builder.Property(t => t.BytesTransferred).HasColumnType("INTEGER");
        builder.Property(t => t.TotalBytes).HasColumnType("INTEGER");

        builder.Ignore(t => t.IsTerminal);
        builder.Ignore(t => t.IsResumable);

        // ITaskRepository.GetRecentAsync — the Tasks view.
        builder.HasIndex(t => t.CreatedAt).HasDatabaseName("IX_Tasks_CreatedAt");

        // ITaskRepository.GetResumableAsync rehydrates interrupted work at startup. A partial
        // index is not available in SQLite, so State is the leading column.
        builder.HasIndex(t => new { t.State, t.CreatedAt }).HasDatabaseName("IX_Tasks_State_CreatedAt");
    }
}
