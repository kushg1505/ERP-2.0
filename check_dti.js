const xlsx = require('xlsx');

const workbook = xlsx.readFile("database/1st year/Core/1st year core week-1.xlsx");
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

const dtiRows = data.filter(row => JSON.stringify(row).includes('DTI'));
console.log(JSON.stringify(dtiRows, null, 2));
