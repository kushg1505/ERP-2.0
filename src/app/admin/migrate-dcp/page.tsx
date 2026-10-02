"use client";

import { useState } from "react";
import * as xlsx from "xlsx";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";

export default function MigrateDCPDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "parsing" | "uploading" | "success" | "error">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  
  const [files, setFiles] = useState<{
    students?: File;
    courses?: File;
  }>({});

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleFileChange = (type: "students" | "courses", file: File) => {
    setFiles((prev) => ({ ...prev, [type]: file }));
  };

  const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = xlsx.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async () => {
    if (!files.students || !files.courses) {
      alert("Please upload both DCP files!");
      return;
    }
    
    setStatus("parsing");
    setLogs([]);
    addLog("Started parsing files...");

    try {
      // 1. Parse Courses
      const coursesData = await readExcel(files.courses);
      const coursesList: any[] = [];
      
      coursesData.slice(1).forEach((row: any) => {
        if (!row[2]) return; // Need Abb
        const courseName = row[1]?.trim() || "";
        const abb = row[2]?.trim() || "";
        const faculty = row[5]?.trim() || "";
        
        coursesList.push({
           name: courseName,
           abbreviation: abb,
           faculty: faculty
        });
      });
      addLog(`Parsed ${coursesList.length} courses.`);

      // 2. Parse Students
      const studentsData = await readExcel(files.students);
      const studentHeaders = studentsData[0] as string[];
      const studentsList: any[] = [];
      
      studentsData.slice(1).forEach((row: any) => {
        const rollNo = row[0];
        const name = row[1];
        if (!rollNo) return;
        
        const enrolledCourses: any[] = [];
        
        for (let i = 2; i < studentHeaders.length - 1; i++) {
           const section = row[i];
           if (section) {
              enrolledCourses.push({
                 abbreviation: studentHeaders[i].trim(),
                 section: String(section).trim()
              });
           }
        }
        
        studentsList.push({
           rollNo: String(rollNo),
           name: name || "",
           enrolledCourses
        });
      });
      addLog(`Parsed ${studentsList.length} students.`);

      setStatus("uploading");
      
      // Upload Courses
      for (const c of coursesList) {
        await setDoc(doc(db, "courses", c.abbreviation), c);
      }
      addLog("Courses uploaded successfully.");

      // Upload Students
      for (const s of studentsList) {
        await setDoc(doc(db, "students", s.rollNo), s);
      }
      addLog("Students uploaded successfully.");

      // Upload BFS Fixed Courses
      addLog("Uploading BFS Courses...");
      const bfsCourses = [
        { name: "Behavioural Finance", abbreviation: "BF", faculty: "Hardeep Singh Mundi" },
        { name: "Service Excellence & Relationship Management", abbreviation: "SERM", faculty: "Sapna Popli" },
        { name: "Machine Learning for BFSI", abbreviation: "MLBFSI", faculty: "Tuhin Chattopadhyay" },
        { name: "Fixed Income Securities", abbreviation: "FIS", faculty: "Harsimran Sandhu" },
        { name: "Venture Capital & Private Equity", abbreviation: "VCPE", faculty: "Kamal Bansal" },
        { name: "Human Resource Management", abbreviation: "HRM", faculty: "Romana Gulshani" },
        { name: "BFSI & Society", abbreviation: "BFSI&STY", faculty: "Labanya Prakash Jena" }
      ];
      for (const c of bfsCourses) {
        await setDoc(doc(db, "courses", c.abbreviation), c);
      }
      addLog("BFS Courses uploaded successfully.");

      setStatus("success");
    } catch (error: any) {
      console.error(error);
      addLog(`Error: ${error.message}`);
      setStatus("error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div>
        <h1 className="text-3xl font-bold mb-2">DCP Migration Portal</h1>
        <p className="text-slate-500">Upload the DCP Student and Courses files here.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upload Cards */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
          <UploadCloud className="w-8 h-8 text-blue-600" />
          <h2 className="text-lg font-semibold">Courses & Faculty DCP</h2>
          <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => e.target.files?.[0] && handleFileChange("courses", e.target.files[0])} className="text-sm" />
        </div>
        
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
          <UploadCloud className="w-8 h-8 text-amber-600" />
          <h2 className="text-lg font-semibold">Student Course DCP</h2>
          <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => e.target.files?.[0] && handleFileChange("students", e.target.files[0])} className="text-sm" />
        </div>
      </div>

      <div className="flex justify-center mt-8">
        <button 
          onClick={processFiles}
          disabled={status === "parsing" || status === "uploading"}
          className="btn-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2"
        >
          {status === "idle" || status === "error" ? "Start Migration" : "Processing..."}
        </button>
      </div>

      <div className="glass-panel p-6 rounded-2xl mt-8">
        <h3 className="font-bold mb-4">Migration Logs</h3>
        <div className="bg-slate-950 rounded-xl p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto space-y-2">
          {logs.map((log, i) => (
            <div key={i}>{">"} {log}</div>
          ))}
          {status === "success" && <div className="text-blue-400 font-bold mt-4">✓ All DCP data successfully migrated!</div>}
        </div>
      </div>
    </div>
  );
}
