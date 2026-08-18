import React, { useState, memo, KeyboardEvent } from 'react';
import { XIcon, PlusIcon } from '../icons';

interface MultiTagInputProps {
    label: string;
    placeholder: string;
    tags: string[];
    maxTags?: number;
    onChange: (tags: string[]) => void;
    colorScheme?: 'violet' | 'amber' | 'emerald' | 'pink';
}

const MultiTagInput = memo(({
    label,
    placeholder,
    tags,
    maxTags = 5,
    onChange,
    colorScheme = 'amber'
}: MultiTagInputProps) => {
    const [input, setInput] = useState('');

    const colors = {
        amber: 'text-[var(--ui-gold)] bg-[var(--ui-gold-soft)] border-[var(--ui-gold)]/40',
        violet: 'text-[var(--ui-violet)] bg-[var(--ui-violet-soft)] border-[var(--ui-violet)]/40',
        emerald: 'text-[var(--ui-teal)] bg-[var(--ui-teal-soft)] border-[var(--ui-teal)]/40',
        pink: 'text-[var(--ui-pink)] bg-[var(--ui-pink-soft)] border-[var(--ui-pink)]/40'
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    };

    const addTag = () => {
        const trimmed = input.trim();
        if (trimmed && tags.length < maxTags && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
            setInput('');
        }
    };

    const removeTag = (index: number) => {
        onChange(tags.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                    {label}
                </label>
                <span className="font-mono text-[10px] text-[var(--editorial-muted)]">
                    {tags.length}/{maxTags}
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5 p-2 min-h-[44px] bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] focus-within:border-[var(--editorial-pink)] transition-all">
                {tags.map((tag, i) => (
                    <span
                        key={i}
                        className={`flex items-center gap-1 px-2 py-0.5 font-mono text-xs border ${colors[colorScheme]}`}
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(i)}
                            className="hover:text-[var(--editorial-coral)] transition-colors"
                        >
                            <XIcon className="w-3 h-3" />
                        </button>
                    </span>
                ))}

                {tags.length < maxTags && (
                    <div className="flex-1 min-w-[120px] flex items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={addTag}
                            placeholder={tags.length === 0 ? placeholder : ''}
                            className="w-full bg-transparent border-none focus:outline-none font-mono text-xs py-0.5 text-[var(--editorial-ink)] placeholder-[var(--editorial-muted)]"
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

MultiTagInput.displayName = 'MultiTagInput';

export default MultiTagInput;
