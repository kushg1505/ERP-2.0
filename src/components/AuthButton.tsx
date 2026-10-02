"use client";

import { useAuth } from "@/lib/AuthContext";
import { User, LogIn, LogOut } from "lucide-react";
import Link from "next/link";

export function AuthButton() {
  const { user, signInWithGoogle, logout } = useAuth();

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/profile" className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Profile">
          <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </Link>
        <button onClick={logout} className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors" title="Logout">
          <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={signInWithGoogle} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
      <LogIn className="h-4 w-4" />
      Sign In
    </button>
  );
}
