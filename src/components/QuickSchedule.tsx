"use client";

import { useState, useEffect } from "react";
import { getStudentFromMasterDB, fetchMasterTimetable, fetchAvailableWeeks } from "@/lib/db";
import { RefreshCw, Download, Calendar, ArrowRight } from "lucide-react";
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
}

export default function QuickSchedule() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [year, setYear] = useState("2nd");
  const [spec, setSpec] = useState("core");
  const [rollNo, setRollNo] = useState("");
  
  const [bfsSection, setBfsSection] = useState("A");
  const [bfsElective, setBfsElective] = useState("BF");

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

      if (spec === "bfs") {
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
      }

      // Filter master schedule
      const filtered = master.filter(cls => 
        enrolledCourses.some(c => 
          c.courseCode === cls.courseAbb && 
          (c.section === cls.section || !cls.section || cls.section.includes(c.section))
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
        const ampmMatch = slot.match(/(\d+):(\d+)\s*(am|pm)/i);
        if (ampmMatch) {
          let hours = parseInt(ampmMatch[1]);
          const mins = parseInt(ampmMatch[2]);
          const ampm = ampmMatch[3].toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          return hours + mins / 60;
        }
        const timeMatch = slot.match(/(\d+):(\d+)/);
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
      <div className="w-full max-w-6xl mx-auto mt-16 print-fullscreen">
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden print-no-border">
          <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex justify-between items-center print-header">
             <div>
                <h2 className="text-2xl font-bold">My Quick Schedule</h2>
                <div className="mt-3 flex items-center gap-3">
                   <span className="font-extrabold text-xl text-blue-400 bg-blue-900/40 px-3 py-1 rounded-lg border border-blue-800/50 print:text-blue-700 print:bg-blue-50 print:border-blue-200">
                     {activeWeek.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                   </span> 
                   <span className="text-slate-500">•</span> 
                   <span className="font-medium text-slate-300 print:text-slate-600">{year} Year {spec.toUpperCase()}</span>
                </div>
             </div>
             {rollNo && <div className="text-slate-400 font-medium">Roll No: {rollNo}</div>}
          </div>
          
          <div className="overflow-x-auto print-overflow-visible">
            <table className="w-full text-left border-collapse min-w-[800px] xl:min-w-0">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 print-bg-gray">
                  <th className="p-4 font-semibold text-slate-500 w-28 border-r border-b border-slate-200 sticky left-0 bg-slate-50 z-20 text-sm print-no-sticky">Day / Time</th>
                  {allTimeSlots.map(slot => <th key={slot} className="p-3 font-bold text-slate-800 border-r border-b border-slate-200 text-center bg-slate-50 text-sm print-no-sticky">{slot}</th>)}
                </tr>
              </thead>
              <tbody>
                {allDays.map(day => (
                  <tr key={day} className="border-b border-slate-200">
                    <td className="p-4 font-medium text-sm text-slate-800 border-r border-slate-200 whitespace-nowrap bg-slate-50 sticky left-0 z-10 print-no-sticky">
                      <span className="font-bold text-base block">{day.split(',')[0]}</span>
                      <span className="text-xs text-slate-500">{day.split(',')[1]?.trim()}</span>
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
                               <td key={`ssr-${slot}`} colSpan={ssrColSpan} className="p-3 border-r border-slate-200 align-middle bg-slate-50/50 print-bg-gray">
                                  <div className="flex items-center justify-center h-full min-h-[4rem]">
                                    <span className="font-bold text-slate-700 tracking-widest text-lg bg-white px-8 py-2 rounded-full border border-slate-200 shadow-sm print-no-shadow">
                                      SSR Visit
                                    </span>
                                  </div>
                               </td>
                             );
                             i = j - 1; // skip the handled slots
                           } else {
                             cells.push(
                               <td key={slot} className="p-3 border-r border-slate-200">
                                 <div className="min-h-[4rem] w-full" />
                               </td>
                             );
                           }
                        } else {
                          cells.push(
                            <td key={slot} className="p-3 border-r border-slate-200 align-top">
                              {classesInSlot.length === 0 ? (
                                <div className="min-h-[4rem] w-full" />
                              ) : (
                                <div className="flex flex-col gap-2 h-full">
                                  {classesInSlot.map((cls, idx) => (
                                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm print-no-shadow">
                                      <div className="font-bold text-sm text-slate-900 leading-tight">
                                        {cls.courseAbb}{cls.sessionNo ? `-${cls.sessionNo}` : ''}
                                      </div>
                                      <div className="text-xs text-slate-500 flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                        <span>{cls.venue || 'TBA'}</span>
                                        <span className="font-bold text-blue-600">Sec {cls.section}</span>
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
        </div>
        
        <div className="mt-8 text-center bg-blue-50 border border-blue-200 rounded-xl p-6 no-print">
           <h3 className="text-lg font-bold text-blue-900 mb-2">Want to save this schedule?</h3>
           <p className="text-blue-700 mb-4">Sign in to edit classes, track your attendance, and manage schedule clashes permanently.</p>
           <Link href="/dashboard" className="btn-primary inline-flex px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50">Create Free Account</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto mt-16 mb-16 grid lg:grid-cols-5 gap-8 items-stretch animate-in slide-in-from-bottom-8 duration-700 no-print">
      
      {/* Form Side */}
      <div className="lg:col-span-3 glass-panel p-8 rounded-3xl border border-slate-200/50 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col justify-center">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent inline-flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" /> Generate Quick Schedule
          </h2>
          <p className="text-slate-500 mt-2">No sign-up required. Just enter your details to view and download your timetable.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto w-full">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="input-field w-full">
                <option value="1st">1st Year</option>
                <option value="2nd">2nd Year</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Specialization</label>
              <select value={spec} onChange={(e) => setSpec(e.target.value)} className="input-field w-full">
                <option value="core">Core</option>
                <option value="bfs">BFS</option>
                <option value="dcp">DCP</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {(spec === "core" || spec === "dcp") ? (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Roll Number</label>
                <input 
                  type="text" 
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="e.g. 2402001"
                  className="input-field w-full"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <p className="text-xs text-slate-400 mt-2">Your courses will be automatically fetched from the master database.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Your Section</label>
                  <select value={bfsSection} onChange={(e) => setBfsSection(e.target.value)} className="input-field w-full">
                     {AVAILABLE_SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Choose Elective</label>
                  <select value={bfsElective} onChange={(e) => setBfsElective(e.target.value)} className="input-field w-full">
                     {BFS_ELECTIVE_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="mt-6 text-center text-red-500 font-medium text-sm bg-red-50 py-3 rounded-lg">{error}</div>}

        <div className="mt-8 text-center">
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 w-full sm:w-auto inline-flex items-center justify-center gap-3 transition-all transform hover:scale-105 active:scale-95"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Generate My Timetable"}
          </button>
        </div>
      </div>

      {/* CTA Side */}
      {!user ? (
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-10 text-white shadow-2xl shadow-blue-900/20 flex flex-col justify-center items-start text-left gap-6 transform transition-all hover:scale-[1.01]">
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold leading-tight">
              Unlock the Full Experience
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed">
              Sign in to create your permanent profile. Get access to fully customizable timetables, personalized attendance tracking, and smart clash management.
            </p>
          </div>
          <button onClick={async () => { await signInWithGoogle(); router.push('/profile'); }} className="bg-white text-blue-700 hover:bg-blue-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-1 active:translate-y-0 w-full justify-center">
            Create Free Account <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 md:p-10 text-white shadow-2xl shadow-emerald-900/20 flex flex-col justify-center items-start text-left gap-6 transform transition-all hover:scale-[1.01]">
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold leading-tight">
              Welcome back!
            </h2>
            <p className="text-emerald-100 text-lg leading-relaxed">
              Head over to your Dashboard to view your personalized schedule, manage attendance, and check for any clashes.
            </p>
          </div>
          <Link href="/dashboard" className="bg-white text-emerald-700 hover:bg-emerald-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-1 active:translate-y-0 w-full justify-center">
            Go to Dashboard <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      )}

    </div>
  );
}
