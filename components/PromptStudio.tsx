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
  onSaveToLibrary: (
    text: string,
    platform?: Platform,
    imageUrl?: string,
    tags?: string[],
  ) => void;
  preparePromptForBuilder: (prompt: string) => void;
}

const tabs: { id: TabId; label: string; activeClass: string }[] = [
  { id: "prompt", label: "Prompt Builder", activeClass: "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm" },
  { id: "image", label: "Image to Prompt", activeClass: "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm" },
  { id: "mixer", label: "Creative Mixer", activeClass: "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm" },
  { id: "batch", label: "Batch Generator", activeClass: "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm" },
  { id: "banner", label: "Pro Prompter", activeClass: "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm" },
];

const resolveTab = (value: string | null): TabId => {
  return VALID_TABS.includes(value as TabId) ? (value as TabId) : "prompt";
};

const PromptStudio: React.FC<PromptStudioProps> = ({
  prompts,
  setPrompts,
  initialPrompt,
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
          />
        );
    }
  }, [
    activeTab,
    handleSendToBuilder,
    initialPrompt,
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
        {/* Mobile: Full-width scrollable tabs */}
        <div className="relative w-full md:hidden">
          <div
            className="overflow-x-auto whitespace-nowrap px-2 scrollbar-hide snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            <div className="inline-flex bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] p-1 gap-1 shadow-sm">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={`mobile-${tab.id}`}
                    onClick={() => handleTabChange(tab.id)}
                    className={`relative px-3 py-2 min-h-[40px] text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap snap-start ${isActive ? tab.activeClass : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"}`}
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
          <div className="inline-flex bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] p-1.5 gap-1 shadow-sm">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={`desktop-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative px-4 py-2 min-h-[40px] text-xs font-mono font-bold uppercase tracking-wider transition-all ${isActive ? tab.activeClass : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-10 editorial-panel p-4 sm:p-8">
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
