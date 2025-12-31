import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
    LayoutGrid,
    Wand2,
    FlaskConical,
    Layers,
    ScanEye,
    Sliders,
    LogOut,
    Settings,
    Menu,
} from "lucide-react";
import { Theme } from "../types";

interface SidebarProps {
    theme?: Theme;
    open?: boolean;
    setOpen?: (open: boolean) => void;
}

const navItems = [
    { name: "Studio Home", icon: LayoutGrid, path: "/" },
    { name: "Prompt Builder", icon: Wand2, path: "/prompt-builder?tab=prompt" },
    { name: "Creative Mixer", icon: FlaskConical, path: "/creative-mixer" },
    { name: "Batch Studio", icon: Layers, path: "/batch-generator" },
    { name: "Vision (Img2Prompt)", icon: ScanEye, path: "/image-to-prompt" },
];

const Sidebar: React.FC<SidebarProps> = ({ open = true }) => {
    const location = useLocation();

    return (
        <aside
            className={`fixed top-0 left-0 h-full bg-white dark:bg-[#0f1015] border-r border-gray-200 dark:border-white/5 transition-all duration-300 z-50 flex flex-col ${open ? "w-64" : "w-20"
                }`}
        >
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-white/5 bg-transparent">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
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
            <nav className="flex-1 py-6 px-3 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path.split('?')[0];

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                                    ? "bg-indigo-50 dark:bg-white/5 text-indigo-600 dark:text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            <item.icon
                                strokeWidth={1.5}
                                className={`w-5 h-5 transition-colors ${isActive
                                        ? "text-indigo-600 dark:text-white fill-indigo-600/10 dark:fill-white/10"
                                        : "group-hover:text-gray-900 dark:group-hover:text-gray-200"
                                    }`}
                            />
                            {open && (
                                <span className={`font-medium text-sm ${isActive ? "font-semibold" : ""}`}>
                                    {item.name}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-gray-200 dark:border-white/5 space-y-1">
                <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 transition-all"
                >
                    <Settings strokeWidth={1.5} className="w-5 h-5" />
                    {open && <span className="font-medium text-sm">Settings</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
