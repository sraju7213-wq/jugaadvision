package com.jugaadvision.app.data.models

enum class Platform(val displayName: String, val apiValue: String) {
    NATURAL("Natural Language", "natural"),
    MIDJOURNEY("Midjourney v6.1", "midjourney"),
    FLUX("Flux AI Pro", "flux"),
    SDXL("SDXL", "sdxl"),
    DALLE3("DALL-E 3", "dalle3"),
    VIDEO_AI("Video AI (Runway/Kling)", "video");

    companion object {
        fun fromApiValue(value: String?): Platform =
            entries.find { it.apiValue == value } ?: NATURAL
    }
}

enum class WorkflowFeature(val apiValue: String) {
    PROMPT_BUILDER("prompt_builder"),
    IMAGE_TO_PROMPT("image_to_prompt"),
    CREATIVE_MIXER("creative_mixer"),
    BATCH_GENERATOR("batch_generator"),
    PRO_PROMPTER("pro_prompter"),
    STUDIO("studio")
}

data class PromptRecord(
    val id: String,
    val text: String,
    val title: String? = null,
    val platform: Platform = Platform.NATURAL,
    val tags: List<String> = emptyList(),
    val createdAt: String = "",
    val updatedAt: String? = null,
    val imageUrl: String? = null,
    val negativePrompt: String? = null,
    val sourceFeature: WorkflowFeature? = null,
    val model: String? = null,
    val qualityScore: Int? = null,
    val qualityGrade: String? = null
)

data class QualityReport(
    val overallScore: Int,
    val grade: String,
    val strengths: List<String> = emptyList(),
    val suggestions: List<QualitySuggestion> = emptyList()
)

data class QualitySuggestion(
    val title: String,
    val description: String,
    val quickFixModifier: String? = null
)

data class GenerateRequest(
    val feature: WorkflowFeature = WorkflowFeature.PROMPT_BUILDER,
    val platform: Platform = Platform.NATURAL,
    val baseConcept: String,
    val constraints: Map<String, String> = emptyMap(),
    val preferFree: Boolean = true,
    val preferredProvider: String? = null,
    val preferredModel: String? = null
)

data class VisionRequest(
    val base64Image: String,
    val mimeType: String = "image/jpeg",
    val feature: WorkflowFeature = WorkflowFeature.IMAGE_TO_PROMPT
)

data class ModelInfo(
    val id: String,
    val name: String,
    val provider: String,
    val isFree: Boolean = false,
    val capabilities: List<String> = emptyList(),
    val isHealthy: Boolean = true
)

data class ProviderHealth(
    val provider: String,
    val status: String,
    val modelCount: Int = 0,
    val isHealthy: Boolean = false
)

data class VisionAnalysis(
    val prompt: String,
    val description: String? = null,
    val colorPalette: List<String> = emptyList(),
    val composition: String? = null,
    val artisticStyle: String? = null,
    val lighting: String? = null,
    val cameraSettings: String? = null
)

data class ApiResult<T>(
    val success: Boolean,
    val data: T? = null,
    val error: String? = null
)
