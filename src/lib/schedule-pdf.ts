"use client";

import { jsPDF } from "jspdf";
import {
  buildPrintableScheduleRows,
  formatDayDate,
  formatScheduleTime,
  type PrintableActivity,
  type PrintableScheduleClass,
  type PrintableScheduleRow,
} from "@/components/PrintableScheduleTable";

interface SchedulePdfOptions {
  weekId: string;
  weekLabel: string;
  days: string[];
  classes: PrintableScheduleClass[];
  activities?: PrintableActivity[];
  studentName?: string;
  rollNo?: string;
  program?: string;
  section?: string;
  courses?: string[];
}

type RGB = [number, number, number];

const COLORS = {
  navy: [25, 50, 79] as RGB,
  ink: [25, 43, 64] as RGB,
  muted: [100, 116, 139] as RGB,
  softBlue: [239, 246, 255] as RGB,
  blue: [52, 125, 195] as RGB,
  row: [246, 248, 251] as RGB,
  greenBg: [234, 246, 239] as RGB,
  green: [39, 115, 79] as RGB,
  amberBg: [255, 245, 223] as RGB,
  amber: [137, 88, 16] as RGB,
  white: [255, 255, 255] as RGB,
};

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN = 12;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLUMN_WIDTHS = [43, 40, 105, 43, 42];
const TABLE_HEADER_HEIGHT = 9;
const TABLE_START_Y = 62;
const FOOTER_RESERVE = 17;

function cleanText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function programLabel(program?: string) {
  const year = program?.startsWith("1st-") ? "Year 1" : program?.startsWith("2nd-") ? "Year 2" : "Year";
  const stream = program?.split("-")[1]?.toUpperCase();
  return stream ? `${year}  |  ${stream}` : year;
}

function dateRange(days: string[]) {
  const dates = days
    .map((value) => value.split(",").slice(1).join(",").trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();
  if (!dates.length) return "Dates follow the selected timetable";

  const first = new Date(`${dates[0]}T12:00:00`);
  const last = new Date(`${dates[dates.length - 1]}T12:00:00`);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  const year = new Intl.DateTimeFormat("en-GB", { year: "numeric" }).format(last);
  return `${fmt.format(first)} - ${fmt.format(last)} ${year}`;
}

function imageDataUrl(url: string): Promise<string | undefined> {
  return fetch(url)
    .then((response) => response.ok ? response.blob() : undefined)
    .then((blob) => new Promise<string | undefined>((resolve) => {
      if (!blob) return resolve(undefined);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    }))
    .catch(() => undefined);
}

function paintRect(doc: jsPDF, x: number, y: number, width: number, height: number, color: RGB, radius = 0) {
  doc.setFillColor(...color);
  if (radius > 0) doc.roundedRect(x, y, width, height, radius, radius, "F");
  else doc.rect(x, y, width, height, "F");
}

function drawPageHeader(doc: jsPDF, options: SchedulePdfOptions, logo?: string) {
  if (logo) doc.addImage(logo, "PNG", MARGIN, 8, 9, 9);
  doc.setTextColor(...COLORS.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("BUNKWISE", MARGIN + 12, 13.5);
  doc.setTextColor(...COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("WEEKLY TIMETABLE", MARGIN + 39, 13.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("ACADEMIC SCHEDULE", PAGE_WIDTH - MARGIN, 13.5, { align: "right" });

  paintRect(doc, MARGIN, 20, 175, 31, [243, 246, 250], 2.5);
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(cleanText(options.studentName || "Student"), MARGIN + 5, 30, { maxWidth: 164 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  const facts = [
    `ROLL NO. ${cleanText(options.rollNo || "-")}`,
    programLabel(options.program),
    `SECTION ${cleanText(options.section || "-")}`,
  ];
  let factX = MARGIN + 5;
  for (const fact of facts) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.ink);
    doc.text(cleanText(fact), factX, 40);
    factX += doc.getTextWidth(cleanText(fact)) + 7;
  }
  const courseLine = (options.courses || []).filter(Boolean).join("  |  ");
  if (courseLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`COURSES  ${cleanText(courseLine)}`, MARGIN + 5, 46, { maxWidth: 164 });
  }

  paintRect(doc, 194, 20, 91, 31, COLORS.softBlue, 2.5);
  doc.setTextColor(...COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("SELECTED WEEK", 200, 27);
  doc.setTextColor(...COLORS.navy);
  doc.setFontSize(15);
  doc.text(cleanText(options.weekLabel), 200, 35, { maxWidth: 78 });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text(cleanText(dateRange(options.days)), 200, 43, { maxWidth: 78 });

  drawTableHeader(doc, TABLE_START_Y);
}

function drawTableHeader(doc: jsPDF, y: number) {
  paintRect(doc, MARGIN, y, CONTENT_WIDTH, TABLE_HEADER_HEIGHT, COLORS.navy, 1.3);
  const labels = ["DAY / DATE", "TIME", "COURSE / SESSION", "SECTION", "VENUE"];
  let x = MARGIN + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.white);
  labels.forEach((label, index) => {
    doc.text(label, x, y + 5.8, { maxWidth: COLUMN_WIDTHS[index] - 5 });
    x += COLUMN_WIDTHS[index];
  });
}

function rowValues(row: PrintableScheduleRow): [string, string, string, string, string] {
  if (row.kind === "no-classes") {
    return [formatDayDate(row.day), "All day", "No classes scheduled", "-", "-"];
  }
  if (row.kind === "activity") {
    const detail = row.activity.detail ? `  ${row.activity.detail}` : "";
    return [formatDayDate(row.day), formatScheduleTime(row.activity.time), `${row.activity.title}${detail}`, "-", "-"];
  }
  const session = row.cls.sessionNo ? `  Session ${row.cls.sessionNo}` : "";
  const section = row.cls.courseAbb.toUpperCase().startsWith("DTI") && row.cls.dtiGroup
    ? `Group ${row.cls.dtiGroup}`
    : row.cls.section ? `Section ${row.cls.section}` : "-";
  return [
    formatDayDate(row.day),
    formatScheduleTime(row.cls.timeSlot),
    `${row.cls.courseAbb}${session}`,
    section,
    row.cls.venue || "TBA",
  ];
}

function drawRow(doc: jsPDF, row: PrintableScheduleRow, index: number, y: number) {
  const values = rowValues(row).map(cleanText) as [string, string, string, string, string];
  const rowColor = row.kind === "no-classes"
    ? COLORS.greenBg
    : row.kind === "activity"
      ? COLORS.amberBg
      : index % 2 === 1 ? COLORS.row : COLORS.white;
  const rowText = row.kind === "no-classes"
    ? COLORS.green
    : row.kind === "activity" ? COLORS.amber : COLORS.ink;
  const lines = values.map((value, i) => doc.splitTextToSize(value, COLUMN_WIDTHS[i] - 5) as string[]);
  const maxLines = Math.max(1, ...lines.map((value) => value.length));
  const height = Math.max(7.4, maxLines * 4.2 + 3);

  paintRect(doc, MARGIN, y, CONTENT_WIDTH, height, rowColor);
  let x = MARGIN + 3;
  lines.forEach((value, i) => {
    doc.setFont("helvetica", i === 2 ? "bold" : "normal");
    doc.setFontSize(i === 2 ? 8.5 : 8);
    doc.setTextColor(...(i === 2 || row.kind !== "class" ? rowText : COLORS.ink));
    doc.text(value, x, y + 4.8, { lineHeightFactor: 1.05, maxWidth: COLUMN_WIDTHS[i] - 5 });
    x += COLUMN_WIDTHS[i];
  });
  return height;
}

function drawFooter(doc: jsPDF, page: number, pageCount: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Verify last-minute schedule changes in the BunkWise app.", MARGIN, PAGE_HEIGHT - 4);
  doc.text(`${page} / ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 4, { align: "center" });
  doc.text(`Generated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 4, { align: "right" });
}

export async function downloadSchedulePdf(options: SchedulePdfOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: `${options.studentName || "Student"} - ${options.weekLabel} Timetable`,
    subject: "BunkWise weekly timetable",
    author: "BunkWise",
  });
  const logo = await imageDataUrl("/icon.png");
  const rows = buildPrintableScheduleRows(options.days, options.classes, options.activities || []);
  const safeRows = rows.length ? rows : [];
  drawPageHeader(doc, options, logo);
  let y = TABLE_START_Y + TABLE_HEADER_HEIGHT + 1;

  safeRows.forEach((row, index) => {
    const rowHeight = Math.max(7.4, ...rowValues(row).map((value, i) => {
      const lines = doc.splitTextToSize(cleanText(value), COLUMN_WIDTHS[i] - 5) as string[];
      return lines.length * 4.2 + 3;
    }));
    if (y + rowHeight > PAGE_HEIGHT - FOOTER_RESERVE) {
      doc.addPage("a4", "landscape");
      drawPageHeader(doc, options, logo);
      y = TABLE_START_Y + TABLE_HEADER_HEIGHT + 1;
    }
    y += drawRow(doc, row, index, y) + 0.8;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, pageCount);
  }

  const identifier = cleanText(options.rollNo || options.studentName || "student")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`BunkWise-${identifier || "schedule"}-${options.weekId || "week"}.pdf`);
}
