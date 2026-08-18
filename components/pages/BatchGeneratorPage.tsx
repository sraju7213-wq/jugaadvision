import React from "react";
import BatchGenerator from "../BatchGenerator";
import FeatureHeader from "../FeatureHeader";

interface BatchGeneratorPageProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
}

const BatchGeneratorPage: React.FC<BatchGeneratorPageProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  return (
    <div className="feature-theme-batch w-full max-w-6xl mx-auto pb-16 pt-2">
      <FeatureHeader
        currentId="batch-generator"
        title="Batch Generator"
        subtitle="Produce high-volume prompt matrices and diverse stylistic variants at scale with custom permutation presets."
        badge="VARIATION & MATRIX ENGINE"
      />

      <BatchGenerator
        onSendToBuilder={onSendToBuilder}
        onSaveToLibrary={onSaveToLibrary}
      />
    </div>
  );
};

export default BatchGeneratorPage;
