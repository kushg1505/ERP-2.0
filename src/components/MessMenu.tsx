"use client";

import React, { useState, useEffect } from "react";
import messMenuData from "@/data/mess_menu.json";
import { format } from "date-fns";
import { Coffee, Utensils, Pizza, Moon, Calendar, ChevronDown, ChevronUp } from "lucide-react";

export default function MessMenu() {
  const [currentDayMenu, setCurrentDayMenu] = useState<any>(null);
  const [otherDays, setOtherDays] = useState<any[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    // Assuming the user is running this during Oct 2026 as per data
    const todayStr = format(today, "dd-MM-yyyy");

    const todayMenu = messMenuData.find((m) => m.date === todayStr);
    
    if (todayMenu) {
      setCurrentDayMenu(todayMenu);
      setOtherDays(messMenuData.filter((m) => m.date !== todayStr));
    } else {
      // If today is not in the menu, default to the first day
      setCurrentDayMenu(messMenuData[0]);
      setOtherDays(messMenuData.slice(1));
    }
  }, []);

  if (!currentDayMenu) return null;

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      <section>
        <div className="flex flex-col gap-2 mb-6">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Utensils className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Today's Mess Menu
          </h2>
          <p className="text-slate-500 font-medium">
            {currentDayMenu.day}, {currentDayMenu.date}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MealCard title="Breakfast" time="8:00 AM - 9:15 AM" icon={<Coffee className="w-5 h-5 text-amber-600" />} items={currentDayMenu.breakfast} bg="bg-amber-50 dark:bg-amber-900/20" border="border-amber-200 dark:border-amber-800/30" />
          <MealCard title="Lunch" time="12:30 PM - 2:15 PM" icon={<Utensils className="w-5 h-5 text-emerald-600" />} items={currentDayMenu.lunch} bg="bg-emerald-50 dark:bg-emerald-900/20" border="border-emerald-200 dark:border-emerald-800/30" />
          <MealCard title="Snacks" time="5:15 PM - 6:00 PM" icon={<Pizza className="w-5 h-5 text-orange-600" />} items={currentDayMenu.snacks} bg="bg-orange-50 dark:bg-orange-900/20" border="border-orange-200 dark:border-orange-800/30" />
          <MealCard title="Dinner" time="8:00 PM - 9:30 PM" icon={<Moon className="w-5 h-5 text-indigo-600" />} items={currentDayMenu.dinner} bg="bg-indigo-50 dark:bg-indigo-900/20" border="border-indigo-200 dark:border-indigo-800/30" />
        </div>
      </section>

      <section className="mt-12">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-500" />
          Upcoming Menu
        </h3>
        
        <div className="flex flex-col gap-3">
          {otherDays.map((day) => (
            <div key={day.date} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all hover:shadow-md">
              <button 
                onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none"
              >
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{day.day}</span>
                  <span className="text-slate-500 ml-3 text-sm">{day.date}</span>
                </div>
                {expandedDay === day.date ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {expandedDay === day.date && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Breakfast</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{day.breakfast}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Lunch</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{day.lunch}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-500 uppercase tracking-wider">Snacks</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{day.snacks}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-500 uppercase tracking-wider">Dinner</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{day.dinner}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MealCard({ title, time, icon, items, bg, border }: { title: string, time: string, icon: React.ReactNode, items: string, bg: string, border: string }) {
  return (
    <div className={`p-5 rounded-2xl border ${bg} ${border} flex flex-col h-full`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
      </div>
      <span className="text-xs font-medium text-slate-500 mb-4">{time}</span>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed mt-auto">
        {items}
      </p>
    </div>
  );
}
