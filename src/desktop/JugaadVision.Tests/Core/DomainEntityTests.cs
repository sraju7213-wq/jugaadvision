using JugaadVision.Core.Enums;
using JugaadVision.Core.Models;

namespace JugaadVision.Tests.Core;

/// <summary>Covers the derived/domain logic on the spec §4.1 entities.</summary>
public sealed class ModelFileTests
{
    [Fact]
    public void DownloadProgress_IsZero_WhenTotalSizeUnknown()
    {
        var file = new ModelFile { TotalBytes = 0, DownloadedBytes = 500 };

        Assert.Equal(0d, file.DownloadProgress);
    }

    [Fact]
    public void DownloadProgress_IsFractionOfTotal()
    {
        var file = new ModelFile { TotalBytes = 200, DownloadedBytes = 50 };

        Assert.Equal(0.25d, file.DownloadProgress, precision: 6);
    }

    [Theory]
    [InlineData(250, 100, 1d)]  // more bytes than expected must not exceed 1
    [InlineData(-5, 100, 0d)]   // a negative counter must not go below 0
    public void DownloadProgress_IsClamped(long downloaded, long total, double expected)
    {
        var file = new ModelFile { TotalBytes = total, DownloadedBytes = downloaded };

        Assert.Equal(expected, file.DownloadProgress, precision: 6);
    }
}

public sealed class AIModelTests
{
    [Fact]
    public void InstalledLocalModel_IsLocallyExecutable()
    {
        var model = new AIModel { Source = ModelSource.Local, State = ModelState.Installed };

        Assert.True(model.IsLocallyExecutable);
    }

    [Theory]
    [InlineData(ModelSource.Local, ModelState.Downloading)]
    [InlineData(ModelSource.HuggingFace, ModelState.Installed)]
    public void NonInstalledLocalModel_IsNotLocallyExecutable(ModelSource source, ModelState state)
    {
        var model = new AIModel { Source = source, State = state };

        Assert.False(model.IsLocallyExecutable);
    }

    [Fact]
    public void PaidCloudModel_RequiresCredential()
    {
        var model = new AIModel { Source = ModelSource.OpenAICompatible, Tier = ModelTier.Paid };

        Assert.True(model.RequiresCredential);
    }

    [Fact]
    public void LocalModel_DoesNotRequireCredential()
    {
        var model = new AIModel { Source = ModelSource.Local, Tier = ModelTier.SelfHosted };

        Assert.False(model.RequiresCredential);
    }
}

public sealed class BackgroundTaskTests
{
    [Theory]
    [InlineData(TaskState.Succeeded, true, false)]
    [InlineData(TaskState.Canceled, true, false)]
    [InlineData(TaskState.Running, false, false)]
    [InlineData(TaskState.Paused, false, true)]
    [InlineData(TaskState.Failed, false, true)]
    public void TaskState_MapsToTerminalAndResumable(TaskState state, bool terminal, bool resumable)
    {
        var task = new BackgroundTask { State = state, AttemptCount = 1 };

        Assert.Equal(terminal, task.IsTerminal);
        Assert.Equal(resumable, task.IsResumable);
    }

    [Fact]
    public void RepeatedlyFailedTask_StopsBeingOfferedAsResumable()
    {
        var task = new BackgroundTask { State = TaskState.Failed, AttemptCount = 5 };

        Assert.False(task.IsResumable);
    }
}

public sealed class AppSettingsTests
{
    [Fact]
    public void Defaults_MatchTheProductDarkTheme()
    {
        var settings = new AppSettings();

        Assert.Equal("dark", settings.General.Theme);
        Assert.Equal("#3DDC84", settings.General.AccentColor);
    }

    [Fact]
    public void Defaults_AreOfflineSafeAndPrivacyConservative()
    {
        var settings = new AppSettings();

        // No telemetry exists in the MVP, so the switch must default off.
        Assert.False(settings.Privacy.AllowTelemetry);

        // Generation parameters match the documented defaults.
        Assert.Equal(0.7d, settings.Generation.DefaultTemperature, precision: 6);
        Assert.Equal(3, settings.Generation.MaxRetries);

        // A model is never loaded into an OOM without warning.
        Assert.True(settings.Hardware.PreflightMemory);
    }
}
