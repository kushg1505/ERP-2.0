import type { StudentDirectoryCourse } from "@/lib/student-directory-types";

interface PrintScheduleHeaderProps {
  weekId: string;
  weekLabel: string;
  days?: string[];
  studentName?: string;
  rollNo?: string;
  program?: string;
  section?: string;
  courses?: StudentDirectoryCourse[];
}

function getWeekDates(weekId: string, days: string[] = []) {
  const dates = days
    .map((day) => day.split(",").slice(1).join(",").trim())
    .filter(Boolean)
    .map((date) => new Date(`${date}T12:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length > 0) {
    const first = new Date(dates[0]);
    let last = new Date(dates[dates.length - 1]);
    if (first.getDay() === 1) {
      const sunday = new Date(first);
      sunday.setDate(sunday.getDate() + 6);
      if (last < sunday) last.setTime(sunday.getTime());
    }
    const day = new Intl.DateTimeFormat("en-GB", { day: "numeric" });
    const month = new Intl.DateTimeFormat("en-GB", { month: "long" });
    const year = new Intl.DateTimeFormat("en-GB", { year: "numeric" });
    if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
      return `${day.format(first)}–${day.format(last)} ${month.format(last)} ${year.format(last)}`;
    }
    return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(first)} – ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(last)}`;
  }

  if (weekId === "week-1-2026") return "5–11 October 2026";
  if (weekId === "week-2-2026") return "12–18 October 2026";
  return "";
}

function getYear(program?: string) {
  if (program?.startsWith("1st-")) return "Year 1";
  if (program?.startsWith("2nd-")) return "Year 2";
  return "—";
}

function getProgramName(program?: string) {
  const stream = program?.split("-")[1]?.toLowerCase();
  if (stream === "core") return "Core";
  if (stream === "dcp") return "DCP";
  if (stream === "bfs") return "BFS";
  return "—";
}

export function PrintScheduleHeader({
  weekId,
  weekLabel,
  days,
  studentName,
  rollNo,
  program,
  section,
  courses = [],
}: PrintScheduleHeaderProps) {
  return (
    <header className="print-schedule-heading" aria-label="Weekly timetable details">
      <div className="print-schedule-brandbar">
        <div className="print-schedule-brand">
          <img src="/icon.png" alt="" />
          <span className="print-schedule-brand-name">BunkWise</span>
          <span className="print-schedule-brand-divider" />
          <span className="print-schedule-brand-subtitle">Weekly timetable</span>
        </div>
        <span className="print-schedule-kicker">Academic schedule</span>
      </div>

      <div className="print-schedule-identity">
        <div className="print-schedule-student">
          <span className="print-schedule-eyebrow">Personal timetable</span>
          <h1>{studentName || "Student"}</h1>
          <div className="print-schedule-facts">
            <div><span>Roll number</span><strong>{rollNo || "—"}</strong></div>
            <div><span>Year</span><strong>{getYear(program)}</strong></div>
            <div><span>Program</span><strong>{getProgramName(program)}</strong></div>
            <div><span>Section</span><strong>{section || "—"}</strong></div>
          </div>
        </div>

        <div className="print-schedule-week">
          <span className="print-schedule-eyebrow">Selected week</span>
          <strong>{weekLabel}</strong>
          <span>{getWeekDates(weekId, days) || "Dates follow the selected timetable"}</span>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="print-schedule-courses">
          <span>Enrolled courses</span>
          <strong>{courses.map((course) => course.courseCode).join(" · ")}</strong>
        </div>
      )}
    </header>
  );
}

export function PrintScheduleFooter() {
  return (
    <footer className="print-schedule-footer">
      <div className="print-schedule-legend" aria-label="Schedule legend">
        <span><i className="print-legend-class" />Class</span>
        <span><i className="print-legend-activity" />Academic activity</span>
        <span><i className="print-legend-no-classes" />No classes</span>
      </div>
      <div className="print-schedule-footer-note">
        <span>Verify last-minute schedule changes in the BunkWise app.</span>
        <span>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
    </footer>
  );
}
