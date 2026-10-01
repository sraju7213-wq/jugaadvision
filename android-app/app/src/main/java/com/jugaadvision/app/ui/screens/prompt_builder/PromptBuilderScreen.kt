package com.jugaadvision.app.ui.screens.prompt_builder

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jugaadvision.app.data.models.Platform
import com.jugaadvision.app.ui.components.ErrorMessage
import com.jugaadvision.app.ui.components.LoadingBar
import com.jugaadvision.app.ui.components.QualityScoreBadge
import com.jugaadvision.app.ui.components.SectionHeader
import com.jugaadvision.app.ui.theme.IndigoPrimary

@Composable
fun PromptBuilderScreen(
    viewModel: PromptBuilderViewModel = viewModel()
) {
    val state = viewModel.state.collectAsState().value
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Text(
            text = "Prompt Builder",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "AI-powered prompt engineering for any platform",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(24.dp))

        SectionHeader(title = "Platform")
        Spacer(Modifier.height(12.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Platform.entries.forEach { platform ->
                FilterChip(
                    selected = state.selectedPlatform == platform,
                    onClick = { viewModel.selectPlatform(platform) },
                    label = { Text(platform.displayName) }
                )
            }
        }

        Spacer(Modifier.height(24.dp))

        SectionHeader(title = "Base Concept")
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = state.baseConcept,
            onValueChange = viewModel::updateConcept,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Describe what you want to create…") },
            minLines = 3,
            shape = RoundedCornerShape(12.dp)
        )

        Spacer(Modifier.height(20.dp))

        Button(
            onClick = viewModel::generate,
            modifier = Modifier.fillMaxWidth(),
            enabled = !state.isGenerating && state.baseConcept.isNotBlank(),
            colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = if (state.isGenerating) "Generating…" else "Generate Prompt",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        Spacer(Modifier.height(24.dp))

        if (state.isGenerating) {
            LoadingBar()
        }

        state.error?.let { error ->
            ErrorMessage(message = error)
            Spacer(Modifier.height(12.dp))
        }

        if (state.result.isNotBlank()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Generated Prompt",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        state.qualityReport?.let { qr ->
                            QualityScoreBadge(score = qr.overallScore, grade = qr.grade)
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = state.result,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    if (state.qualityReport?.strengths?.isNotEmpty() == true) {
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = "Strengths",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        state.qualityReport.strengths.forEach { strength ->
                            Text(
                                text = "• $strength",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { /* copy handled by caller */ },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Filled.ContentCopy, null, modifier = Modifier.padding(end = 6.dp))
                            Text("Copy")
                        }
                        OutlinedButton(
                            onClick = { viewModel.saveToLibrary() },
                            modifier = Modifier.weight(1f),
                            enabled = !state.savedToLibrary
                        ) {
                            Icon(Icons.Filled.Bookmark, null, modifier = Modifier.padding(end = 6.dp))
                            Text(if (state.savedToLibrary) "Saved" else "Save")
                        }
                    }
                }
            }
        }
    }
}
