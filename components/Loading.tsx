import React from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";

const Loading: React.FC = () => {
  return (
    <ProcessingAnimation
      variant="page"
      theme="auto"
      badge="00 / Environment"
      title="Initializing Jugaad Visuals Studio"
      stages={[
        "Loading neural creative workspace...",
        "Synchronizing model adapters...",
        "Calibrating prompt engineering matrix...",
        "Preparing visual synthesis canvas...",
      ]}
      stageIntervalMs={1800}
      subtext="Loading high-precision creative AI tools and generative parameters."
    />
  );
};

export default Loading;
