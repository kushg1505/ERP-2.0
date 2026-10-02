"use client";

import { useState } from "react";
import * as xlsx from "xlsx";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, writeBatch, collection, getDocs, deleteDoc } from "firebase/firestore";
import { UploadCloud, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

export default function MigrateDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "parsing" | "uploading" | "success" | "error">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  
  const [files, setFiles] = useState<{
    students?: File;
    courses?: File;
    timetable?: File;
  }>({});

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleFileChange = (type: "students" | "courses" | "timetable", file: File) => {
    setFiles((prev) => ({ ...prev, [type]: file }));
  };

  const processFiles = async () => {
    if (!files.students || !files.courses || !files.timetable) {
      alert("Please upload all 3 files!");
      return;
    }
    
    setStatus("parsing");
    setLogs([]);
    addLog("Started parsing files...");

    try {
      // 1. Parse Courses
      const coursesData = await readExcel(files.courses);
      const coursesMap = new Map(); // Course Name -> Abb
      const coursesList: any[] = [];
      
      coursesData.slice(1).forEach((row: any) => {
        if (!row[3] || !row[4]) return; // Need Name and Abb
        const courseName = row[3].trim();
        const abb = row[4].trim();
        const faculty = row[5] ? row[5].trim() : "";
        
        coursesMap.set(courseName, abb);
        coursesList.push({
           name: courseName,
           abbreviation: abb,
           faculty: faculty
        });
      });
      addLog(`Parsed ${coursesList.length} courses.`);

      // 2. Parse Students
      const studentsData = await readExcel(files.students);
      const studentHeaders = studentsData[0];
      const studentsList: any[] = [];
      
      studentsData.slice(1).forEach((row: any) => {
        const rollNo = row[1];
        const name = row[2];
        if (!rollNo) return;
        
        const enrolledCourses: any[] = [];
        
        // Check columns from index 6 onwards for sections
        for (let i = 6; i < studentHeaders.length; i++) {
           const courseName = studentHeaders[i];
           const section = row[i];
           
           if (section && courseName) {
              const abb = coursesMap.get(courseName.trim());
              if (abb) {
                 enrolledCourses.push({
                    abbreviation: abb,
                    section: String(section).trim()
                 });
              }
           }
        }
        
        studentsList.push({
           rollNo: String(rollNo),
           name: name || "",
           enrolledCourses
        });
      });
      addLog(`Parsed ${studentsList.length} students.`);

      // 3. Parse Timetable
      const timetableData = await readExcel(files.timetable);
      const timetableList: any[] = [];
      
      timetableData.slice(1).forEach((row: any) => {
         const courseAbb = row[7];
         const section = row[9];
         if (!courseAbb || !section) return;
         
         timetableList.push({
            date: row[0],
            day: row[1],
            timeSlot: row[3],
            startTime: row[4],
            endTime: row[5],
            courseAbb: courseAbb,
            courseName: row[8],
            section: String(section),
            faculty: row[11],
            venue: row[12]
         });
      });
      addLog(`Parsed ${timetableList.length} timetable entries.`);

      setStatus("uploading");
      addLog("Uploading to Firestore...");

      // Upload Courses
      for (const course of coursesList) {
         await setDoc(doc(db, "courses", course.abbreviation), course);
      }
      addLog("Uploaded courses successfully.");

      // Upload Students
      let batch = writeBatch(db);
      let count = 0;
      for (const student of studentsList) {
         const studentRef = doc(db, "students", student.rollNo);
         batch.set(studentRef, student);
         count++;
         if (count === 500) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
         }
      }
      if (count > 0) await batch.commit();
      addLog("Uploaded students successfully.");

      // Upload Timetable to a master document
      await setDoc(doc(db, "master_schedules", "week-1-term-5"), {
         classes: timetableList
      });
      addLog("Uploaded timetable successfully.");

      setStatus("success");
      addLog("Migration Complete! Database is ready.");

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      addLog(`Error: ${err.message}`);
    }
  };

  const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = xlsx.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return <div className="text-center mt-20 text-red-500">Access Denied. Admins only.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-bold mb-2">Term 5 Database Migration</h1>
        <p className="text-slate-500">Upload the 3 master Excel files below to securely wipe the old database and seed Term 5 data.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Student File */}
        <div className="glass-panel p-6 rounded-xl flex flex-col items-center text-center space-y-4 border border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-lg">1. Student List</h2>
          <label className="btn-primary cursor-pointer w-full text-center hover-lift relative overflow-hidden bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => e.target.files && handleFileChange("students", e.target.files[0])} />
            {files.students ? files.students.name : "Select Excel"}
          </label>
        </div>

        {/* Courses File */}
        <div className="glass-panel p-6 rounded-xl flex flex-col items-center text-center space-y-4 border border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-lg">2. Course List</h2>
          <label className="btn-primary cursor-pointer w-full text-center hover-lift relative overflow-hidden bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium">
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => e.target.files && handleFileChange("courses", e.target.files[0])} />
            {files.courses ? files.courses.name : "Select Excel"}
          </label>
        </div>

        {/* Timetable File */}
        <div className="glass-panel p-6 rounded-xl flex flex-col items-center text-center space-y-4 border border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-lg">3. Week 1 Timetable</h2>
          <label className="btn-primary cursor-pointer w-full text-center hover-lift relative overflow-hidden bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-medium">
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => e.target.files && handleFileChange("timetable", e.target.files[0])} />
            {files.timetable ? files.timetable.name : "Select Excel"}
          </label>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <button 
          onClick={processFiles}
          disabled={status === "parsing" || status === "uploading"}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all"
        >
          <UploadCloud className="w-5 h-5" />
          {status === "idle" ? "Start Migration" : status === "parsing" ? "Parsing Files..." : status === "uploading" ? "Writing to Database..." : "Migration Complete"}
        </button>
      </div>

      {logs.length > 0 && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-sm text-green-400">
          {logs.map((log, i) => (
            <div key={i}>{'>'} {log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
