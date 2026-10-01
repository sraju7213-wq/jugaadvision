package com.jugaadvision.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class JugaadRoute(val route: String, val label: String, val icon: ImageVector) {
    data object Home : JugaadRoute("home", "Home", Icons.Filled.Home)
    data object PromptBuilder : JugaadRoute("prompt_builder", "Builder", Icons.Filled.AddCircle)
    data object Vision : JugaadRoute("vision", "Vision", Icons.Filled.PhotoCamera)
    data object Library : JugaadRoute("library", "Library", Icons.Filled.Collections)
    data object Settings : JugaadRoute("settings", "Settings", Icons.Filled.Settings)
}

val bottomNavItems = listOf(
    JugaadRoute.Home,
    JugaadRoute.PromptBuilder,
    JugaadRoute.Vision,
    JugaadRoute.Library,
    JugaadRoute.Settings
)
