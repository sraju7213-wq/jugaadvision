# JugaadVision Android App

A native Android application for **JugaadVision — Smart AI Creative Studio**, built with Kotlin, Jetpack Compose, and Material Design 3.

## Features

- **Prompt Builder** — AI-powered prompt engineering with platform optimization (Midjourney, DALL-E 3, Flux, SDXL, Video AI)
- **Image-to-Prompt** — Vision analysis with camera capture, color palette extraction, and composition breakdown
- **Prompt Library** — Save, search, and manage generated prompts
- **Settings** — API key configuration, model preferences, light/dark/system theme
- **Model Health** — Real-time provider health monitoring

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Jetpack Compose + Material 3 |
| Architecture | MVVM |
| Networking | Retrofit 2 + OkHttp |
| Image Loading | Coil 3 |
| Storage | DataStore |
| Navigation | Navigation Compose |
| Min SDK | 24 (Android 7.0) |
| Target SDK | 35 (Android 15) |

## Project Structure

```
android-app/
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/jugaadvision/app/
│       │   ├── JugaadVisionApp.kt
│       │   ├── MainActivity.kt
│       │   ├── data/
│       │   │   ├── models/
│       │   │   ├── remote/
│       │   │   └── repository/
│       │   └── ui/
│       │       ├── theme/
│       │       ├── navigation/
│       │       ├── screens/
│       │       └── components/
│       └── res/
│           ├── values/
│           ├── values-night/
│           └── drawable/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── gradle/wrapper/
└── PLAN.md
```

## Setup

1. Open the `android-app` folder in Android Studio
2. Let Gradle sync complete
3. Run on an emulator or device (API 24+)

## Backend

The app connects to the JugaadVision backend deployed on Vercel.

- **Production URL**: `https://jugaadvision.vercel.app`
- **API Base**: `https://jugaadvision.vercel.app/api/`
- **Health Check**: `GET /api/ai/health`
- **Models**: `GET /api/ai/models`

The API base URL is configured via `BuildConfig.API_BASE_URL` in `app/build.gradle.kts`.
To point at a local dev server, change the `buildConfigField` value and rebuild:

```kotlin
buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000/api/\"")
```

## GitHub

- **Repository**: [sraju7213-wq/jugaadvision](https://github.com/sraju7213-wq/jugaadvision)
- **CI**: GitHub Actions builds the Android APK on every push to `main` that touches `android-app/`
- **Vercel**: Auto-deploys on push to `main` (Vercel GitHub integration)

### CI Workflows

| Workflow | File | Trigger |
|----------|------|---------|
| Android Build | `.github/workflows/android.yml` | Push/PR to `main` touching `android-app/` |
| Vercel Deploy | `.github/workflows/vercel-deploy.yml` | Push to `main` touching web/API files |

## Credits

- **Creator**: Raju Sheikh (@depressed_4rtist)
- **Brand**: Kreative.ai (@Kreative.ai)
