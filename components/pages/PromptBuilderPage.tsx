import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Prompt } from "../../types";
import PromptBuilder from "../PromptBuilder";
import FeatureHeader from "../FeatureHeader";

interface PromptBuilderPageProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  initialPrompt: Prompt | null;
}

const PromptBuilderPage: React.FC<PromptBuilderPageProps> = ({
  prompts,
  setPrompts,
  initialPrompt,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "image") {
      navigate("/image-to-prompt", { replace: true });
    } else if (tab === "mixer") {
      navigate("/creative-mixer", { replace: true });
    } else if (tab === "batch") {
      navigate("/batch-generator", { replace: true });
    } else if (tab === "banner") {
      navigate("/pro-prompter", { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="feature-theme-builder w-full max-w-6xl mx-auto pb-16 pt-2">
      <FeatureHeader
        currentId="builder"
        title="Prompt Builder"
        subtitle="Craft fine-tuned AI prompts with platform presets, keyword triggers, quality parameters, and real-time AI enhancement."
        badge="TOKEN & SYNTAX ENGINE"
      />

      <PromptBuilder
        prompts={prompts}
        setPrompts={setPrompts}
        initialPrompt={initialPrompt}
      />
    </div>
  );
};

export default PromptBuilderPage;
