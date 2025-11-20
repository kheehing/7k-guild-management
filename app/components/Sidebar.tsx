"use client";

import React from "react";
import { FaHome, FaUsers, FaCog, FaSignOutAlt, FaSearch } from "react-icons/fa";

interface SidebarProps {
  children?: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  return (
    <div className="flex h-screen w-full">
      {/* Fixed modern sidebar */}
      <aside className="w-72 bg-white/90 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 shadow-lg border-r border-slate-200 dark:border-slate-800 backdrop-blur-md flex flex-col">
        <div className="px-6 py-5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-lg font-semibold">Ap0theosis</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Guild Management</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-auto">
          <a className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">
            <span className="text-sm font-medium">Dashboard</span>
          </a>

          <a className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">
            <span className="text-sm font-medium">Members</span>
          </a>

          <a className="flex items-center gap-3 px-3 py-2 rounded-md" href="#">
            <span className="text-sm font-medium">Settings</span>
          </a>
        </nav>

        <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-100">
              K
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Khee</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Guild Lead</div>
            </div>
            <button className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" aria-label="sign out">
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 p-8">
        {children}
      </main>
    </div>
  );
}