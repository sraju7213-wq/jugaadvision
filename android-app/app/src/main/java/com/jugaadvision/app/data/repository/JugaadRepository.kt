package com.jugaadvision.app.data.repository

import com.jugaadvision.app.data.models.ApiResult
import com.jugaadvision.app.data.models.GenerateRequest
import com.jugaadvision.app.data.models.ModelInfo
import com.jugaadvision.app.data.models.Platform
import com.jugaadvision.app.data.models.PromptRecord
import com.jugaadvision.app.data.models.ProviderHealth
import com.jugaadvision.app.data.models.QualityReport
import com.jugaadvision.app.data.models.QualitySuggestion
import com.jugaadvision.app.data.models.VisionRequest
import com.jugaadvision.app.data.models.VisionAnalysis
import com.jugaadvision.app.data.remote.JugaadApi
import com.jugaadvision.app.data.remote.dto.GenerateRequestDto
import com.jugaadvision.app.data.remote.dto.ImageReferenceDto
import com.jugaadvision.app.data.remote.dto.SettingsProvidersDto
import com.jugaadvision.app.data.remote.dto.VisionRequestDto
import java.util.UUID

class JugaadRepository(private val api: JugaadApi) {

    private val savedPrompts = mutableListOf<PromptRecord>()

    suspend fun generatePrompt(request: GenerateRequest): ApiResult<Pair<String, QualityReport?>> {
        return try {
            val dto = GenerateRequestDto(
                feature = request.feature.apiValue,
                baseConcept = request.baseConcept,
                constraints = request.constraints,
                platform = request.platform.apiValue,
                preferFree = request.preferFree,
                preferredProvider = request.preferredProvider,
                preferredModel = request.preferredModel
            )
            val response = api.generatePrompt(dto)
            if (response.isSuccessful) {
                val body = response.body()!!
                val quality = body.qualityReport?.let { qr ->
                    QualityReport(
                        overallScore = qr.overallScore,
                        grade = qr.grade,
                        strengths = qr.strengths,
                        suggestions = qr.suggestions.map {
                            QualitySuggestion(it.title, it.description, it.quickFixModifier)
                        }
                    )
                }
                ApiResult(success = true, data = body.content to quality)
            } else {
                ApiResult(success = false, error = "Server error: ${response.code()}")
            }
        } catch (e: Exception) {
            ApiResult(success = false, error = e.message ?: "Network error")
        }
    }

    suspend fun analyzeVision(request: VisionRequest): ApiResult<VisionAnalysis> {
        return try {
            val dto = VisionRequestDto(
                references = listOf(
                    ImageReferenceDto(
                        base64 = request.base64Image,
                        mimeType = request.mimeType
                    )
                )
            )
            val response = api.analyzeVision(dto)
            if (response.isSuccessful) {
                val body = response.body()!!
                val parsed = body.parsedJson
                val analysis = VisionAnalysis(
                    prompt = parsed?.prompt ?: body.content,
                    description = parsed?.description,
                    colorPalette = parsed?.colorPalette ?: emptyList(),
                    composition = parsed?.composition,
                    artisticStyle = parsed?.artisticStyle,
                    lighting = parsed?.lighting,
                    cameraSettings = parsed?.cameraSettings
                )
                ApiResult(success = true, data = analysis)
            } else {
                ApiResult(success = false, error = "Server error: ${response.code()}")
            }
        } catch (e: Exception) {
            ApiResult(success = false, error = e.message ?: "Network error")
        }
    }

    suspend fun getModels(freeOnly: Boolean = false): ApiResult<List<ModelInfo>> {
        return try {
            val response = api.getModels(freeOnly = freeOnly)
            if (response.isSuccessful) {
                val models = response.body()!!.models.map {
                    ModelInfo(
                        id = it.id,
                        name = it.name,
                        provider = it.provider,
                        isFree = it.isFree,
                        capabilities = it.capabilities,
                        isHealthy = it.healthy
                    )
                }
                ApiResult(success = true, data = models)
            } else {
                ApiResult(success = false, error = "Server error: ${response.code()}")
            }
        } catch (e: Exception) {
            ApiResult(success = false, error = e.message ?: "Network error")
        }
    }

    suspend fun getHealth(): ApiResult<List<ProviderHealth>> {
        return try {
            val response = api.getHealth()
            if (response.isSuccessful) {
                val providers = response.body()!!.providers.map {
                    ProviderHealth(
                        provider = it.provider,
                        status = it.status,
                        modelCount = it.modelCount,
                        isHealthy = it.healthy
                    )
                }
                ApiResult(success = true, data = providers)
            } else {
                ApiResult(success = false, error = "Server error: ${response.code()}")
            }
        } catch (e: Exception) {
            ApiResult(success = false, error = e.message ?: "Network error")
        }
    }

    suspend fun saveProviders(
        openrouter: String?,
        nim: String?,
        huggingface: String?,
        cloudflare: String?
    ): ApiResult<Unit> {
        return try {
            val dto = SettingsProvidersDto(openrouter, nim, huggingface, cloudflare)
            val response = api.saveProviders(dto)
            if (response.isSuccessful) {
                ApiResult(success = true, data = Unit)
            } else {
                ApiResult(success = false, error = "Server error: ${response.code()}")
            }
        } catch (e: Exception) {
            ApiResult(success = false, error = e.message ?: "Network error")
        }
    }

    fun savePrompt(prompt: PromptRecord) {
        savedPrompts.add(0, prompt)
    }

    fun getSavedPrompts(): List<PromptRecord> = savedPrompts.toList()

    fun createPromptRecord(
        text: String,
        platform: Platform,
        title: String? = null,
        tags: List<String> = emptyList(),
        qualityScore: Int? = null,
        qualityGrade: String? = null,
        model: String? = null
    ): PromptRecord {
        return PromptRecord(
            id = UUID.randomUUID().toString(),
            text = text,
            title = title,
            platform = platform,
            tags = tags,
            createdAt = System.currentTimeMillis().toString(),
            qualityScore = qualityScore,
            qualityGrade = qualityGrade,
            model = model
        )
    }
}
