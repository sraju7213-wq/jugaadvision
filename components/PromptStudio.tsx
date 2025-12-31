import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { Platform, Prompt } from "../types";
import Loading from "./Loading";

const PromptBuilder = React.lazy(() => import("./PromptBuilder"));
const ImageToPrompt = React.lazy(() => import("./ImageToPrompt"));
const CreativeMixer = React.lazy(() => import("./CreativeMixer"));
const BatchGenerator = React.lazy(() => import("./BatchGenerator"));
const BannerPrompter = React.lazy(() => import("./BannerPrompter"));

type TabId = "prompt" | "image" | "mixer" | "batch" | "banner";
const VALID_TABS: TabId[] = ["prompt", "image", "mixer", "batch", "banner"];

interface PromptStudioProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  initialPrompt: Prompt | null;
  onJumpToImage: (prompt: string) => void;
  onSaveToLibrary: (
    text: string,
    platform?: Platform,
    imageUrl?: string,
    tags?: string[],
  ) => void;
  preparePromptForBuilder: (prompt: string) => void;
}

const tabs: { id: TabId; label: string; activeClass: string }[] = [
  { id: "prompt", label: "Prompt Builder", activeClass: "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30" },
  { id: "image", label: "Image to Prompt", activeClass: "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30" },
  { id: "mixer", label: "Creative Mixer", activeClass: "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/30" },
  { id: "batch", label: "Batch Generator", activeClass: "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30" },
  { id: "banner", label: "Pro Prompter", activeClass: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30" },
];

const resolveTab = (value: string | null): TabId => {
  return VALID_TABS.includes(value as TabId) ? (value as TabId) : "prompt";
};

const PromptStudio: React.FC<PromptStudioProps> = ({
  prompts,
  setPrompts,
  initialPrompt,
  onJumpToImage,
  onSaveToLibrary,
  preparePromptForBuilder,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    resolveTab(searchParams.get("tab")),
  );

  useEffect(() => {
    const nextTab = resolveTab(searchParams.get("tab"));
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [searchParams, activeTab]);

  const syncTabParam = useCallback(
    (tab: TabId) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (tab === "prompt") {
          params.delete("tab");
        } else {
          params.set("tab", tab);
        }
        return params;
      });
    },
    [setSearchParams],
  );

  const handleTabChange = useCallback(
    (tab: TabId) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      syncTabParam(tab);
    },
    [activeTab, syncTabParam],
  );

  const handleSendToBuilder = useCallback(
    (promptText: string) => {
      preparePromptForBuilder(promptText);
      setActiveTab("prompt");
      syncTabParam("prompt");
    },
    [preparePromptForBuilder, syncTabParam],
  );

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case "image":
        return (
          <ImageToPrompt
            onSendToBuilder={handleSendToBuilder}
            onJumpToImage={onJumpToImage}
            onSaveToLibrary={(text) =>
              onSaveToLibrary(text, Platform.Natural, undefined, [
                "image-to-prompt",
              ])
            }
          />
        );
      case "mixer":
        return (
          <CreativeMixer
            onSendToBuilder={handleSendToBuilder}
            onJumpToImage={onJumpToImage}
            onSaveToLibrary={(text) =>
              onSaveToLibrary(text, Platform.Natural, undefined, [
                "creative-mix",
              ])
            }
          />
        );

      case "batch":
        return (
          <BatchGenerator
            onSendToBuilder={handleSendToBuilder}
            onJumpToImage={onJumpToImage}
            onSaveToLibrary={(text) =>
              onSaveToLibrary(text, Platform.Natural, undefined, [
                "batch-variation",
              ])
            }
          />
        );
      case "banner":
        return (
          <BannerPrompter
            onSendToBuilder={handleSendToBuilder}
            onJumpToImage={onJumpToImage}
            onSaveToLibrary={(text) =>
              onSaveToLibrary(text, Platform.Natural, undefined, [
                "banner-design",
              ])
            }
          />
        );
      default:
        return (
          <PromptBuilder
            prompts={prompts}
            setPrompts={setPrompts}
            initialPrompt={initialPrompt}
            onJumpToImage={onJumpToImage}
          />
        );
    }
  }, [
    activeTab,
    handleSendToBuilder,
    initialPrompt,
    onJumpToImage,
    onSaveToLibrary,
    prompts,
    setPrompts,
  ]);

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 pt-10">
      <div className="text-center space-y-3 mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
          AI Prompt Builder Hub
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
          AI Prompt Builder
        </h1>
      </div>

      <div className="flex justify-center mb-6">
        {/* Mobile: Full-width scrollable tabs with gradient indicators */}
        <div className="relative w-full md:hidden">
          {/* Left gradient fade indicator */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/80 dark:from-gray-900/80 to-transparent pointer-events-none z-10 rounded-l-full" />
          {/* Right gradient fade indicator */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 dark:from-gray-900/80 to-transparent pointer-events-none z-10 rounded-r-full" />
          <div
            className="overflow-x-auto whitespace-nowrap px-2 scrollbar-hide snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            <div className="inline-flex bg-white/30 dark:bg-white/10 border border-white/40 dark:border-white/10 rounded-full backdrop-blur-2xl p-1 gap-1 shadow-[0_15px_50px_rgba(15,23,42,0.12)]">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={`mobile-${tab.id}`}
                    onClick={() => handleTabChange(tab.id)}
                    className={`relative px-3 py-2.5 min-h-[44px] rounded-full text-xs font-bold transition-all whitespace-nowrap snap-start ${isActive ? tab.activeClass : "text-gray-600 dark:text-gray-200 active:bg-white/30 hover:text-gray-900 dark:hover:text-white"}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* Desktop: Centered tabs */}
        <div className="hidden md:flex justify-center">
          <div className="inline-flex bg-white/30 dark:bg-white/10 border border-white/40 dark:border-white/10 rounded-full backdrop-blur-2xl p-1.5 gap-1 shadow-[0_15px_50px_rgba(15,23,42,0.12)]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={`desktop-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative px-4 lg:px-5 py-2.5 min-h-[44px] rounded-full text-sm font-semibold transition-all ${isActive ? tab.activeClass : "text-gray-600 dark:text-gray-200 hover:bg-white/20 hover:text-gray-900 dark:hover:text-white"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-10 bg-white/60 dark:bg-white/5 border border-white/40 dark:border-white/10 rounded-3xl backdrop-blur-2xl shadow-[0_20px_60px_rgba(15,23,42,0.15)] p-4 sm:p-8 will-change-transform">
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <Loading />
            </div>
          }
        >
          {tabContent}
        </Suspense>
      </div>
    </div>
  );
};

export default PromptStudio;
