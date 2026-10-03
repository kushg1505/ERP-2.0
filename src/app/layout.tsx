import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { CalendarDays, Settings } from "lucide-react";
import { AuthProvider } from "@/lib/AuthContext";
import { AuthButton } from "@/components/AuthButton";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ERP 2.0",
  description: "Personalized timetable and clash management made exclusively for IMT Ghaziabad students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <nav className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex">
                    <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl group-hover:scale-110 transition-transform">
                        <CalendarDays className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-bold text-xl tracking-tight hidden sm:block bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">ERP 2.0</span>
                    </Link>
                    <div className="hidden md:flex ml-4 sm:ml-8 space-x-4 sm:space-x-8">
                      <Link href="/dashboard" className="border-transparent text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-bold transition-all">
                        Dashboard
                      </Link>
                      <Link href="/profile" className="border-transparent text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-bold transition-all">
                        Courses
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link href="/admin" className="hidden sm:block p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors" title="Admin Portal">
                      <Settings className="h-5 w-5" />
                    </Link>
                    <AuthButton />
                    <MobileNav />
                  </div>
                </div>
              </div>
            </nav>
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </main>
            
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm mt-auto py-8 no-print">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  
                  <div className="flex flex-col items-center md:items-start text-center md:text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">ERP 2.0</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Intelligent Timetable & Clash Management, made exclusively for IMT Ghaziabad students.</p>
                  </div>

                  <div className="flex flex-col items-center md:items-end text-center md:text-right">
                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                      Developed by <span className="font-bold text-blue-600 dark:text-blue-400">Kush Goyal</span>
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Batch 2025-27</p>
                  </div>

                </div>
              </div>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
