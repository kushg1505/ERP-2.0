"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getStudentProfile, fetchMasterTimetable, StudentProfile, fetchAttendance, fetchAllAttendanceStats, markAttendance, fetchAvailableWeeks, updateStudentOverrides, ScheduleOverride } from "@/lib/db";
import { Clock, MapPin, CheckCircle2, XCircle, Calendar, CheckSquare, List, Edit3, Trash2, Plus, Settings2, X } from "lucide-react";

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
             return { ...cls, weekId: w, classId };
          }));
        }));
        
        setAllHistoricalSessions(historicalSessions);

        // Filter master schedule for student's courses in current week
        let myFilteredClasses = master.filter(cls => 
          p.courses.some(c => 
            c.courseCode === cls.courseAbb && 
            (c.section === cls.section || !cls.section || cls.section.includes(c.section))
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
          if (cls.timeSlot && cls.timeSlot.trim() !== "") slotsSet.add(cls.timeSlot);
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
          const match = slot.match(/(\d+):(\d+)\s*(am|pm)/i);
          if (!match) return 0;
          let hours = parseInt(match[1]);
          const mins = parseInt(match[2]);
          const ampm = match[3].toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          return hours + mins / 60;
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

        // Add Full Day to allTimeSlots if it's missing so Tabular view shows it
        if (p.program === "2nd-core" && !sortedSlots.includes("Full Day")) {
           const hasThursday = sortedDays.some(d => d.toLowerCase().includes("thursday"));
           if (hasThursday) {
             sortedSlots.unshift("Full Day");
           }
        }

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
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
          <p className="text-slate-500">Welcome back, {profile?.name || "Student"}!</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">Roll No: {profile?.rollNo}</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <select 
              value={selectedWeek} 
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-transparent font-bold text-blue-800 dark:text-blue-300 outline-none cursor-pointer"
            >
              {availableWeeks.length === 0 ? (
                <option value="">No weeks available</option>
              ) : (
                availableWeeks.map(w => (
                  <option key={w} value={w} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                    {w.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </header>

      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button onClick={() => setActiveTab("schedule")} className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'schedule' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>My Schedule</button>
        <button onClick={() => setActiveTab("attendance")} className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'attendance' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}><CheckSquare className="w-4 h-4" /> Attendance</button>
        <button onClick={() => setActiveTab("clashes")} className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'clashes' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}><List className="w-4 h-4" /> Clash Management</button>
      </div>

      {activeTab === "schedule" && (
        <div className="space-y-12 animate-in fade-in duration-300">
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold flex items-center gap-4">My Schedule {isEditMode && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full animate-pulse">EDIT MODE</span>}</h2>
              <div className="flex items-center gap-4">
                <button onClick={() => setIsEditMode(!isEditMode)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isEditMode ? 'bg-blue-600 shadow-lg shadow-blue-500/30 text-white hover:bg-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                   <Settings2 className="w-4 h-4" /> {isEditMode ? 'Done Editing' : 'Customize'}
                </button>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                  <button onClick={() => setViewMode("list")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}><MapPin className="w-4 h-4" /> List</button>
                  <button onClick={() => setViewMode("table")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}><Clock className="w-4 h-4" /> Tabular</button>
                </div>
              </div>
            </div>

            {viewMode === "list" ? (
              <div className="space-y-8 mt-6">
                {schedule.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-800">
                    <p className="text-slate-500">No classes scheduled for this week.</p>
                  </div>
                ) : (
                  schedule.map((dayPlan, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4"><h3 className="font-bold text-white">{dayPlan.day}</h3></div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {dayPlan.classes.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 font-medium">
                            No classes scheduled for this day.
                          </div>
                        ) : (
                          dayPlan.classes.map((cls, cIdx) => (
                            <div key={cIdx} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <div className="flex items-center gap-6">
                                <div className="w-24 text-right shrink-0">
                                  <span className="text-sm font-medium block text-slate-700 dark:text-slate-300">{cls.timeSlot}</span>
                                </div>
                                <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                                <div>
                                  <h4 className="font-bold text-lg">{cls.courseAbb}{cls.sessionNo ? `-${cls.sessionNo}` : ''}{cls.courseName ? ` - ${cls.courseName}` : ''}</h4>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {cls.venue || 'TBA'}</span>
                                    {cls.faculty && <span className="flex items-center gap-1">Prof. {cls.faculty}</span>}
                                    {cls.section && cls.section !== "All" && <span className="font-bold text-blue-600 bg-blue-100 px-2 rounded-full">Sec {cls.section}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-3 mt-4 md:mt-0">
                                {cls.courseAbb !== "SSR" && (
                                  <>
                                    <button onClick={() => handleAttendance(getClassId(cls), "attended")} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${attendance[getClassId(cls)]?.status === 'attended' ? 'bg-emerald-500 text-white border-emerald-600' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}><CheckCircle2 className="w-4 h-4" /> Attended</button>
                                    <button onClick={() => handleAttendance(getClassId(cls), "missed")} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${attendance[getClassId(cls)]?.status === 'missed' ? 'bg-red-500 text-white border-red-600' : 'border-red-200 text-red-700 hover:bg-red-50'}`}><XCircle className="w-4 h-4" /> Missed</button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto mt-6">
                <table className="w-full text-left border-collapse xl:table-fixed min-w-[800px] xl:min-w-0">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950">
                      <th className="p-4 font-semibold text-slate-500 dark:text-slate-400 w-24 md:w-32 xl:w-28 border-r border-b border-slate-200 dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-slate-950 z-20 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b] text-sm">Day / Time</th>
                      {allTimeSlots.map(slot => <th key={slot} className="p-2 md:p-4 font-bold text-slate-800 dark:text-slate-200 border-r border-b border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-950 text-sm md:text-base">{slot}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {allDays.map(day => (
                      <tr key={day} className="border-b border-slate-200 dark:border-slate-800 last:border-0 group">
                        <td className="p-4 font-medium text-sm text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap bg-slate-50 dark:bg-slate-950 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]">
                          <span className="font-bold text-base">{day.split(',')[0]}</span>
                        </td>
                        {allTimeSlots.map(slot => {
                          const classesInSlot = myClasses.filter(c => c.day === day && c.timeSlot === slot);
                          return (
                            <td key={slot} className="p-3 border-r border-slate-200 dark:border-slate-800 align-top group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/30 transition-colors">
                              {classesInSlot.length === 0 ? (
                                <div className="h-full w-full min-h-[5rem] flex items-center justify-center">
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
                                <div className="flex flex-col gap-2 h-full">
                                  {classesInSlot.map((cls, idx) => {
                                    const cId = getClassId(cls);
                                    const isAttended = attendance[cId]?.status === 'attended' || attendanceStats.records.find((r: any) => r.classId === cId)?.status === 'attended';
                                    const isMissed = attendance[cId]?.status === 'missed' || attendanceStats.records.find((r: any) => r.classId === cId)?.status === 'missed';
                                    return (
                                    <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-1 shadow-sm h-full transition-all cursor-default ${isEditMode ? 'ring-2 ring-blue-500/50 hover:shadow-md' : 'hover-lift'} ${isAttended ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : isMissed ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                                      
                                      {isEditMode ? (
                                        <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 -mx-3 -mt-3 p-2 rounded-t-xl mb-1 border-b border-slate-200 dark:border-slate-700">
                                          <button onClick={() => openRescheduleModal(cls)} className="p-1.5 text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-lg dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60"><Edit3 className="w-3.5 h-3.5"/></button>
                                          <button onClick={() => handleCancelClass(cls)} className="p-1.5 text-red-600 bg-red-100 hover:bg-red-200 rounded-lg dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"><Trash2 className="w-3.5 h-3.5"/></button>
                                        </div>
                                      ) : (
                                        <div className="flex justify-between items-start gap-2">
                                          <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                                            {cls.courseAbb}{cls.sessionNo ? `-${cls.sessionNo}` : ''}
                                          </div>
                                          {isAttended && <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded leading-none">P</span>}
                                          {isMissed && <span className="text-[10px] font-black text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded leading-none">A</span>}
                                        </div>
                                      )}
                                      
                                      {isEditMode && (
                                        <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                                          {cls.courseAbb}{cls.sessionNo ? `-${cls.sessionNo}` : ''}
                                        </div>
                                      )}

                                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mt-auto pt-2">
                                        <span>{cls.venue || 'TBA'}</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">Sec {cls.section}</span>
                                      </div>
                                    </div>
                                  )})}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                                  <span className="font-bold text-slate-800 dark:text-slate-200 text-base">{rec.date} <span className="font-medium text-slate-500 ml-1">({rec.day})</span></span>
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
    </div>
  );
}
