import React, { useState, memo, useCallback } from 'react';
import {
    ChevronDownIcon,
    ChevronUpIcon,
    TargetIcon,
    HomeIcon,
    LayoutIcon,
    CameraIcon,
    SunIcon,
    PaletteIcon,
    BoxIcon,
    ShareIcon,
    SparklesIcon,
    ZapIcon
} from '../icons';
import {
    ProfessionalPrompt,
    PURPOSE_LABELS,
    ENVIRONMENT_LABELS,
    FRAMING_LABELS,
    LIGHTING_TYPE_LABELS,
    LIGHTING_QUALITY_LABELS,
    ARRANGEMENT_LABELS,
    OUTPUT_RATIO_LABELS,
    ImagePurposeEnum,
    EnvironmentEnum,
    BackgroundToneEnum,
    BackgroundTextureEnum,
    SurfaceFinishEnum,
    FramingEnum,
    CameraHeightEnum,
    NegativeSpaceEnum,
    ArrangementEnum,
    LensTypeEnum,
    LightingDirectionEnum,
    ColorTemperatureEnum,
    ShadowBehaviorEnum,
    WarmthEnum,
    SaturationEnum,
    GrainEnum,
    OutputRatioEnum
} from '../../lib/schemas/professionalPrompt';
import SliderInput from './SliderInput';
import MultiTagInput from './MultiTagInput';

interface AdvancedSettingsPanelProps {
    settings: Partial<ProfessionalPrompt>;
    onChange: (settings: Partial<ProfessionalPrompt>) => void;
}

const Section = memo(({
    id,
    label,
    icon: Icon,
    isOpen,
    onToggle,
    children,
    badge
}: {
    id: string;
    label: string;
    icon: React.ElementType;
    isOpen: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
    badge?: string;
}) => (
    <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden transition-all duration-300">
        <button
            onClick={() => onToggle(id)}
            className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen
                ? 'bg-[#BF953F]/10 dark:bg-[#BF953F]/5'
                : 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10'
                }`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${isOpen
                    ? 'bg-[#BF953F] text-black border-[#BF953F]'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border-transparent'
                    }`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                    <p className={`text-sm font-bold tracking-tight ${isOpen ? 'text-[#BF953F]' : 'text-gray-900 dark:text-white'
                        }`}>
                        {label}
                    </p>
                    {badge && <p className="text-[10px] text-gray-400 font-medium uppercase">{badge}</p>}
                </div>
            </div>
            {isOpen ? <ChevronUpIcon className="w-5 h-5 text-[#BF953F]" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
        </button>
        {isOpen && (
            <div className="p-4 sm:p-6 bg-white/50 dark:bg-black/20 border-t border-gray-200 dark:border-white/10 space-y-6 animate-in slide-in-from-top-2 duration-300">
                {children}
            </div>
        )}
    </div>
));

const AdvancedSettingsPanel = memo(({ settings, onChange }: AdvancedSettingsPanelProps) => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const toggleSection = useCallback((id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const updateField = (path: string, value: any) => {
        const parts = path.split('.');
        const newSettings = JSON.parse(JSON.stringify(settings));

        let current = newSettings;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;

        onChange(newSettings);
    };

    const getKeys = (schema: any) => Object.keys(schema.Values || schema._def.values || {});

    return (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-2 px-1">
                <ZapIcon className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                    Pro Alchemy Controls
                </h3>
            </div>

            {/* Section 1: Purpose */}
            <Section
                id="purpose"
                label="Intent & Category"
                icon={TargetIcon}
                isOpen={expandedSections.has('purpose')}
                onToggle={toggleSection}
                badge={settings.image_purpose ? PURPOSE_LABELS[settings.image_purpose] : 'Automatic'}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Primary Purpose</label>
                        <select
                            value={settings.image_purpose || ''}
                            onChange={(e) => updateField('image_purpose', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-1 focus:ring-amber-500/50 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(ImagePurposeEnum).map(k => <option key={k} value={k}>{PURPOSE_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                </div>
            </Section>

            {/* Section 2: Environment */}
            <Section
                id="environment"
                label="Environment & Background"
                icon={HomeIcon}
                isOpen={expandedSections.has('environment')}
                onToggle={toggleSection}
                badge={settings.scene?.environment ? ENVIRONMENT_LABELS[settings.scene.environment] : 'Automatic'}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Environment</label>
                        <select
                            value={settings.scene?.environment || ''}
                            onChange={(e) => updateField('scene.environment', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(EnvironmentEnum).map(k => <option key={k} value={k}>{ENVIRONMENT_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Background Tone</label>
                        <select
                            value={settings.scene?.background?.tone || ''}
                            onChange={(e) => updateField('scene.background.tone', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(BackgroundToneEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Surface Material</label>
                        <input
                            type="text"
                            placeholder="e.g. Marble, Aged Oak..."
                            value={settings.scene?.surface?.material || ''}
                            onChange={(e) => updateField('scene.surface.material', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Surface Finish</label>
                        <select
                            value={settings.scene?.surface?.finish || ''}
                            onChange={(e) => updateField('scene.surface.finish', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(SurfaceFinishEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                </div>
            </Section>

            {/* Section 3: Composition */}
            <Section
                id="composition"
                label="Composition & Framing"
                icon={LayoutIcon}
                isOpen={expandedSections.has('composition')}
                onToggle={toggleSection}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Camera Height</label>
                        <select
                            value={settings.composition?.camera_height || ''}
                            onChange={(e) => updateField('composition.camera_height', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(CameraHeightEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Arrangement</label>
                        <select
                            value={settings.composition?.arrangement || ''}
                            onChange={(e) => updateField('composition.arrangement', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(ArrangementEnum).map(k => <option key={k} value={k}>{ARRANGEMENT_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                </div>
            </Section>

            {/* Section 4: Camera */}
            <Section id="camera" label="Optics & Focus" icon={CameraIcon} isOpen={expandedSections.has('camera')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <SliderInput
                        label="Focal Length"
                        value={settings.camera?.focal_length_mm || 35}
                        min={12}
                        max={800}
                        unit="mm"
                        presets={[
                            { label: 'Wide', value: 24 },
                            { label: 'Standard', value: 35 },
                            { label: 'Expert', value: 50 },
                            { label: 'Portrait', value: 85 },
                            { label: 'Tele', value: 200 }
                        ]}
                        onChange={(val) => updateField('camera.focal_length_mm', val)}
                    />
                    <SliderInput
                        label="Aperture"
                        value={settings.camera?.aperture_f || 2.8}
                        min={1}
                        max={22}
                        step={0.1}
                        unit="f/"
                        presets={[
                            { label: 'Bokeh', value: 1.4 },
                            { label: 'Soft', value: 2.8 },
                            { label: 'Sharp', value: 8 },
                            { label: 'Deep', value: 16 }
                        ]}
                        onChange={(val) => updateField('camera.aperture_f', val)}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Lens Type</label>
                        <select
                            value={settings.camera?.lens_type || ''}
                            onChange={(e) => updateField('camera.lens_type', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(LensTypeEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Focus Strategy</label>
                        <input
                            type="text"
                            placeholder="e.g. sharp eyes, blur background..."
                            value={settings.camera?.focus_strategy || ''}
                            onChange={(e) => updateField('camera.focus_strategy', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none"
                        />
                    </div>
                </div>
            </Section>

            {/* Section 5: Lighting */}
            <Section id="lighting" label="Light & Shadows" icon={SunIcon} isOpen={expandedSections.has('lighting')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Primary Source</label>
                        <select
                            value={settings.lighting?.primary?.type || ''}
                            onChange={(e) => updateField('lighting.primary.type', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(LIGHTING_TYPE_LABELS).map(k => <option key={k} value={k}>{LIGHTING_TYPE_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Direction</label>
                        <select
                            value={settings.lighting?.primary?.direction || ''}
                            onChange={(e) => updateField('lighting.primary.direction', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(LightingDirectionEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Temp / Mood</label>
                        <select
                            value={settings.lighting?.color_temperature || ''}
                            onChange={(e) => updateField('lighting.color_temperature', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(ColorTemperatureEnum).map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Shadows</label>
                        <select
                            value={settings.lighting?.shadow_behavior || ''}
                            onChange={(e) => updateField('lighting.shadow_behavior', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(ShadowBehaviorEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Secondary Lighting</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500">Fill / Accent Type</label>
                            <select
                                value={settings.lighting?.secondary?.type || ''}
                                onChange={(e) => updateField('lighting.secondary.type', e.target.value)}
                                className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                            >
                                <option value="">None / AI Suggested</option>
                                {getKeys(LIGHTING_TYPE_LABELS).map(k => <option key={k} value={k}>{LIGHTING_TYPE_LABELS[k] || k}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500">Secondary Position</label>
                            <input
                                type="text"
                                placeholder="e.g. Right fill, Hair light..."
                                value={settings.lighting?.secondary?.position || ''}
                                onChange={(e) => updateField('lighting.secondary.position', e.target.value)}
                                className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none"
                            />
                        </div>
                    </div>
                </div>
            </Section>

            {/* Section 6: Color Grading */}
            <Section id="color" label="Chromatics & Grading" icon={PaletteIcon} isOpen={expandedSections.has('color')} onToggle={toggleSection}>
                <MultiTagInput
                    label="Color Palette"
                    placeholder="Type a color (e.g. Sage Green)..."
                    tags={settings.color_grading?.palette || []}
                    onChange={(tags) => updateField('color_grading.palette', tags)}
                    colorScheme="emerald"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Warmth</label>
                        <select
                            value={settings.color_grading?.warmth || ''}
                            onChange={(e) => updateField('color_grading.warmth', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(WarmthEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Saturation</label>
                        <select
                            value={settings.color_grading?.saturation || ''}
                            onChange={(e) => updateField('color_grading.saturation', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(SaturationEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                </div>
            </Section>

            {/* Section 7: Materials */}
            <Section id="materials" label="Textural Details" icon={BoxIcon} isOpen={expandedSections.has('materials')} onToggle={toggleSection}>
                <MultiTagInput
                    label="Primary Materials"
                    placeholder="e.g. Brushed Gold, Velvet..."
                    tags={settings.materials?.primary || []}
                    onChange={(tags) => updateField('materials.primary', tags)}
                    colorScheme="amber"
                />

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500">Texture Notes</label>
                    <input
                        type="text"
                        placeholder="e.g. Fine grain, hand-stitched, micro-scratches..."
                        value={settings.materials?.texture_notes || ''}
                        onChange={(e) => updateField('materials.texture_notes', e.target.value)}
                        className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none"
                    />
                </div>

                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Authentic Imperfections</p>
                            <p className="text-xs text-gray-500">Adds organic realism to the shot</p>
                        </div>
                        <button
                            onClick={() => updateField('materials.imperfections.include', !settings.materials?.imperfections?.include)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${settings.materials?.imperfections?.include ? 'bg-amber-500' : 'bg-gray-200 dark:bg-white/10'
                                }`}
                        >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.materials?.imperfections?.include ? 'translate-x-6' : ''
                                }`} />
                        </button>
                    </div>

                    {settings.materials?.imperfections?.include && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <MultiTagInput
                                label="Imperfection Types"
                                placeholder="e.g. Dust, Fingerprints, Scratches..."
                                tags={settings.materials?.imperfections?.types || []}
                                onChange={(tags) => updateField('materials.imperfections.types', tags)}
                                colorScheme="amber"
                            />
                        </div>
                    )}
                </div>
            </Section>

            {/* Section 8: Subject Details */}
            <Section id="subject" label="Subject Mastery" icon={SparklesIcon} isOpen={expandedSections.has('subject')} onToggle={toggleSection}>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500">Pose / Orientation</label>
                            <input
                                type="text"
                                placeholder="e.g. 3/4 view, Dynamic action..."
                                value={settings.subject?.pose_or_orientation || ''}
                                onChange={(e) => updateField('subject.pose_or_orientation', e.target.value)}
                                className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500">Condition</label>
                            <input
                                type="text"
                                placeholder="e.g. Pristine, Weathered, Handmade..."
                                value={settings.subject?.condition || ''}
                                onChange={(e) => updateField('subject.condition', e.target.value)}
                                className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                            />
                        </div>
                    </div>
                    <MultiTagInput
                        label="Key Visual Features"
                        placeholder="e.g. Hand-painted details, Embossed logo..."
                        tags={settings.subject?.features || []}
                        onChange={(tags) => updateField('subject.features', tags)}
                        colorScheme="amber"
                    />
                </div>
            </Section>

            {/* Section 9: Mood */}
            <Section id="mood" label="Mood & Atmosphere" icon={ZapIcon} isOpen={expandedSections.has('mood')} onToggle={toggleSection}>
                <MultiTagInput
                    label="Emotional Keywords"
                    placeholder="e.g. Nostalgic, Luxurious, Calm..."
                    tags={settings.mood || []}
                    onChange={(tags) => updateField('mood', tags)}
                    colorScheme="orange"
                />
            </Section>

            {/* Section 10: Output */}
            <Section id="output" label="Finishing & Export" icon={ShareIcon} isOpen={expandedSections.has('output')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Aspect Ratio</label>
                        <select
                            value={settings.post_processing?.output_ratio || ''}
                            onChange={(e) => updateField('post_processing.output_ratio', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(OutputRatioEnum).map(k => <option key={k} value={k}>{OUTPUT_RATIO_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500">Film Grain</label>
                        <select
                            value={settings.post_processing?.grain || ''}
                            onChange={(e) => updateField('post_processing.grain', e.target.value)}
                            className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(GrainEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                </div>
            </Section>
        </div>
    );
});

AdvancedSettingsPanel.displayName = 'AdvancedSettingsPanel';

export default AdvancedSettingsPanel;
