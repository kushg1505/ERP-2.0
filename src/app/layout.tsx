import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { CalendarDays, Settings } from "lucide-react";
import { AuthProvider } from "@/lib/AuthContext";
import { AuthButton } from "@/components/AuthButton";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Class Schedule & Clash Manager",
  description: "Personalized timetable and clash management for MBA students.",
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
                      <span className="font-bold text-xl tracking-tight hidden sm:block bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">ClassManager</span>
                    </Link>
                    <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                      <Link href="/dashboard" className="border-transparent text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-bold transition-all">
                        Dashboard
                      </Link>
                      <Link href="/profile" className="border-transparent text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-bold transition-all">
                        My Courses
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link href="/admin" className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors" title="Admin Portal">
                      <Settings className="h-5 w-5" />
                    </Link>
                    <AuthButton />
                  </div>
                </div>
              </div>
            </nav>
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
