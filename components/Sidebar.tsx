import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Wand2,
  FlaskConical,
  Layers,
  ScanEye,
  Sparkles,
  Palette,
  Bookmark,
  Settings,
} from "lucide-react";
import { Theme } from "../types";

interface SidebarProps {
  theme?: Theme;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

const navItems = [
  { name: "Studio Home", icon: LayoutGrid, path: "/" },
  { name: "Prompt Builder", icon: Wand2, path: "/prompt-builder" },
  { name: "Image to Prompt", icon: ScanEye, path: "/image-to-prompt" },
  { name: "Creative Mixer", icon: FlaskConical, path: "/creative-mixer" },
  { name: "Batch Generator", icon: Layers, path: "/batch-generator" },
  { name: "Pro Prompter", icon: Sparkles, path: "/pro-prompter" },
  { name: "Studio Workspace", icon: Palette, path: "/studio" },
  { name: "Prompt Library", icon: Bookmark, path: "/library" },
];

const Sidebar: React.FC<SidebarProps> = ({ open = true }) => {
  const location = useLocation();

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white dark:bg-[#0f1015] border-r border-gray-200 dark:border-white/5 transition-all duration-300 z-50 flex flex-col ${
        open ? "w-64" : "w-20"
      }`}
    >
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-white/5 bg-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--editorial-ink)] text-[var(--editorial-paper)] flex items-center justify-center font-bold font-serif border border-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-coral)]">
            J
          </div>
          {open && (
            <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
              Jugaad<span className="text-indigo-500">AI</span>
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-hide">
        <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-3 py-1 uppercase tracking-wider mb-1">
          {open ? "Independent Features" : "Tools"}
        </div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-indigo-50 dark:bg-white/5 text-indigo-600 dark:text-white shadow-sm font-semibold"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <item.icon
                strokeWidth={1.5}
                className={`w-5 h-5 transition-colors ${
                  isActive
                    ? "text-indigo-600 dark:text-white"
                    : "group-hover:text-gray-900 dark:group-hover:text-gray-200"
                }`}
              />
              {open && (
                <span className="font-medium text-sm">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-gray-200 dark:border-white/5 space-y-1">
        <Link
          to="/help"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 transition-all"
        >
          <Settings strokeWidth={1.5} className="w-5 h-5" />
          {open && <span className="font-medium text-sm">Help & Resources</span>}
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
