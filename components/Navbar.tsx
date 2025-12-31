import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SunIcon,
  MoonIcon,
  BrainCircuitIcon,
  PaletteIcon,
  ImageIcon,
  LightbulbIcon,
} from "./icons";
import Tooltip from "./Tooltip";

interface NavbarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  theme,
  toggleTheme,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activePath, setActivePath] = useState("");

  useEffect(() => {
    setActivePath(location.pathname.split("?")[0]);
  }, [location]);

  return (
    <header className="fixed top-5 z-50 w-full flex justify-center px-4 pointer-events-none">
      <nav aria-label="Main navigation" className="pointer-events-auto flex items-center justify-between px-1.5 sm:px-2 py-1.5 sm:py-2 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-full backdrop-blur-md shadow-lg w-full max-w-2xl transition-all duration-300">
        {/* Logo Area */}
        <button
          type="button"
          aria-label="Go to home page"
          className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-4 cursor-pointer group"
          onClick={() => navigate("/")}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg group-hover:scale-110 transition-transform">
            J
          </div>
          <span className="font-bold text-gray-800 dark:text-white hidden sm:block tracking-tight">
            Jugaad
          </span>
        </button>

        {/* Center Links */}
        <div className="flex items-center gap-0.5 sm:gap-1 mx-1 sm:mx-2" role="group" aria-label="Main pages">
          <button
            type="button"
            onClick={() => navigate("/")}
            className={`h-12 w-12 flex items-center justify-center rounded-full transition-all duration-300 ${activePath === "/" ? "bg-white text-black shadow-md" : "text-gray-600 dark:text-gray-300 hover:bg-white/10"}`}
            aria-label="Dashboard"
            aria-current={activePath === "/" ? "page" : undefined}
          >
            <BrainCircuitIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/generate")}
            className={`h-12 w-12 flex items-center justify-center rounded-full transition-all duration-300 ${activePath === "/generate" ? "bg-white text-black shadow-md" : "text-gray-600 dark:text-gray-300 hover:bg-white/10"}`}
            aria-label="Generate Images"
            aria-current={activePath === "/generate" ? "page" : undefined}
          >
            <PaletteIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/edit")}
            className={`h-12 w-12 flex items-center justify-center rounded-full transition-all duration-300 ${activePath === "/edit" ? "bg-white text-black shadow-md" : "text-gray-600 dark:text-gray-300 hover:bg-white/10"}`}
            aria-label="Edit Images"
            aria-current={activePath === "/edit" ? "page" : undefined}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/prompt-builder?tab=prompt")}
            className={`h-12 w-12 flex items-center justify-center rounded-full transition-all duration-300 ${activePath === "/prompt-builder" ? "bg-white text-black shadow-md" : "text-gray-600 dark:text-gray-300 hover:bg-white/10"}`}
            aria-label="Smart Prompting"
            aria-current={activePath === "/prompt-builder" ? "page" : undefined}
          >
            <LightbulbIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2">
          <Tooltip content="Toggle Theme">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              className="h-12 w-12 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-white/10 transition-colors"
            >
              {theme === "light" ? (
                <MoonIcon className="w-5 h-5" aria-hidden="true" />
              ) : (
                <SunIcon className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
