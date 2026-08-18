import React from "react";
import CreativeMixer from "../CreativeMixer";
import FeatureHeader from "../FeatureHeader";

interface CreativeMixerPageProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
}

const CreativeMixerPage: React.FC<CreativeMixerPageProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  return (
    <div className="feature-theme-mixer w-full max-w-6xl mx-auto pb-16 pt-2">
      <FeatureHeader
        currentId="creative-mixer"
        title="Creative Mixer"
        subtitle="Synthesize multiple aesthetic concepts, artist techniques, cinema cameras, and color palettes into unique hybrid compositions."
        badge="STYLE & CONCEPT FUSION"
      />

      <CreativeMixer
        onSendToBuilder={onSendToBuilder}
        onSaveToLibrary={onSaveToLibrary}
      />
    </div>
  );
};

export default CreativeMixerPage;
