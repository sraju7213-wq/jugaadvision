using JugaadVision.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace JugaadVision.Storage.Configuration;

/// <summary>
/// Fluent configuration for <see cref="AIModel"/> and <see cref="ModelFile"/>.
/// </summary>
/// <remarks>
/// The indexes here are not speculative. Each one is named for the repository method it
/// serves, so an index added "just in case" is visible as such in review.
/// </remarks>
public sealed class AIModelConfiguration : IEntityTypeConfiguration<AIModel>
{
    public void Configure(EntityTypeBuilder<AIModel> builder)
    {
        builder.ToTable("Models");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Name).IsRequired().HasMaxLength(512);
        builder.Property(m => m.Publisher).HasMaxLength(256);
        builder.Property(m => m.ExternalId).HasMaxLength(512);
        builder.Property(m => m.Quantization).HasMaxLength(64);
        builder.Property(m => m.License).HasMaxLength(128);
        builder.Property(m => m.Description).HasMaxLength(4096);

        builder.Property(m => m.ParameterCountBillions).HasColumnType("REAL");
        builder.Property(m => m.DownloadCount).HasColumnType("INTEGER");

        // decimal is TEXT in SQLite; DATABASE_SCHEMA.md §4.1 explains why that is acceptable
        // here and why all comparisons must go through EF rather than raw SQL.
        builder.Property(m => m.PriceInputPerMillion).HasColumnType("TEXT");
        builder.Property(m => m.PriceOutputPerMillion).HasColumnType("TEXT");

        // Computed properties must never be persisted.
        builder.Ignore(m => m.IsLocallyExecutable);
        builder.Ignore(m => m.RequiresCredential);

        builder.HasIndex(m => new { m.Source, m.State }).HasDatabaseName("IX_Models_Source_State");
        builder.HasIndex(m => new { m.Kind, m.State }).HasDatabaseName("IX_Models_Kind_State");
        builder.HasIndex(m => m.Name).HasDatabaseName("IX_Models_Name");

        // ModelFile exposes only ModelId, with no inverse navigation property on the domain
        // type, so the relationship is configured without one. Core stays a pure domain layer.
        builder.HasMany(m => m.Files)
            .WithOne()
            .HasForeignKey(f => f.ModelId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ModelFileConfiguration : IEntityTypeConfiguration<ModelFile>
{
    public void Configure(EntityTypeBuilder<ModelFile> builder)
    {
        builder.ToTable("ModelFiles");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.FileName).IsRequired().HasMaxLength(512);
        builder.Property(f => f.LocalPath).HasMaxLength(4096);
        builder.Property(f => f.SourceUrl).HasMaxLength(4096);
        builder.Property(f => f.Checksum).HasMaxLength(128);

        builder.Ignore(f => f.DownloadProgress);

        // Resume queries ask "which files for this model are still incomplete?".
        builder.HasIndex(f => f.ModelId).HasDatabaseName("IX_ModelFiles_ModelId");
    }
}
