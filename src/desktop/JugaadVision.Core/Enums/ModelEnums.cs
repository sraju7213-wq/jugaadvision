namespace JugaadVision.Core.Enums;

/// <summary>Serialisation format of a model file on disk.</summary>
public enum ModelFormat
{
    Unknown = 0,
    Gguf = 1,
    Onnx = 2,
    SafeTensors = 3,
    TorchScript = 4,
    Caffe = 5,
    ONNXRuntime = 6,
    Xml = 7,
    Bin = 8,
    KvCache = 9,
}

/// <summary>What a model actually does. Drives which runtime and which workspace can use it.</summary>
public enum ModelKind
{
    Unknown = 0,
    TextGeneration = 1,
    ImageGeneration = 2,
    AudioGeneration = 3,
    Embedding = 4,
    Vision = 5,
    Classification = 6,
    Upscale = 7,
}

/// <summary>Where a model record came from, and therefore how it is executed.</summary>
public enum ModelSource
{
    Unknown = 0,

    /// <summary>A model file physically present on this machine.</summary>
    Local = 1,

    /// <summary>Discovered through the HuggingFace Hub API.</summary>
    HuggingFace = 2,

    /// <summary>Served by a local Ollama daemon.</summary>
    Ollama = 3,

    /// <summary>Any OpenAI-compatible /chat/completions endpoint.</summary>
    OpenAICompatible = 4,

    /// <summary>A user-supplied provider with a custom base URL.</summary>
    Custom = 5,
}

/// <summary>Cost class of a model. Drives router preference and the cost estimate shown before a run.</summary>
public enum ModelTier
{
    Unknown = 0,
    Free = 1,
    Paid = 2,
    SelfHosted = 3,
    Enterprise = 4,
}

/// <summary>Lifecycle state of a model, from discovery through to removal.</summary>
/// <remarks>Mirrors MODEL_SYSTEM.md: discover → download → install → manage.</remarks>
public enum ModelState
{
    /// <summary>Seen in a catalogue but not present locally.</summary>
    Discovered = 0,

    /// <summary>Bytes are being fetched.</summary>
    Downloading = 1,

    /// <summary>Download halted, resumable from the recorded offset.</summary>
    Paused = 2,

    /// <summary>Present on disk and loadable by a runtime.</summary>
    Installed = 3,

    /// <summary>Terminal failure; the reason is recorded on the entity.</summary>
    Failed = 4,

    /// <summary>Uninstalled, with a retained record for history.</summary>
    Removed = 5,
}
