export interface ParsedClass {
  day: string;
  timeSlot: string;
  courseFull: string;
  courseCode: string;
  section: string;
  sessionInfo: string;
  professor: string;
  room: string;
  rawText: string;
}

export function parseScheduleCSV(data: any[]): ParsedClass[] {
  const parsedClasses: ParsedClass[] = [];
  let currentDay = "";
  let lastClassBySlot: Record<string, ParsedClass> = {};

  for (const row of data) {
    // Find the day column (usually the first column, labeled "Day")
    // Sometimes CSVs have weird spaces in headers, so we check variations
    const dayKey = Object.keys(row).find(k => k.trim().toLowerCase() === "day");
    
    if (dayKey) {
      const dayVal = row[dayKey];
      if (typeof dayVal === "string" && dayVal.trim() !== "") {
        const newDay = dayVal.trim();
        if (newDay !== currentDay) {
          currentDay = newDay;
          lastClassBySlot = {}; // Reset tracking for the new day
        }
      }
    }

    // If we haven't found a day yet, we can't process this row
    if (!currentDay) continue;

    // Iterate through all time slots in the row
    for (const key of Object.keys(row)) {
      if (key === dayKey || key.trim() === "") continue;

      const cellText = row[key];
      if (typeof cellText !== "string" || cellText.trim() === "") continue;

      const text = cellText.trim();
      
      let courseFull = text;
      let courseCode = "";
      let section = "";
      let sessionInfo = "";
      let professor = "";
      let room = "";

      // Split by newline. In Excel -> CSV, multiline cells contain actual newlines.
      // We use a regex to split by \r\n, \n, or \r to handle Windows and Mac Excel exports.
      const lines = text.split(/\r?\n|\r/).map(l => l.trim()).filter(l => l !== "");
      
      let isProfRoomOnly = false;
      
      if (lines.length === 1) {
        // Check if this line is strictly a prof/room line (e.g. "RC {C -401}")
        const roomMatch = text.match(/^(.*?)\{(.*?)\}/);
        if (roomMatch) {
          isProfRoomOnly = true;
          professor = roomMatch[1].trim();
          room = roomMatch[2].trim();
        }
      }

      // If it's just a professor/room and we have a preceding class in this slot, merge it!
      if (isProfRoomOnly && lastClassBySlot[key]) {
        lastClassBySlot[key].professor = professor || lastClassBySlot[key].professor;
        lastClassBySlot[key].room = room || lastClassBySlot[key].room;
        lastClassBySlot[key].rawText += "\n" + text;
        continue; // Skip creating a new class entry
      }

      if (lines.length >= 2) {
        // Typically: 
        // EM-A(9)
        // SS{C -403}
        courseFull = lines[0];
        const profRoom = lines.slice(1).join(" "); // Combine rest if there are more than 2 lines
        
        // Match course structure like DIGM-D(11), SAPM-A+B(13), or WM A(14)
        // We use a more resilient regex that accepts subscripts or weird chars before the hyphen
        const courseMatch = courseFull.match(/^([^\s\-–—−]+)[\s\-–—−]+([^(\s]+)(?:\((.*?)\))?/);
        if (courseMatch) {
          courseCode = courseMatch[1];
          section = courseMatch[2];
          sessionInfo = courseMatch[3] || "";
        } else {
          // If regex fails, fallback to full text
          courseCode = courseFull; 
        }

        // Match professor and room structure like AK{C -201} or NT {Eklavya}
        const roomMatch = profRoom.match(/^(.*?)\{(.*?)\}/);
        if (roomMatch) {
          professor = roomMatch[1].trim();
          room = roomMatch[2].trim();
        } else {
          professor = profRoom;
        }
      } else {
        // Single line entry, like an event, workshop, or a course separated into two rows
        courseFull = text;
        const courseMatch = courseFull.match(/^([^\s\-–—−]+)[\s\-–—−]+([^(\s]+)(?:\((.*?)\))?/);
        if (courseMatch) {
          courseCode = courseMatch[1];
          section = courseMatch[2];
          sessionInfo = courseMatch[3] || "";
        } else {
          courseCode = courseFull; 
        }
      }

      const parsedClass = {
        day: currentDay,
        timeSlot: key.trim(),
        courseFull,
        courseCode,
        section,
        sessionInfo,
        professor,
        room,
        rawText: text
      };

      parsedClasses.push(parsedClass);
      lastClassBySlot[key] = parsedClass;
    }
  }

  return parsedClasses;
}
