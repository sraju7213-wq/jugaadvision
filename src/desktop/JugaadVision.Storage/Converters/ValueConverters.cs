using System.Text.Json;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace JugaadVision.Storage.Converters;

/// <summary>
/// Converts <see cref="DateTimeOffset"/> to <see cref="long"/> UTC ticks.
/// </summary>
/// <remarks>
/// This converter is <b>mandatory, not cosmetic</b>. EF Core's SQLite provider maps
/// <see cref="DateTimeOffset"/> to TEXT and then refuses to sort it, throwing
/// <c>NotSupportedException: SQLite does not support expressions of type 'DateTimeOffset' in
/// ORDER BY clauses</c> at query-compile time. That breaks the three headline query paths in
/// <c>IRepositories.cs</c>: paged history newest-first (UC-05), library sorting, and recent
/// projects. Storing an integer also removes the offset-dependence of TEXT ordering, where
/// <c>10:00+02:00</c> and <c>09:00+00:00</c> are the same instant but sort incorrectly.
/// See DATABASE_SCHEMA.md §4.2.
/// </remarks>
public sealed class DateTimeOffsetToUtcTicksConverter : ValueConverter<DateTimeOffset, long>
{
    public DateTimeOffsetToUtcTicksConverter()
        : base(
            v => v.UtcTicks,
            v => new DateTimeOffset(v, TimeSpan.Zero))
    {
    }
}

/// <summary>Nullable counterpart of <see cref="DateTimeOffsetToUtcTicksConverter"/>.</summary>
public sealed class NullableDateTimeOffsetToUtcTicksConverter : ValueConverter<DateTimeOffset?, long?>
{
    public NullableDateTimeOffsetToUtcTicksConverter()
        : base(
            v => v.HasValue ? v.Value.UtcTicks : (long?)null,
            v => v.HasValue ? new DateTimeOffset(v.Value, TimeSpan.Zero) : (DateTimeOffset?)null)
    {
    }
}

/// <summary>
/// Serialises a <see cref="Dictionary{TKey,TValue}"/> to a single JSON <c>TEXT</c> column.
/// </summary>
/// <remarks>
/// One converter per distinct CLR shape, registered model-wide in
/// <c>AppDbContext.ConfigureConventions</c>. No normalised child tables: nothing in
/// <c>IRepositories.cs</c> queries any of these properties by content, so an index on the
/// contents would never be used. See DATABASE_SCHEMA.md §5.
/// <para>
/// An empty or absent column deserialises to an empty collection rather than null, so callers
/// never have to null-check a round-tripped property.
/// </para>
/// </remarks>
public sealed class StringDictionaryToJsonConverter : ValueConverter<Dictionary<string, string>, string>
{
    public StringDictionaryToJsonConverter()
        : base(
            v => JsonSerializer.Serialize(v),
            v => string.IsNullOrEmpty(v)
                ? new Dictionary<string, string>()
                : JsonSerializer.Deserialize<Dictionary<string, string>>(v) ?? new Dictionary<string, string>())
    {
    }
}

public sealed class DoubleDictionaryToJsonConverter : ValueConverter<Dictionary<string, double>, string>
{
    public DoubleDictionaryToJsonConverter()
        : base(
            v => JsonSerializer.Serialize(v),
            v => string.IsNullOrEmpty(v)
                ? new Dictionary<string, double>()
                : JsonSerializer.Deserialize<Dictionary<string, double>>(v) ?? new Dictionary<string, double>())
    {
    }
}

public sealed class StringListToJsonConverter : ValueConverter<List<string>, string>
{
    public StringListToJsonConverter()
        : base(
            v => JsonSerializer.Serialize(v),
            v => string.IsNullOrEmpty(v)
                ? new List<string>()
                : JsonSerializer.Deserialize<List<string>>(v) ?? new List<string>())
    {
    }
}

public sealed class GuidListToJsonConverter : ValueConverter<List<Guid>, string>
{
    public GuidListToJsonConverter()
        : base(
            v => JsonSerializer.Serialize(v),
            v => string.IsNullOrEmpty(v)
                ? new List<Guid>()
                : JsonSerializer.Deserialize<List<Guid>>(v) ?? new List<Guid>())
    {
    }
}
