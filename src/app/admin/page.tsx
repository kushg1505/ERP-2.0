"use client";

import { useState } from "react";
import Papa from "papaparse";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { saveMasterTimetable, saveClashSchedule } from "@/lib/db";
import { parseScheduleCSV } from "@/lib/parser";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState("week-5-2026");
  const [selectedProgram, setSelectedProgram] = useState("2nd-core");
  const [timetableStatus, setTimetableStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [clashStatus, setClashStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");

  const handleTimetableUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTimetableStatus("uploading");
    
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as string[][];
          
          // Detect offset headers (e.g. if the first few rows are Titles instead of column names)
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(10, rows.length); i++) {
             const rowVals = rows[i].map(v => String(v).trim().toLowerCase());
             if (rowVals.includes("day")) {
                headerRowIndex = i;
                break;
             }
          }
          
          if (headerRowIndex === -1) {
             throw new Error("Could not find a 'Day' column in the first 10 rows.");
          }
          
          const headers = rows[headerRowIndex].map(h => String(h).trim());
          
          const rawData = rows.slice(headerRowIndex + 1).map(row => {
             const obj: any = {};
             row.forEach((val, index) => {
                const header = headers[index];
                if (header && header !== "") {
                   obj[header] = val;
                }
             });
             return obj;
          });

          const parsedClasses = parseScheduleCSV(rawData);
          await saveMasterTimetable(selectedWeek, selectedProgram, parsedClasses);
          setTimetableStatus("success");
        } catch (error) {
          console.error(error);
          setTimetableStatus("error");
        }
      },
      error: () => setTimetableStatus("error")
    });
  };

  const handleClashUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setClashStatus("uploading");
    
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as string[][];
          
          // Detect if headers were offset by an empty row in Excel
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(10, rows.length); i++) {
             const rowVals = rows[i].map(v => String(v).trim().toLowerCase());
             if (rowVals.includes("roll no.") || rowVals.includes("name") || rowVals.includes("course-1")) {
                headerRowIndex = i;
                break;
             }
          }
          
          if (headerRowIndex === -1) {
             headerRowIndex = 0; // Fallback to first row
          }
          
          const headers = rows[headerRowIndex].map(h => String(h).trim());
          
          const cleanedData = rows.slice(headerRowIndex + 1).map(row => {
             const obj: any = {};
             row.forEach((val, index) => {
                const header = headers[index];
                if (header && header !== "") {
                   obj[header] = val;
                }
             });
             return obj;
          });
          
          await saveClashSchedule(selectedWeek, cleanedData);
          setClashStatus("success");
        } catch (error) {
          console.error("Clash upload error:", error);
          setClashStatus("error");
        }
      },
      error: () => setClashStatus("error")
    });
  };

  // Basic role check
  if (!user) {
    return <div className="text-center mt-20">Please sign in to access the Admin Portal.</div>;
  }

  // Admin authorization check
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You do not have permission to access the Admin Portal. Only authorized administrators can upload schedules.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Portal</h1>
          <p className="text-slate-500">Upload the weekly Master Timetable and Clash Management schedules here.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Target Program</label>
            <select 
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1st-core">1st Year - Core</option>
              <option value="1st-bfs">1st Year - BFS</option>
              <option value="1st-dcp">1st Year - DCP</option>
              <option value="2nd-core">2nd Year - Core</option>
              <option value="2nd-bfs">2nd Year - BFS</option>
              <option value="2nd-dcp">2nd Year - DCP</option>
            </select>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[150px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Target Week</label>
            <select 
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                <option key={num} value={`week-${num}-2026`}>Week {num}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <UploadCloud className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold">Master Timetable</h2>
          <p className="text-sm text-slate-500 mb-4">Upload the converted CSV of the weekly schedule.</p>
          
          <label className="btn-primary cursor-pointer w-full text-center hover-lift relative overflow-hidden">
            <input type="file" accept=".csv" className="hidden" onChange={handleTimetableUpload} />
            {timetableStatus === "uploading" ? "Parsing..." : "Upload Timetable CSV"}
          </label>
          
          {timetableStatus === "success" && <p className="text-emerald-500 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Successfully uploaded!</p>}
          {timetableStatus === "error" && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Failed to parse file.</p>}
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <UploadCloud className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold">Clash Management</h2>
          <p className="text-sm text-slate-500 mb-4">Upload the CSV containing the weekly class clashes.</p>
          
          <label className="btn-primary cursor-pointer w-full text-center hover-lift relative overflow-hidden bg-amber-600 hover:bg-amber-700 active:bg-amber-800">
            <input type="file" accept=".csv" className="hidden" onChange={handleClashUpload} />
            {clashStatus === "uploading" ? "Parsing..." : "Upload Clashes CSV"}
          </label>

          {clashStatus === "success" && <p className="text-emerald-500 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Successfully uploaded!</p>}
          {clashStatus === "error" && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Failed to parse file.</p>}
        </div>
      </div>
    </div>
  );
}
