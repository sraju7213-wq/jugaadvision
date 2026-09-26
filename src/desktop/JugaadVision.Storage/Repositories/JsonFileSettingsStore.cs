using System.Text.Json;
using System.Text.Json.Serialization;
using JugaadVision.Core.Abstractions;
using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace JugaadVision.Storage.Repositories;

/// <summary>
/// File-backed settings store.
/// </summary>
/// <remarks>
/// Settings live as a single JSON document in the XDG config directory rather than in SQLite.
/// That is deliberate: PRODUCT_SPEC §33 enumerates eight settings sections that will grow, and
/// a document means adding a section needs no migration at all. <see cref="AppSettings.SchemaVersion"/>
/// drives in-place upgrades. Writes are atomic via a temp file plus rename, so a crash mid-save
/// cannot leave a truncated settings file that would reset the user's configuration.
/// </remarks>
public sealed class JsonFileSettingsStore : ISettingsStore
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly string _path;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public JsonFileSettingsStore(string? path = null)
    {
        _path = path ?? ResolveDefaultPath();
    }

    /// <summary>Default location: <c>$XDG_CONFIG_HOME/jugaadvision/settings.json</c>.</summary>
    public static string ResolveDefaultPath()
    {
        var configHome = Environment.GetEnvironmentVariable("XDG_CONFIG_HOME");

        var root = !string.IsNullOrWhiteSpace(configHome)
            ? configHome
            : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".config");

        var directory = Path.Combine(root, "jugaadvision");
        Directory.CreateDirectory(directory);

        return Path.Combine(directory, "settings.json");
    }

    public async Task<AppSettings> LoadAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (!File.Exists(_path))
            {
                return new AppSettings();
            }

            var json = await File.ReadAllTextAsync(_path, ct).ConfigureAwait(false);

            if (string.IsNullOrWhiteSpace(json))
            {
                return new AppSettings();
            }

            var settings = JsonSerializer.Deserialize<AppSettings>(json, SerializerOptions);
            return settings ?? new AppSettings();
        }
        catch (JsonException)
        {
            // A corrupt settings file must not prevent the app from starting. Falling back to
            // defaults loses preferences but loses nothing the user cannot re-enter.
            return new AppSettings();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveAsync(AppSettings settings, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(settings);

        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var directory = Path.GetDirectoryName(_path);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var json = JsonSerializer.Serialize(settings, SerializerOptions);

            // Write-then-rename: atomic on POSIX, so a crash cannot truncate the settings.
            var temp = _path + ".tmp";
            await File.WriteAllTextAsync(temp, json, ct).ConfigureAwait(false);
            File.Move(temp, _path, overwrite: true);
        }
        finally
        {
            _gate.Release();
        }
    }
}
