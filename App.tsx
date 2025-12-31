import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { Theme, Prompt, Platform } from "./types";
import Navbar from "./components/Navbar";
import useLocalStorage from "./hooks/useLocalStorage";
import Loading from "./components/Loading";
import ErrorBoundary from "./components/ErrorBoundary";
import { InstagramIcon } from "./components/icons";

// Lazy load workflow components
const Home = React.lazy(() => import("./components/Home"));
const ImageGenerator = React.lazy(() => import("./components/ImageGenerator"));
const ImageEditor = React.lazy(() => import("./components/ImageEditor"));
const PromptStudio = React.lazy(() => import("./components/PromptStudio"));
const PromptLibrary = React.lazy(() => import("./components/PromptLibrary"));
const StudioWorkspace = React.lazy(
  () => import("./components/StudioWorkspace"),
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

  const [theme, setTheme] = useState<Theme>("dark");
  const [prompts, setPrompts] = useLocalStorage<Prompt[]>("prompt-library", []);
  const [initialPromptForBuilder, setInitialPromptForBuilder] =
    useState<Prompt | null>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme;
    if (storedTheme) {
      setTheme(storedTheme);
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
      imageUrl: string | undefined,
      tags: string[] = [],
    ) => {
      if (!text.trim() && !imageUrl) return;
      const newPrompt: Prompt = {
        id: `prompt_${Date.now()}`,
        text: text,
        platform: platform,
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
      navigate("/prompt-builder?tab=prompt");
    },
    [navigate],
  );

  const handleSendToBuilder = useCallback(
    (promptText: string) => {
      preparePromptForBuilder(promptText);
      navigate("/prompt-builder?tab=prompt");
    },
    [navigate, preparePromptForBuilder],
  );

  const handleJumpToImage = useCallback(
    (promptText: string) => {
      navigate(`/generate?prompt=${encodeURIComponent(promptText)}`);
    },
    [navigate],
  );

  return (
    <div className="relative min-h-screen bg-transparent font-sans flex flex-col">
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main id="main-content" role="main" className="flex-grow container mx-auto px-5 sm:px-6 lg:px-8 pt-24 pb-8 pb-safe" tabIndex={-1}>
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/prompt-builder"
                element={
                  <PromptStudio
                    prompts={prompts}
                    setPrompts={setPrompts}
                    initialPrompt={initialPromptForBuilder}
                    onJumpToImage={handleJumpToImage}
                    onSaveToLibrary={handleSaveToLibrary}
                    preparePromptForBuilder={preparePromptForBuilder}
                  />
                }
              />
              <Route
                path="/prompt-studio"
                element={<Navigate to="/prompt-builder" replace />}
              />

              <Route
                path="/generate"
                element={
                  <ImageGenerator
                    onSaveToLibrary={(text, platform, img) =>
                      handleSaveToLibrary(text, platform, img, [
                        "generated-image",
                      ])
                    }
                  />
                }
              />
              <Route
                path="/edit"
                element={
                  <ImageEditor
                    onSaveToLibrary={(text, platform, img) =>
                      handleSaveToLibrary(text, platform, img, ["edited-image"])
                    }
                  />
                }
              />

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
              <Route
                path="/studio"
                element={
                  <StudioWorkspace
                    onSendToBuilder={handleSendToBuilder}
                    onJumpToImage={handleJumpToImage}
                    onSaveToLibrary={(text) =>
                      handleSaveToLibrary(text, Platform.Natural, undefined, [
                        "studio",
                      ])
                    }
                  />
                }
              />

              <Route path="/help" element={<HelpResources />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="w-full max-w-5xl mx-auto py-6 border-t border-gray-200 dark:border-white/10">
        <div className="flex flex-col sm:flex-row justify-between items-center text-center gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Designed & Developed by{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              Raju Sheikh
            </span>
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <a
              href="https://instagram.com/depressed_4rtist"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-pink-500 transition-colors"
            >
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>@depressed_4rtist</span>
            </a>
            <a
              href="https://instagram.com/Kreative.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-purple-500 transition-colors"
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
