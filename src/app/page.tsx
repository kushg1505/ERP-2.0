import Link from "next/link";
import { ArrowRight, Calendar, AlertTriangle, ShieldCheck } from "lucide-react";
import QuickSchedule from "@/components/QuickSchedule";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 pt-12">
      <div className="space-y-6 max-w-3xl no-print">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent pb-2">
          Your MBA Schedule, Simplified.
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          No more missing classes or guessing clash resolutions. Get your personalized timetable, clash alerts, and attendance tracking all in one place.
        </p>
      </div>

      <QuickSchedule />

      <div className="mt-12 max-w-4xl w-full no-print">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-10 text-white shadow-2xl shadow-blue-900/20 flex flex-col md:flex-row items-center justify-between gap-8 transform transition-all hover:scale-[1.01]">
          <div className="text-left space-y-3 flex-1">
            <h2 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              Unlock the Full Experience
            </h2>
            <p className="text-blue-100 text-lg">
              Sign in to create your permanent profile. Get access to fully customizable timetables, personalized attendance tracking, and smart clash management.
            </p>
          </div>
          <Link href="/dashboard" className="shrink-0 bg-white text-blue-700 hover:bg-blue-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-1 active:translate-y-0">
            Create Free Account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mt-16 max-w-5xl w-full text-left no-print">
        <div className="glass-panel p-6 rounded-2xl hover-lift">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">Personalized Timetable</h3>
          <p className="text-slate-600 dark:text-slate-400">View only the classes you are enrolled in. No more scrolling through the giant master PDF.</p>
        </div>
        
        <div className="glass-panel p-6 rounded-2xl hover-lift">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">Smart Clash Alerts</h3>
          <p className="text-slate-600 dark:text-slate-400">Instantly see if you have a schedule clash and the official resolution provided by the program office.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl hover-lift">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">Attendance Tracking</h3>
          <p className="text-slate-600 dark:text-slate-400">Keep a reliable personal record of your attendance, especially for classes attended in alternate sections.</p>
        </div>
      </div>
    </div>
  );
}
