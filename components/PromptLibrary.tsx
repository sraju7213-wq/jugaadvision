import React, { useState, useMemo, useEffect, useRef } from "react";
import { Prompt, Platform } from "../types";
import {
  CopyIcon,
  CheckIcon,
  TrashIcon,
  XIcon,
  FolderIcon,
  SparklesIcon,
  SearchIcon,
} from "./icons";

interface PromptLibraryProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  onUsePrompt: (prompt: Prompt) => void;
}

const FEATURE_BADGES: Record<string, { label: string; badgeClass: string }> = {
  "prompt-builder": { label: "Prompt Builder", badgeClass: "editorial-badge--violet" },
  "image-to-prompt": { label: "Image to Prompt", badgeClass: "editorial-badge--coral" },
  "creative-mixer": { label: "Creative Mixer", badgeClass: "editorial-badge--pink" },
  "batch-generator": { label: "Batch Generator", badgeClass: "editorial-badge--gold" },
  "pro-prompter": { label: "Pro Prompter", badgeClass: "editorial-badge--teal" },
  "studio": { label: "Studio", badgeClass: "editorial-badge--violet" },
};

const PromptCard: React.FC<{
  prompt: Prompt;
  onUse: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
}> = ({ prompt, onUse, onDelete, onUpdateTags }) => {
  const [copied, setCopied] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState(prompt.tags?.join(", ") || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTags && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingTags]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTags = () => {
    const newTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onUpdateTags(prompt.id, newTags);
    setIsEditingTags(false);
  };

  const featureMeta = prompt.sourceFeature
    ? FEATURE_BADGES[prompt.sourceFeature] || { label: prompt.sourceFeature, badgeClass: "editorial-badge--neutral" }
    : null;

  return (
    <div className="editorial-panel flex flex-col justify-between h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--editorial-coral)] overflow-hidden">
      {prompt.imageUrl && (
        <div className="w-full h-44 overflow-hidden relative bg-black/5 border-b border-[var(--editorial-rule)]">
          <img
            src={prompt.imageUrl}
            alt="Saved prompt preview"
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
      )}

      <div className="p-4 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-2.5 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="editorial-badge">
              {prompt.platform || "Natural Language"}
            </span>
            {featureMeta && (
              <span className={`editorial-badge ${featureMeta.badgeClass}`}>
                {featureMeta.label}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-[var(--editorial-muted)]">
            {new Date(prompt.createdAt).toLocaleDateString()}
          </span>
        </div>

        <p className="font-mono text-xs text-[var(--editorial-ink)] leading-relaxed line-clamp-4 flex-grow m-0">
          {prompt.text}
        </p>

        {isEditingTags ? (
          <div className="mt-3 animate-fade-in">
            <input
              ref={inputRef}
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={handleSaveTags}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTags()}
              placeholder="Add tags, comma-separated"
              className="editorial-input text-xs py-1 px-2 w-full"
            />
          </div>
        ) : (
          <div className="flex gap-1 flex-wrap mt-3">
            {prompt.tags?.map((tag) => (
              <span
                key={tag}
                className="editorial-badge editorial-badge--violet text-[10px]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-[var(--editorial-surface-strong)] border-t border-[var(--editorial-rule)] flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-[var(--editorial-muted)] hover:text-emerald-500 transition-colors"
            title="Copy prompt"
          >
            {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsEditingTags(!isEditingTags)}
            className="p-1.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] transition-colors"
            title="Edit tags"
          >
            <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(prompt.id)}
            className="p-1.5 text-[var(--editorial-muted)] hover:text-red-500 transition-colors"
            title="Delete from library"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onUse(prompt)}
          className="editorial-button editorial-button--sm editorial-button--primary"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          <span>Load</span>
        </button>
      </div>
    </div>
  );
};

const PromptLibrary: React.FC<PromptLibraryProps> = ({ prompts, setPrompts, onUsePrompt }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const handleDelete = (id: string) => setPrompts(prompts.filter((p) => p.id !== id));
  const handleUpdateTags = (id: string, tags: string[]) => {
    setPrompts(prompts.map((p) => (p.id === id ? { ...p, tags } : p)));
  };

  const allTags = useMemo(
    () => Array.from(new Set(prompts.flatMap((p) => p.tags || []))).sort(),
    [prompts]
  );

  const allFeatures = useMemo(
    () => Array.from(new Set(prompts.map((p) => p.sourceFeature).filter(Boolean))) as string[],
    [prompts]
  );

  const filteredPrompts = useMemo(() => {
    return prompts
      .filter((p) => {
        const matchesSearch = p.text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTag = selectedTag ? p.tags?.includes(selectedTag) : true;
        const matchesFeature = selectedFeature ? p.sourceFeature === selectedFeature : true;
        return matchesSearch && matchesTag && matchesFeature;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [prompts, searchTerm, selectedTag, selectedFeature]);

  const handleExportJson = () => {
    const dataStr = JSON.stringify(prompts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jugaad-prompts-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="feature-theme-library py-6 h-[calc(100vh-8rem)] flex flex-col max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 pb-4 border-b border-[var(--editorial-rule)]">
        <div>
          <p className="editorial-page__eyebrow mb-1">
            <span className="editorial-page__eyebrow-mark" aria-hidden="true" />
            Vault <span>/</span> Universal Archive
          </p>
          <h1 className="editorial-page__title text-3xl sm:text-4xl">
            Universal <em>Prompt Vault</em>
          </h1>
          <p className="editorial-page__description text-xs sm:text-sm mt-1">
            Persisted directions and prompt layers across all creative workflows ({prompts.length} saved).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          {prompts.length > 0 && (
            <button
              onClick={handleExportJson}
              className="editorial-button editorial-button--outline editorial-button--sm"
            >
              📥 Export JSON
            </button>
          )}

          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search prompt vault..."
              className="editorial-input text-xs py-2 pl-9 pr-8"
            />
            <SearchIcon className="w-4 h-4 text-[var(--editorial-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature and Tag Filters */}
      <div className="flex flex-col gap-2.5 mb-4">
        {allFeatures.length > 0 && (
          <div className="horizontal-scroll-ribbon items-center max-w-full">
            <span className="text-[11px] font-bold text-[var(--editorial-muted)] uppercase self-center mr-1 font-mono whitespace-nowrap flex-shrink-0">Feature:</span>
            <button
              onClick={() => setSelectedFeature(null)}
              className={`px-3 py-1.5 text-xs font-bold font-mono uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                selectedFeature === null
                  ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                  : "bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              }`}
            >
              All Features
            </button>
            {allFeatures.map((feat) => {
              const meta = FEATURE_BADGES[feat] || { label: feat };
              return (
                <button
                  key={feat}
                  onClick={() => setSelectedFeature(selectedFeature === feat ? null : feat)}
                  className={`px-3 py-1.5 text-xs font-bold font-mono uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                    selectedFeature === feat
                      ? "bg-[var(--editorial-coral)] text-white shadow-sm"
                      : "bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)] hover:border-[var(--editorial-coral)] hover:text-[var(--editorial-coral)]"
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="horizontal-scroll-ribbon items-center max-w-full">
            <span className="text-[11px] font-bold text-[var(--editorial-muted)] uppercase self-center mr-1 font-mono whitespace-nowrap flex-shrink-0">Tag:</span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1.5 text-xs font-bold font-mono transition-all whitespace-nowrap flex-shrink-0 ${
                selectedTag === null
                  ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                  : "bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1.5 text-xs font-bold font-mono transition-all whitespace-nowrap flex-shrink-0 ${
                  selectedTag === tag
                    ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                    : "bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prompts Grid */}
      {prompts.length === 0 ? (
        <div className="editorial-empty-state flex-grow">
          <div className="editorial-empty-state__icon">
            <FolderIcon className="w-6 h-6" />
          </div>
          <h3 className="editorial-empty-state__title">Your vault is currently empty</h3>
          <p className="editorial-empty-state__description">
            Save prompts from Prompt Builder, Image to Prompt, Creative Mixer, Studio, or Pro Prompter to access them here.
          </p>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="editorial-empty-state flex-grow">
          <p className="editorial-empty-state__description">
            No saved prompts match the active search and filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-12 custom-scrollbar pr-1 flex-grow">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onUse={onUsePrompt}
              onDelete={handleDelete}
              onUpdateTags={handleUpdateTags}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptLibrary;