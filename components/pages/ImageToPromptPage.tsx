import React from "react";
import ImageToPrompt from "../ImageToPrompt";
import FeatureHeader from "../FeatureHeader";

interface ImageToPromptPageProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
}

const ImageToPromptPage: React.FC<ImageToPromptPageProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  return (
    <div className="feature-theme-image w-full max-w-6xl mx-auto pb-16 pt-2">
      <FeatureHeader
        currentId="image-to-prompt"
        title="Image to Prompt"
        subtitle="Reverse-engineer visuals into descriptive prompts. Analyze lighting, perspective, artistic mediums, and style keywords instantly."
        badge="VISION AI ANALYZER"
      />

      <ImageToPrompt
        onSendToBuilder={onSendToBuilder}
        onSaveToLibrary={onSaveToLibrary}
      />
    </div>
  );
};

export default ImageToPromptPage;
