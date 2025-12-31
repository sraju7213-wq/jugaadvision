import React from "react";
import { useNavigate } from "react-router-dom";
import { Palette, Wand2, Sliders } from "lucide-react";

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 pt-10">
      <section className="text-center py-20 animate-slide-up-fade">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/10 border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-md mb-4">
          <Wand2 className="w-4 h-4 text-indigo-500" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-xs font-semibold tracking-[0.2em] text-gray-600 dark:text-gray-300 uppercase">
            Creative AI Studio
          </span>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
          Visualize Your <span className="text-gradient">Imagination.</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          The streamlined AI creative hub for crafting, remixing, and scaling
          prompts faster than ever.
        </p>
      </section>

      <section aria-label="Quick access tools" className="flex flex-col items-center gap-6 pb-12 pt-2">
        <div className="flex flex-wrap justify-center gap-6 sm:gap-10" role="group" aria-label="Main features">
          {[
            {
              label: "Image Generator",
              icon: Palette,
              path: "/generate",
              delay: "0s",
            },
            {
              label: "Image Editor",
              icon: Sliders,
              path: "/edit",
              delay: "0.5s",
            },
            {
              label: "Smart Prompting",
              icon: Wand2,
              path: "/prompt-builder?tab=prompt",
              delay: "1s",
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              aria-label={`Open ${item.label}`}
              className="group flex flex-col items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-full"
            >
              <span
                className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/5 dark:bg-white/10 backdrop-blur-md border border-white/10 shadow-[0_15px_50px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_30px_-5px_rgba(124,58,237,0.5)] will-change-transform animate-float"
                style={{ animationDelay: item.delay }}
                aria-hidden="true"
              >
                <item.icon
                  strokeWidth={1.5}
                  className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-500 drop-shadow transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-12"
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
