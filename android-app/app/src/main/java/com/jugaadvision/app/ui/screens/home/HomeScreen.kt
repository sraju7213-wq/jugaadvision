package com.jugaadvision.app.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jugaadvision.app.ui.components.ErrorMessage
import com.jugaadvision.app.ui.components.LoadingBar
import com.jugaadvision.app.ui.components.SectionHeader
import com.jugaadvision.app.ui.components.StatCard
import com.jugaadvision.app.ui.theme.ErrorRed
import com.jugaadvision.app.ui.theme.IndigoPrimary
import com.jugaadvision.app.ui.theme.PinkAccent
import com.jugaadvision.app.ui.theme.SuccessGreen
import com.jugaadvision.app.ui.theme.TealAccent
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun HomeScreen(
    onNavigateToBuilder: () -> Unit,
    onNavigateToVision: () -> Unit,
    onNavigateToLibrary: () -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val state = viewModel.state.collectAsState().value

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        BrandHeader()
        Spacer(Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                title = "Saved Prompts",
                value = state.savedPromptCount.toString(),
                icon = { Icon(Icons.Filled.Collections, null, tint = IndigoPrimary) },
                modifier = Modifier.weight(1f),
                accentColor = IndigoPrimary
            )
            StatCard(
                title = "Providers",
                value = state.providers.count { it.isHealthy }.toString(),
                icon = { Icon(Icons.Filled.AutoAwesome, null, tint = SuccessGreen) },
                modifier = Modifier.weight(1f),
                accentColor = SuccessGreen
            )
        }

        Spacer(Modifier.height(28.dp))

        SectionHeader(title = "Quick Actions")
        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            QuickActionCard(
                title = "Build Prompt",
                subtitle = "AI-powered\nprompt builder",
                icon = Icons.Filled.AddCircle,
                color = IndigoPrimary,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToBuilder
            )
            QuickActionCard(
                title = "Analyze Image",
                subtitle = "Image-to-prompt\nvision analysis",
                icon = Icons.Filled.PhotoCamera,
                color = TealAccent,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToVision
            )
        }

        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            QuickActionCard(
                title = "Library",
                subtitle = "Browse saved\nprompts",
                icon = Icons.Filled.Collections,
                color = PinkAccent,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToLibrary
            )
            QuickActionCard(
                title = "Mix Ideas",
                subtitle = "Creative\nconcept mixer",
                icon = Icons.Filled.AutoAwesome,
                color = IndigoPrimary,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToBuilder
            )
        }

        Spacer(Modifier.height(28.dp))

        SectionHeader(title = "Model Status")
        Spacer(Modifier.height(12.dp))

        if (state.isLoading) {
            LoadingBar()
        } else if (state.error != null) {
            ErrorMessage(message = state.error)
        } else if (state.providers.isEmpty()) {
            Text(
                text = "No provider data available",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            state.providers.forEach { provider ->
                ProviderStatusRow(provider)
                Spacer(Modifier.height(8.dp))
            }
        }

        Spacer(Modifier.height(24.dp))

        AboutFooter()
    }
}

@Composable
private fun BrandHeader() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = IndigoPrimary
    ) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text(
                text = "JugaadVision",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Smart AI Creative Studio",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.85f)
            )
        }
    }
}

@Composable
private fun QuickActionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.height(140.dp),
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = color, modifier = Modifier.size(22.dp))
            }
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ProviderStatusRow(provider: ProviderHealth) {
    val statusColor = if (provider.isHealthy) SuccessGreen else ErrorRed
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(statusColor)
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = provider.provider.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${provider.modelCount} models • ${provider.status}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun AboutFooter() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Created by Raju Sheikh",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "@depressed_4rtist  •  @Kreative.ai",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}


