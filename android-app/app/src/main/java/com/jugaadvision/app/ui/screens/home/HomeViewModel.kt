package com.jugaadvision.app.ui.screens.home

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.jugaadvision.app.JugaadVisionApp
import com.jugaadvision.app.data.models.ProviderHealth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val isLoading: Boolean = false,
    val providers: List<ProviderHealth> = emptyList(),
    val savedPromptCount: Int = 0,
    val error: String? = null
)

class HomeViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(HomeUiState())
    val state = _state.asStateFlow()

    init {
        loadHealth()
        refreshPromptCount()
    }

    fun loadHealth() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = JugaadVisionApp.repository.getHealth()
            if (result.success) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    providers = result.data ?: emptyList()
                )
            } else {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = result.error
                )
            }
        }
    }

    fun refreshPromptCount() {
        _state.value = _state.value.copy(
            savedPromptCount = JugaadVisionApp.repository.getSavedPrompts().size
        )
    }
}
