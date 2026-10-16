export interface StudentDirectoryCourse {
  courseCode: string;
  section: string;
}

export type StudentDirectoryWarning =
  | "dti-group-pending"
  | "elective-pending"
  | "elective-unrecognized";

export interface StudentDirectoryRecord {
  rollNo: string;
  name: string;
  program: string;
  section?: string;
  dtiGroup?: string;
  courses: StudentDirectoryCourse[];
  warnings: StudentDirectoryWarning[];
}
