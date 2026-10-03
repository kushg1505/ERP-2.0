"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getStudentProfile, fetchMasterTimetable, StudentProfile, fetchAttendance, fetchAllAttendanceStats, markAttendance, fetchAvailableWeeks, updateStudentOverrides, ScheduleOverride } from "@/lib/db";
import { Clock, MapPin, CheckCircle2, XCircle, Calendar, CheckSquare, List, Edit3, Trash2, Plus, Settings2, X, Download, Users } from "lucide-react";

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
  id?: string;
}

interface DayPlan {
  day: string;
  classes: ParsedClass[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [schedule, setSchedule] = useState<DayPlan[]>([]);
  const [myClasses, setMyClasses] = useState<ParsedClass[]>([]);
  
  // Week, Tabs & Attendance State
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [activeTab, setActiveTab] = useState<"schedule" | "attendance" | "clashes">("schedule");
  const [attendance, setAttendance] = useState<Record<string, {status: "attended" | "missed", timestamp: string}>>({});
  const [attendanceStats, setAttendanceStats] = useState({ attended: 0, missed: 0, records: [] as any[] });
  const [allHistoricalSessions, setAllHistoricalSessions] = useState<any[]>([]);
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});

  const toggleCourse = (course: string) => {
    setExpandedCourses(prev => ({ ...prev, [course]: !prev[course] }));
  };

  const formatWeek = (w: string) => {
    if (w === "week-1-2026") {
      return profile?.program?.startsWith("1st") ? "Week 1 Term 2" : "Week 1 Term 5";
    }
    return w.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Tabular View State
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [allTimeSlots, setAllTimeSlots] = useState<string[]>([]);
  const [allDays, setAllDays] = useState<string[]>([]);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [originalClassIdToReschedule, setOriginalClassIdToReschedule] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setLoading(true);
      
      const p = await getStudentProfile(user.uid);
      setProfile(p);
      
      const userProgram = p?.program || "2nd-core";

      const weeks = await fetchAvailableWeeks(userProgram);
      setAvailableWeeks(weeks);
      
      let targetWeek = selectedWeek;
      if ((!targetWeek || !weeks.includes(targetWeek)) && weeks.length > 0) {
        targetWeek = weeks[weeks.length - 1];
        setSelectedWeek(targetWeek);
      }

      if (p && p.courses.length > 0 && targetWeek) {
        // Fetch real data from Firestore
        const master = await fetchMasterTimetable(targetWeek, userProgram) as ParsedClass[];
        
        const att = await fetchAttendance(user.uid, targetWeek);
        setAttendance(att);
        
        const stats = await fetchAllAttendanceStats(user.uid);
        setAttendanceStats(stats);
        
        // Fetch ALL historical sessions for attendance calculation
        let historicalSessions: any[] = [];
        
        await Promise.all(weeks.map(async (w) => {
          const wMaster = await fetchMasterTimetable(w, userProgram) as ParsedClass[];
          let myWClasses = wMaster.filter(cls => 
            p.courses.some(c => 
              c.courseCode === cls.courseAbb && 
              (c.section === cls.section || !cls.section || cls.section.includes(c.section))
            )
          );
          
          const weekOverrides = p.scheduleOverrides?.filter((o: any) => o.weekId === w) || [];
          const canceledIds = weekOverrides.filter((o: any) => o.type === 'cancel' || o.type === 'reschedule').map((o: any) => o.originalClassId);
          myWClasses = myWClasses.filter(cls => {
            const classId = `${cls.courseAbb}-${cls.day}-${cls.timeSlot}`.replace(/\s+/g, '-');
            return !canceledIds.includes(classId);
          });
          const addedClasses = weekOverrides.filter((o: any) => o.type === 'add' || o.type === 'reschedule').map((o: any) => o.newClassDetails);
          myWClasses.push(...addedClasses);

          historicalSessions.push(...myWClasses.map(cls => {
             const classId = cls.id || `${cls.courseAbb}-${cls.day}-${cls.timeSlot}`.replace(/\s+/g, '-');
             const date = cls.date || (cls.day ? cls.day.split(',')[1]?.trim() : "");
             const startTime = cls.startTime || (cls.timeSlot ? cls.timeSlot.split('-')[0]?.trim() : "");
             const endTime = cls.endTime || (cls.timeSlot ? cls.timeSlot.split('-')[1]?.trim() : "");
             return { ...cls, weekId: w, classId, date, startTime, endTime };
          }));
        }));
        
        setAllHistoricalSessions(historicalSessions);

        // Filter master schedule for student's courses in current week
        const isFirstYear = p.program?.startsWith('1st-');
        let myFilteredClasses = isFirstYear 
          ? master.filter(cls => !cls.section || (p.section && cls.section.includes(p.section)))
          : master.filter(cls => 
            p.courses?.some(c => 
              c.courseCode === cls.courseAbb && 
              (c.courseCode === "FINPrep" || c.section === cls.section || !cls.section || cls.section.includes(c.section))
            )
          );
        
        const currentWeekOverrides = p.scheduleOverrides?.filter((o: any) => o.weekId === targetWeek) || [];
        const currentCanceledIds = currentWeekOverrides.filter((o: any) => o.type === 'cancel' || o.type === 'reschedule').map((o: any) => o.originalClassId);
        myFilteredClasses = myFilteredClasses.filter(cls => {
          const classId = `${cls.courseAbb}-${cls.day}-${cls.timeSlot}`.replace(/\s+/g, '-');
          return !currentCanceledIds.includes(classId);
        });
        const currentAddedClasses = currentWeekOverrides.filter((o: any) => o.type === 'add' || o.type === 'reschedule').map((o: any) => o.newClassDetails);
        myFilteredClasses.push(...currentAddedClasses);

        // Group by day
        const grouped: Record<string, ParsedClass[]> = {};
        myFilteredClasses.forEach(cls => {
          if (!grouped[cls.day]) grouped[cls.day] = [];
          grouped[cls.day].push(cls);
        });

        // Extract ALL unique days and timeslots from the Master Timetable to build a perfect Grid
        const daysSet = new Set<string>();
        const slotsSet = new Set<string>();
        
        master.forEach((cls: ParsedClass) => {
          if (cls.day && cls.day.trim() !== "") daysSet.add(cls.day);
          if (cls.timeSlot && cls.timeSlot.trim() !== "" && cls.timeSlot.toLowerCase() !== "full day") slotsSet.add(cls.timeSlot);
        });

        if (p.program === "2nd-core") {
           const hasThursday = Array.from(daysSet).some(d => d.toLowerCase().includes("thursday"));
           if (!hasThursday && daysSet.size > 0) {
              const anyDay = Array.from(daysSet)[0];
              const dateStr = anyDay.split(',')[1]?.trim();
              let thursdayStr = "Thursday";
              if (dateStr) {
                 const d = new Date(dateStr);
                 if (!isNaN(d.getTime())) {
                    const diff = 4 - d.getDay();
                    d.setDate(d.getDate() + diff);
                    thursdayStr = `Thursday, ${d.toISOString().split('T')[0]}`;
                 }
              }
              daysSet.add(thursdayStr);
           }
        }

        // Sort time slots chronologically
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

        const dayOrder: Record<string, number> = {
          "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6, "sun": 7
        };
        
        const sortedDays = Array.from(daysSet).sort((a, b) => {
          const rankA = dayOrder[a.substring(0, 3).toLowerCase()] || 99;
          const rankB = dayOrder[b.substring(0, 3).toLowerCase()] || 99;
          if (rankA !== rankB) return rankA - rankB;
          const dateA = new Date(a).getTime();
          const dateB = new Date(b).getTime();
          return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
        });

        const dayPlans: DayPlan[] = sortedDays.map(day => {
          let classesForDay = grouped[day] ? grouped[day].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)) : [];
          
          if (p.program === "2nd-core" && day.toLowerCase().includes("thursday")) {
            classesForDay.push({
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
            classesForDay = classesForDay.sort((a, b) => {
               if (a.timeSlot === "Full Day") return -1;
               if (b.timeSlot === "Full Day") return 1;
               return a.timeSlot.localeCompare(b.timeSlot);
            });
          }

          return {
            day,
            classes: classesForDay
          };
        });


        setAllTimeSlots(sortedSlots);
        setAllDays(sortedDays);
        setMyClasses(dayPlans.flatMap(dp => dp.classes));
        setSchedule(dayPlans);
      }
      setLoading(false);
    }
    loadData();
  }, [user, selectedWeek, refreshKey]);

  const handleCancelClass = async (cls: ParsedClass) => {
    if (!profile || !user) return;
    if (!confirm("Are you sure you want to remove this class from your personal schedule?")) return;
    
    const classId = (cls as any).id || `${cls.courseAbb}-${cls.day}-${cls.timeSlot}`.replace(/\s+/g, '-');
    const newOverride: ScheduleOverride = { type: 'cancel', originalClassId: classId, weekId: selectedWeek };
    const overrides = [...(profile.scheduleOverrides || []), newOverride];
    
    setProfile({ ...profile, scheduleOverrides: overrides });
    await updateStudentOverrides(user.uid, overrides);
    setRefreshKey(k => k + 1);
  };

  const openAddModal = () => {
    setOriginalClassIdToReschedule(null);
    setEditForm({
      courseAbb: profile?.courses[0]?.courseCode || "NEW",
      courseName: "New Session",
      section: profile?.courses[0]?.section || "A",
      day: "Monday",
      timeSlot: "08:45-10:00",
      startTime: "08:45",
      endTime: "10:00",
      venue: "TBA",
      faculty: "TBA",
      date: "2026-10-05"
    });
    setEditModalOpen(true);
  };

  const openRescheduleModal = (cls: ParsedClass) => {
    const classId = (cls as any).id || `${cls.courseAbb}-${cls.day}-${cls.timeSlot}`.replace(/\s+/g, '-');
    setOriginalClassIdToReschedule(classId);
    setEditForm({ ...cls });
    setEditModalOpen(true);
  };

  const saveEditForm = async () => {
    if (!profile || !user) return;
    
    const newOverride: ScheduleOverride = {
       type: originalClassIdToReschedule ? 'reschedule' : 'add',
       originalClassId: originalClassIdToReschedule || undefined,
       newClassDetails: editForm,
       weekId: selectedWeek
    };
    const overrides = [...(profile.scheduleOverrides || []), newOverride];
    setProfile({ ...profile, scheduleOverrides: overrides });
    await updateStudentOverrides(user.uid, overrides);
    setEditModalOpen(false);
    setRefreshKey(k => k + 1);
  };

  if (!user) return <div className="text-center mt-20">Please sign in to view your dashboard.</div>;
  if (loading) return <div className="text-center mt-20 text-slate-500">Loading your personalized schedule...</div>;

  const handleAttendance = async (classId: string, status: "attended" | "missed") => {
    if (!user) return;
    setAttendance(prev => ({
      ...prev,
      [classId]: { status, timestamp: new Date().toISOString() }
    }));
    await markAttendance(user.uid, selectedWeek, classId, status);
    const stats = await fetchAllAttendanceStats(user.uid);
    setAttendanceStats(stats);
  };

  const getClassId = (cls: ParsedClass) => {
    return (cls as any).id || `${cls.courseAbb}-${cls.day}-${cls.timeSlot}`.replace(/\s+/g, '-');
  };

  let trueTotalScheduled = 0;
  let trueTotalAttended = 0;
  let trueTotalMissed = 0;

  if (profile?.courses && allHistoricalSessions.length > 0) {
    const courseGroups = allHistoricalSessions.reduce((acc: any, session: any) => {
      let courseName = "Other";
      const sortedCourses = [...profile.courses].sort((a, b) => b.courseCode.length - a.courseCode.length);
      for (const c of sortedCourses) {
        if (session.classId.toLowerCase().startsWith(c.courseCode.toLowerCase())) {
          courseName = c.courseCode;
          break;
        }
      }
      if (courseName === "Other") courseName = session.courseAbb;
      
      if (!acc[courseName]) acc[courseName] = [];
      acc[courseName].push(session);
      return acc;
    }, {});

    Object.values(courseGroups).forEach((sessions: any) => {
      const sessionsWithStatus = sessions.map((s: any) => {
         const record = attendanceStats.records.find((r: any) => r.classId === s.classId);
         return { ...s, status: record ? record.status : 'unmarked' };
      });
      
      const occurredSessions = sessionsWithStatus.filter((s: any) => {
         if (s.status !== 'unmarked') return true; // Manually marked counts as occurred
         if (!s.date || !s.endTime) return true; // Fallback
         const endDateTime = new Date(`${s.date}T${s.endTime}:00+05:30`).getTime();
         return Date.now() >= endDateTime;
      });
      
      trueTotalScheduled += occurredSessions.length;
      trueTotalAttended += occurredSessions.filter((r: any) => r.status === 'attended').length;
      trueTotalMissed += occurredSessions.filter((r: any) => r.status === 'missed').length;
    });
  }

  if (!profile || profile.courses.length === 0) {
    return (
      <div className="text-center mt-20">
        <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
        <p className="text-slate-500 mb-6">You haven't set up your profile or selected any courses yet.</p>
        <a href="/profile" className="btn-primary inline-flex">Go to My Courses</a>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-12 pb-24 md:pb-0">
      <header className="flex flex-col gap-4 print:hidden">
        {/* Rich Hero Card */}
        <div className="w-full bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 rounded-2xl md:rounded-3xl p-6 md:p-8 flex items-center justify-between overflow-hidden relative border border-blue-100 dark:border-blue-800/30">
          <div className="relative z-10">
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium mb-1">Welcome back,</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 leading-tight">{profile?.name || "Student"}!</h1>
            <div className="inline-flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200/50 dark:border-blue-700/50 shadow-sm">
               <Users className="w-4 h-4 text-slate-500" />
               <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">Roll No: {profile?.rollNo}</span>
            </div>
          </div>
          {/* Decorative Calendar Graphic for Hero */}
          <div className="absolute right-[-20px] md:right-8 opacity-90 rotate-12 transform scale-110 md:scale-100 pointer-events-none">
             <div className="w-24 h-24 md:w-32 md:h-32 bg-blue-500 rounded-2xl shadow-xl shadow-blue-500/20 flex flex-col overflow-hidden border-2 border-white/20">
                <div className="h-6 md:h-8 bg-blue-600 w-full border-b border-blue-400 flex justify-around items-center px-4">
                  <div className="w-2 h-4 bg-white/80 rounded-full -mt-4 shadow-sm" />
                  <div className="w-2 h-4 bg-white/80 rounded-full -mt-4 shadow-sm" />
                </div>
                <div className="flex-1 bg-white p-2 md:p-3 grid grid-cols-3 gap-1 md:gap-1.5">
                   {[...Array(9)].map((_, i) => <div key={i} className={`rounded ${i===7 ? 'bg-emerald-400' : 'bg-slate-100'}`} />)}
                </div>
             </div>
             {/* Checkmark badge */}
             <div className="absolute -bottom-2 -right-2 w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
               <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
             </div>
          </div>
        </div>
        
        {/* Week Selector Card */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 w-full">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2.5 rounded-xl text-blue-600 dark:text-blue-400">
               <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 relative">
              <select 
                value={selectedWeek} 
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-transparent font-bold text-slate-900 dark:text-slate-100 outline-none w-full appearance-none cursor-pointer text-base md:text-lg z-10 relative"
              >
                {availableWeeks.length === 0 ? (
                  <option value="">No weeks available</option>
                ) : (
                  availableWeeks.map(w => (
                    <option key={w} value={w} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                      {formatWeek(w)}
                    </option>
                  ))
                )}
              </select>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                5 Oct 2026 - 11 Oct 2026
              </div>
            </div>
            {/* Arrows for Next/Prev Week */}
            <div className="flex items-center gap-2 shrink-0">
               <button onClick={() => {
                 const idx = availableWeeks.indexOf(selectedWeek);
                 if (idx > 0) setSelectedWeek(availableWeeks[idx-1]);
               }} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50" disabled={availableWeeks.indexOf(selectedWeek) <= 0}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
               </button>
               <button onClick={() => {
                 const idx = availableWeeks.indexOf(selectedWeek);
                 if (idx < availableWeeks.length - 1) setSelectedWeek(availableWeeks[idx+1]);
               }} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50" disabled={availableWeeks.indexOf(selectedWeek) >= availableWeeks.length - 1}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
               </button>
            </div>
          </div>
        </div>
      </header>

      <div className="hidden md:flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto print:hidden">
        <button onClick={() => setActiveTab("schedule")} className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'schedule' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>My Schedule</button>
        <button onClick={() => setActiveTab("attendance")} className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'attendance' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}><CheckSquare className="w-4 h-4" /> Attendance</button>
        <button onClick={() => setActiveTab("clashes")} className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'clashes' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}><List className="w-4 h-4" /> Clash Management</button>
      </div>

      {activeTab === "schedule" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <section>
            <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-4">My Schedule {isEditMode && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full animate-pulse">EDIT MODE</span>}</h2>
                  <p className="text-sm text-slate-500 mt-1">View your class schedule for the selected week.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <button onClick={() => window.print()} className="no-print btn-secondary flex-1 md:flex-none justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30">
                     <Download className="w-4 h-4"/> Download PDF
                  </button>
                  <button onClick={() => setIsEditMode(!isEditMode)} className={`no-print flex-1 md:flex-none justify-center px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isEditMode ? 'bg-blue-600 shadow-lg shadow-blue-500/30 text-white hover:bg-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}>
                     <Settings2 className="w-4 h-4" /> {isEditMode ? 'Done Editing' : 'Customize'}
                  </button>
                </div>
              </div>
              
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit no-print mt-2">
                <button onClick={() => setViewMode("list")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}><List className="w-4 h-4" /> List</button>
                <button onClick={() => setViewMode("table")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}><Clock className="w-4 h-4" /> Tabular</button>
              </div>
            </div>

            {/* Print Header (Only visible when printing) */}
            <div className="hidden print:block w-full bg-[url('/hero-light.png')] bg-cover bg-center rounded-2xl border border-slate-200 overflow-hidden relative mb-6">
              <div className="p-8 pb-6 relative z-10">
                 <div className="flex justify-between items-center mb-6">
                    <span className="font-extrabold text-sm tracking-widest text-slate-700">ERP 2.0</span>
                    <span className="text-sm font-medium text-slate-500">{new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                 </div>

                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 relative">
                   <div className="relative inline-block">
                      <h2 className="text-5xl font-extrabold tracking-tight">
                         <span className="text-slate-900 border-b-4 border-slate-900 pb-1 mr-3">My</span>
                         <span className="text-blue-600">Schedule</span>
                      </h2>
                   </div>
                 </div>

                 <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-sm">
                      <Calendar className="w-4 h-4" />
                      {selectedWeek ? formatWeek(selectedWeek) : "Current Week"}
                    </div>
                    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-full font-bold border border-slate-200 text-sm">
                      <Users className="w-4 h-4 text-slate-500" />
                      {profile?.name || "Student"}
                    </div>
                    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-full font-bold border border-slate-200 text-sm">
                      <Clock className="w-4 h-4 text-slate-500" />
                      Roll No: {profile?.rollNo}
                    </div>
                 </div>
              </div>
            </div>

            {/* Table View (Hidden on screen if in list mode, ALWAYS visible on print) */}
            <div className={`rounded-xl sm:rounded-2xl overflow-x-auto print:overflow-hidden border border-slate-200 print:border-slate-200 mt-0 sm:mt-6 ${viewMode === "table" ? "block" : "hidden print:block"}`}>
               <table className="w-full text-left border-collapse bg-white min-w-[max-content] md:min-w-[800px] xl:min-w-0 print:min-w-0 print:w-full print:table-fixed">
                 <thead>
                   <tr>
                     <th className="p-2 md:p-4 print:p-1 font-bold text-white w-20 md:w-32 print:w-16 border-r border-slate-200 print:border-slate-200 bg-slate-700 print:bg-[#2c4062] sticky left-0 z-20 text-[10px] md:text-sm print:text-[10px] print-no-sticky text-center align-middle">Day / Time</th>
                     {allTimeSlots.map(slot => (
                       <th key={slot} className="p-1 md:p-3 print:p-1 font-bold text-slate-800 border-r border-slate-200 print:border-slate-200 text-center bg-blue-50/50 print:bg-[#f4f7fb] text-[10px] md:text-sm print:text-[9px] print-no-sticky align-middle">
                         <span className="hidden md:inline print:hidden">{slot}</span>
                         <span className="md:hidden block whitespace-pre-line">{slot.replace('-', '\n')}</span>
                         <span className="hidden print:block whitespace-pre-line">{slot.replace('-', '\n')}</span>
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {allDays.map(day => (
                     <tr key={day} className="border-t border-slate-200 print:border-slate-200">
                       <td className="p-2 md:p-4 print:p-1 border-r border-slate-200 print:border-slate-200 whitespace-nowrap bg-slate-50 dark:bg-slate-900 print:bg-[#f8fafd] sticky left-0 z-10 print-no-sticky text-center align-middle">
                         <span className="font-extrabold text-[11px] md:text-base print:text-[10px] block text-blue-900">{day.split(',')[0]}</span>
                         <span className="text-[9px] md:text-xs font-medium text-slate-500 mt-0.5 md:mt-1 block print:mt-0.5 print:text-[8px]">{day.split(',')[1]?.trim()}</span>
                       </td>
                       {(() => {
                         const isSSRThursday = profile?.program === "2nd-core" && day.toLowerCase().includes("thursday");
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
                                  <td key={`ssr-${slot}`} colSpan={ssrColSpan} className="p-1 md:p-3 print:p-1 border-r border-slate-200 print:border-slate-200 align-middle">
                                     <div className="flex items-center justify-center h-full min-h-[3rem] md:min-h-[4.5rem] print:min-h-[2.5rem] bg-amber-50 rounded-lg md:rounded-xl border border-amber-100/50 mx-0.5 md:mx-1">
                                       <div className="flex items-center gap-1 md:gap-2">
                                          <Users className="w-3 h-3 md:w-5 md:h-5 print:w-3 print:h-3 text-amber-500" />
                                          <span className="font-extrabold text-slate-800 tracking-wide text-xs md:text-lg print:text-[10px]">
                                            {window.innerWidth < 768 ? 'SSR' : 'SSR Visit'}
                                          </span>
                                       </div>
                                     </div>
                                  </td>
                                );
                                i = j - 1; 
                              } else {
                                cells.push(
                                  <td key={slot} className="p-1 md:p-3 print:p-1 border-r border-slate-200 print:border-slate-200">
                                    <div className="min-h-[3rem] md:min-h-[4.5rem] print:min-h-[2.5rem] w-full flex items-center justify-center text-slate-300">
                                      <span className="md:hidden">-</span>
                                    </div>
                                  </td>
                                );
                              }
                           } else {
                             cells.push(
                               <td key={slot} className="p-1 sm:p-2 md:p-3 print:p-1 border-r border-slate-200 print:border-slate-200 align-top bg-white relative">
                                 {classesInSlot.length === 0 ? (
                                   <div className="min-h-[3rem] md:min-h-[4.5rem] print:min-h-[2.5rem] w-full flex items-center justify-center text-slate-200">
                                     {!isEditMode && <span className="md:hidden">-</span>}
                                     {isEditMode && (
                                       <button onClick={() => {
                                          setOriginalClassIdToReschedule(null);
                                          setEditForm({
                                            courseAbb: profile?.courses[0]?.courseCode || "NEW",
                                            courseName: "New Session",
                                            section: profile?.courses[0]?.section || "A",
                                            day: day.split(',')[0],
                                            timeSlot: slot,
                                            startTime: slot.split('-')[0] || "09:00",
                                            endTime: slot.split('-')[1] || "10:15",
                                            venue: "TBA",
                                            faculty: "TBA",
                                            date: day.split(',')[1]?.trim() || "2026-10-05"
                                          });
                                          setEditModalOpen(true);
                                       }} className="w-10 h-10 rounded-full border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-500 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                                         <Plus className="w-5 h-5"/>
                                       </button>
                                     )}
                                   </div>
                                 ) : (
                                   <div className="flex flex-col gap-1.5 h-full">
                                     {classesInSlot.map((cls, idx) => {
                                        const cId = getClassId(cls);
                                        const isAttended = attendance[cId]?.status === 'attended' || attendanceStats.records.find((r: any) => r.classId === cId)?.status === 'attended';
                                        const isMissed = attendance[cId]?.status === 'missed' || attendanceStats.records.find((r: any) => r.classId === cId)?.status === 'missed';
                                        
                                        let cardClasses = "bg-white border-blue-100 border-l-blue-600 shadow-sm";
                                        if (isEditMode) cardClasses = "bg-white border-blue-300 border-l-blue-600 ring-2 ring-blue-500/30 shadow-md";
                                        else if (isAttended) cardClasses = "bg-emerald-50/50 border-emerald-200 border-l-emerald-500 shadow-sm";
                                        else if (isMissed) cardClasses = "bg-red-50/50 border-red-200 border-l-red-500 shadow-sm";

                                        return (
                                        <div key={idx} className={`p-1.5 md:p-3 print:p-1 print:px-1.5 rounded-lg md:rounded-xl print:rounded border-y border-r border-l-[3px] md:border-l-4 h-full flex flex-col justify-between relative print:shadow-none print:border-slate-200 print:border-l-slate-400 print:bg-white transition-all ${cardClasses}`}>
                                          {isEditMode && (
                                            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 -mx-1.5 md:-mx-3 -mt-1.5 md:-mt-3 p-1.5 md:p-2 rounded-t-xl mb-1.5 md:mb-2 border-b border-slate-200 dark:border-slate-700">
                                              <button onClick={() => openRescheduleModal(cls)} className="p-1 text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-lg dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60"><Edit3 className="w-3 h-3 md:w-3.5 md:h-3.5"/></button>
                                              <button onClick={() => handleCancelClass(cls)} className="p-1 text-red-600 bg-red-100 hover:bg-red-200 rounded-lg dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"><Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5"/></button>
                                            </div>
                                          )}
                                          <div>
                                             <div className="flex justify-between items-start gap-1">
                                               <div className="font-extrabold text-[10px] md:text-sm print:text-[9px] text-slate-900 leading-tight">
                                                 {cls.courseAbb}{cls.sessionNo ? <span className="md:inline hidden">-{cls.sessionNo}</span> : ''}
                                               </div>
                                               {!isEditMode && isAttended && <span className="text-[8px] md:text-[10px] print:text-[8px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.5 rounded leading-none">P</span>}
                                               {!isEditMode && isMissed && <span className="text-[8px] md:text-[10px] print:text-[8px] font-black text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded leading-none">A</span>}
                                             </div>
                                             <div className="text-[8px] md:text-xs print:text-[8px] text-slate-500 mt-0.5 md:mt-1 print:mt-0 font-medium break-words leading-tight hidden md:block">
                                               {cls.venue || 'TBA'}
                                             </div>
                                          </div>
                                          <div className="mt-1 md:mt-2 print:mt-1 flex">
                                             <span className={`font-bold text-[8px] md:text-xs print:text-[7px] px-1.5 md:px-2.5 py-0.5 md:py-1 print:px-1 print:py-0.5 rounded-full border whitespace-nowrap inline-block print:bg-transparent print:border-slate-300 print:text-slate-600 ${isAttended ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : isMissed ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-100/50'}`}>
                                               Sec {cls.section}
                                             </span>
                                          </div>
                                        </div>
                                      )})}
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
            <div className={`space-y-6 mt-6 ${viewMode === "list" ? "block" : "hidden"} print:hidden`}>
              {allDays.map(day => {
                const isSSRThursday = profile?.program === "2nd-core" && day.toLowerCase().includes("thursday");
                const dayClasses = myClasses.filter(c => c.day === day).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
                
                if (dayClasses.length === 0 && !isSSRThursday) return null;

                return (
                  <div key={day} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden break-inside-avoid">
                    <div className="bg-slate-100 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <div>
                        <h3 className="font-extrabold text-slate-800 dark:text-white text-lg">{day.split(',')[0]}</h3>
                        <span className="text-sm font-medium text-slate-500">{day.split(',')[1]?.trim()}</span>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6 flex flex-col gap-4">
                      {isSSRThursday && dayClasses.length === 0 && (
                        <div className="flex items-center gap-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                          <div className="bg-amber-100 dark:bg-amber-800/50 p-3 rounded-lg">
                            <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 dark:text-amber-100 text-lg">SSR Visit</h4>
                            <p className="text-amber-700 dark:text-amber-300/80 text-sm font-medium">All day field visit</p>
                          </div>
                        </div>
                      )}
                      {dayClasses.map((cls, idx) => {
                         const cId = getClassId(cls);
                         const isAttended = attendance[cId]?.status === 'attended' || attendanceStats.records.find((r: any) => r.classId === cId)?.status === 'attended';
                         const isMissed = attendance[cId]?.status === 'missed' || attendanceStats.records.find((r: any) => r.classId === cId)?.status === 'missed';
                         
                         let isFuture = false;
                         const dateStr = cls.date || (cls.day ? cls.day.split(',')[1]?.trim() : "");
                         const endTimeStr = cls.endTime || (cls.timeSlot ? cls.timeSlot.split('-')[1]?.trim() : "");
                         if (dateStr && endTimeStr) {
                            const endDateTime = new Date(`${dateStr}T${endTimeStr}:00+05:30`).getTime();
                            isFuture = Date.now() < endDateTime;
                         }

                         return (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-100 dark:border-slate-700 border-l-4 border-l-blue-500 shadow-sm transition-all hover:shadow-md break-inside-avoid relative">
                          <div className="flex-shrink-0 min-w-[120px]">
                            <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              {cls.timeSlot}
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-extrabold text-slate-800 dark:text-white text-lg">
                              {cls.courseName || 'New Session'} <span className="text-slate-400 font-medium text-sm">({cls.courseAbb}{cls.sessionNo ? `-${cls.sessionNo}` : ''})</span>
                            </h4>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                                📍 {cls.venue || 'TBA'}
                              </span>
                              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                                👨‍🏫 {cls.faculty}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-3 shrink-0">
                            <div className="flex items-center justify-end gap-2">
                               <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800/50">
                                 Sec {cls.section}
                               </span>
                            </div>

                            <div className="flex gap-2">
                              {cls.courseAbb !== "SSR" && !isEditMode && (
                                isFuture ? (
                                  <span className="text-xs font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Upcoming</span>
                                ) : (
                                  <>
                                    <button onClick={() => handleAttendance(cId, "attended")} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${isAttended ? 'bg-emerald-500 text-white border-emerald-600' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}><CheckCircle2 className="w-4 h-4" /> Attended</button>
                                    <button onClick={() => handleAttendance(cId, "missed")} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${isMissed ? 'bg-red-500 text-white border-red-600' : 'border-red-200 text-red-700 hover:bg-red-50'}`}><XCircle className="w-4 h-4" /> Missed</button>
                                  </>
                                )
                              )}
                              {isEditMode && (
                                <>
                                  <button onClick={() => openRescheduleModal(cls)} className="bg-slate-100 text-blue-600 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5"/> Edit</button>
                                  <button onClick={() => handleCancelClass(cls)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5"/> Delete</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="space-y-12 animate-in fade-in duration-300">
          
          {/* COURSE-WISE ATTENDANCE (Primary Focus) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-2">
               <CheckSquare className="w-6 h-6 text-blue-500" /> Course-wise Attendance
            </h2>
            
            {allHistoricalSessions.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                 <p className="text-slate-500 font-medium">No sessions recorded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {Object.entries(
                  allHistoricalSessions.reduce((acc: any, session: any) => {
                    let courseName = session.courseAbb;
                    if (!acc[courseName]) acc[courseName] = [];
                    acc[courseName].push(session);
                    return acc;
                  }, {})
                ).map(([course, sessions]: [string, any], idx) => {
                  
                  // Sort chronologically to assign session numbers
                  const sortedSessions = sessions.sort((a: any, b: any) => {
                     const dateA = new Date(`${a.date}T${a.startTime || '00:00'}:00+05:30`).getTime();
                     const dateB = new Date(`${b.date}T${b.startTime || '00:00'}:00+05:30`).getTime();
                     return dateA - dateB;
                  });

                  const sessionsWithStatus = sortedSessions.map((s: any, sIdx: number) => {
                     const record = attendanceStats.records.find((r: any) => r.classId === s.classId);
                     return { ...s, sessionNumber: sIdx + 1, status: record ? record.status : 'unmarked' };
                  });
                  
                  const occurredSessions = sessionsWithStatus.filter((s: any) => {
                     if (s.status !== 'unmarked') return true;
                     if (!s.date || !s.endTime) return true;
                     const endDateTime = new Date(`${s.date}T${s.endTime}:00+05:30`).getTime();
                     return Date.now() >= endDateTime;
                  });

                  const courseAttended = occurredSessions.filter((r: any) => r.status === 'attended').length;
                  const totalOccurred = occurredSessions.length;
                  const pct = totalOccurred > 0 ? Math.round((courseAttended / totalOccurred) * 100) : 0;
                  const isExpanded = !!expandedCourses[course];
                  
                  return (
                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
                      <button 
                        onClick={() => toggleCourse(course)} 
                        className="w-full text-left p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="mb-4 sm:mb-0">
                          <h3 className="font-bold text-2xl mb-2 text-slate-900 dark:text-white flex items-center gap-3">
                             {course}
                             {sessions[0]?.courseName && <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{sessions[0].courseName}</span>}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                             <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold px-4 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                {courseAttended} / {totalOccurred} Attended
                             </div>
                             <span className="text-sm text-slate-500 font-medium">(Out of {totalOccurred} occurred so far)</span>
                          </div>
                        </div>
                        <div className={`w-20 h-20 shrink-0 rounded-full flex items-center justify-center border-[5px] ${pct >= 75 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-amber-500 text-amber-600 dark:text-amber-400'} bg-white dark:bg-slate-950 shadow-inner`}>
                          <span className="font-black text-xl">{pct}%</span>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 divide-y divide-slate-200 dark:divide-slate-800">
                          {sessionsWithStatus.map((rec: any, rIdx: number) => {
                            let isFuture = false;
                            if (rec.status === 'unmarked' && rec.date && rec.endTime) {
                               const endDateTime = new Date(`${rec.date}T${rec.endTime}:00+05:30`).getTime();
                               isFuture = Date.now() < endDateTime;
                            }
                            return (
                            <div key={rIdx} className={`p-5 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900 ${isFuture ? 'opacity-60' : ''}`}>
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 shrink-0 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center font-bold text-slate-500">
                                   #{rec.sessionNumber}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 text-base">{rec.date} <span className="font-medium text-slate-500 ml-1">({rec.day ? rec.day.split(',')[0] : ""})</span></span>
                                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3.5 h-3.5" /> {rec.timeSlot}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:ml-auto">
                                {isFuture ? (
                                  <span className="text-xs font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Upcoming Class</span>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => handleAttendance(rec.classId, "attended")} 
                                      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${rec.status === 'attended' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600'}`}
                                    >
                                      Present
                                    </button>
                                    <button 
                                      onClick={() => handleAttendance(rec.classId, "missed")} 
                                      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${rec.status === 'missed' ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-red-500 hover:text-red-600'}`}
                                    >
                                      Absent
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* OVERALL ATTENDANCE (Secondary Focus) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-90">
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-800 dark:to-black rounded-3xl p-6 text-white shadow-md flex flex-col justify-center items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Overall (Till Date)</span>
              <span className="text-5xl font-black text-white">{trueTotalScheduled > 0 ? Math.round((trueTotalAttended / trueTotalScheduled) * 100) : 0}%</span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-center items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Total Present</span>
              <span className="text-5xl font-black text-emerald-500">{trueTotalAttended}</span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-center items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Total Occurred</span>
              <span className="text-5xl font-black text-slate-700 dark:text-slate-200">{trueTotalScheduled}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "clashes" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <List className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Clash Management</h2>
            <p className="text-slate-500 text-lg">Coming soon for Term 5! We are upgrading this feature.</p>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">{originalClassIdToReschedule ? "Reschedule Session" : "Add Makeup Session"}</h3>
               <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Course Code</label>
                <input name="courseAbb" value={editForm.courseAbb || ""} onChange={(e) => setEditForm({...editForm, courseAbb: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Section</label>
                <input name="section" value={editForm.section || ""} onChange={(e) => setEditForm({...editForm, section: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Date (YYYY-MM-DD)</label>
                <input name="date" type="date" value={editForm.date || ""} onChange={(e) => setEditForm({...editForm, date: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Day</label>
                <select name="day" value={editForm.day || ""} onChange={(e) => setEditForm({...editForm, day: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Time Slot (e.g., 08:45-10:00)</label>
                <input name="timeSlot" value={editForm.timeSlot || ""} onChange={(e) => setEditForm({...editForm, timeSlot: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Start Time</label>
                  <input name="startTime" type="time" value={editForm.startTime || ""} onChange={(e) => setEditForm({...editForm, startTime: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">End Time</label>
                  <input name="endTime" type="time" value={editForm.endTime || ""} onChange={(e) => setEditForm({...editForm, endTime: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Venue</label>
                <input name="venue" value={editForm.venue || ""} onChange={(e) => setEditForm({...editForm, venue: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Faculty</label>
                <input name="faculty" value={editForm.faculty || ""} onChange={(e) => setEditForm({...editForm, faculty: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
               <button onClick={() => setEditModalOpen(false)} className="btn-secondary">Cancel</button>
               <button onClick={saveEditForm} className="btn-primary">Save to Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around items-center p-2 z-50 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <button onClick={() => setActiveTab("schedule")} className={`flex flex-col items-center gap-1 p-2 w-full rounded-xl transition-colors ${activeTab === 'schedule' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 font-bold' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Schedule</span>
        </button>
        <button onClick={() => setActiveTab("attendance")} className={`flex flex-col items-center gap-1 p-2 w-full rounded-xl transition-colors ${activeTab === 'attendance' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 font-bold' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px]">Attendance</span>
        </button>
        <button onClick={() => setActiveTab("clashes")} className={`flex flex-col items-center gap-1 p-2 w-full rounded-xl transition-colors ${activeTab === 'clashes' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 font-bold' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <List className="w-5 h-5" />
          <span className="text-[10px]">Clash Management</span>
        </button>
      </div>
    </div>
  );
}
