import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";

export interface ScheduleOverride {
  type: 'cancel' | 'add' | 'reschedule';
  originalClassId?: string; 
  newClassDetails?: any; 
  weekId: string;
}

export interface StudentProfile {
  rollNo: string;
  name: string;
  program?: string;
  section?: string;
  dtiGroup?: string;
  courses: { courseCode: string; section: string }[];
  scheduleOverrides?: ScheduleOverride[];
}

export async function getStudentProfile(uid: string): Promise<StudentProfile | null> {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as StudentProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching profile", error);
    return null;
  }
}

export async function updateStudentOverrides(uid: string, overrides: ScheduleOverride[]) {
  try {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, { scheduleOverrides: overrides });
  } catch (error) {
    console.error("Error updating overrides", error);
  }
}

// NEW FUNCTIONS FOR TERM 5 MIGRATION FLOW
export async function getStudentFromMasterDB(rollNo: string) {
  try {
    const docRef = doc(db, "students", rollNo);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error: any) {
    console.error("Error fetching student from master DB", error);
    if (error.code === 'permission-denied') throw new Error("Firebase Permission Denied: Allow read access to 'students' collection in Firestore Rules.");
    return null;
  }
}

export async function fetchAllCourses() {
  try {
    const colRef = collection(db, "courses");
    const snap = await getDocs(colRef);
    return snap.docs.map(doc => doc.data());
  } catch (error) {
    console.error("Error fetching courses", error);
    return [];
  }
}

export async function saveStudentProfile(uid: string, profileData: Partial<StudentProfile>) {
  try {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, profileData, { merge: true });
  } catch (error) {
    console.error("Error saving profile", error);
  }
}

export async function fetchAvailableWeeks(program: string = "2nd-core"): Promise<string[]> {
  try {
    const colRef = collection(db, `master_schedules_${program}`);
    const snap = await getDocs(colRef);
    const weeks = snap.docs.map(doc => doc.id).filter(id => id.includes("term-5") || id.includes("week"));
    
    // Custom sort to ensure week-2 comes before week-10
    return weeks.sort((a, b) => {
      const numA = parseInt(a.split("-")[1]) || 0;
      const numB = parseInt(b.split("-")[1]) || 0;
      return numA - numB;
    });
  } catch (error: any) {
    console.error("Error fetching available weeks", error);
    if (error.code === 'permission-denied') {
      throw new Error("Firebase Permission Denied: You need to allow read access in Firestore Rules.");
    }
    return [];
  }
}

export async function saveMasterTimetable(weekId: string, program: string, data: any[]) {
  try {
    const docRef = doc(db, `master_schedules_${program}`, weekId);
    await setDoc(docRef, { classes: data });
  } catch (error) {
    console.error("Error saving timetable", error);
    throw error;
  }
}

export async function fetchMasterTimetable(weekId: string, program: string = "2nd-core"): Promise<any[]> {
  try {
    const docRef = doc(db, `master_schedules_${program}`, weekId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const classes = docSnap.data().classes || [];
      if (weekId === "week-1-2026" && program === "2nd-core") {
         classes.push({
            courseAbb: "FINPrep",
            courseName: "Finance Prep",
            day: "Wednesday, 2026-10-07",
            timeSlot: "19:00-20:15",
            startTime: "19:00",
            endTime: "20:15",
            venue: "TBA",
            faculty: "TBA",
            date: "2026-10-07",
            section: ""
         });
      }
      if ((weekId === "week-2-2026" || classes.some((c: any) => c.date === "2026-10-14" || c.day?.includes("2026-10-14"))) && program === "2nd-core") {
         if (!classes.some((c: any) => c.courseAbb?.toLowerCase().startsWith("finprep") && (c.date === "2026-10-14" || c.day?.includes("2026-10-14")))) {
           classes.push({
              courseAbb: "FINPrep",
              courseName: "Finance Prep",
              sessionNo: "11",
              day: "Wednesday, 2026-10-14",
              timeSlot: "19:00-20:15",
              startTime: "19:00",
              endTime: "20:15",
              venue: "C-001",
              faculty: "TK",
              date: "2026-10-14",
              section: ""
           });
         }
      }
      return classes;
    }
    return [];
  } catch (error: any) {
    console.error("Error fetching timetable", error);
    if (error.code === 'permission-denied') throw new Error(`Firebase Permission Denied: Allow read access to 'master_schedules_${program}' collection in Firestore Rules.`);
    return [];
  }
}

export async function resolveOngoingWeek(program: string, weeks: string[]): Promise<string> {
  if (!weeks || weeks.length === 0) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const ranges = await Promise.all(weeks.map(async (weekId) => {
    const classes = await fetchMasterTimetable(weekId, program);
    const classDates = classes.flatMap((cls) => {
      const dateStr = cls.date || (cls.day ? cls.day.split(",")[1]?.trim() : "");
      if (!dateStr) return [];

      // Parse ISO calendar dates as local dates so midnight UTC cannot shift the week in other timezones.
      const isoDate = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const parsedDate = isoDate
        ? new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))
        : new Date(dateStr);
      if (Number.isNaN(parsedDate.getTime())) return [];

      parsedDate.setHours(0, 0, 0, 0);
      return [parsedDate.getTime()];
    });

    if (classDates.length === 0) return null;
    return {
      weekId,
      start: Math.min(...classDates),
      end: Math.max(...classDates),
    };
  }));

  const datedRanges = ranges.filter((range): range is { weekId: string; start: number; end: number } => range !== null);
  const ongoingWeek = datedRanges
    .filter((range) => range.start <= todayTime && range.end >= todayTime)
    .sort((a, b) => b.start - a.start)[0];
  if (ongoingWeek) return ongoingWeek.weekId;

  const nextWeek = datedRanges
    .filter((range) => range.start > todayTime)
    .sort((a, b) => a.start - b.start)[0];
  if (nextWeek) return nextWeek.weekId;

  const mostRecentPastWeek = datedRanges.sort((a, b) => b.end - a.end)[0];
  return mostRecentPastWeek?.weekId || weeks[weeks.length - 1];
}

export async function saveClashSchedule(weekId: string, data: any[]) {
  try {
    const docRef = doc(db, "clashes", weekId);
    await setDoc(docRef, { studentClashes: data });
  } catch (error) {
    console.error("Error saving clashes", error);
    throw error;
  }
}

export async function fetchClashSchedule(weekId: string): Promise<any[]> {
  try {
    const docRef = doc(db, "clashes", weekId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().studentClashes || [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching clashes", error);
    return [];
  }
}

// ==========================================
// ATTENDANCE TRACKING
// ==========================================

export async function markAttendance(uid: string, weekId: string, classId: string, status: "attended" | "missed") {
  try {
    const docRef = doc(db, `attendance/${uid}/records`, weekId);
    // We store a map of classId -> {status, timestamp} in the week document using merge: true
    await setDoc(docRef, {
      [classId]: { status, timestamp: new Date().toISOString() }
    }, { merge: true });
  } catch (error) {
    console.error("Error marking attendance", error);
  }
}

export async function fetchAttendance(uid: string, weekId: string): Promise<Record<string, {status: "attended" | "missed", timestamp: string}>> {
  try {
    const docRef = doc(db, `attendance/${uid}/records`, weekId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as any;
    }
    return {};
  } catch (error) {
    console.error("Error fetching attendance", error);
    return {};
  }
}

export async function fetchAllAttendanceStats(uid: string): Promise<{attended: number, missed: number, records: any[]}> {
  try {
    const recordsRef = collection(db, `attendance/${uid}/records`);
    const snap = await getDocs(recordsRef);
    
    let attended = 0;
    let missed = 0;
    const records: any[] = [];
    
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const weekId = docSnap.id;
      for (const key in data) {
        if (data[key].status === "attended") attended++;
        else if (data[key].status === "missed") missed++;
        
        records.push({
           classId: key,
           status: data[key].status,
           timestamp: data[key].timestamp,
           weekId
        });
      }
    });
    
    return { attended, missed, records };
  } catch (error) {
    console.error("Error fetching global attendance stats", error);
    return { attended: 0, missed: 0, records: [] };
  }
}
