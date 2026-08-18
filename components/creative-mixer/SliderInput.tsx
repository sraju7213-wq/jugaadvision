import React, { memo } from 'react';

interface SliderInputProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    presets?: { label: string; value: number }[];
    onChange: (val: number) => void;
}

const SliderInput = memo(({
    label,
    value,
    min,
    max,
    step = 1,
    unit = '',
    presets,
    onChange
}: SliderInputProps) => {
    return (
        <div className="space-y-3 p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
            <div className="flex items-center justify-between">
                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                    {label}
                </label>
                <div className="px-2 py-0.5 bg-[var(--editorial-paper)] text-[var(--editorial-pink)] border border-[var(--editorial-rule)] font-mono text-xs font-bold">
                    {value}{unit}
                </div>
            </div>

            <div className="relative group px-1">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full h-1 bg-[var(--editorial-rule)] appearance-none cursor-pointer accent-[var(--editorial-pink)]"
                />
            </div>

            {presets && presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {presets.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => onChange(preset.value)}
                            className={`px-2 py-0.5 font-mono text-[10px] font-bold transition-all border ${value === preset.value
                                    ? 'bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]'
                                    : 'bg-[var(--editorial-paper)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-pink)] hover:text-[var(--editorial-ink)]'
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

SliderInput.displayName = 'SliderInput';

export default SliderInput;
