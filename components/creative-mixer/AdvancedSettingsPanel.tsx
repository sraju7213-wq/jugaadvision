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
    <div className="editorial-panel transition-all">
        <button
            type="button"
            onClick={() => onToggle(id)}
            className={`w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors ${isOpen
                ? 'bg-[var(--ui-surface)]'
                : 'bg-[var(--ui-surface-muted)] hover:bg-[var(--ui-surface)]'
                }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-7 h-7 flex items-center justify-center border transition-colors ${isOpen
                    ? 'bg-[var(--ui-pink)] text-white border-[var(--ui-pink)]'
                    : 'bg-[var(--ui-surface)] text-[var(--ui-pink)] border-[var(--ui-border)]'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                    <p className="m-0 font-serif text-sm font-normal text-[var(--ui-ink)]">
                        {label}
                    </p>
                    {badge && (
                        <p className="m-0 font-mono text-[10px] text-[var(--ui-muted)] uppercase tracking-wider">
                            {badge}
                        </p>
                    )}
                </div>
            </div>
            {isOpen ? (
                <ChevronUpIcon className="w-4 h-4 text-[var(--ui-pink)]" />
            ) : (
                <ChevronDownIcon className="w-4 h-4 text-[var(--ui-muted)]" />
            )}
        </button>
        {isOpen && (
            <div className="p-4 sm:p-5 bg-[var(--ui-surface)] border-t border-[var(--ui-border)] space-y-5 motion-fade">
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

    const getKeys = (schema: any) => {
        if (!schema) return [];
        // Handle Zod Enum
        if (schema._def?.values) return schema._def.values;
        // Handle Zod Object / other Zod types with .values
        if (schema.values && typeof schema.values === 'object' && !Array.isArray(schema.values)) {
            return Object.keys(schema.values);
        }
        // Handle plain objects (like labels)
        if (typeof schema === 'object') return Object.keys(schema);
        return [];
    };

    return (
        <div className="space-y-4 pt-4 border-t border-[var(--ui-border)] motion-section-enter">
            <div className="flex items-center gap-2 mb-2 px-1">
                <ZapIcon className="w-4 h-4 text-[var(--ui-pink)]" />
                <h3 className="text-xs font-mono font-bold text-[var(--ui-muted)] uppercase tracking-[0.2em]">
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
                        <label className="editorial-label">Primary Purpose</label>
                        <select
                            value={settings.image_purpose || ''}
                            onChange={(e) => updateField('image_purpose', e.target.value)}
                            className="editorial-select cursor-pointer"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="editorial-label">Environment</label>
                        <select
                            value={settings.scene?.environment || ''}
                            onChange={(e) => updateField('scene.environment', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(EnvironmentEnum).map(k => <option key={k} value={k}>{ENVIRONMENT_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Background Tone</label>
                        <select
                            value={settings.scene?.background?.tone || ''}
                            onChange={(e) => updateField('scene.background.tone', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(BackgroundToneEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Surface Material</label>
                        <input
                            type="text"
                            placeholder="e.g. Marble, Aged Oak..."
                            value={settings.scene?.surface?.material || ''}
                            onChange={(e) => updateField('scene.surface.material', e.target.value)}
                            className="editorial-input"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Surface Finish</label>
                        <select
                            value={settings.scene?.surface?.finish || ''}
                            onChange={(e) => updateField('scene.surface.finish', e.target.value)}
                            className="editorial-select"
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
                        <label className="editorial-label">Camera Height</label>
                        <select
                            value={settings.composition?.camera_height || ''}
                            onChange={(e) => updateField('composition.camera_height', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(CameraHeightEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Arrangement</label>
                        <select
                            value={settings.composition?.arrangement || ''}
                            onChange={(e) => updateField('composition.arrangement', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(ArrangementEnum).map(k => <option key={k} value={k}>{ARRANGEMENT_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                </div>
            </Section>

            {/* Section 4: Camera */}
            <Section id="camera" label="Optics & Focus" icon={CameraIcon} isOpen={expandedSections.has('camera')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                        <label className="editorial-label">Lens Type</label>
                        <select
                            value={settings.camera?.lens_type || ''}
                            onChange={(e) => updateField('camera.lens_type', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(LensTypeEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Focus Strategy</label>
                        <input
                            type="text"
                            placeholder="e.g. sharp eyes, blur background..."
                            value={settings.camera?.focus_strategy || ''}
                            onChange={(e) => updateField('camera.focus_strategy', e.target.value)}
                            className="editorial-input"
                        />
                    </div>
                </div>
            </Section>

            {/* Section 5: Lighting */}
            <Section id="lighting" label="Light & Shadows" icon={SunIcon} isOpen={expandedSections.has('lighting')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="editorial-label">Primary Source</label>
                        <select
                            value={settings.lighting?.primary?.type || ''}
                            onChange={(e) => updateField('lighting.primary.type', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(LIGHTING_TYPE_LABELS).map(k => <option key={k} value={k}>{LIGHTING_TYPE_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Direction</label>
                        <select
                            value={settings.lighting?.primary?.direction || ''}
                            onChange={(e) => updateField('lighting.primary.direction', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(LightingDirectionEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Temp / Mood</label>
                        <select
                            value={settings.lighting?.color_temperature || ''}
                            onChange={(e) => updateField('lighting.color_temperature', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(ColorTemperatureEnum).map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Shadows</label>
                        <select
                            value={settings.lighting?.shadow_behavior || ''}
                            onChange={(e) => updateField('lighting.shadow_behavior', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(ShadowBehaviorEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-[var(--ui-border)]">
                    <p className="font-mono text-xs font-bold text-[var(--ui-muted)] uppercase tracking-widest">Secondary Lighting</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="editorial-label">Fill / Accent Type</label>
                            <select
                                value={settings.lighting?.secondary?.type || ''}
                                onChange={(e) => updateField('lighting.secondary.type', e.target.value)}
                                className="editorial-select"
                            >
                                <option value="">None / AI Suggested</option>
                                {getKeys(LIGHTING_TYPE_LABELS).map(k => <option key={k} value={k}>{LIGHTING_TYPE_LABELS[k] || k}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="editorial-label">Secondary Position</label>
                            <input
                                type="text"
                                placeholder="e.g. Right fill, Hair light..."
                                value={settings.lighting?.secondary?.position || ''}
                                onChange={(e) => updateField('lighting.secondary.position', e.target.value)}
                                className="editorial-input"
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
                    colorScheme="pink"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                        <label className="editorial-label">Warmth</label>
                        <select
                            value={settings.color_grading?.warmth || ''}
                            onChange={(e) => updateField('color_grading.warmth', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(WarmthEnum).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Saturation</label>
                        <select
                            value={settings.color_grading?.saturation || ''}
                            onChange={(e) => updateField('color_grading.saturation', e.target.value)}
                            className="editorial-select"
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
                    colorScheme="pink"
                />

                <div className="space-y-2 mt-4">
                    <label className="editorial-label">Texture Notes</label>
                    <input
                        type="text"
                        placeholder="e.g. Fine grain, hand-stitched, micro-scratches..."
                        value={settings.materials?.texture_notes || ''}
                        onChange={(e) => updateField('materials.texture_notes', e.target.value)}
                        className="editorial-input"
                    />
                </div>

                <div className="p-4 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-serif text-sm font-bold text-[var(--ui-ink)] m-0">Authentic Imperfections</p>
                            <p className="font-mono text-xs text-[var(--ui-muted)] m-0 mt-0.5">Adds organic realism to the shot</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => updateField('materials.imperfections.include', !settings.materials?.imperfections?.include)}
                            className={`relative w-11 h-6 transition-colors border ${settings.materials?.imperfections?.include
                                ? 'bg-[var(--ui-pink)] border-[var(--ui-pink)]'
                                : 'bg-[var(--ui-surface)] border-[var(--ui-border-strong)]'
                                }`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-[var(--ui-ink)] transition-transform ${settings.materials?.imperfections?.include
                                ? 'translate-x-5 bg-white'
                                : ''
                                }`} />
                        </button>
                    </div>

                    {settings.materials?.imperfections?.include && (
                        <div className="motion-fade pt-2">
                            <MultiTagInput
                                label="Imperfection Types"
                                placeholder="e.g. Dust, Fingerprints, Scratches..."
                                tags={settings.materials?.imperfections?.types || []}
                                onChange={(tags) => updateField('materials.imperfections.types', tags)}
                                colorScheme="pink"
                            />
                        </div>
                    )}
                </div>
            </Section>

            {/* Section 8: Subject Details */}
            <Section id="subject" label="Subject Mastery" icon={SparklesIcon} isOpen={expandedSections.has('subject')} onToggle={toggleSection}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="editorial-label">Pose / Orientation</label>
                            <input
                                type="text"
                                placeholder="e.g. 3/4 view, Dynamic action..."
                                value={settings.subject?.pose_or_orientation || ''}
                                onChange={(e) => updateField('subject.pose_or_orientation', e.target.value)}
                                className="editorial-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="editorial-label">Condition</label>
                            <input
                                type="text"
                                placeholder="e.g. Pristine, Weathered, Handmade..."
                                value={settings.subject?.condition || ''}
                                onChange={(e) => updateField('subject.condition', e.target.value)}
                                className="editorial-input"
                            />
                        </div>
                    </div>
                    <MultiTagInput
                        label="Key Visual Features"
                        placeholder="e.g. Hand-painted details, Embossed logo..."
                        tags={settings.subject?.features || []}
                        onChange={(tags) => updateField('subject.features', tags)}
                        colorScheme="pink"
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
                    colorScheme="pink"
                />
            </Section>

            {/* Section 10: Output */}
            <Section id="output" label="Finishing & Export" icon={ShareIcon} isOpen={expandedSections.has('output')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="editorial-label">Aspect Ratio</label>
                        <select
                            value={settings.post_processing?.output_ratio || ''}
                            onChange={(e) => updateField('post_processing.output_ratio', e.target.value)}
                            className="editorial-select"
                        >
                            <option value="">AI Suggested</option>
                            {getKeys(OutputRatioEnum).map(k => <option key={k} value={k}>{OUTPUT_RATIO_LABELS[k] || k}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="editorial-label">Film Grain</label>
                        <select
                            value={settings.post_processing?.grain || ''}
                            onChange={(e) => updateField('post_processing.grain', e.target.value)}
                            className="editorial-select"
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
