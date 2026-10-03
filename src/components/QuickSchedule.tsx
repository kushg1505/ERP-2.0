"use client";

import { useState, useEffect } from "react";
import { getStudentFromMasterDB, fetchMasterTimetable, fetchAvailableWeeks } from "@/lib/db";
import { RefreshCw, Download, Calendar, ArrowRight, GraduationCap, Crown, Sparkles, Clock, BarChart2, AlertTriangle, ShieldCheck, IdCard, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

const AVAILABLE_SECTIONS = ["A", "B", "C", "D", "E", "F"];
const BFS_FIXED_COURSES = ["MLBFSI", "FIS", "VCPE", "HRM", "BFSI&STY"];
const BFS_ELECTIVE_COURSES = ["BF", "SERM"];

interface ParsedClass {
  courseAbb: string;
  courseName: string;
  section: string;
  day: string;
  timeSlot: string;
  startTime: string;
  endTime: string;
  venue: string;
  faculty: string;
  date: string;
  sessionNo?: string;
  dtiGroup?: string;
}

export default function QuickSchedule() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [year, setYear] = useState("2nd");
  const [spec, setSpec] = useState("core");
  const [rollNo, setRollNo] = useState("");
  
  const [bfsSection, setBfsSection] = useState("A");
  const [bfsElective, setBfsElective] = useState("BF");
  const [dtiGroup, setDtiGroup] = useState("1");
  const [isFinPrep, setIsFinPrep] = useState(false);

  const [myClasses, setMyClasses] = useState<ParsedClass[]>([]);
  const [allDays, setAllDays] = useState<string[]>([]);
  const [allTimeSlots, setAllTimeSlots] = useState<string[]>([]);
  const [activeWeek, setActiveWeek] = useState("");

  const handleGenerate = async () => {
    setError("");
    setLoading(true);

    try {
      const program = `${year}-${spec}`;
      const weeks = await fetchAvailableWeeks(program);
      if (weeks.length === 0) {
        throw new Error("No schedule uploaded for this program yet.");
      }
      
      const targetWeek = weeks[weeks.length - 1]; // Latest week
      setActiveWeek(targetWeek);
      
      const master = await fetchMasterTimetable(targetWeek, program) as ParsedClass[];
      
      let enrolledCourses: {courseCode: string, section: string}[] = [];

      if (year === "1st") {
        // 1st years don't need roll no, we just filter the master table by their section
      } else if (spec === "bfs") {
        for (const c of BFS_FIXED_COURSES) {
          enrolledCourses.push({ courseCode: c, section: bfsSection });
        }
        enrolledCourses.push({ courseCode: bfsElective, section: bfsSection });
      } else {
        if (!rollNo) throw new Error("Please enter your Roll Number.");
        const masterData = await getStudentFromMasterDB(rollNo.trim());
        if (!masterData || !masterData.enrolledCourses) {
          throw new Error("Roll Number not found in master database.");
        }
        enrolledCourses = masterData.enrolledCourses.map((c: any) => ({
          courseCode: c.abbreviation,
          section: c.section
        }));
        if (year === "2nd" && spec === "core" && isFinPrep) {
           enrolledCourses.push({ courseCode: "FINPrep", section: "" });
        }
      }

      // Filter master schedule
      const filtered = year === "1st" ? master.filter(cls => {
         if (cls.courseAbb.startsWith('DTI') && spec === 'core') {
            return cls.dtiGroup === `G-${dtiGroup}`;
         }
         return !cls.section || cls.section.includes(bfsSection);
      }) : master.filter(cls => 
        enrolledCourses.some(c => 
          c.courseCode === cls.courseAbb && 
          (c.courseCode === "FINPrep" || c.section === cls.section || !cls.section || cls.section.includes(c.section))
        )
      );

      // Add SSR Visit for 2nd core
      if (program === "2nd-core") {
        const uniqueDays = Array.from(new Set(master.map(c => c.day))).filter(Boolean);
        
        let thursdays = uniqueDays.filter(d => d.toLowerCase().includes("thursday"));
        
        // If Thursday is completely missing from the master timetable, synthesize it
        if (thursdays.length === 0 && uniqueDays.length > 0) {
           const anyDay = uniqueDays[0];
           const dateStr = anyDay.split(',')[1]?.trim();
           let thursdayStr = "Thursday";
           if (dateStr) {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) {
                 const diff = 4 - d.getDay(); // 4 is Thursday
                 d.setDate(d.getDate() + diff);
                 thursdayStr = `Thursday, ${d.toISOString().split('T')[0]}`;
              }
           }
           thursdays.push(thursdayStr);
        }

        thursdays.forEach(day => {
          filtered.push({
             courseAbb: "SSR",
             courseName: "SSR Visit",
             section: "All",
             day: day,
             timeSlot: "Full Day",
             startTime: "09:00",
             endTime: "18:00",
             venue: "Off-campus",
             faculty: "",
             date: day.split(",")[1]?.trim() || ""
          });
        });
      }

      const daysSet = new Set<string>();
      const slotsSet = new Set<string>();
      
      master.forEach((cls) => {
        if (cls.day && cls.day.trim() !== "") daysSet.add(cls.day);
        if (cls.timeSlot && cls.timeSlot.trim() !== "" && cls.timeSlot !== "Full Day") slotsSet.add(cls.timeSlot);
      });
      
      // Also add days and slots from our filtered list in case we injected any custom ones
      filtered.forEach((cls) => {
        if (cls.day && cls.day.trim() !== "") daysSet.add(cls.day);
        if (cls.timeSlot && cls.timeSlot.trim() !== "" && cls.timeSlot !== "Full Day") slotsSet.add(cls.timeSlot);
      });

      const parseTime = (slot: string) => {
        const ampmMatch = slot.match(/(\d+)[:.](\d+)\s*(am|pm)/i);
        if (ampmMatch) {
          let hours = parseInt(ampmMatch[1]);
          const mins = parseInt(ampmMatch[2]);
          const ampm = ampmMatch[3].toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          return hours + mins / 60;
        }
        const timeMatch = slot.match(/(\d+)[:.](\d+)/);
        if (timeMatch) {
          return parseInt(timeMatch[1]) + parseInt(timeMatch[2]) / 60;
        }
        return 0;
      };
      
      const sortedSlots = Array.from(slotsSet).sort((a, b) => parseTime(a) - parseTime(b));

      const dayOrder: Record<string, number> = { "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6, "sun": 7 };
      const sortedDays = Array.from(daysSet).sort((a, b) => {
        const rankA = dayOrder[a.substring(0, 3).toLowerCase()] || 99;
        const rankB = dayOrder[b.substring(0, 3).toLowerCase()] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(a).getTime() - new Date(b).getTime();
      });

      setAllTimeSlots(sortedSlots);
      setAllDays(sortedDays);
      setMyClasses(filtered);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to generate schedule.");
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (step === 2) {
    return (
      <div className="w-full max-w-6xl mx-auto mt-16 print:mt-0 print-fullscreen print:bg-white print:text-black flex flex-col justify-center">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 no-print gap-4">
          <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium px-4 py-2">&larr; Back to setup</button>
          <div className="flex items-center gap-3">
             <button onClick={handlePrint} className="btn-secondary px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"><Download className="w-4 h-4"/> Download PDF</button>
             {user ? (
               <Link href="/dashboard" className="btn-primary px-6 py-2.5 rounded-lg font-bold flex items-center gap-2">Go to Dashboard <ArrowRight className="w-4 h-4"/></Link>
             ) : (
               <button onClick={async () => { await signInWithGoogle(); router.push('/profile'); }} className="btn-primary px-6 py-2.5 rounded-lg font-bold flex items-center gap-2">Sign In to Edit <ArrowRight className="w-4 h-4"/></button>
             )}
          </div>
        </div>

        {/* Print wrapper */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl border border-slate-200 dark:border-slate-800 print:shadow-none print:border-slate-200 relative overflow-hidden flex flex-col print:max-h-screen print:h-fit box-border">
          
          {/* Header Section */}
          <div className="p-4 sm:p-8 pb-4 sm:pb-6 relative z-10 print:p-6 print:pb-4">
             {/* Top info row */}
             <div className="hidden print:flex justify-between items-center mb-4">
                <span className="font-extrabold text-sm tracking-widest text-slate-700">ERP 2.0</span>
                <span className="text-sm font-medium text-slate-500">{new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
             </div>

             {/* Title & View Toggle */}
             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4 sm:mb-6 relative">
               <div className="relative inline-block">
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight print:text-4xl">
                     <span className="text-slate-900 dark:text-white border-b-4 border-slate-900 dark:border-white pb-1 mr-2">My</span>
                     <span className="text-blue-600">Quick Schedule</span>
                  </h2>
               </div>
               
               <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl no-print self-start sm:self-auto">
                 <button 
                   onClick={() => setViewMode("list")}
                   className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === "list" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                 >
                   List View
                 </button>
                 <button 
                   onClick={() => setViewMode("table")}
                   className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === "table" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                 >
                   Table View
                 </button>
               </div>
             </div>

             {/* Pills row */}
             <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                <div className="flex items-center gap-2 sm:gap-3">
                   {/* Week Pill */}
                   <div className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold shadow-md shadow-blue-500/20 print:shadow-none text-xs sm:text-base print:text-sm print:px-3 print:py-1.5">
                     <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 print:w-3.5 print:h-3.5" />
                     {activeWeek === "week-1-2026" ? (year === "2nd" ? "Week 1 Term 5" : "Week 1 Term 2") : activeWeek.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                   </div>
                   {/* Specialization Pill */}
                   <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold border border-slate-200 dark:border-slate-700 text-xs sm:text-base print:text-sm print:px-3 print:py-1.5">
                     <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 print:w-3.5 print:h-3.5" />
                     {year} Year {spec.toUpperCase()}
                   </div>
                </div>
                {/* Roll No Pill */}
                {rollNo && (
                   <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold border border-slate-200 dark:border-slate-700 text-xs sm:text-base print:text-sm print:px-3 print:py-1.5 mt-1 sm:mt-0">
                     <IdCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 print:w-3.5 print:h-3.5" />
                     Roll No: {rollNo}
                   </div>
                )}
             </div>
          </div>
          
          <div className="px-4 sm:px-8 pb-4 sm:pb-8 relative z-10 flex-1 print:px-6 print:pb-6 print:flex-none">
            {/* Table View (Hidden on screen if in list mode, ALWAYS visible on print) */}
            <div className={`rounded-xl sm:rounded-2xl overflow-x-auto print:overflow-hidden border border-slate-200 print:border-slate-200 ${viewMode === "table" ? "block" : "hidden print:block"}`}>
               <table className="w-full text-left border-collapse bg-white min-w-[800px] xl:min-w-0 print:min-w-0 print:w-full print:table-fixed">
                 <thead>
                   <tr>
                     <th className="p-4 print:p-1 font-bold text-white w-32 print:w-16 border-r border-slate-200 print:border-slate-200 bg-slate-700 print:bg-[#2c4062] sticky left-0 z-20 text-sm print:text-[10px] print-no-sticky text-center align-middle">Day / Time</th>
                     {allTimeSlots.map(slot => (
                       <th key={slot} className="p-3 print:p-1 font-bold text-slate-800 border-r border-slate-200 print:border-slate-200 text-center bg-blue-50/50 print:bg-[#f4f7fb] text-sm print:text-[9px] print-no-sticky align-middle">
                         <span className="print:hidden">{slot}</span>
                         <span className="hidden print:block whitespace-pre-line">{slot.replace('-', '\n')}</span>
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {allDays.map(day => (
                     <tr key={day} className="border-t border-slate-200 print:border-slate-200">
                       <td className="p-4 print:p-1 border-r border-slate-200 print:border-slate-200 whitespace-nowrap bg-slate-50 dark:bg-slate-900 print:bg-[#f8fafd] sticky left-0 z-10 print-no-sticky text-center align-middle">
                         <span className="font-extrabold text-base print:text-[10px] block text-blue-900">{day.split(',')[0]}</span>
                         <span className="text-xs font-medium text-slate-500 mt-1 block print:mt-0.5 print:text-[8px]">{day.split(',')[1]?.trim()}</span>
                       </td>
                       {(() => {
                         const isSSRThursday = year === "2nd" && spec === "core" && day.toLowerCase().includes("thursday");
                         const cells = [];
                         let ssrStarted = false;
                         const slotHasClass = allTimeSlots.map(slot => myClasses.some(c => c.day === day && c.timeSlot === slot));
                         
                         for (let i = 0; i < allTimeSlots.length; i++) {
                           const slot = allTimeSlots[i];
                           const classesInSlot = myClasses.filter(c => c.day === day && c.timeSlot === slot);
                           
                           if (isSSRThursday && !slotHasClass[i]) {
                              if (!ssrStarted) {
                                ssrStarted = true;
                                let j = i;
                                while (j < allTimeSlots.length && !slotHasClass[j]) j++;
                                const ssrColSpan = j - i;
                                
                                cells.push(
                                  <td key={`ssr-${slot}`} colSpan={ssrColSpan} className="p-3 print:p-1 border-r border-slate-200 print:border-slate-200 align-middle">
                                     <div className="flex items-center justify-center h-full min-h-[4.5rem] print:min-h-[2.5rem] bg-amber-50 rounded-xl border border-amber-100/50 mx-1">
                                       <div className="flex items-center gap-2">
                                          <Users className="w-5 h-5 print:w-3 print:h-3 text-amber-500" />
                                          <span className="font-extrabold text-slate-800 tracking-wide text-lg print:text-[10px]">
                                            SSR Visit
                                          </span>
                                       </div>
                                     </div>
                                  </td>
                                );
                                i = j - 1; 
                              } else {
                                cells.push(
                                  <td key={slot} className="p-3 print:p-1 border-r border-slate-200 print:border-slate-200">
                                    <div className="min-h-[4.5rem] print:min-h-[2.5rem] w-full" />
                                  </td>
                                );
                              }
                           } else {
                             cells.push(
                               <td key={slot} className="p-2 sm:p-3 print:p-1 border-r border-slate-200 print:border-slate-200 align-top bg-white">
                                 {classesInSlot.length === 0 ? (
                                   <div className="min-h-[4.5rem] print:min-h-[2.5rem] w-full" />
                                 ) : (
                                   <div className="flex flex-col gap-1.5 h-full">
                                     {classesInSlot.map((cls, idx) => (
                                       <div key={idx} className="p-2 sm:p-3 print:p-1 print:px-1.5 rounded-xl print:rounded border border-blue-100 print:border-slate-200 border-l-4 border-l-blue-600 bg-white shadow-sm print:shadow-none h-full flex flex-col justify-between">
                                         <div>
                                            <div className="font-extrabold text-sm print:text-[9px] text-slate-900 leading-tight">
                                              {cls.courseAbb}{cls.sessionNo ? `-${cls.sessionNo}` : ''}
                                            </div>
                                            <div className="text-xs print:text-[8px] text-slate-500 mt-1 print:mt-0 font-medium break-words leading-tight">
                                              {cls.venue || 'TBA'}
                                            </div>
                                         </div>
                                         <div className="mt-2 print:mt-1 flex">
                                            <span className="bg-blue-50 text-blue-700 font-bold text-[10px] sm:text-xs print:text-[7px] px-2.5 py-1 print:px-1 print:py-0.5 rounded-full border border-blue-100/50 whitespace-nowrap inline-block">
                                              {cls.courseAbb.startsWith('DTI') && cls.dtiGroup ? `Group ${cls.dtiGroup}` : `Sec ${cls.section}`}
                                            </span>
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 )}
                               </td>
                             );
                           }
                         }
                         return cells;
                       })()}
                   </tr>
                 ))}
               </tbody>
             </table>
            </div>

            {/* List View (Hidden on screen if in table mode, NEVER visible on print) */}
            <div className={`flex flex-col gap-6 ${viewMode === "list" ? "block" : "hidden"} print:hidden`}>
                {allDays.map(day => {
                  const isSSRThursday = year === "2nd" && spec === "core" && day.toLowerCase().includes("thursday");
                  const dayClasses = myClasses.filter(c => c.day === day).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
                  
                  if (dayClasses.length === 0 && !isSSRThursday) return null;

                  return (
                    <div key={day} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden print:border-slate-300 print:bg-transparent break-inside-avoid">
                      <div className="bg-slate-100 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center print:bg-slate-50">
                        <div>
                          <h3 className="font-extrabold text-slate-800 dark:text-white text-lg">{day.split(',')[0]}</h3>
                          <span className="text-sm font-medium text-slate-500">{day.split(',')[1]?.trim()}</span>
                        </div>
                      </div>
                      <div className="p-4 sm:p-6 flex flex-col gap-4">
                        {isSSRThursday && dayClasses.length === 0 && (
                          <div className="flex items-center gap-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30 print:border-amber-200">
                            <div className="bg-amber-100 dark:bg-amber-800/50 p-3 rounded-lg print:bg-amber-50">
                              <Users className="w-6 h-6 text-amber-600 dark:text-amber-400 print:text-amber-600" />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-slate-800 dark:text-amber-100 text-lg print:text-slate-800">SSR Visit</h4>
                              <p className="text-amber-700 dark:text-amber-300/80 text-sm font-medium print:text-amber-700">All day field visit</p>
                            </div>
                          </div>
                        )}
                        {isSSRThursday && dayClasses.length > 0 && (
                          <div className="flex items-center gap-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30 print:border-amber-200">
                            <div className="bg-amber-100 dark:bg-amber-800/50 p-3 rounded-lg print:bg-amber-50">
                              <Users className="w-6 h-6 text-amber-600 dark:text-amber-400 print:text-amber-600" />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-slate-800 dark:text-amber-100 text-lg print:text-slate-800">SSR Visit</h4>
                              <p className="text-amber-700 dark:text-amber-300/80 text-sm font-medium print:text-amber-700">Field Visit</p>
                            </div>
                          </div>
                        )}
                        {dayClasses.map((cls, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-100 dark:border-slate-700 border-l-4 border-l-blue-500 shadow-sm transition-all hover:shadow-md break-inside-avoid print:shadow-none print:border-slate-300">
                            <div className="flex-shrink-0 min-w-[120px]">
                              <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-2 print:text-blue-600">
                                <Clock className="w-4 h-4 print:text-blue-600" />
                                {cls.timeSlot}
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-extrabold text-slate-800 dark:text-white text-lg print:text-slate-800">
                                {cls.courseName} <span className="text-slate-400 font-medium text-sm">({cls.courseAbb}{cls.sessionNo ? `-${cls.sessionNo}` : ''})</span>
                              </h4>
                              <div className="flex flex-wrap items-center gap-3 mt-2">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md print:bg-slate-50 print:text-slate-600">
                                  📍 {cls.venue || 'TBA'}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md print:bg-slate-50 print:text-slate-600">
                                  👨‍🏫 {cls.faculty}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800/50 print:bg-transparent print:border-blue-300 print:text-blue-600">
                                {cls.courseAbb.startsWith('DTI') && cls.dtiGroup ? `Group ${cls.dtiGroup}` : `Sec ${cls.section}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
        </div>

        {/* Print Footer */}
        <div className="hidden print:flex px-8 pb-8 justify-end items-center relative z-10">
           <span className="text-slate-500 font-bold text-xs tracking-wide">Generated from ERP 2.0</span>
           <div className="w-8 h-[3px] bg-blue-600 ml-4 rounded-full"></div>
        </div>
      </div>
      
      <div className="mt-8 text-center bg-blue-50 border border-blue-200 rounded-xl p-6 no-print">
           <h3 className="text-lg font-bold text-blue-900 mb-2">Want to save this schedule?</h3>
           <p className="text-blue-700 mb-4">Sign in to edit classes, track your attendance, and manage schedule clashes permanently.</p>
           <Link href="/dashboard" className="btn-primary inline-flex px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50">Create Free Account</Link>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in slide-in-from-bottom-8 duration-700 no-print flex flex-col items-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none z-0 opacity-50"></div>
        
        {/* Top Row: Hero Text & Image */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center w-full relative z-10 mb-12 sm:mb-16">
          {/* Left Side: Hero Text */}
          <div className="space-y-8 text-center lg:text-left relative z-10 w-full max-w-xl mx-auto lg:mx-0">
             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm">
               <GraduationCap className="w-4 h-4" /> Built for IMT Ghaziabad Students
             </div>
             
             <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
               Your MBA <br className="hidden lg:block"/> Schedule, <br className="hidden lg:block"/>
               <span className="text-blue-600 dark:text-blue-500">Simplified.</span>
             </h1>
             
             <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400">
               No more missing classes or guessing clash resolutions. Get your personalized timetable, clash alerts, and attendance tracking all in one place.
             </p>
             
             <div className="mt-8 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 p-4 rounded-2xl inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 shadow-md shadow-blue-500/10 transition-transform hover:scale-[1.02]">
                <span className="font-black text-blue-950 dark:text-blue-50 text-lg sm:text-xl tracking-tight">
                   Developed by{' '}
                   <a href="https://www.linkedin.com/in/kush-goyal-5218661b4" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-600/30 hover:decoration-blue-600 underline-offset-4 transition-all">
                     Kush Goyal
                   </a>
                </span>
                <span className="hidden sm:inline text-blue-400 dark:text-blue-600 font-bold text-xl">&bull;</span>
                <span className="font-black text-blue-950 dark:text-blue-50 text-lg sm:text-xl tracking-tight">Batch 2025-27</span>
             </div>
          </div>
          
          {/* Right Side: Image */}
          <div className="relative z-0 flex justify-center lg:justify-end w-full max-w-xl mx-auto lg:mx-0 pointer-events-none">
             <img src="/hero-light.png" alt="Hero Illustration" className="w-full max-w-lg h-auto dark:hidden drop-shadow-2xl scale-110 object-contain origin-center lg:origin-bottom-right" />
             <img src="/hero-dark.png" alt="Hero Illustration" className="w-full max-w-lg h-auto hidden dark:block drop-shadow-2xl scale-110 object-contain origin-center lg:origin-bottom-right" />
          </div>
        </div>

        {/* Bottom Row: Cards */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-stretch w-full relative z-10">
           {/* Left Card: Generate Quick Schedule */}
           <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/50 shadow-xl shadow-slate-200/50 dark:shadow-none w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-20 text-left flex flex-col h-full">
              <div className="flex-1">
                 <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Generate Quick Schedule</h2>
                    <p className="text-sm text-slate-500">No sign-up required. Just enter your details to view and download your timetable.</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6 w-full">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Year</label>
                      <select value={year} onChange={(e) => setYear(e.target.value)} className="input-field w-full bg-slate-50 dark:bg-slate-800/50">
                        <option value="1st">1st Year</option>
                        <option value="2nd">2nd Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Specialization</label>
                      <select value={spec} onChange={(e) => setSpec(e.target.value)} className="input-field w-full bg-slate-50 dark:bg-slate-800/50">
                        <option value="core">Core</option>
                        <option value="bfs">BFS</option>
                        <option value="dcp">DCP</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {year === "1st" ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Your Section</label>
                          <select value={bfsSection} onChange={(e) => setBfsSection(e.target.value)} className="input-field w-full bg-slate-50 dark:bg-slate-800/50">
                             {(spec === 'bfs' ? ['A', 'B'] : AVAILABLE_SECTIONS).map(s => <option key={s} value={s}>Section {s}</option>)}
                          </select>
                        </div>
                        {spec === 'core' && (
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Your DTI Group</label>
                            <select value={dtiGroup} onChange={(e) => setDtiGroup(e.target.value)} className="input-field w-full bg-slate-50 dark:bg-slate-800/50">
                              {[...Array(11)].map((_, i) => <option key={i+1} value={(i+1).toString()}>Group {i+1}</option>)}
                            </select>
                          </div>
                        )}
                        <p className="text-xs text-blue-500 font-medium mt-2 bg-blue-50 p-2 rounded">Roll Number is not required for 1st-year students.</p>
                      </div>
                    ) : (spec === "core" || spec === "dcp") ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Roll Number</label>
                          <input 
                            type="text" 
                            value={rollNo}
                            onChange={(e) => setRollNo(e.target.value)}
                            className="input-field w-full bg-slate-50 dark:bg-slate-800/50"
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                          />
                        </div>
                        {year === "2nd" && spec === "core" && (
                          <div className="flex items-center gap-2 mt-2">
                             <input type="checkbox" id="finprep" checked={isFinPrep} onChange={(e) => setIsFinPrep(e.target.checked)} className="w-4 h-4 text-blue-600 rounded bg-slate-50 border-slate-300" />
                             <label htmlFor="finprep" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">I am enrolled in FINPrep</label>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Your Section</label>
                          <select value={bfsSection} onChange={(e) => setBfsSection(e.target.value)} className="input-field w-full bg-slate-50 dark:bg-slate-800/50">
                             {(spec === 'bfs' ? ['A', 'B'] : AVAILABLE_SECTIONS).map(s => <option key={s} value={s}>Section {s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Choose Elective</label>
                          <select value={bfsElective} onChange={(e) => setBfsElective(e.target.value)} className="input-field w-full bg-slate-50 dark:bg-slate-800/50">
                             {BFS_ELECTIVE_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {error && <div className="mt-4 text-center text-red-500 font-medium text-sm bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">{error}</div>}

                 <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className="mt-6 btn-primary w-full py-4 rounded-xl font-bold text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 inline-flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Generate My Timetable <ArrowRight className="w-5 h-5 ml-1" /></>}
                </button>
              </div>
           </div>
          
          {/* Right Card: CTA / Welcome Back */}
          <div className="w-full relative z-10 transition-all hover:scale-[1.01] h-full flex flex-col">
             {!user ? (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl shadow-blue-900/30 flex flex-col sm:flex-row items-center sm:items-stretch text-center sm:text-left gap-8 overflow-hidden relative h-full flex-1">
                    
                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                    <div className="flex-1 space-y-4 relative z-10 flex flex-col justify-center">
                      <div className="w-12 h-12 bg-amber-400/20 rounded-xl flex items-center justify-center mx-auto sm:mx-0">
                        <Crown className="w-6 h-6 text-amber-400" />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                        Unlock the Full Experience
                      </h2>
                      <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                        Sign in to create your permanent profile. Get access to fully customizable timetables, personalized attendance tracking, and smart clash management.
                      </p>
                      <button onClick={async () => { await signInWithGoogle(); router.push('/profile'); }} className="bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-xl font-bold text-sm sm:text-base shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-1 active:translate-y-0 w-full sm:w-auto justify-center group mt-2">
                        Create Profile <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>

                    <div className="w-full sm:w-[220px] shrink-0 flex flex-col justify-center gap-3 relative z-10 mt-6 sm:mt-0">
                       <div className="absolute -top-4 -right-2 sm:-right-4 bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-amber-500/40 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-extrabold tracking-wider text-slate-900 uppercase flex items-center gap-1.5 z-20 transform rotate-2">
                          <Sparkles className="w-3.5 h-3.5" /> Recommended
                       </div>
                       
                       <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 hover:bg-white/15 transition-colors">
                         <div className="w-8 h-8 rounded-lg bg-blue-500/40 flex items-center justify-center shrink-0">
                           <Clock className="w-4 h-4 text-blue-50" />
                         </div>
                         <span className="text-sm font-semibold leading-tight text-white">Personalized Timetables</span>
                       </div>
                       
                       <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 hover:bg-white/15 transition-colors">
                         <div className="w-8 h-8 rounded-lg bg-emerald-500/40 flex items-center justify-center shrink-0">
                           <BarChart2 className="w-4 h-4 text-emerald-50" />
                         </div>
                         <span className="text-sm font-semibold leading-tight text-white">Attendance Tracking</span>
                       </div>
                       
                       <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 hover:bg-white/15 transition-colors">
                         <div className="w-8 h-8 rounded-lg bg-amber-500/40 flex items-center justify-center shrink-0">
                           <AlertTriangle className="w-4 h-4 text-amber-50" />
                         </div>
                         <span className="text-sm font-semibold leading-tight text-white">Smart Clash Alerts</span>
                       </div>
                    </div>

                  </div>
               ) : (
                  <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-2xl shadow-emerald-900/30 flex flex-col items-center justify-center text-center gap-6 overflow-hidden relative h-full flex-1">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="w-20 h-20 bg-emerald-400/20 rounded-2xl flex items-center justify-center relative z-10 mb-2">
                      <ShieldCheck className="w-10 h-10 text-emerald-300" />
                    </div>
                    <div className="relative z-10 space-y-4">
                      <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">
                        Welcome back!
                      </h2>
                      <p className="text-emerald-100 text-base sm:text-lg leading-relaxed max-w-sm mx-auto">
                        Head over to your Dashboard to view your personalized schedule, manage attendance, and check for any clashes.
                      </p>
                    </div>
                    <Link href="/dashboard" className="relative z-10 bg-white text-emerald-700 hover:bg-emerald-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-1 active:translate-y-0 group mt-4">
                      Go to Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
               )}
          </div>
        </div>

        {/* Bottom Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 w-full max-w-6xl mx-auto">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/50 hover-lift text-left bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Personalized Timetable</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">View only the classes you are enrolled in. No more scrolling through the giant master PDF.</p>
          </div>
          
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/50 hover-lift text-left bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-800">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Smart Clash Alerts</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Instantly see if you have a schedule clash and the official resolution provided by the program office.</p>
          </div>

          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/50 hover-lift text-left bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800">
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Attendance Tracking</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Keep a reliable personal record of your attendance, especially for classes attended in alternate sections.</p>
          </div>
        </div>

      </div>
    );
  }
}
