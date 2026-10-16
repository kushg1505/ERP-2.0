import { NextResponse } from "next/server";
import { findStudentByRollNo } from "@/lib/student-directory";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rollNo = typeof body.rollNo === "string" ? body.rollNo.trim() : "";
    if (!rollNo) {
      return NextResponse.json({ error: "Enter your roll number." }, { status: 400 });
    }

    const student = findStudentByRollNo(rollNo);
    if (!student) {
      return NextResponse.json({ error: "We could not find that roll number in the student rosters." }, { status: 404 });
    }

    return NextResponse.json({ student }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Student lookup failed", error);
    const message = error instanceof Error ? error.message : "Student lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
