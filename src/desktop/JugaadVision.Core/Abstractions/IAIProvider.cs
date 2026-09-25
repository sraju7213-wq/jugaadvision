using JugaadVision.Core.Generation;
using JugaadVision.Core.Models;

namespace JugaadVision.Core.Abstractions;

/// <summary>
/// A cloud AI backend (spec §4.2 / §17). One implementation per provider; the router selects
/// among them by cost, availability, and user preference.
/// </summary>
/// <remarks>
/// Implementations live in <c>JugaadVision.AI</c>. Failures are returned as
/// <see cref="AIResponse.Succeeded"/> = false rather than thrown, so the router can fall back
/// without exception-driven control flow. Exceptions are reserved for programming errors and
/// <see cref="OperationCanceledException"/>, which always propagates.
/// </remarks>
public interface IAIProvider
{
    /// <summary>Stable provider key used in configuration and DI, e.g. "openrouter".</summary>
    string Name { get; }

    /// <summary>True when a usable credential is resolvable. Never performs I/O.</summary>
    bool IsConfigured();

    /// <summary>Lists the models this provider can serve (UC-01).</summary>
    Task<IReadOnlyList<AIModel>> DiscoverModelsAsync(CancellationToken ct);

    /// <summary>Runs one generation (UC-02 local, UC-03 cloud).</summary>
    Task<AIResponse> GenerateAsync(GenerationRequest request, CancellationToken ct);

    /// <summary>Verifies the credential and reachability. Returns false rather than throwing on failure.</summary>
    Task<bool> TestConnectionAsync(CancellationToken ct);
}
