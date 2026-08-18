import React from 'react';
import { PenCircuitIcon, SparklesIcon, LayersIcon } from './icons';

const HelpResources: React.FC = () => {
  return (
    <div className="feature-theme-help max-w-5xl mx-auto py-8 space-y-10">
      <header className="editorial-page__header editorial-page__header--centered">
        <p className="editorial-page__eyebrow">
          <span className="editorial-page__eyebrow-mark" aria-hidden="true" />
          Documentation <span>/</span> Studio Guide
        </p>
        <h1 className="editorial-page__title">
          Mastering the <em>creative</em> toolkit.
        </h1>
        <p className="editorial-page__description text-center">
          A field guide to constructing, reverse-engineering, and orchestrating production-grade prompts across every discipline.
        </p>
      </header>

      <div className="editorial-grid editorial-grid--1 gap-6">
        <div className="editorial-panel editorial-panel--strong">
          <div className="editorial-panel__header">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[var(--editorial-violet-soft)] text-[var(--editorial-violet)] border border-[var(--editorial-violet)]/20">
                <PenCircuitIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="editorial-badge editorial-badge--violet mb-1">01 / Direct</span>
                <h3 className="editorial-panel__title">Crafting & Enhancing Prompts</h3>
              </div>
            </div>
          </div>
          <div className="editorial-panel__body">
            <p className="text-sm leading-relaxed text-[var(--editorial-muted)]">
              Navigate to the <strong className="text-[var(--editorial-ink)]">Prompt Builder</strong> to structure visual tokens, platform-specific parameters, and artistic nuances. Use the <strong className="text-[var(--editorial-coral)]">Enhance</strong> engine to expand raw concepts into layered, cinematic visual instructions. Save breakthrough configurations directly to your vault.
            </p>
          </div>
        </div>

        <div className="editorial-panel editorial-panel--strong">
          <div className="editorial-panel__header">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[var(--editorial-teal-soft)] text-[var(--editorial-teal)] border border-[var(--editorial-teal)]/20">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="editorial-badge editorial-badge--teal mb-1">02 / Reverse</span>
                <h3 className="editorial-panel__title">Vision & Image-to-Prompt Analysis</h3>
              </div>
            </div>
          </div>
          <div className="editorial-panel__body">
            <p className="text-sm leading-relaxed text-[var(--editorial-muted)]">
              Drop any visual reference into the <strong className="text-[var(--editorial-ink)]">Image to Prompt</strong> engine. Multimodal vision models decompose lighting angles, color temperatures, lens parameters, composition grids, and stylistic references into modular prompt building blocks.
            </p>
          </div>
        </div>

        <div className="editorial-panel editorial-panel--strong">
          <div className="editorial-panel__header">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[var(--editorial-coral-soft)] text-[var(--editorial-coral)] border border-[var(--editorial-coral)]/20">
                <LayersIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="editorial-badge editorial-badge--coral mb-1">03 / Multiply</span>
                <h3 className="editorial-panel__title">Creative Mixing & Batch Matrix</h3>
              </div>
            </div>
          </div>
          <div className="editorial-panel__body">
            <p className="text-sm leading-relaxed text-[var(--editorial-muted)]">
              Synthesize distinct visual philosophies with the <strong className="text-[var(--editorial-ink)]">Creative Mixer</strong>, or scale exploration with the <strong className="text-[var(--editorial-ink)]">Batch Generator</strong> to create permutations of subjects, moods, and stylistic variables for client presentations or production campaigns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpResources;