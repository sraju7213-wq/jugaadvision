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
import useLocalStorage from "./hooks/useLocalStorage";
import Loading from "./components/Loading";
import ErrorBoundary from "./components/ErrorBoundary";
import { InstagramIcon } from "./components/icons";

import {
  initializeSettingsStorage,
  loadAppearanceSettings,
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

  const [theme, setTheme] = useState<Theme>("dark");
  const [prompts, setPrompts] = useLocalStorage<Prompt[]>("prompt-library", []);
  const [initialPromptForBuilder, setInitialPromptForBuilder] =
    useState<Prompt | null>(null);

  useEffect(() => {
    initializeSettingsStorage();
    const appSettings = loadAppearanceSettings();
    applyAppearanceToDOM(appSettings);
    if (appSettings.theme === "light" || appSettings.theme === "dark") {
      setTheme(appSettings.theme);
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

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
        className={`flex-grow ${isHome ? "homepage-main" : "editorial-page__content pt-20 pb-12 pb-safe"}`}
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

      <footer className="editorial-footer">
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
    </div>
  );
};

export default App;
