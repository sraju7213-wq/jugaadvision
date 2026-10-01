package com.jugaadvision.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.jugaadvision.app.ui.screens.home.HomeScreen
import com.jugaadvision.app.ui.screens.library.LibraryScreen
import com.jugaadvision.app.ui.screens.prompt_builder.PromptBuilderScreen
import com.jugaadvision.app.ui.screens.settings.SettingsScreen
import com.jugaadvision.app.ui.screens.vision.VisionScreen

@Composable
fun JugaadNavHost() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar {
                bottomNavItems.forEach { item ->
                    val selected = currentRoute == item.route ||
                        backStackEntry?.destination?.hierarchy?.any { it.route == item.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().route!!) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = JugaadRoute.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(JugaadRoute.Home.route) {
                HomeScreen(
                    onNavigateToBuilder = { navController.navigate(JugaadRoute.PromptBuilder.route) },
                    onNavigateToVision = { navController.navigate(JugaadRoute.Vision.route) },
                    onNavigateToLibrary = { navController.navigate(JugaadRoute.Library.route) }
                )
            }
            composable(JugaadRoute.PromptBuilder.route) {
                PromptBuilderScreen()
            }
            composable(JugaadRoute.Vision.route) {
                VisionScreen()
            }
            composable(JugaadRoute.Library.route) {
                LibraryScreen()
            }
            composable(JugaadRoute.Settings.route) {
                SettingsScreen()
            }
        }
    }
}
