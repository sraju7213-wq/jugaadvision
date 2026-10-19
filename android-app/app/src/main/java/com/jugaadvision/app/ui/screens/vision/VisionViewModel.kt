package com.jugaadvision.app.ui.screens.vision

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.jugaadvision.app.JugaadVisionApp
import com.jugaadvision.app.data.models.VisionAnalysis
import com.jugaadvision.app.data.models.VisionRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class VisionUiState(
    val imageUri: Uri? = null,
    val base64Image: String = "",
    val isAnalyzing: Boolean = false,
    val result: VisionAnalysis? = null,
    val error: String? = null
)

class VisionViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(VisionUiState())
    val state = _state.asStateFlow()

    fun setImage(uri: Uri, base64: String) {
        _state.value = _state.value.copy(
            imageUri = uri,
            base64Image = base64,
            result = null,
            error = null
        )
    }

    fun analyze() {
        if (_state.value.base64Image.isBlank()) {
            _state.value = _state.value.copy(error = "Please select an image first")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isAnalyzing = true, error = null, result = null)
            val request = VisionRequest(base64Image = _state.value.base64Image)
            val result = JugaadVisionApp.repository.analyzeVision(request)
            if (result.success && result.data != null) {
                _state.value = _state.value.copy(
                    isAnalyzing = false,
                    result = result.data
                )
            } else {
                _state.value = _state.value.copy(
                    isAnalyzing = false,
                    error = result.error ?: "Analysis failed"
                )
            }
        }
    }
}
