import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  SunIcon,
  MoonIcon,
} from "./icons";
import {
  Wand2,
  ScanEye,
  FlaskConical,
  Layers,
  Sparkles,
  Home as HomeIcon,
  Bookmark,
  Palette,
  Settings as SettingsIcon,
} from "lucide-react";
import Tooltip from "./Tooltip";

interface NavbarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activePath, setActivePath] = useState("");

  useEffect(() => {
    setActivePath(location.pathname);
  }, [location]);

  const navItems = [
    {
      name: "Prompt Builder",
      short: "Builder",
      path: "/prompt-builder",
      icon: Wand2,
    },
    {
      name: "Image to Prompt",
      short: "Vision AI",
      path: "/image-to-prompt",
      icon: ScanEye,
    },
    {
      name: "Creative Mixer",
      short: "Mixer",
      path: "/creative-mixer",
      icon: FlaskConical,
    },
    {
      name: "Batch Generator",
      short: "Batch",
      path: "/batch-generator",
      icon: Layers,
    },
    {
      name: "Pro Prompter",
      short: "Pro Banner",
      path: "/pro-prompter",
      icon: Sparkles,
    },
  ];

  return (
    <header className="editorial-nav">
      <nav
        aria-label="Main navigation"
        className="editorial-nav__inner"
      >
        {/* Editorial Brand Logo */}
        <button
          type="button"
          aria-label="Go to home page"
          className="editorial-nav__brand group flex-shrink-0"
          onClick={() => navigate("/")}
        >
          <div className="editorial-nav__brand-mark">
            J
          </div>
          <span className="editorial-nav__brand-text text-sm sm:text-base inline">
            Jugaad <span>AI</span>
          </span>
        </button>

        {/* Center Links (Desktop) - Independent Feature Items */}
        <div
          className="hidden md:flex items-center gap-1 mx-2"
          role="group"
          aria-label="Main pages"
        >
          {/* Home */}
          <Tooltip content="Studio Home">
            <Link
              to="/"
              className={`editorial-nav__link ${
                activePath === "/" ? "editorial-nav__link--active" : ""
              }`}
            >
              <HomeIcon className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
          </Tooltip>

          <div className="editorial-nav__divider" />

          {/* 5 Independent Generator Features */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePath === item.path;

            return (
              <Tooltip key={item.path} content={item.name}>
                <Link
                  to={item.path}
                  className={`editorial-nav__link ${
                    isActive ? "editorial-nav__link--active" : ""
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">{item.name}</span>
                  <span className="inline xl:hidden">{item.short}</span>
                </Link>
              </Tooltip>
            );
          })}

          <div className="editorial-nav__divider" />

          {/* Studio Workspace */}
          <Tooltip content="Persona AI Studio">
            <Link
              to="/studio"
              className={`editorial-nav__link ${
                activePath === "/studio" ? "editorial-nav__link--active" : ""
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Studio</span>
            </Link>
          </Tooltip>

          {/* Library */}
          <Tooltip content="Saved Prompts Library">
            <Link
              to="/library"
              className={`editorial-nav__link ${
                activePath === "/library" ? "editorial-nav__link--active" : ""
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Vault</span>
            </Link>
          </Tooltip>
        </div>

        {/* Right Actions */}
        <div className="editorial-nav__actions">
          {/* Settings */}
          <Tooltip content="Settings & AI Orchestration">
            <Link
              to="/settings"
              aria-label="Open Settings"
              className={`editorial-nav__icon-button ${
                activePath === "/settings" ? "!border-[var(--editorial-coral)] !text-[var(--editorial-coral)]" : ""
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
            </Link>
          </Tooltip>

          {/* Theme Toggle */}
          <Tooltip content="Toggle Theme">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              className="editorial-nav__icon-button"
            >
              {theme === "light" ? (
                <MoonIcon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <SunIcon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </Tooltip>

        </div>
      </nav>
    </header>
  );
};

export default Navbar;
