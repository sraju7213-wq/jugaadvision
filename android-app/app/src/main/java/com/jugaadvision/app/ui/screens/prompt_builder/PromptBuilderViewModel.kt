package com.jugaadvision.app.ui.screens.prompt_builder

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.jugaadvision.app.JugaadVisionApp
import com.jugaadvision.app.data.models.GenerateRequest
import com.jugaadvision.app.data.models.Platform
import com.jugaadvision.app.data.models.QualityReport
import com.jugaadvision.app.data.models.WorkflowFeature
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PromptBuilderUiState(
    val selectedPlatform: Platform = Platform.MIDJOURNEY,
    val baseConcept: String = "",
    val isGenerating: Boolean = false,
    val result: String = "",
    val qualityReport: QualityReport? = null,
    val error: String? = null,
    val savedToLibrary: Boolean = false
)

class PromptBuilderViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(PromptBuilderUiState())
    val state = _state.asStateFlow()

    fun selectPlatform(platform: Platform) {
        _state.value = _state.value.copy(selectedPlatform = platform)
    }

    fun updateConcept(text: String) {
        _state.value = _state.value.copy(baseConcept = text)
    }

    fun generate() {
        val concept = _state.value.baseConcept.trim()
        if (concept.isBlank()) {
            _state.value = _state.value.copy(error = "Please enter a base concept")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isGenerating = true, error = null, result = "")
            val request = GenerateRequest(
                feature = WorkflowFeature.PROMPT_BUILDER,
                platform = _state.value.selectedPlatform,
                baseConcept = concept,
                preferFree = true
            )
            val result = JugaadVisionApp.repository.generatePrompt(request)
            if (result.success && result.data != null) {
                val (content, quality) = result.data
                _state.value = _state.value.copy(
                    isGenerating = false,
                    result = content,
                    qualityReport = quality,
                    savedToLibrary = false
                )
            } else {
                _state.value = _state.value.copy(
                    isGenerating = false,
                    error = result.error ?: "Generation failed"
                )
            }
        }
    }

    fun saveToLibrary() {
        val current = _state.value
        if (current.result.isBlank()) return
        val record = JugaadVisionApp.repository.createPromptRecord(
            text = current.result,
            platform = current.selectedPlatform,
            title = current.baseConcept.take(50),
            qualityScore = current.qualityReport?.overallScore,
            qualityGrade = current.qualityReport?.grade
        )
        JugaadVisionApp.repository.savePrompt(record)
        _state.value = _state.value.copy(savedToLibrary = true)
    }
}
