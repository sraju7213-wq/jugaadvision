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
        amber: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/30',
        violet: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800/30',
        emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/30',
        pink: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800/30'
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
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                    {label}
                </label>
                <span className="text-[10px] font-medium text-gray-400">
                    {tags.length}/{maxTags}
                </span>
            </div>

            <div className="flex flex-wrap gap-2 p-2 min-h-[50px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus-within:ring-1 focus-within:ring-[#BF953F]/50 transition-all">
                {tags.map((tag, i) => (
                    <span
                        key={i}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${colors[colorScheme]} animate-in zoom-in duration-200`}
                    >
                        {tag}
                        <button
                            onClick={() => removeTag(i)}
                            className="hover:scale-110 transition-transform"
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
                            className="w-full bg-transparent border-none focus:ring-0 text-sm py-1 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

MultiTagInput.displayName = 'MultiTagInput';

export default MultiTagInput;
