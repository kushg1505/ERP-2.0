"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { getStudentProfile, saveStudentProfile } from "@/lib/db";
import type { StudentProfile } from "@/lib/db";
import type { StudentDirectoryRecord } from "@/lib/student-directory-types";
import { ArrowRight, CheckCircle2, Search, Save, UserRound } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [rollNo, setRollNo] = useState("");
  const [student, setStudent] = useState<StudentDirectoryRecord | null>(null);
  const [savedProfile, setSavedProfile] = useState<StudentProfile | null>(null);
  const [includeFinPrep, setIncludeFinPrep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (authLoading) return;
      if (!user) {
        const pendingRollNo = new URLSearchParams(window.location.search).get("rollNo")?.trim() || "";
        if (pendingRollNo) setRollNo(pendingRollNo);
        setLoading(false);
        return;
      }

      setLoading(true);
      const existing = await getStudentProfile(user.uid);
      if (cancelled) return;
      setSavedProfile(existing);
      const queryRollNo = new URLSearchParams(window.location.search).get("rollNo")?.trim() || "";
      const requestedFinPrep = new URLSearchParams(window.location.search).get("includeFinPrep") === "1";
      const initialRollNo = queryRollNo || existing?.rollNo || "";
      setRollNo(initialRollNo);
      setIncludeFinPrep(Boolean(
        requestedFinPrep || (existing?.rollNo === initialRollNo &&
          existing.courses?.some((course) => course.courseCode.toLowerCase() === "finprep")),
      ));

      if (initialRollNo) {
        setLookingUp(true);
        try {
          const response = await fetch("/api/student-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rollNo: initialRollNo }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Could not find your student record.");
          if (!cancelled) setStudent(result.student as StudentDirectoryRecord);
        } catch (lookupError) {
          if (!cancelled) setError(lookupError instanceof Error ? lookupError.message : "Student lookup failed.");
        } finally {
          if (!cancelled) setLookingUp(false);
        }
      }

      if (!cancelled) setLoading(false);
    }

    loadProfile();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const handleLookup = async () => {
    if (!rollNo.trim()) {
      setError("Enter your roll number.");
      return;
    }
    setLookingUp(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/student-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: rollNo.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not find your student record.");
      setStudent(result.student as StudentDirectoryRecord);
      setRollNo((result.student as StudentDirectoryRecord).rollNo);
      setIncludeFinPrep(Boolean(
        savedProfile?.rollNo === (result.student as StudentDirectoryRecord).rollNo &&
        savedProfile.courses?.some((course) => course.courseCode.toLowerCase() === "finprep"),
      ));
    } catch (lookupError) {
      setStudent(null);
      setError(lookupError instanceof Error ? lookupError.message : "Student lookup failed.");
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    if (!user || !student) return;
    setSaving(true);
    setError("");
    const courses = student.courses.filter((course) => course.courseCode.toLowerCase() !== "finprep");
    if (student.program === "2nd-core" && includeFinPrep) {
      courses.push({ courseCode: "FINPrep", section: "" });
    }
    const profile: StudentProfile = {
      rollNo: student.rollNo,
      name: student.name,
      program: student.program,
      ...(student.section ? { section: student.section } : {}),
      ...(student.dtiGroup ? { dtiGroup: student.dtiGroup } : {}),
      courses,
      scheduleOverrides: savedProfile?.rollNo === student.rollNo ? savedProfile.scheduleOverrides ?? [] : [],
    };
    await saveStudentProfile(user.uid, profile);
    setSavedProfile(profile);
    setSaving(false);
    setSaved(true);
  };

  if (authLoading || loading) {
    return <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
      <div>
        <h1 className="text-3xl font-bold mb-2">Set Up Your Timetable</h1>
        <p className="text-slate-500">Enter your roll number once. We’ll identify your program, courses, and sections automatically.</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-5">
        <label htmlFor="profile-roll-number" className="text-sm font-bold text-slate-500 uppercase tracking-wider block">Enrollment / Roll Number</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="profile-roll-number"
            type="text"
            value={rollNo}
            onChange={(event) => setRollNo(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleLookup()}
            placeholder="Enter your roll number"
            autoComplete="off"
            className="input-field flex-1"
          />
          <button onClick={handleLookup} disabled={lookingUp} className="btn-secondary flex justify-center items-center gap-2 rounded-xl">
            <Search className={`w-4 h-4 ${lookingUp ? "animate-pulse" : ""}`} />
            {lookingUp ? "Finding you…" : "Find my record"}
          </button>
        </div>

        {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

        {student && (
          <div className="space-y-5 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UserRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{student.name || "Student"}</h2>
                <p className="text-sm text-slate-500">{student.program.split("-")[0]} Year {student.program.split("-")[1].toUpperCase()} · Roll No. {student.rollNo}</p>
                <p className="text-sm text-slate-500 mt-1">
                  Section {student.section || "—"}{student.dtiGroup ? ` · DTI Group ${student.dtiGroup}` : ""}
                </p>
              </div>
            </div>

            {student.warnings.map((warning) => (
              <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
                {warning === "dti-group-pending"
                  ? "Your base section is available. The DTI group roster has not been added yet, so DTI classes may be missing until that file is provided."
                  : warning === "elective-pending"
                    ? "Your section and fixed courses are available, but the roster does not include your elective choice yet."
                      : "Your elective could not be matched to a timetable course. Please contact the administrator."}
              </div>
            ))}

            {student.program === "2nd-core" && (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includeFinPrep}
                  onChange={(event) => setIncludeFinPrep(event.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Include FINPrep in my timetable
              </label>
            )}

            {student.courses.length > 0 && (
              <div>
                <h3 className="font-bold mb-3">Courses found ({student.courses.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {student.courses.map((course, index) => (
                    <span key={`${course.courseCode}-${course.section}-${index}`} className="rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-3 py-1.5 text-sm font-semibold text-blue-800 dark:text-blue-300">
                      {course.courseCode}{course.section ? ` · Sec ${course.section}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {user ? (
              <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-2">
                {saved && (
                  <Link href="/dashboard" className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-5 py-3 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Profile saved · Open dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2">
                  <Save className="w-5 h-5" /> {saving ? "Saving…" : saved ? "Saved" : "Save profile"}
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-500">Your schedule is ready. Sign in to save it and track attendance.</p>
                <AuthButton />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
