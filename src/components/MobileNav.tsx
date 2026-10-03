"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden ml-2 flex items-center">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 -mr-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-xl p-4 flex flex-col gap-2 z-50">
          <Link 
            href="/dashboard" 
            onClick={() => setIsOpen(false)}
            className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 font-bold text-slate-700 dark:text-slate-200"
          >
            Dashboard
          </Link>
          <Link 
            href="/profile" 
            onClick={() => setIsOpen(false)}
            className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 font-bold text-slate-700 dark:text-slate-200"
          >
            Courses
          </Link>
        </div>
      )}
    </div>
  );
}
