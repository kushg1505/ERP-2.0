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

      {showMessPopup && activeTab !== "mess" && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm cursor-pointer animate-in fade-in duration-300"
          onClick={() => setShowMessPopup(false)}
        >
          <div className="bg-white dark:bg-slate-800 p-8 sm:p-12 rounded-3xl shadow-2xl max-w-lg mx-4 text-center transform transition-transform scale-100 cursor-default" onClick={(e) => e.stopPropagation()}>
             <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
               <Utensils className="w-10 h-10 animate-bounce" />
             </div>
             <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">New Feature! 🎉</h2>
             <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
               You can now check the <strong>Mess Menu</strong> directly from your home page and dashboard!
             </p>
             <button 
               onClick={() => { setActiveTab("mess"); setShowMessPopup(false); }}
               className="w-full py-4 rounded-xl font-bold text-lg text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
             >
               View Mess Menu Now
             </button>
          </div>
        </div>
      )}

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
