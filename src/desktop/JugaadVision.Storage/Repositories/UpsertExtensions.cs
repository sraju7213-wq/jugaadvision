using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace JugaadVision.Storage.Repositories;

/// <summary>
/// Helpers for the upsert pattern used by every repository.
/// </summary>
internal static class UpsertExtensions
{
    /// <summary>
    /// Copies the mutable properties of <paramref name="source"/> onto a tracked entity, leaving
    /// the primary key alone.
    /// </summary>
    /// <remarks>
    /// Plain <c>CurrentValues.SetValues(source)</c> copies the primary key too, which throws
    /// when the source is matched to an existing row by something other than its own id. That
    /// is exactly the case for <see cref="Core.Models.ProviderConfig"/>, which is upserted by
    /// <c>ProviderKey</c>: the caller's instance carries a fresh <c>Id</c>, EF tries to change
    /// the key of an existing row, and fails with <c>"The property 'ProviderConfig.Id' is part
    /// of a key and so cannot be modified"</c>. Skipping the key keeps the row's identity
    /// stable, which is the whole point of an upsert.
    /// <para>
    /// Properties are assigned one by one rather than through a <c>SetValues</c> overload with
    /// a filter: no such overload exists in EF Core 10, and this form works across versions. It
    /// also leaves <paramref name="source"/> untouched, which a fix-up-the-key approach would not.
    /// </para>
    /// </remarks>
    public static void SetValuesExceptKey<TEntity>(this EntityEntry<TEntity> entry, TEntity source)
        where TEntity : class
    {
        ArgumentNullException.ThrowIfNull(source);

        var primaryKey = entry.Metadata.FindPrimaryKey();

        if (primaryKey is null)
        {
            entry.CurrentValues.SetValues(source);
            return;
        }

        var keyNames = primaryKey.Properties
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var property in entry.Properties)
        {
            if (keyNames.Contains(property.Metadata.Name))
            {
                continue;
            }

            MemberInfo? clrMember = (MemberInfo?)property.Metadata.PropertyInfo ?? property.Metadata.FieldInfo;
            if (clrMember is null)
            {
                continue;
            }

            var value = clrMember switch
            {
                PropertyInfo p => p.GetValue(source),
                FieldInfo f => f.GetValue(source),
                _ => null,
            };

            property.CurrentValue = value;
        }
    }
}
