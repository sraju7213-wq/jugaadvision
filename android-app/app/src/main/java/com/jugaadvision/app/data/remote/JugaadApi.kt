package com.jugaadvision.app.data.remote

import com.jugaadvision.app.data.remote.dto.GenerateRequestDto
import com.jugaadvision.app.data.remote.dto.GenerateResponseDto
import com.jugaadvision.app.data.remote.dto.HealthResponseDto
import com.jugaadvision.app.data.remote.dto.ModelListResponseDto
import com.jugaadvision.app.data.remote.dto.SettingsProvidersDto
import com.jugaadvision.app.data.remote.dto.VisionRequestDto
import com.jugaadvision.app.data.remote.dto.VisionResponseDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface JugaadApi {
    @POST("ai/generate")
    suspend fun generatePrompt(@Body request: GenerateRequestDto): Response<GenerateResponseDto>

    @POST("ai/vision")
    suspend fun analyzeVision(@Body request: VisionRequestDto): Response<VisionResponseDto>

    @GET("ai/models")
    suspend fun getModels(
        @Query("freeOnly") freeOnly: Boolean = false,
        @Query("task") task: String? = null
    ): Response<ModelListResponseDto>

    @GET("ai/health")
    suspend fun getHealth(): Response<HealthResponseDto>

    @POST("settings/providers")
    suspend fun saveProviders(@Body providers: SettingsProvidersDto): Response<Unit>
}
