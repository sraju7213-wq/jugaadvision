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
        <div className="space-y-4 p-4 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {label}
                </label>
                <div className="px-3 py-1 bg-[#BF953F]/10 text-[#BF953F] rounded-lg text-sm font-bold border border-[#BF953F]/20">
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
                    className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-[#BF953F] hover:accent-[#D4AF37] transition-all"
                />
            </div>

            {presets && presets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                        <button
                            key={preset.label}
                            onClick={() => onChange(preset.value)}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${value === preset.value
                                    ? 'bg-[#BF953F] text-black border-transparent shadow-sm'
                                    : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-[#BF953F]/50'
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
