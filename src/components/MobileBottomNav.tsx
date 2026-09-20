import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon,
  Camera,
  Plus,
  Bookmark,
  Settings as SettingsIcon,
  MoreVertical,
  X,
  Wand2,
  FlaskConical,
  Layers,
  Sparkles,
  Palette,
} from "lucide-react";
import { triggerHaptic } from "../services/nativeMedia";

/**
 * Phone-first bottom nav: 5 targets only.
 * Home / Photo / +Create (FAB) / Ideas / Settings.
 * Power routes (mixer, batch, pro, studio, help) live inside Create/Home,
 * not as tabs — keeps first-time users unblocked.
 */
const TABS_LEFT = [
  { id: "home", label: "Home", path: "/", icon: HomeIcon },
  { id: "photo", label: "Photo", path: "/image-to-prompt", icon: Camera },
];

const TABS_RIGHT = [
  { id: "library", label: "Library", path: "/library", icon: Bookmark },
  { id: "settings", label: "Settings", path: "/settings", icon: SettingsIcon },
];

const OVERFLOW_ITEMS = [
  { id: "builder", label: "Prompt Builder", path: "/prompt-builder", icon: Wand2 },
  { id: "mixer", label: "Creative Mixer", path: "/creative-mixer", icon: FlaskConical },
  { id: "batch", label: "Batch Generator", path: "/batch-generator", icon: Layers },
  { id: "pro", label: "Pro Prompter", path: "/pro-prompter", icon: Sparkles },
  { id: "studio", label: "Studio", path: "/studio", icon: Palette },
];

export const MobileBottomNav: React.FC<{ theme?: string; toggleTheme?: () => void }> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activePath, setActivePath] = useState(location.pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setActivePath(location.pathname);
  }, [location.pathname]);

  // Close overflow when tapping outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close overflow on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const isCreateActive = ["/prompt-builder", "/creative-mixer", "/batch-generator", "/pro-prompter", "/studio"].some(
    (p) => activePath === p || activePath.startsWith(p + "/")
  );

  const isOverflowActive = OVERFLOW_ITEMS.some((item) => activePath === item.path || activePath.startsWith(item.path + "/"));

  const renderTab = (item: { id: string; label: string; path: string; icon: any }) => {
    const Icon = item.icon;
    const isActive = activePath === item.path;
    return (
      <Link
        key={item.id}
        to={item.path}
        onClick={() => triggerHaptic("selection")}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex flex-col items-center justify-center flex-1 min-w-0 py-2 rounded-xl select-none transition-all active:scale-95 ${
          isActive
            ? "text-[var(--editorial-coral)] font-bold"
            : "text-[var(--editorial-muted)] font-medium"
        }`}
      >
        <Icon
          className="w-[22px] h-[22px]"
          strokeWidth={isActive ? 2.4 : 1.8}
        />
        <span className="text-[10px] tracking-wide mt-0.5 leading-none whitespace-nowrap">
          {item.label}
        </span>
        {isActive && (
          <span
            className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[var(--editorial-coral)]"
            aria-hidden="true"
          />
        )}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--editorial-paper)]/95 backdrop-blur-lg border-t border-[var(--editorial-rule)]"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex items-end px-2 pt-1">
        <div className="flex flex-1">{TABS_LEFT.map(renderTab)}</div>

        {/* Center Create FAB */}
        <div className="flex flex-col items-center px-1 -mt-6" ref={moreRef}>
          <button
            type="button"
            aria-label="Create something new"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => {
              triggerHaptic("medium");
              setMoreOpen((prev) => !prev);
            }}
            className={`flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all active:scale-90 ${
              isCreateActive || isOverflowActive
                ? "bg-[var(--editorial-coral)] text-white"
                : "bg-[var(--editorial-ink)] text-[var(--editorial-paper)]"
            }`}
          >
            {moreOpen ? <X className="w-7 h-7" strokeWidth={2.4} /> : <Plus className="w-7 h-7" strokeWidth={2.4} />}
          </button>
          <span
            className={`text-[10px] tracking-wide mt-1 leading-none ${
              isCreateActive || isOverflowActive ? "text-[var(--editorial-coral)] font-bold" : "text-[var(--editorial-muted)] font-medium"
            }`}
          >
            {moreOpen ? "Cancel" : "Create"}
          </span>

          {/* Overflow bottom sheet */}
          {moreOpen && (
            <div
              className="absolute bottom-16 left-1/2 -translate-x-1/2 w-56 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] rounded-2xl shadow-2xl py-3 z-50"
              role="menu"
            >
              {OVERFLOW_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path || activePath.startsWith(item.path + "/");
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    role="menuitem"
                    className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? "text-[var(--editorial-coral)] bg-[var(--editorial-coral-soft)]"
                        : "text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface)]"
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--editorial-coral)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-1">{TABS_RIGHT.map(renderTab)}</div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
