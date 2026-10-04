"use client";

import { useAuth } from "@/lib/AuthContext";
import { User, LogIn, LogOut, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { DisclaimerModal } from "./DisclaimerModal";

export function AuthButton() {
  const { user, signInWithGoogle, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (user) {
    return (
      <div className="flex items-center gap-3" ref={dropdownRef}>
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`p-2 rounded-full transition-colors flex items-center justify-center
              ${isDropdownOpen 
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            title="Account"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="h-5 w-5 rounded-full" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {user.displayName || "Student"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {user.email}
                </p>
              </div>
              
              <div className="p-2">
                <Link 
                  href="/profile" 
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                >
                  <BookOpen className="h-4 w-4" />
                  Manage My Courses
                </Link>
                
                <button 
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors mt-1"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleSignIn = () => {
    setShowDisclaimer(true);
  };

  const onDisclaimerAccept = async () => {
    setShowDisclaimer(false);
    await signInWithGoogle();
    if (pathname === "/") {
      router.push("/profile");
    }
  };

  return (
    <>
      <DisclaimerModal 
        isOpen={showDisclaimer} 
        onAccept={onDisclaimerAccept} 
        onCancel={() => setShowDisclaimer(false)} 
      />
      <button onClick={handleSignIn} className="btn-primary flex items-center justify-center gap-2 text-sm px-3 sm:px-4 py-2 whitespace-nowrap">
        <LogIn className="h-4 w-4 shrink-0" />
        <span>Sign In</span>
      </button>
    </>
  );
}
