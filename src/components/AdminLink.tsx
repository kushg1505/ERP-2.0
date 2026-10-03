"use client";

import { useAuth } from "@/lib/AuthContext";
import { Settings } from "lucide-react";
import Link from "next/link";

export function AdminLink() {
  const { user } = useAuth();
  
  // Replace these with your actual admin emails
  const ADMIN_EMAILS = ['kushg0259@gmail.com', 'your.email@example.com'];
  
  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
    return null;
  }

  return (
    <Link href="/admin" className="hidden sm:block p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors" title="Admin Portal">
      <Settings className="h-5 w-5" />
    </Link>
  );
}
