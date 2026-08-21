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
    <div className="w-full max-w-[1760px] mx-auto px-2 sm:px-4 lg:px-6 pb-20 pt-4 sm:pt-6">
      <div className="text-center space-y-1.5 mb-6">
        <p className="text-[11px] uppercase tracking-[0.25em] font-mono text-[var(--editorial-muted)]">
          AI Prompt Studio &amp; Engineering Workstation
        </p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--editorial-ink)] tracking-tight">
          Prompt Engineering Studio
        </h1>
      </div>

      <div className="flex justify-center mb-5">
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
                    className={`relative px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap snap-start ${isActive ? tab.activeClass : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"}`}
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
          <div className="inline-flex bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] p-1 gap-1 shadow-sm">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={`desktop-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative px-4 py-1.5 min-h-[36px] text-xs font-mono font-bold uppercase tracking-wider transition-all ${isActive ? tab.activeClass : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="editorial-panel p-3 sm:p-5 lg:p-6 shadow-sm">
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

