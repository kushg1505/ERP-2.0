import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";
import type {
  StudentDirectoryRecord,
  StudentDirectoryWarning,
} from "./student-directory-types";

const root = process.cwd();
const BFS_FIXED_COURSES = ["MLBFSI", "FIS", "VCPE", "HRM", "BFSI&STY"];
const DTI_GROUP_OVERRIDES: Record<string, string> = {
  "260101139": "1",
};

let cachedFingerprint = "";
let cachedRecords: StudentDirectoryRecord[] | null = null;

function normalizeHeader(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeRollNo(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\.0$/, "").replace(/\s+/g, "").toUpperCase();
}

function normalizeDtiGroup(value: unknown) {
  const group = String(value ?? "").trim().toUpperCase();
  const match = group.match(/^(?:(?:G|GROUP)\s*[- ]?\s*)?(\d+)$/);
  return match ? match[1] : group;
}

function workbookRows(filePath: string) {
  const workbook = xlsx.read(fs.readFileSync(filePath), { type: "buffer" });
  return workbook.SheetNames.flatMap((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    return worksheet
      ? [xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][]]
      : [];
  });
}

function findHeader(rows: unknown[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex++) {
    const headers = (rows[rowIndex] ?? []).map(normalizeHeader);
    const rollIndex = headers.findIndex((header) =>
      ["rollno", "rollnumber", "enrollmentno", "enrollmentnumber", "enrolmentno", "enrolmentnumber"].includes(header),
    );
    if (rollIndex >= 0) return { rowIndex, headers, rollIndex };
  }
  return null;
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

interface DirectorySourceRow {
  rollNo: string;
  name?: string;
  section?: string;
  elective?: string;
  dtiGroup?: string;
}

function jsonRows(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as DirectorySourceRow[];
}

function recordFromRow(
  row: unknown[],
  rollIndex: number,
  nameIndex: number,
  program: string,
  sectionIndex: number,
) {
  const rollNo = normalizeRollNo(row[rollIndex]);
  if (!rollNo) return null;
  const record: StudentDirectoryRecord = {
    rollNo,
    name: stringValue(row[nameIndex]),
    program,
    courses: [],
    warnings: [] as StudentDirectoryWarning[],
  };
  const section = stringValue(row[sectionIndex]);
  if (section) record.section = section;
  return record;
}

function parseSimpleRoster(filePath: string, program: string) {
  return jsonRows(filePath).flatMap((row) => {
    const rollNo = normalizeRollNo(row.rollNo);
    if (!rollNo) return [];
    const record: StudentDirectoryRecord = {
      rollNo,
      name: stringValue(row.name),
      program,
      courses: [],
      warnings: [],
    };
    const section = stringValue(row.section);
    if (section) record.section = section;
    return [record];
  });
}

function courseAbbreviationsByName() {
  const filePath = path.join(root, "database", "2nd year", "Core", "2nd year Core course-faculty.xlsx");
  const rows = workbookRows(filePath)[0] ?? [];
  const header = rows[0]?.map(normalizeHeader) ?? [];
  const nameIndex = header.indexOf("coursename");
  const abbreviationIndex = header.indexOf("abb");
  const abbreviations = new Map<string, string>();
  if (nameIndex < 0 || abbreviationIndex < 0) return abbreviations;

  for (const row of rows.slice(1)) {
    const name = normalizeHeader(row[nameIndex]);
    const abbreviation = stringValue(row[abbreviationIndex]);
    if (name && abbreviation) abbreviations.set(name, abbreviation);
  }
  return abbreviations;
}

function parseSecondYearCore(filePath: string) {
  const records: StudentDirectoryRecord[] = [];
  const abbreviations = courseAbbreviationsByName();
  for (const rows of workbookRows(filePath)) {
    const header = findHeader(rows);
    if (!header) continue;
    const nameIndex = header.headers.findIndex((value) => ["studentname", "name"].includes(value));
    const sectionIndex = header.headers.findIndex((value) => ["section", "sec"].includes(value));
    const rawHeaders = rows[header.rowIndex] ?? [];
    for (const row of rows.slice(header.rowIndex + 1)) {
      const record = recordFromRow(row, header.rollIndex, nameIndex, "2nd-core", sectionIndex);
      if (!record) continue;
      for (let column = 0; column < rawHeaders.length; column++) {
        const abbreviation = abbreviations.get(normalizeHeader(rawHeaders[column]));
        const section = stringValue(row[column]);
        if (abbreviation && section) record.courses.push({ courseCode: abbreviation, section });
      }
      records.push(record);
    }
  }
  return records;
}

function parseSecondYearDcp(filePath: string) {
  const records: StudentDirectoryRecord[] = [];
  for (const rows of workbookRows(filePath)) {
    const header = findHeader(rows);
    if (!header) continue;
    const nameIndex = header.headers.findIndex((value) => ["studentname", "name"].includes(value));
    for (const row of rows.slice(header.rowIndex + 1)) {
      const record = recordFromRow(row, header.rollIndex, nameIndex, "2nd-dcp", -1);
      if (!record) continue;
      for (let column = 0; column < header.headers.length; column++) {
        const courseCode = stringValue((rows[header.rowIndex] ?? [])[column]);
        const section = stringValue(row[column]);
        if (column !== header.rollIndex && column !== nameIndex && section && courseCode && normalizeHeader(courseCode) !== "noofcourses") {
          record.courses.push({ courseCode, section });
        }
      }
      records.push(record);
    }
  }
  return records;
}

function electiveCode(value: unknown) {
  const elective = normalizeHeader(value);
  if (elective === "behaviouralfinance" || elective === "behavioralfinance" || elective === "bf") return "BF";
  if (elective.includes("serviceexcellence") && elective.includes("relationshipmanagement")) return "SERM";
  if (elective === "serm") return "SERM";
  return "";
}

function parseSecondYearBfs(filePath: string) {
  return jsonRows(filePath).flatMap((row) => {
    const rollNo = normalizeRollNo(row.rollNo);
    if (!rollNo) return [];
    const record: StudentDirectoryRecord = {
      rollNo,
      name: stringValue(row.name),
      program: "2nd-bfs",
      courses: [],
      warnings: [],
    };
    const section = stringValue(row.section);
    if (section) record.section = section;
    record.courses = BFS_FIXED_COURSES.map((courseCode) => ({ courseCode, section: record.section ?? "" }));
    const code = electiveCode(row.elective);
    if (code) record.courses.push({ courseCode: code, section: "" });
    else record.warnings.push(row.elective ? "elective-unrecognized" : "elective-pending");
    return [record];
  });
}

function parseDtiRoster(files: string[]) {
  const groupByRoll = new Map<string, string>();
  const conflictingRolls = new Set<string>();
  for (const filePath of files) {
    for (const row of jsonRows(filePath)) {
      const rollNo = normalizeRollNo(row.rollNo);
      const group = normalizeDtiGroup(row.dtiGroup);
      if (!rollNo || !group) continue;
      const existing = groupByRoll.get(rollNo);
      if (existing && existing !== group) {
        conflictingRolls.add(rollNo);
        groupByRoll.delete(rollNo);
      } else if (!conflictingRolls.has(rollNo)) {
        groupByRoll.set(rollNo, group);
      }
    }
  }
  return groupByRoll;
}

function getSourceFiles() {
  const lookupDirectory = path.join(root, "database", "roll-lookup");
  const requiredFiles = [
    path.join(lookupDirectory, "first-year-core.json"),
    path.join(lookupDirectory, "first-year-dcp.json"),
    path.join(lookupDirectory, "first-year-bfs.json"),
    path.join(root, "database", "2nd year", "Core", "2nd year Core student-course.xls"),
    path.join(root, "database", "2nd year", "Core", "2nd year Core course-faculty.xlsx"),
    path.join(root, "database", "2nd year", "DCP", "2nd year DCP student-course.xlsx"),
    path.join(lookupDirectory, "second-year-bfs.json"),
    path.join(lookupDirectory, "first-year-core-dti.json"),
    path.join(lookupDirectory, "first-year-dcp-dti.json"),
  ];
  const missing = requiredFiles.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length) {
    throw new Error(`Student roster source file is missing: ${path.relative(root, missing[0])}`);
  }

  return requiredFiles;
}

function loadDirectory() {
  const files = getSourceFiles();
  const fingerprint = files
    .map((filePath) => {
      const stat = fs.statSync(filePath);
      return `${filePath}:${stat.size}:${stat.mtimeMs}`;
    })
    .join("|");
  if (cachedRecords && cachedFingerprint === fingerprint) return cachedRecords;

  const records = [
    ...parseSimpleRoster(files[0], "1st-core"),
    ...parseSimpleRoster(files[1], "1st-dcp"),
    ...parseSimpleRoster(files[2], "1st-bfs"),
    ...parseSecondYearCore(files[3]),
    ...parseSecondYearDcp(files[5]),
    ...parseSecondYearBfs(files[6]),
  ];

  const dtiGroups = parseDtiRoster(files.slice(7, 9));
  for (const record of records) {
    if (record.program !== "1st-core" && record.program !== "1st-dcp") continue;
    const dtiGroup = (record.program === "1st-core" ? DTI_GROUP_OVERRIDES[record.rollNo] : undefined)
      ?? dtiGroups.get(record.rollNo);
    if (dtiGroup) record.dtiGroup = dtiGroup;
    else record.warnings.push("dti-group-pending");
  }

  cachedFingerprint = fingerprint;
  cachedRecords = records;
  return records;
}

export function findStudentByRollNo(rollNoInput: unknown) {
  const rollNo = normalizeRollNo(rollNoInput);
  if (!rollNo) return null;
  const matches = loadDirectory().filter((record) => record.rollNo === rollNo);
  if (matches.length > 1) throw new Error("This roll number appears more than once in the student rosters.");
  return matches[0] ?? null;
}
