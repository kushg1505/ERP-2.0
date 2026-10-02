"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getStudentProfile, saveStudentProfile, StudentProfile, fetchAllCourses, getStudentFromMasterDB } from "@/lib/db";
import { Save, RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Trash2, Plus } from "lucide-react";
import Link from "next/link";

const AVAILABLE_SECTIONS = ["A", "B", "C", "D", "E", "F"];
const BFS_FIXED_COURSES = ["MLBFSI", "FIS", "VCPE", "HRM", "BFSI&STY"];
const BFS_ELECTIVE_COURSES = ["BF", "SERM"];

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile>({ rollNo: "", name: "", courses: [], program: "2nd-core" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // UI State
  const [year, setYear] = useState<string>("2nd");
  const [spec, setSpec] = useState<string>("core"); // core, bfs, dcp
  
  const [availableCourses, setAvailableCourses] = useState<{abbreviation: string, name: string}[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  // BFS State
  const [bfsSection, setBfsSection] = useState("A");
  const [bfsElective, setBfsElective] = useState("BF");

  // Manual Course Edit State
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseSection, setNewCourseSection] = useState("A");

  useEffect(() => {
    if (user) {
      Promise.all([
        getStudentProfile(user.uid),
        fetchAllCourses()
      ]).then(([profileData, coursesData]) => {
        if (profileData) {
          setProfile(profileData);
          if (profileData.program) {
            const [y, s] = profileData.program.split("-");
            setYear(y);
            setSpec(s);
          }
        } else {
          setProfile(prev => ({ ...prev, name: user.displayName || "" }));
        }
        
        const sortedCourses = (coursesData as any[]).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
        setAvailableCourses(sortedCourses);
        setLoading(false);
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    const programStr = `${year}-${spec}`;
    let finalProfile = { ...profile, program: programStr };

    if (spec === "bfs") {
      // Build courses list manually
      const courses = [];
      for (const c of BFS_FIXED_COURSES) {
         courses.push({ courseCode: c, section: bfsSection });
      }
      courses.push({ courseCode: bfsElective, section: bfsSection });
      finalProfile.courses = courses;
    }

    await saveStudentProfile(user.uid, finalProfile);
    setProfile(finalProfile);
    setSaving(false);
    setSaved(true);
    // Don't auto hide the saved state immediately, give them time to click the dashboard link
    setTimeout(() => setSaved(false), 8000);
  };

  const handleSyncDatabase = async () => {
    if (!profile.rollNo || profile.rollNo.trim() === "") {
       setSyncMessage({ type: "error", text: "Please enter your Roll Number first." });
       return;
    }
    setSyncing(true);
    setSyncMessage(null);
    
    const masterData = await getStudentFromMasterDB(profile.rollNo.trim());
    if (masterData && masterData.enrolledCourses) {
       const formattedCourses = masterData.enrolledCourses.map((c: any) => ({
          courseCode: c.abbreviation,
          section: c.section
       }));
       setProfile(prev => ({ ...prev, name: masterData.name || prev.name, courses: formattedCourses }));
       setSyncMessage({ type: "success", text: "Successfully synced with master database!" });
    } else {
       setSyncMessage({ type: "error", text: "Roll number not found in master database." });
    }
    setSyncing(false);
  };

  const handleAddCourse = () => {
    if (!newCourseCode) return;
    if (profile.courses.some(c => c.courseCode === newCourseCode)) return; // Already exists
    setProfile(prev => ({
      ...prev,
      courses: [...prev.courses, { courseCode: newCourseCode, section: newCourseSection }]
    }));
    setNewCourseCode(""); // Reset after add
  };

  const handleRemoveCourse = (courseCode: string) => {
    setProfile(prev => ({
      ...prev,
      courses: prev.courses.filter(c => c.courseCode !== courseCode)
    }));
  };

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
      <div>
        <h1 className="text-3xl font-bold mb-2">Student Profile</h1>
        <p className="text-slate-500">Configure your program details to view your personalized schedule.</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-6">
        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-4">1. Select Your Program</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="input-field w-full">
              <option value="1st">1st Year</option>
              <option value="2nd">2nd Year</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Specialization</label>
            <select value={spec} onChange={(e) => setSpec(e.target.value)} className="input-field w-full">
              <option value="core">Core</option>
              <option value="bfs">BFS</option>
              <option value="dcp">DCP</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-6">
        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-4">2. Course Setup</h2>

        {(spec === "core" || spec === "dcp") && (
          <div className="space-y-6">
             <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
               <p className="text-sm font-medium">For Core and DCP students, simply enter your Roll Number and click Sync. Your courses will be automatically fetched.</p>
             </div>
             
             <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Roll Number</label>
                <input 
                  type="text" 
                  value={profile.rollNo}
                  onChange={(e) => setProfile({ ...profile, rollNo: e.target.value })}
                  placeholder="e.g. 2402001"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Name (Optional)</label>
                <input 
                  type="text" 
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Your Name"
                  className="input-field w-full"
                />
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <button 
                onClick={handleSyncDatabase}
                disabled={syncing}
                className="btn-secondary px-6 py-2.5 rounded-xl font-medium flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync from Master Database"}
              </button>
              {syncMessage && (
                <div className={`flex items-center gap-2 text-sm font-medium ${syncMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {syncMessage.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {syncMessage.text}
                </div>
              )}
            </div>

            {profile.courses.length > 0 && (
               <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Enrolled Courses ({profile.courses.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                     {profile.courses.map((c, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex justify-between items-center group">
                           <div>
                             <div className="font-bold text-lg">{c.courseCode}</div>
                             <div className="text-xs text-slate-500 font-medium">Section {c.section}</div>
                           </div>
                           <button onClick={() => handleRemoveCourse(c.courseCode)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Remove course">
                             <Trash2 className="w-5 h-5" />
                           </button>
                        </div>
                     ))}
                  </div>
                  
                  <div className="mt-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3">Add / Override Course</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select 
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        className="input-field flex-grow"
                      >
                        <option value="">-- Select Course --</option>
                        {availableCourses.filter(c => !profile.courses.some(pc => pc.courseCode === c.abbreviation)).map(c => (
                          <option key={c.abbreviation} value={c.abbreviation}>{c.abbreviation} - {c.name}</option>
                        ))}
                      </select>
                      <select
                        value={newCourseSection}
                        onChange={(e) => setNewCourseSection(e.target.value)}
                        className="input-field w-full sm:w-32"
                      >
                        {AVAILABLE_SECTIONS.map(s => <option key={s} value={s}>Sec {s}</option>)}
                      </select>
                      <button 
                        onClick={handleAddCourse}
                        disabled={!newCourseCode}
                        className="btn-secondary px-6 rounded-lg font-bold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>
               </div>
            )}
          </div>
        )}

        {spec === "bfs" && (
           <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
               <p className="text-sm font-medium">As a BFS student, you have 5 fixed courses. Please select your 1 Elective and your Section.</p>
             </div>

             <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Your Section</label>
                  <select value={bfsSection} onChange={(e) => setBfsSection(e.target.value)} className="input-field w-full">
                     {AVAILABLE_SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Choose Elective</label>
                  <select value={bfsElective} onChange={(e) => setBfsElective(e.target.value)} className="input-field w-full">
                     {BFS_ELECTIVE_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
             </div>

             <div className="mt-6">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-3">Your 6 Courses</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                   {BFS_FIXED_COURSES.map((c, i) => (
                      <div key={i} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
                         <div className="font-bold">{c}</div>
                         <div className="text-xs text-slate-500">Fixed</div>
                      </div>
                   ))}
                   <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-center ring-2 ring-blue-500">
                         <div className="font-bold text-blue-700 dark:text-blue-400">{bfsElective}</div>
                         <div className="text-xs text-blue-500">Elective</div>
                      </div>
                </div>
             </div>
           </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4">
        {saved && (
          <Link href="/dashboard" className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-6 py-3 rounded-xl flex items-center gap-2 transition-all hover:bg-emerald-100 hover:shadow-lg hover:shadow-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
            Profile Saved! Go to Dashboard <ArrowRight className="w-5 h-5" />
          </Link>
        )}
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
        >
          {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
          {saved ? "Saved!" : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
