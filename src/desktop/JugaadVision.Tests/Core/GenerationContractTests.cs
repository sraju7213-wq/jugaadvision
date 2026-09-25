using JugaadVision.Core.Abstractions;
using JugaadVision.Core.Enums;
using JugaadVision.Core.Generation;
using JugaadVision.Core.Models;

namespace JugaadVision.Tests.Core;

/// <summary>Covers the generation/load contracts, including the failure paths the router relies on.</summary>
public sealed class GenerationContractTests
{
    [Fact]
    public void SuccessResponse_IsMarkedSucceededAndCarriesUsage()
    {
        var response = AIResponse.Success(
            text: "hello",
            promptTokens: 12,
            completionTokens: 30,
            costUsd: 0.002m);

        Assert.True(response.Succeeded);
        Assert.Equal("hello", response.Text);
        Assert.Equal(30, response.CompletionTokens);
        Assert.Equal(0.002m, response.CostUsd);
    }

    [Fact]
    public void FailureResponse_IsNotRetryableByDefault()
    {
        var response = AIResponse.Failure("bad request", "invalid_request");

        Assert.False(response.Succeeded);
        Assert.False(response.IsRetryable);
        Assert.Equal("invalid_request", response.ErrorCode);
    }

    [Fact]
    public void FailureResponse_CanBeMarkedRetryable_ForRouterFallback()
    {
        var response = AIResponse.Failure("rate limited", "rate_limited", isRetryable: true);

        Assert.True(response.IsRetryable);
    }

    [Fact]
    public void LoadProgress_ClampsFractionIntoRange()
    {
        Assert.Equal(1d, LoadProgress.FromFraction(4.2, "load", "over").Fraction, precision: 6);
        Assert.Equal(0d, LoadProgress.FromFraction(-1d, "load", "under").Fraction, precision: 6);
    }

    [Fact]
    public void SuccessfulLoadResult_CarriesTheResidentHandle()
    {
        var model = new LoadedModel
        {
            ModelId = Guid.NewGuid(),
            Handle = "h1",
            RuntimeName = "llamacpp",
            MemoryBytes = 4_000_000_000,
        };

        var result = LoadResult.Success(model);

        Assert.True(result.Succeeded);
        Assert.Same(model, result.Model);
        Assert.Equal(4_000_000_000L, result.MemoryBytes);
    }

    [Fact]
    public void FailedLoadResult_HasNoHandle()
    {
        var result = LoadResult.Failure("out of memory");

        Assert.False(result.Succeeded);
        Assert.Null(result.Model);
    }

    [Fact]
    public void Request_IsStreamable_OnlyWhenParametersAskForIt()
    {
        var blocking = new GenerationRequest
        {
            ModelId = Guid.NewGuid(),
            ModelName = "m",
            Prompt = "p",
            Parameters = new GenerationParameters { Stream = false },
        };

        var streaming = blocking with { Parameters = new GenerationParameters { Stream = true } };

        Assert.False(blocking.Stream);
        Assert.True(streaming.Stream);
    }
}
