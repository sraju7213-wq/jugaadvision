package com.jugaadvision.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.jugaadvision.app.ui.navigation.JugaadNavHost
import com.jugaadvision.app.ui.theme.JugaadVisionTheme
import com.jugaadvision.app.ui.theme.ThemeViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val themeViewModel = ThemeViewModel(application)
            val themeMode = themeViewModel.themeMode.collectAsState()
            JugaadVisionTheme(themeMode = themeMode.value) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    JugaadNavHost()
                }
            }
        }
    }
}
