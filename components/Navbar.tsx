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
  Menu,
  X,
} from "lucide-react";
import Tooltip from "./Tooltip";
import { FEATURE_TOOLS } from "./FeatureHeader";

interface NavbarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activePath, setActivePath] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setActivePath(location.pathname);
    setMobileMenuOpen(false);
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
          <span className="editorial-nav__brand-text hidden sm:inline">
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

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle Mobile Menu"
            aria-expanded={mobileMenuOpen}
            className="editorial-nav__icon-button md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </nav>

      {/* Editorial Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="editorial-nav__drawer md:hidden motion-fade"
          role="dialog"
          aria-label="Mobile Navigation"
        >
          {/* Section 1: Engines */}
          <div className="editorial-nav__drawer-section">
            <div className="editorial-nav__drawer-title">
              01 / Creative Engines
            </div>
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`editorial-nav__drawer-item ${
                activePath === "/" ? "editorial-nav__drawer-item--active" : ""
              }`}
            >
              <HomeIcon className="w-4 h-4" />
              <div>
                <div className="font-bold text-xs uppercase tracking-wide">Studio Home</div>
                <div className="text-[10px] text-[var(--editorial-muted)] font-mono">Overview & Spectrum</div>
              </div>
            </Link>

            {FEATURE_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = location.pathname === tool.path;
              return (
                <Link
                  key={`mobile-nav-${tool.id}`}
                  to={tool.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`editorial-nav__drawer-item ${
                    isActive ? "editorial-nav__drawer-item--active" : ""
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide">{tool.name}</div>
                    <div className="text-[10px] text-[var(--editorial-muted)] font-mono">
                      {tool.tag}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Section 2: Studio, Vault & Guide */}
          <div className="editorial-nav__drawer-section">
            <div className="editorial-nav__drawer-title">
              02 / Workspace, Vault & Settings
            </div>
            <Link
              to="/studio"
              onClick={() => setMobileMenuOpen(false)}
              className={`editorial-nav__drawer-item ${
                activePath === "/studio" ? "editorial-nav__drawer-item--active" : ""
              }`}
            >
              <Palette className="w-4 h-4" />
              <div>
                <div className="font-bold text-xs uppercase tracking-wide">Persona Studio</div>
                <div className="text-[10px] text-[var(--editorial-muted)] font-mono">Interactive Director Workspace</div>
              </div>
            </Link>
            <Link
              to="/library"
              onClick={() => setMobileMenuOpen(false)}
              className={`editorial-nav__drawer-item ${
                activePath === "/library" ? "editorial-nav__drawer-item--active" : ""
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <div>
                <div className="font-bold text-xs uppercase tracking-wide">Universal Vault</div>
                <div className="text-[10px] text-[var(--editorial-muted)] font-mono">Saved Prompts & Formats</div>
              </div>
            </Link>
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={`editorial-nav__drawer-item ${
                activePath === "/settings" ? "editorial-nav__drawer-item--active" : ""
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <div>
                <div className="font-bold text-xs uppercase tracking-wide">Settings</div>
                <div className="text-[10px] text-[var(--editorial-muted)] font-mono">Aesthetics & AI Models</div>
              </div>
            </Link>
            <Link
              to="/help"
              onClick={() => setMobileMenuOpen(false)}
              className={`editorial-nav__drawer-item ${
                activePath === "/help" ? "editorial-nav__drawer-item--active" : ""
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <div>
                <div className="font-bold text-xs uppercase tracking-wide">Field Guide</div>
                <div className="text-[10px] text-[var(--editorial-muted)] font-mono">Documentation & Tips</div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
