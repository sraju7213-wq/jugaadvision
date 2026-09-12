import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Theme, Prompt, Platform } from "./types";
import Navbar from "./components/Navbar";
import MobileBottomNav from "./components/MobileBottomNav";
import useLocalStorage from "./hooks/useLocalStorage";
import Loading from "./components/Loading";
import ErrorBoundary from "./components/ErrorBoundary";
import { InstagramIcon } from "./components/icons";

import {
  initializeSettingsStorage,
  loadAppearanceSettings,
  saveAppearanceSettings,
  applyAppearanceToDOM,
} from "./services/settingsStorage";

// Lazy load workflow components
const Home = React.lazy(() => import("./components/Home"));
const PromptBuilderPage = React.lazy(
  () => import("./components/pages/PromptBuilderPage")
);
const ImageToPromptPage = React.lazy(
  () => import("./components/pages/ImageToPromptPage")
);
const CreativeMixerPage = React.lazy(
  () => import("./components/pages/CreativeMixerPage")
);
const BatchGeneratorPage = React.lazy(
  () => import("./components/pages/BatchGeneratorPage")
);
const ProPrompterPage = React.lazy(
  () => import("./components/pages/ProPrompterPage")
);
const PromptLibrary = React.lazy(() => import("./components/PromptLibrary"));
const StudioWorkspace = React.lazy(
  () => import("./components/StudioWorkspace")
);
const SettingsPage = React.lazy(
  () => import("./components/pages/SettingsPage")
);
const HelpResources = React.lazy(() => import("./components/HelpResources"));

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = loadAppearanceSettings();
      if (stored.theme === "light" || stored.theme === "dark") {
        return stored.theme as Theme;
      }
      if (stored.theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      // fallback to legacy key if appearance not yet set
      const legacy = localStorage.getItem("theme");
      if (legacy === "light" || legacy === "dark") return legacy as Theme;
    } catch {}
    return "light";
  });
  const [prompts, setPrompts] = useLocalStorage<Prompt[]>("prompt-library", []);
  const [initialPromptForBuilder, setInitialPromptForBuilder] =
    useState<Prompt | null>(null);

  useEffect(() => {
    initializeSettingsStorage();
    const appSettings = loadAppearanceSettings();
    // persist legacy migration if needed
    if (!localStorage.getItem("jugaad_appearance_settings_v1") && localStorage.getItem("theme")) {
      const legacy = localStorage.getItem("theme");
      if (legacy === "light" || legacy === "dark") {
        saveAppearanceSettings({ theme: legacy as Theme });
      }
    }
    applyAppearanceToDOM(appSettings);
    // sync state with persisted storage (handles system -> resolved light/dark)
    if (appSettings.theme === "light" || appSettings.theme === "dark") {
      setTheme(appSettings.theme as Theme);
    } else if (appSettings.theme === "system") {
      const resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      setTheme(resolved as Theme);
    }

    // keep Navbar/BottomNav in sync when Settings page changes theme (same-tab, no storage event)
    const onAppearanceChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { theme?: string };
      if (detail?.theme === "light" || detail?.theme === "dark") {
        setTheme(detail.theme as Theme);
      } else if (detail?.theme === "system") {
        const resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        setTheme(resolved as Theme);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "jugaad_appearance_settings_v1" || e.key === "theme") {
        const s = loadAppearanceSettings();
        if (s.theme === "light" || s.theme === "dark") setTheme(s.theme as Theme);
        else if (s.theme === "system") {
          const resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          setTheme(resolved as Theme);
        }
      }
    };
    window.addEventListener("jugaad:appearancechange", onAppearanceChange as EventListener);
    window.addEventListener("storage", onStorage);
    // also react to system preference changes when user chose system
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const s = loadAppearanceSettings();
      if (s.theme === "system") {
        setTheme(mql.matches ? "dark" : "light");
      }
    };
    mql.addEventListener?.("change", onSystemChange);
    return () => {
      window.removeEventListener("jugaad:appearancechange", onAppearanceChange as EventListener);
      window.removeEventListener("storage", onStorage);
      mql.removeEventListener?.("change", onSystemChange);
    };
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    // unified persistence: keep both keys in sync so preference survives reload
    localStorage.setItem("theme", theme);
    try {
      const current = loadAppearanceSettings();
      if (current.theme !== theme) {
        saveAppearanceSettings({ theme });
      }
    } catch {}
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        saveAppearanceSettings({ theme: next });
      } catch {}
      localStorage.setItem("theme", next);
      return next;
    });

  const handleSaveToLibrary = useCallback(
    (
      text: string,
      platform: Platform = Platform.Natural,
      imageUrl?: string,
      tags: string[] = [],
    ) => {
      if (!text.trim() && !imageUrl) return;
      const newPrompt: Prompt = {
        id: `prompt_${Date.now()}`,
        text: text,
        platform: platform || Platform.Natural,
        sourceFeature: tags[0] || "general",
        tags,
        createdAt: new Date().toISOString(),
        imageUrl,
      };
      setPrompts((prev) => [newPrompt, ...prev]);
    },
    [setPrompts],
  );

  const preparePromptForBuilder = useCallback(
    (promptText: string) => {
      const tempPrompt: Prompt = {
        id: `temp-${Date.now()}`,
        text: promptText,
        platform: Platform.Natural,
        tags: [],
        createdAt: new Date().toISOString(),
      };
      setInitialPromptForBuilder(tempPrompt);
    },
    [setInitialPromptForBuilder],
  );

  const handleUsePromptFromLibrary = useCallback(
    (prompt: Prompt) => {
      setInitialPromptForBuilder(prompt);
      navigate("/prompt-builder");
    },
    [navigate],
  );

  const handleSendToBuilder = useCallback(
    (promptText: string) => {
      preparePromptForBuilder(promptText);
      navigate("/prompt-builder");
    },
    [navigate, preparePromptForBuilder],
  );

  return (
    <div className="app-canvas relative min-h-screen font-sans flex flex-col">
      <Navbar theme={theme} toggleTheme={toggleTheme} />

      <main
        id="main-content"
        role="main"
        className={`flex-grow ${isHome ? "homepage-main pb-24 md:pb-0" : "editorial-page__content pt-16 sm:pt-20 pb-28 md:pb-12"}`}
        tabIndex={-1}
      >
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* Home Hub */}
              <Route path="/" element={<Home />} />

              {/* Independent Prompt Generator Features */}
              <Route
                path="/prompt-builder"
                element={
                  <PromptBuilderPage
                    prompts={prompts}
                    setPrompts={setPrompts}
                    initialPrompt={initialPromptForBuilder}
                  />
                }
              />

              <Route
                path="/image-to-prompt"
                element={
                  <ImageToPromptPage
                    onSendToBuilder={handleSendToBuilder}
                    onSaveToLibrary={(text, platform, imgUrl, tags) =>
                      handleSaveToLibrary(text, platform || Platform.Natural, imgUrl, tags || [
                        "image-to-prompt",
                      ])
                    }
                  />
                }
              />

              <Route
                path="/creative-mixer"
                element={
                  <CreativeMixerPage
                    onSendToBuilder={handleSendToBuilder}
                    onSaveToLibrary={(text, platform, imgUrl, tags) =>
                      handleSaveToLibrary(text, platform || Platform.Natural, imgUrl, tags || [
                        "creative-mixer",
                      ])
                    }
                  />
                }
              />

              <Route
                path="/batch-generator"
                element={
                  <BatchGeneratorPage
                    onSendToBuilder={handleSendToBuilder}
                    onSaveToLibrary={(text, platform, imgUrl, tags) =>
                      handleSaveToLibrary(text, platform || Platform.Natural, imgUrl, tags || [
                        "batch-generator",
                      ])
                    }
                  />
                }
              />

              <Route
                path="/pro-prompter"
                element={
                  <ProPrompterPage
                    onSendToBuilder={handleSendToBuilder}
                    onSaveToLibrary={(text, platform, imgUrl, tags) =>
                      handleSaveToLibrary(text, platform || Platform.Natural, imgUrl, tags || [
                        "pro-prompter",
                      ])
                    }
                  />
                }
              />

              {/* Alias for banner prompter */}
              <Route
                path="/banner-prompter"
                element={<Navigate to="/pro-prompter" replace />}
              />

              {/* Studio Workspace */}
              <Route
                path="/studio"
                element={
                  <StudioWorkspace
                    onSendToBuilder={handleSendToBuilder}
                    onSaveToLibrary={(text, platform, imgUrl, tags) =>
                      handleSaveToLibrary(text, platform || Platform.Natural, imgUrl, tags || [
                        "studio",
                      ])
                    }
                  />
                }
              />

              {/* Prompt Library */}
              <Route
                path="/library"
                element={
                  <PromptLibrary
                    prompts={prompts}
                    setPrompts={setPrompts}
                    onUsePrompt={handleUsePromptFromLibrary}
                  />
                }
              />

              {/* Legacy / Hub Route */}
              <Route
                path="/prompt-studio"
                element={<Navigate to="/prompt-builder" replace />}
              />

              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpResources />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="editorial-footer mb-16 md:mb-0">
        <div className="editorial-footer__inner">
          <div className="editorial-footer__meta">
            <div className="editorial-footer__status-dot" aria-hidden="true" />
            <p className="m-0 text-xs">
              Jugaad Visuals AI Studio • Crafted by{" "}
              <span className="editorial-footer__author">
                Raju Sheikh
              </span>
            </p>
          </div>
          <div className="editorial-footer__links">
            <a
              href="https://instagram.com/depressed_4rtist"
              target="_blank"
              rel="noopener noreferrer"
              className="editorial-footer__link"
              aria-label="Raju Sheikh on Instagram"
            >
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>@depressed_4rtist</span>
            </a>
            <a
              href="https://instagram.com/Kreative.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="editorial-footer__link"
              aria-label="Kreative.ai on Instagram"
            >
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>@Kreative.ai</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Thumb-Accessible Mobile Bottom Navigation */}
      <MobileBottomNav theme={theme} toggleTheme={toggleTheme} />
    </div>
  );
};

export default App;
