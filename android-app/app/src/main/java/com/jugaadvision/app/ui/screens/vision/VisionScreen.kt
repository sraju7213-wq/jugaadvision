package com.jugaadvision.app.ui.screens.vision

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.jugaadvision.app.ui.components.ErrorMessage
import com.jugaadvision.app.ui.components.LoadingBar
import com.jugaadvision.app.ui.components.SectionHeader
import com.jugaadvision.app.ui.theme.IndigoPrimary
import com.jugaadvision.app.ui.theme.TealAccent
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun VisionScreen(
    viewModel: VisionViewModel = viewModel()
) {
    val state = viewModel.state.collectAsState().value
    val context = LocalContext.current

    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            val base64 = encodeImage(context, it)
            viewModel.setImage(it, base64)
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        bitmap?.let {
            val stream = java.io.ByteArrayOutputStream()
            it.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, stream)
            val base64 = android.util.Base64.encodeToString(stream.toByteArray(), android.util.Base64.NO_WRAP)
            val uri = android.net.Uri.parse("data:image/jpeg;base64,$base64")
            viewModel.setImage(uri, base64)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Text(
            text = "Image to Prompt",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "Upload an image to extract AI prompts and analysis",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(24.dp))

        if (state.imageUri != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                AsyncImage(
                    model = state.imageUri,
                    contentDescription = "Selected image",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp)
                        .clip(RoundedCornerShape(16.dp)),
                    contentScale = ContentScale.Crop
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Filled.PhotoCamera,
                        null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "No image selected",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = { cameraLauncher.launch(null) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Filled.PhotoCamera, null, modifier = Modifier.padding(end = 8.dp))
                Text("Camera")
            }
            OutlinedButton(
                onClick = { galleryLauncher.launch("image/*") },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Filled.PhotoLibrary, null, modifier = Modifier.padding(end = 8.dp))
                Text("Gallery")
            }
        }

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = viewModel::analyze,
            modifier = Modifier.fillMaxWidth(),
            enabled = state.base64Image.isNotBlank() && !state.isAnalyzing,
            colors = ButtonDefaults.buttonColors(containerColor = TealAccent),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = if (state.isAnalyzing) "Analyzing…" else "Analyze Image",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        Spacer(Modifier.height(24.dp))

        if (state.isAnalyzing) {
            LoadingBar()
        }

        state.error?.let { error ->
            ErrorMessage(message = error)
        }

        state.result?.let { result ->
            VisionResultCard(result)
        }
    }
}

@Composable
private fun VisionResultCard(result: VisionAnalysis) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionHeader(title = "Analysis Result")
            Spacer(Modifier.height(12.dp))

            Text(
                text = "Extracted Prompt",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = IndigoPrimary
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = result.prompt,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            result.description?.let {
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Description",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = IndigoPrimary
                )
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            if (result.colorPalette.isNotEmpty()) {
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Color Palette",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = IndigoPrimary
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    result.colorPalette.take(8).forEach { hex ->
                        val color = try {
                            Color(android.graphics.Color.parseColor(hex))
                        } catch (e: Exception) {
                            MaterialTheme.colorScheme.primary
                        }
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(color)
                        )
                    }
                }
            }

            result.composition?.let {
                Spacer(Modifier.height(16.dp))
                VisionDetailRow("Composition", it)
            }
            result.artisticStyle?.let {
                VisionDetailRow("Artistic Style", it)
            }
            result.lighting?.let {
                VisionDetailRow("Lighting", it)
            }
            result.cameraSettings?.let {
                VisionDetailRow("Camera", it)
            }
        }
    }
}

@Composable
private fun VisionDetailRow(label: String, value: String) {
    Column(modifier = Modifier.padding(top = 8.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

private fun encodeImage(context: android.content.Context, uri: Uri): String {
    val inputStream = context.contentResolver.openInputStream(uri)
    val bytes = inputStream?.readBytes() ?: ByteArray(0)
    inputStream?.close()
    return android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
}
