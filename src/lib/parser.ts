export interface ParsedClass {
  day: string;
  timeSlot: string;
  startTime: string;
  endTime: string;
  courseAbb: string;
  courseName: string;
  section: string;
  faculty: string;
  venue: string;
  sessionNo?: string;
}

export function parseScheduleCSV(data: any[]): ParsedClass[] {
  const parsedClasses: ParsedClass[] = [];

  for (const row of data) {
    // Normalize keys
    const normalizedRow: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      if (key && key.trim() !== "") {
        const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '');
        normalizedRow[cleanKey] = row[key];
      }
    }

    // Skip empty rows
    if (Object.keys(normalizedRow).length === 0) continue;

    // Extract values
    const date = String(normalizedRow['date'] || "").trim();
    const dayName = String(normalizedRow['day'] || "").trim();
    
    if (!dayName) continue; // Require at least a day

    const day = date ? `${dayName}, ${date}` : dayName;
    
    // Time slot might be in 'timeslot' or 'start'/'end'
    let timeSlot = String(normalizedRow['timeslot'] || "").trim();
    const start = String(normalizedRow['start(24h)'] || normalizedRow['start'] || "").trim();
    const end = String(normalizedRow['end(24h)'] || normalizedRow['end'] || "").trim();
    
    if (!timeSlot && start && end) {
      timeSlot = `${start}-${end}`;
    }

    const courseAbb = String(normalizedRow['courseabb'] || "").trim();
    const courseName = String(normalizedRow['coursename'] || "").trim();
    
    // Section could be missing for some common classes, default to A or empty
    const section = String(normalizedRow['section'] || "").trim();
    
    let faculty = String(normalizedRow['faculty'] || "").trim();
    if (!faculty) {
      faculty = String(normalizedRow['facultyabb'] || "").trim();
    }
    
    const venue = String(normalizedRow['venue'] || normalizedRow['room'] || "").trim();
    const sessionNo = String(normalizedRow['sessionno.'] || normalizedRow['sessionno'] || "").trim();

    // Only add if it has a course abbreviation
    if (courseAbb) {
      parsedClasses.push({
        day,
        timeSlot,
        startTime: start,
        endTime: end,
        courseAbb,
        courseName,
        section,
        faculty,
        venue,
        sessionNo
      });
    }
  }

  return parsedClasses;
}
