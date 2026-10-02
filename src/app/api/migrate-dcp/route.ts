import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import * as xlsx from "xlsx";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    const basePath = process.cwd();
    
    // Parse Courses
    const cPath = path.join(basePath, "Term_V_Courses_and_Faculty_DCP.xlsx");
    if (!fs.existsSync(cPath)) return NextResponse.json({ error: "Courses file not found" }, { status: 400 });
    
    const cBuffer = fs.readFileSync(cPath);
    const cWb = xlsx.read(cBuffer);
    const cData = xlsx.utils.sheet_to_json(cWb.Sheets[cWb.SheetNames[0]], {header: 1});
    
    const courses: any[] = [];
    cData.slice(1).forEach((row: any) => {
      if(row[2]) {
        courses.push({ name: row[1]?.trim() || "", abbreviation: row[2]?.trim() || "", faculty: row[5]?.trim() || "" });
      }
    });

    // Parse Students
    const sPath = path.join(basePath, "Student_Course_Section_DCP.xlsx");
    if (!fs.existsSync(sPath)) return NextResponse.json({ error: "Students file not found" }, { status: 400 });
    
    const sBuffer = fs.readFileSync(sPath);
    const sWb = xlsx.read(sBuffer);
    const sData = xlsx.utils.sheet_to_json(sWb.Sheets[sWb.SheetNames[0]], {header: 1});
    const sHeaders: any = sData[0];
    
    const students: any[] = [];
    sData.slice(1).forEach((row: any) => {
      if(!row[0]) return;
      const enrolled: any[] = [];
      for(let i=2; i<sHeaders.length-1; i++){
         if(row[i]) {
            enrolled.push({ abbreviation: sHeaders[i]?.trim(), section: String(row[i]).trim() });
         }
      }
      students.push({ rollNo: String(row[0]).trim(), name: row[1]?.trim() || "", enrolledCourses: enrolled });
    });

    // Upload to Firestore
    let coursesCount = 0;
    for (const c of courses) {
      await setDoc(doc(db, "courses", c.abbreviation), c);
      coursesCount++;
    }

    let studentsCount = 0;
    for (const s of students) {
      await setDoc(doc(db, "students", s.rollNo), s);
      studentsCount++;
    }

    return NextResponse.json({ success: true, coursesCount, studentsCount });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
