const xlsx = require('xlsx');
const fs = require('fs');


const workbook = xlsx.readFile("database/1st year/Core/1st year core week-1.xlsx");
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

const parsedClasses = [];

for (const row of data) {
  const normalizedRow = {};
  for (const key of Object.keys(row)) {
    if (key && key.trim() !== "") {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '');
      normalizedRow[cleanKey] = row[key];
    }
  }

  if (Object.keys(normalizedRow).length === 0) continue;

  const courseAbb = String(normalizedRow['courseabb'] || "").trim();
  const dtiGroup = String(normalizedRow['dtigroup'] || "").trim();

  if (courseAbb.startsWith('DTI')) {
    parsedClasses.push({ courseAbb, dtiGroup });
  }
}

console.log(parsedClasses);
