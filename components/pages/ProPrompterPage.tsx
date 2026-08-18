import React from "react";
import BannerPrompter from "../BannerPrompter";
import FeatureHeader from "../FeatureHeader";

interface ProPrompterPageProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
}

const ProPrompterPage: React.FC<ProPrompterPageProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  return (
    <div className="feature-theme-pro w-full max-w-6xl mx-auto pb-16 pt-2">
      <FeatureHeader
        currentId="pro-prompter"
        title="Pro Prompter"
        subtitle="Formulate publication-ready banner designs, architectural compositions, negative space layouts, and studio lighting blueprints."
        badge="CINEMATIC & BANNER ARCHITECT"
      />

      <BannerPrompter
        onSendToBuilder={onSendToBuilder}
        onSaveToLibrary={onSaveToLibrary}
      />
    </div>
  );
};

export default ProPrompterPage;
