import React from 'react';
import { Cloud, Sparkles, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ModelSelectorProps {
  variant?: 'navbar' | 'header' | 'inline' | 'card';
  filterModality?: 'text' | 'vision' | 'all';
  className?: string;
  showManageLink?: boolean;
  onModelChange?: (modelId: string) => void;
  disabled?: boolean;
}

/**
 * AI Router indicator.
 *
 * Model selection is handled server-side: the router picks the best available
 * provider and fails over automatically, so the client no longer ships a model
 * picker or a free-model catalog.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  variant = 'inline',
  className = '',
  showManageLink = false,
}) => {
  const label = 'AI ROUTER';

  if (variant === 'navbar') {
    return (
      <div className={`relative flex items-center gap-1.5 ${className}`}>
        <div
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-sm border bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-muted)] hover:border-[var(--editorial-coral)] transition-all"
          title="Active AI routing: automatic provider selection with failover"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--editorial-muted)] flex-shrink-0" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider max-w-[130px] sm:max-w-[160px] truncate">
            {label}
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <div
          className="flex items-center gap-1.5 p-1 px-2 border bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)] transition-all"
          aria-label="Active AI routing"
        >
          <div className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[var(--editorial-coral)] flex-shrink-0" />
            <span className="hidden sm:inline px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)]">
              AI ROUTER
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-[var(--editorial-muted)]" />
        </div>

        {showManageLink && (
          <Link
            to="/settings"
            className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] underline transition-colors ml-1"
          >
            Manage Providers &rarr;
          </Link>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        <div className="flex items-center gap-1 p-0.5 px-1.5 border bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)] transition-all">
          <Sparkles className="w-3 h-3 text-[var(--editorial-coral)] flex-shrink-0" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-wide">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 border rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--editorial-surface)] border-[var(--editorial-rule)] ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-sm border bg-[var(--editorial-paper)] border-[var(--editorial-rule)] text-[var(--editorial-coral)] flex items-center justify-center flex-shrink-0">
          <Cloud className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
              AI Router
            </span>
          </div>
          <p className="m-0 font-mono text-[9px] text-[var(--editorial-muted)]">
            Automatic provider selection with failover
          </p>
        </div>
      </div>

      {showManageLink && (
        <Link
          to="/settings"
          className="px-2 py-1 border border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] font-mono text-[9px] font-bold uppercase tracking-wider transition-colors"
        >
          Providers
        </Link>
      )}
    </div>
  );
};

export default ModelSelector;
