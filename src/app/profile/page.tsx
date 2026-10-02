"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getStudentProfile, saveStudentProfile, StudentProfile, fetchAllCourses, getStudentFromMasterDB } from "@/lib/db";
import { Save, Plus, Trash2, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";

const AVAILABLE_SECTIONS = ["A", "B", "C", "D", "E", "F", "A+B"];

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile>({ rollNo: "", name: "", courses: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // New States for Flow
  const [availableCourses, setAvailableCourses] = useState<{abbreviation: string, name: string}[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  useEffect(() => {
    if (user) {
      Promise.all([
        getStudentProfile(user.uid),
        fetchAllCourses()
      ]).then(([profileData, coursesData]) => {
        if (profileData) setProfile(profileData);
        else setProfile(prev => ({ ...prev, name: user.displayName || "" }));
        
        // Sort courses alphabetically by abbreviation
        const sortedCourses = (coursesData as any[]).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
        setAvailableCourses(sortedCourses);
        
        setLoading(false);
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await saveStudentProfile(user.uid, profile);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
       // Format to match our profile interface: {courseCode, section}
       const formattedCourses = masterData.enrolledCourses.map((c: any) => ({
          courseCode: c.abbreviation,
          section: c.section
       }));
       
       setProfile(prev => ({ ...prev, courses: formattedCourses, name: masterData.name || prev.name }));
       setSyncMessage({ type: "success", text: "Success! Your courses were loaded from the university database." });
    } else {
       setSyncMessage({ type: "error", text: "Roll number not found in database. Please choose your subjects manually below." });
    }
    setSyncing(false);
  };

  const addCourse = () => {
    setProfile(prev => ({
      ...prev,
      courses: [...prev.courses, { courseCode: availableCourses[0]?.abbreviation || "UNKNOWN", section: AVAILABLE_SECTIONS[0] }]
    }));
  };

  const removeCourse = (index: number) => {
    setProfile(prev => {
      const newCourses = [...prev.courses];
      newCourses.splice(index, 1);
      return { ...prev, courses: newCourses };
    });
  };

  const updateCourse = (index: number, field: "courseCode" | "section", value: string) => {
    setProfile(prev => {
      const newCourses = [...prev.courses];
      newCourses[index] = { ...newCourses[index], [field]: value };
      return { ...prev, courses: newCourses };
    });
  };

  if (!user) {
    return <div className="text-center mt-20">Please sign in to view your profile.</div>;
  }

  if (loading) return <div className="text-center mt-20">Loading profile...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Profile & Courses</h1>
        <p className="text-slate-500">Set your Roll Number and sync to generate your personalized timetable, or select subjects manually.</p>
      </div>

      <div className="glass-panel p-8 rounded-2xl space-y-6">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={profile.name}
              onChange={e => setProfile({...profile, name: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Enrollment / Roll Number</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. 240102069"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                value={profile.rollNo}
                onChange={e => setProfile({...profile, rollNo: e.target.value})}
              />
              <button 
                onClick={handleSyncDatabase}
                disabled={syncing}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </div>
            {syncMessage && (
               <div className={`mt-2 text-sm flex items-start gap-1.5 ${syncMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                 {syncMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                 <span>{syncMessage.text}</span>
               </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 rounded-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center gap-2">
             Enrolled Courses
             <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">{profile.courses.length} selected</span>
          </h2>
          <button onClick={addCourse} className="btn-secondary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Manually
          </button>
        </div>

        {profile.courses.length === 0 ? (
          <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">No courses found.</p>
            <p className="text-sm">Sync your Roll No above, or click 'Add Manually' if you are not in the database.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.courses.map((course, idx) => (
              <div key={idx} className="flex gap-4 items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 group">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-500">Course</label>
                  <select 
                    className="w-full bg-transparent outline-none font-medium text-slate-800 dark:text-slate-200"
                    value={course.courseCode}
                    onChange={(e) => updateCourse(idx, "courseCode", e.target.value)}
                  >
                    {availableCourses.map(c => (
                       <option key={c.abbreviation} value={c.abbreviation} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                          {c.abbreviation} - {c.name}
                       </option>
                    ))}
                    {/* Fallback in case a course was saved that is no longer in the DB */}
                    {!availableCourses.some(c => c.abbreviation === course.courseCode) && (
                       <option value={course.courseCode} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                          {course.courseCode}
                       </option>
                    )}
                  </select>
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-xs font-medium text-slate-500">Section</label>
                  <select 
                    className="w-full bg-transparent outline-none font-medium text-slate-800 dark:text-slate-200"
                    value={course.section}
                    onChange={(e) => updateCourse(idx, "section", e.target.value)}
                  >
                    {AVAILABLE_SECTIONS.map(s => <option key={s} value={s} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">Section {s}</option>)}
                    {!AVAILABLE_SECTIONS.includes(course.section) && (
                       <option value={course.section} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">Section {course.section}</option>
                    )}
                  </select>
                </div>
                <button 
                  onClick={() => removeCourse(idx)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors mt-4 opacity-50 group-hover:opacity-100"
                  title="Remove Course"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-6 flex items-center justify-end gap-4 border-t border-slate-200 dark:border-slate-700">
          {saved && <span className="text-emerald-500 text-sm flex items-center gap-1 font-medium"><CheckCircle2 className="w-4 h-4" /> Schedule Saved!</span>}
          <button 
            onClick={handleSave} 
            disabled={saving || !profile.rollNo}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save & Generate Timetable"}
          </button>
        </div>
      </div>
    </div>
  );
}
