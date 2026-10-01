package com.jugaadvision.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class GenerateRequestDto(
    @SerializedName("feature") val feature: String,
    @SerializedName("mode") val mode: String? = null,
    @SerializedName("baseConcept") val baseConcept: String,
    @SerializedName("constraints") val constraints: Map<String, String>? = null,
    @SerializedName("requestedOutput") val requestedOutput: String = "text",
    @SerializedName("preferFree") val preferFree: Boolean = true,
    @SerializedName("preferredProvider") val preferredProvider: String? = null,
    @SerializedName("preferredModel") val preferredModel: String? = null,
    @SerializedName("platform") val platform: String? = null
)

data class GenerateResponseDto(
    @SerializedName("content") val content: String,
    @SerializedName("model") val model: String? = null,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("durationMs") val durationMs: Long = 0,
    @SerializedName("qualityReport") val qualityReport: QualityReportDto? = null
)

data class QualityReportDto(
    @SerializedName("overallScore") val overallScore: Int = 0,
    @SerializedName("grade") val grade: String = "B",
    @SerializedName("strengths") val strengths: List<String> = emptyList(),
    @SerializedName("suggestions") val suggestions: List<QualitySuggestionDto> = emptyList()
)

data class QualitySuggestionDto(
    @SerializedName("title") val title: String,
    @SerializedName("description") val description: String,
    @SerializedName("quickFixModifier") val quickFixModifier: String? = null
)

data class VisionRequestDto(
    @SerializedName("feature") val feature: String = "image_to_prompt",
    @SerializedName("references") val references: List<ImageReferenceDto>,
    @SerializedName("requestedOutput") val requestedOutput: String = "vision"
)

data class ImageReferenceDto(
    @SerializedName("base64") val base64: String,
    @SerializedName("mimeType") val mimeType: String,
    @SerializedName("role") val role: String? = null
)

data class VisionResponseDto(
    @SerializedName("content") val content: String,
    @SerializedName("model") val model: String? = null,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("parsedJson") val parsedJson: VisionAnalysisDto? = null
)

data class VisionAnalysisDto(
    @SerializedName("prompt") val prompt: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("colorPalette") val colorPalette: List<String> = emptyList(),
    @SerializedName("composition") val composition: String? = null,
    @SerializedName("artisticStyle") val artisticStyle: String? = null,
    @SerializedName("lighting") val lighting: String? = null,
    @SerializedName("cameraSettings") val cameraSettings: String? = null
)

data class ModelDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("provider") val provider: String,
    @SerializedName("isFree") val isFree: Boolean = false,
    @SerializedName("capabilities") val capabilities: List<String> = emptyList(),
    @SerializedName("healthy") val healthy: Boolean = true
)

data class ModelListResponseDto(
    @SerializedName("models") val models: List<ModelDto> = emptyList()
)

data class HealthResponseDto(
    @SerializedName("providers") val providers: List<ProviderHealthDto> = emptyList()
)

data class ProviderHealthDto(
    @SerializedName("provider") val provider: String,
    @SerializedName("status") val status: String,
    @SerializedName("modelCount") val modelCount: Int = 0,
    @SerializedName("healthy") val healthy: Boolean = false
)

data class SettingsProvidersDto(
    @SerializedName("openrouter") val openrouter: String? = null,
    @SerializedName("nim") val nim: String? = null,
    @SerializedName("huggingface") val huggingface: String? = null,
    @SerializedName("cloudflare") val cloudflare: String? = null
)
