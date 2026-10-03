"use client";

import { useAuth } from "@/lib/AuthContext";
import { User, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export function AuthButton() {
  const { user, signInWithGoogle, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  const handleSignIn = async () => {
    await signInWithGoogle();
    if (pathname === "/") {
      router.push("/profile");
    }
  };

  return (
    <button onClick={handleSignIn} className="btn-primary flex items-center justify-center gap-2 text-sm px-3 sm:px-4 py-2 whitespace-nowrap">
      <LogIn className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Sign In</span>
    </button>
  );
}
