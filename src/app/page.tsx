"use client";

import { useState } from "react";
import QuickSchedule from "@/components/QuickSchedule";
import MessMenu from "@/components/MessMenu";
import { Calendar, Utensils } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"schedule" | "mess">("schedule");
  const [showMessPopup, setShowMessPopup] = useState(true);

  return (
    <main className="w-full flex flex-col items-center min-h-screen">
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mt-8">
        <button 
          onClick={() => setActiveTab("schedule")} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === "schedule" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
        >
          <Calendar className="w-4 h-4" /> 
          Class Schedule
        </button>
        <button 
          onClick={() => { setActiveTab("mess"); setShowMessPopup(false); }} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all relative ${
            activeTab === "mess" 
              ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
              : "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse"
          }`}
        >
          <Utensils className="w-4 h-4" /> 
          Mess Menu
        </button>
      </div>



      <div className="w-full mt-4">
        {activeTab === "schedule" ? (
          <QuickSchedule />
        ) : (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <MessMenu />
          </div>
        )}
      </div>
    </main>
  );
}
