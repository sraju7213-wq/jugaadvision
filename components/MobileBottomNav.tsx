import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  Wand2,
  ScanEye,
  FlaskConical,
  Layers,
  Sparkles,
  Palette,
  Bookmark,
  Settings as SettingsIcon,
  HelpCircle,
} from "lucide-react";

interface MobileBottomNavProps {
  theme?: "light" | "dark";
  toggleTheme?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = () => {
  const location = useLocation();
  const [activePath, setActivePath] = useState(location.pathname);

  useEffect(() => {
    setActivePath(location.pathname);
  }, [location.pathname]);

  const allPages = [
    {
      id: "home",
      label: "Home",
      path: "/",
      icon: HomeIcon,
    },
    {
      id: "builder",
      label: "Builder",
      path: "/prompt-builder",
      icon: Wand2,
    },
    {
      id: "vision",
      label: "Vision",
      path: "/image-to-prompt",
      icon: ScanEye,
    },
    {
      id: "mixer",
      label: "Mixer",
      path: "/creative-mixer",
      icon: FlaskConical,
    },
    {
      id: "batch",
      label: "Batch",
      path: "/batch-generator",
      icon: Layers,
    },
    {
      id: "pro",
      label: "Pro",
      path: "/pro-prompter",
      icon: Sparkles,
    },
    {
      id: "studio",
      label: "Studio",
      path: "/studio",
      icon: Palette,
    },
    {
      id: "vault",
      label: "Vault",
      path: "/library",
      icon: Bookmark,
    },
    {
      id: "settings",
      label: "Settings",
      path: "/settings",
      icon: SettingsIcon,
    },
    {
      id: "help",
      label: "Help",
      path: "/help",
      icon: HelpCircle,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar - All Pages"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--editorial-paper)]/95 backdrop-blur-lg border-t border-[var(--editorial-rule)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{
        paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Horizontal scrollable container showing ALL pages */}
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory px-1 py-1"
           style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
        {allPages.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.path;

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`relative flex flex-col items-center justify-center flex-shrink-0 snap-start min-w-[56px] sm:min-w-[62px] py-1.5 px-1.5 rounded-lg text-center select-none transition-all active:scale-95 ${
                isActive
                  ? "text-[var(--editorial-coral)] bg-[var(--editorial-surface-strong)] font-bold"
                  : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface)] font-medium"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon
                  className={`w-4 h-4 sm:w-[18px] sm:h-[18px] transition-transform duration-200 ${
                    isActive ? "scale-110" : ""
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.7}
                />
                {isActive && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--editorial-coral)]"
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className="font-mono text-[8.5px] sm:text-[9px] uppercase tracking-wider mt-1 leading-none whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
};

export default MobileBottomNav;
