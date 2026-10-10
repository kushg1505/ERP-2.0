import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { CalendarDays, Settings, ExternalLink } from "lucide-react";
import { AuthProvider } from "@/lib/AuthContext";
import { AuthButton } from "@/components/AuthButton";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { AdminLink } from "@/components/AdminLink";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BunkWise",
  description: "Personalized timetable and clash management made exclusively for IMT Ghaziabad students.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BunkWise",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
                      <img src="/icon.png" alt="BunkWise Logo" className="h-10 w-auto group-hover:scale-105 transition-transform" />
                      <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">BunkWise</span>
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
                    <AdminLink />
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
                      <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">BunkWise</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Intelligent Timetable & Clash Management, made exclusively for IMT Ghaziabad students.</p>
                  </div>

                  <div className="flex flex-col items-center md:items-end text-center md:text-right">
                    <p className="text-slate-700 dark:text-slate-200 font-bold text-base">
                      Developed by{' '}
                      <a href="https://www.linkedin.com/in/kush-goyal-5218661b4" target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-2 underline-offset-4 transition-colors">
                        Kush Goyal
                      </a>
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">Batch 2025-27</p>
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
