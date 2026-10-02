const xlsx = require('xlsx');

function printHeaders(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n=== Headers for ${filePath} ===`);
    if (data.length > 0) {
      console.log(data[0].slice(0, 20)); // Print first 20 columns
      if(data.length > 1) {
         console.log("Row 2:", data[1].slice(0, 20));
      }
    } else {
      console.log("Empty sheet");
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
}

printHeaders('./Student and Courses - Term -V (1).xls');
printHeaders('./Term_V_Courses_Faculty.xlsx');
printHeaders('./Week1_Timetable_Structured.xlsx');
