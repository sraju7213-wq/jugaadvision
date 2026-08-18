import React from "react";

const Loading: React.FC = () => {
  return (
    <div
      className="w-full min-h-[40vh] flex items-center justify-center py-12"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-5 h-5 border-2 border-[var(--editorial-rule)] border-t-[var(--editorial-coral)] rounded-full animate-spin" />
    </div>
  );
};

export default Loading;
