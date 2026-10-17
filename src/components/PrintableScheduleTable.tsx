export interface PrintableScheduleClass {
  day: string;
  timeSlot: string;
  courseAbb: string;
  courseName?: string;
  sessionNo?: string;
  section?: string;
  dtiGroup?: string;
  venue?: string;
}

export interface PrintableActivity {
  day: string;
  title: string;
  time: string;
  detail?: string;
}

interface PrintableScheduleTableProps {
  days: string[];
  classes: PrintableScheduleClass[];
  activities?: PrintableActivity[];
}

export type PrintableScheduleRow =
  | { kind: "class"; day: string; cls: PrintableScheduleClass }
  | { kind: "activity"; day: string; activity: PrintableActivity }
  | { kind: "no-classes"; day: string };

function dateKey(value: string) {
  return value.split(",").slice(1).join(",").trim();
}

export function formatDayDate(value: string) {
  const [dayName, ...dateParts] = value.split(",");
  const dateValue = dateParts.join(",").trim();
  const date = dateValue ? new Date(`${dateValue}T12:00:00`) : null;
  const dateLabel = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date)
    : dateValue;
  return [dayName?.trim().slice(0, 3).toUpperCase(), dateLabel].filter(Boolean).join(" ").toUpperCase();
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function completeWeek(days: string[]) {
  const datedDays = days
    .map((day) => ({ day, key: dateKey(day) }))
    .filter(({ key }) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort((a, b) => a.key.localeCompare(b.key));
  if (!datedDays.length) return days;

  const firstDate = new Date(`${datedDays[0].key}T12:00:00`);
  const monday = new Date(firstDate);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return weekdayNames.map((weekday, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = localDateKey(date);
    return datedDays.find((item) => item.key === key)?.day || `${weekday}, ${key}`;
  });
}

export function formatScheduleTime(value: string) {
  if (!value) return "—";
  return value.replace(/\s*-\s*/g, " – ").replace(/\s*–\s*/g, " – ").trim();
}

function timeOrder(value: string) {
  const match = value.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function buildPrintableScheduleRows(
  days: string[],
  classes: PrintableScheduleClass[],
  activities: PrintableActivity[] = [],
): PrintableScheduleRow[] {
  const weekDays = completeWeek([
    ...days,
    ...classes.map((cls) => cls.day),
    ...activities.map((activity) => activity.day),
  ]);
  return weekDays.flatMap<PrintableScheduleRow>((day) => {
    const key = dateKey(day);
    const scheduledClasses = classes
      .filter((cls) => dateKey(cls.day) === key)
      .sort((a, b) => timeOrder(a.timeSlot) - timeOrder(b.timeSlot));
    const fullDayActivities = scheduledClasses
      .filter((cls) => cls.courseAbb.toUpperCase() === "SSR" && cls.timeSlot.toLowerCase() === "full day")
      .map((cls) => ({ day: cls.day, title: cls.courseName || "SSR Visit", time: "All day", detail: "Full day" }));
    const dayClasses = scheduledClasses.filter(
      (cls) => !(cls.courseAbb.toUpperCase() === "SSR" && cls.timeSlot.toLowerCase() === "full day"),
    );
    const dayActivities = [
      ...activities.filter((activity) => dateKey(activity.day) === key),
      ...fullDayActivities,
    ];

    const dayRows = [
      ...dayActivities.map((activity) => ({ kind: "activity" as const, day, activity })),
      ...dayClasses.map((cls) => ({ kind: "class" as const, day, cls })),
    ];

    if (dayRows.length === 0) return [{ kind: "no-classes" as const, day }];
    return dayRows;
  });
}

export default function PrintableScheduleTable({ days, classes, activities = [] }: PrintableScheduleTableProps) {
  const rows = buildPrintableScheduleRows(days, classes, activities);

  return (
    <div className="print-row-table-wrap">
      <table className="print-row-table">
        <colgroup>
          <col className="print-col-day" />
          <col className="print-col-time" />
          <col className="print-col-course" />
          <col className="print-col-section" />
          <col className="print-col-venue" />
        </colgroup>
        <thead>
          <tr>
            <th>Day / Date</th>
            <th>Time</th>
            <th>Course / Session</th>
            <th>Section</th>
            <th>Venue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            if (row.kind === "no-classes") {
              return (
                <tr key={`${dateKey(row.day)}-no-classes`} className="print-row-no-classes">
                  <td>{formatDayDate(row.day)}</td>
                  <td>All day</td>
                  <td><strong>No classes scheduled</strong></td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              );
            }

            if (row.kind === "activity") {
              return (
                <tr key={`${dateKey(row.day)}-${row.activity.title}-${index}`} className="print-row-activity">
                  <td>{formatDayDate(row.day)}</td>
                  <td>{formatScheduleTime(row.activity.time)}</td>
                  <td>
                    <strong>{row.activity.title}</strong>
                    {row.activity.detail && <span className="print-row-session">{row.activity.detail}</span>}
                  </td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              );
            }

            const section = row.cls.courseAbb.toUpperCase().startsWith("DTI") && row.cls.dtiGroup
              ? `Group ${row.cls.dtiGroup}`
              : row.cls.section
                ? `Section ${row.cls.section}`
                : "—";

            return (
              <tr key={`${dateKey(row.day)}-${row.cls.timeSlot}-${row.cls.courseAbb}-${index}`} className="print-row-class">
                <td>{formatDayDate(row.day)}</td>
                <td>{formatScheduleTime(row.cls.timeSlot)}</td>
                <td>
                  <strong>{row.cls.courseAbb}</strong>
                  {row.cls.sessionNo && <span className="print-row-session">Session {row.cls.sessionNo}</span>}
                </td>
                <td><span className="print-row-section">{section}</span></td>
                <td>{row.cls.venue || "TBA"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
