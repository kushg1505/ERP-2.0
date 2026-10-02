const Papa = require("papaparse");

const csvData = `INSTITUTE OF MANAGEMENT TECHNOLOGY, GHAZIABAD
POST GRADUATE DIPLOMA IN MANGEMENT [2025-27] - Term - IV
Schedule for Week-2 (July 06 - 12, 2026)
Day,9:30 - 10:45 am,11:00 am - 12:15 pm
"Mon, Jul 06, 2026","FRM-B(4)
RC{C-201}","FRM-A(4)
RC{C-201}"
,"SMMT-B(3)
AM{C-403}","BBC-A(4)
PD/AP{Gurukul}"
,"SMMT-D(3)
GS{C-403}",`;

function parseScheduleCSV(data) {
  const parsedClasses = [];
  let currentDay = "";

  for (const row of data) {
    const dayKey = Object.keys(row).find(k => k.trim().toLowerCase() === "day");
    
    if (dayKey) {
      const dayVal = row[dayKey];
      if (typeof dayVal === "string" && dayVal.trim() !== "") {
        currentDay = dayVal.trim();
      }
    }

    if (!currentDay) continue;

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

      const lines = text.split('\n').map(l => l.trim()).filter(l => l !== "");
      
      if (lines.length >= 2) {
        courseFull = lines[0];
        const profRoom = lines.slice(1).join(" "); 
        
        const courseMatch = courseFull.match(/^([A-Za-z0-9_]+)[\s-]+([A-Za-z0-9_+]+)(?:\((.*?)\))?/);
        if (courseMatch) {
          courseCode = courseMatch[1];
          section = courseMatch[2];
          sessionInfo = courseMatch[3] || "";
        } else {
          courseCode = courseFull; 
        }

        const roomMatch = profRoom.match(/^(.*?)\{(.*?)\}/);
        if (roomMatch) {
          professor = roomMatch[1].trim();
          room = roomMatch[2].trim();
        } else {
          professor = profRoom;
        }
      } else {
        courseCode = text;
      }

      parsedClasses.push({
        day: currentDay,
        timeSlot: key.trim(),
        courseFull,
        courseCode,
        section,
        sessionInfo,
        professor,
        room,
      });
    }
  }

  return parsedClasses;
}

Papa.parse(csvData, {
  header: false,
  skipEmptyLines: true,
  complete: (results) => {
    const rows = results.data;
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const rowVals = rows[i].map(v => String(v).trim().toLowerCase());
        if (rowVals.includes("day")) {
        headerRowIndex = i;
        break;
        }
    }
    
    if (headerRowIndex === -1) {
        console.error("Could not find a 'Day' column in the first 10 rows.");
        return;
    }
    
    const headers = rows[headerRowIndex].map(h => String(h).trim());
    
    const rawData = rows.slice(headerRowIndex + 1).map(row => {
        const obj = {};
        row.forEach((val, index) => {
        const header = headers[index];
        if (header && header !== "") {
            obj[header] = val;
        }
        });
        return obj;
    });

    console.log("Raw mapped data:");
    console.log(JSON.stringify(rawData, null, 2));

    const parsedClasses = parseScheduleCSV(rawData);
    console.log("Parsed classes:");
    console.log(JSON.stringify(parsedClasses, null, 2));
  }
});
