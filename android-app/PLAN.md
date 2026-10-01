# JugaadVision Android App — Development Plan

## Overview

A native Android application built with **Kotlin + Jetpack Compose + Material Design 3** that brings the JugaadVision "Smart AI Creative Studio" platform to Android devices. The app connects to the existing JugaadVision backend API for all AI generation, vision analysis, and model management features.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Kotlin 2.0+ |
| UI Framework | Jetpack Compose with Material 3 |
| Architecture | MVVM + Clean Architecture |
| Navigation | Navigation Compose |
| Networking | Retrofit 2 + OkHttp + Kotlin Coroutines |
| Image Loading | Coil 3 (Compose-native) |
| Local Storage | DataStore (Preferences) + Room (prompt library) |
| Dependency Injection | Manual (lightweight service locator) |
| Async | Kotlin Coroutines + Flow |
| Min SDK | 24 (Android 7.0) |
| Target SDK | 35 (Android 15) |

---

## App Features (Phase 1 — MVP)

### 1. Home Dashboard
- Welcome banner with app branding
- Quick-action cards for each tool
- Recent prompts carousel
- Model health status indicator

### 2. Prompt Builder
- Token-based prompt composition
- Platform selector (Midjourney, DALL-E 3, Flux, SDXL, Video AI)
- AI-powered prompt enhancement
- Quality score display
- Copy/share generated prompts

### 3. Image-to-Prompt (Vision Analysis)
- Camera capture + gallery picker
- Real-time vision analysis via streaming
- Color palette extraction
- Composition and style breakdown
- Multi-image reference support

### 4. Prompt Library
- Saved prompts with tags and metadata
- Full-text search and filtering
- Platform-based grouping
- Prompt detail view with quality report

### 5. Settings
- API key configuration (OpenRouter, NVIDIA NIM, HuggingFace, Cloudflare)
- Model preferences (free model toggle, preferred provider)
- Appearance (dark/light/system theme, UI density)
- About and credits

---

## Design System

### Colors (matching web brand)
- **Primary**: Indigo `#4F46E5`
- **Background (Light)**: `#FFFFFF`
- **Background (Dark)**: `#0F1117`
- **Surface**: `#FFFFFF` / `#0F1117`
- **Text Primary**: `#1F2937` / `#F0F4F8`
- **Text Muted**: `#6B7280` / `#8B949E`
- **Success**: `#2EA44F`
- **Warning**: `#D29922`
- **Error**: `#DA3633`

### Typography
- Font: Inter (with system fallback)
- Responsive type scale following Material 3 tokens

### Components
- Material 3 Cards, Buttons, Chips, NavigationBar
- Custom: TokenChip, QualityScoreBadge, PromptCard, ModelStatusPill
- Bottom navigation bar (thumb-accessible, 56dp+ height)
- Smooth transitions (200ms cubic-bezier)

---

## Project Structure

```
android-app/
├── app/
│   ├── build.gradle.kts
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/jugaadvision/app/
│   │   │   ├── JugaadVisionApp.kt          # Application class
│   │   │   ├── MainActivity.kt             # Single-activity entry
│   │   │   ├── data/
│   │   │   │   ├── models/                 # Data classes (Prompt, Platform, etc.)
│   │   │   │   ├── remote/                 # Retrofit API interface, DTOs
│   │   │   │   └── repository/             # Repository pattern
│   │   │   ├── ui/
│   │   │   │   ├── theme/                  # Color, Type, Shape, Theme
│   │   │   │   ├── navigation/             # NavHost, routes
│   │   │   │   ├── screens/                # Feature screens + ViewModels
│   │   │   │   │   ├── home/
│   │   │   │   │   ├── prompt_builder/
│   │   │   │   │   ├── vision/
│   │   │   │   │   ├── library/
│   │   │   │   │   └── settings/
│   │   │   │   └── components/             # Reusable composables
│   │   │   └── util/                       # Extensions, constants
│   │   └── res/
│   │       ├── values/                     # strings, colors, themes
│   │       ├── values-night/               # Dark mode overrides
│   │       ├── drawable/                   # Icons, shapes
│   │       └── mipmap-*/                   # App icons
├── build.gradle.kts                        # Root build config
├── settings.gradle.kts                     # Project settings
├── gradle.properties                       # Gradle + Android props
└── PLAN.md                                 # This document
```

---

## Development Phases

### Phase 1: Foundation (Current)
1. ✅ Create project structure and Gradle configuration
2. ✅ Implement Material 3 theme matching JugaadVision branding
3. ✅ Build data layer (models, API service, repository)
4. ✅ Create navigation scaffold with bottom nav
5. ✅ Implement all 5 core screens with UI
6. ✅ Add reusable UI components

### Phase 2: API Integration
- Wire up Retrofit to JugaadVision backend (`https://jugaadvision.vercel.app/api/`)
- Implement streaming vision analysis
- Add error handling and retry logic
- Configure API key storage in DataStore

### Phase 3: Persistence
- Room database for prompt library
- DataStore for settings/preferences
- Offline prompt caching

### Phase 4: Polish
- App icons (adaptive icons for all densities)
- Splash screen API
- Haptic feedback
- Share sheet integration
- Camera integration via CameraX
- Animations and transitions
- Accessibility (TalkBack, content descriptions)

### Phase 5: Release
- ProGuard/R8 minification
- Signed APK/AAB generation
- Play Store listing assets
- Store-ready build configuration

---

## API Endpoints Used

| Endpoint | Method | App Feature |
|----------|--------|-------------|
| `/api/ai/generate` | POST | Prompt Builder |
| `/api/ai/batch` | POST | Batch Generator |
| `/api/ai/vision` | POST | Image-to-Prompt |
| `/api/ai/vision/stream` | POST | Vision (streaming) |
| `/api/ai/models` | GET | Model Selector |
| `/api/ai/health` | GET | Health Status |
| `/api/settings/providers` | POST | Settings |
| `/api/settings/appearance` | GET/POST | Appearance |

---

## Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.VIBRATE" />
```

---

## Credits
- **Creator**: Raju Sheikh (@depressed_4rtist)
- **Brand**: Kreative.ai (@Kreative.ai)
- **App Title**: Jugaad Visuals — Smart AI Creative Studio
