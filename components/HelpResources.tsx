import React from 'react';
import { HelpIcon, PenCircuitIcon, PaletteIcon, ImageIcon } from './icons';

const HelpResources: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto py-8 animate-slide-in space-y-12">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-md-on-surface">User Guide</h2>
                <p className="text-md-on-surface-variant mt-2">Learn how to use Jugaad Visuals effectively.</p>
            </div>

            <div className="grid gap-8">
                <div className="bg-md-surface-container rounded-3xl p-8 border border-md-outline/10 shadow-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500"><PenCircuitIcon className="w-6 h-6" /></div>
                        <h3 className="text-xl font-bold text-md-on-surface">1. Crafting a Prompt</h3>
                    </div>
                    <p className="text-md-on-surface-variant mb-4 text-sm leading-relaxed">
                        Go to the <b>Prompt Builder</b>. You can type words manually or click on "Smart Library" items to add them. 
                        Use the "Enhance" button to let AI rewrite your simple idea into a detailed description. 
                        Don't forget to save your best prompts to the Library!
                    </p>
                </div>

                <div className="bg-md-surface-container rounded-3xl p-8 border border-md-outline/10 shadow-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500"><PaletteIcon className="w-6 h-6" /></div>
                        <h3 className="text-xl font-bold text-md-on-surface">2. Generating Images</h3>
                    </div>
                    <p className="text-md-on-surface-variant mb-4 text-sm leading-relaxed">
                        Navigate to the <b>Image Generator</b>. Paste your prompt or type a new one. 
                        Select "Fast" for quick results or "Premium" for high-definition quality. 
                        Click "Generate" and wait for the magic. You can download the result immediately.
                    </p>
                </div>

                <div className="bg-md-surface-container rounded-3xl p-8 border border-md-outline/10 shadow-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500"><ImageIcon className="w-6 h-6" /></div>
                        <h3 className="text-xl font-bold text-md-on-surface">3. Editing Images</h3>
                    </div>
                    <p className="text-md-on-surface-variant mb-4 text-sm leading-relaxed">
                        Use the <b>Image Editor</b> to modify existing pictures. Upload an image, then use the "Brush" tool 
                        to paint over the area you want to change. In the instruction box, describe what should happen 
                        (e.g., "Make the sky blue"). AI will only change the painted area.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HelpResources;