export type StaffDepartment = "service" | "cashier" | "kitchen" | "management" | "cleaning" | "barista" | "shisha" | "other";
export type EmploymentType = "full_time" | "part_time" | "temporary";
export type ShiftType = "morning" | "evening" | "night" | "rotating" | "fixed";
export type StaffStatus = "active" | "on_leave" | "inactive" | "terminated";
export type SystemRole = "captain" | "cashier" | "kitchen" | "admin";

export type StaffProfileSummary = {
  username: string;
  role: SystemRole;
  status: "active" | "inactive" | "suspended";
};

export type StaffMember = {
  id: string;
  employeeNumber: number;
  profileId: string | null;
  fullName: string;
  phone: string | null;
  secondaryPhone: string | null;
  jobTitle: string;
  department: StaffDepartment;
  employmentType: EmploymentType;
  shiftType: ShiftType;
  hireDate: string | null;
  birthDate: string | null;
  salary: number | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  status: StaffStatus;
  hasSystemAccess: boolean;
  createdAt: string;
  updatedAt: string;
  profile: StaffProfileSummary | null;
};

export type CreateStaffInput = {
  fullName: string;
  phone?: string;
  secondaryPhone?: string;
  jobTitle: string;
  department: StaffDepartment;
  employmentType: EmploymentType;
  shiftType: ShiftType;
  hireDate?: string;
  birthDate?: string;
  salary?: number | null;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
};

export type UpdateStaffInput = CreateStaffInput & { id: string };

export type StaffStatistics = {
  total: number;
  active: number;
  onLeave: number;
  inactive: number;
  terminated: number;
  withSystemAccess: number;
};

export const departmentLabels: Record<StaffDepartment, string> = {
  service: "??????",
  cashier: "????????",
  kitchen: "??????",
  management: "???????",
  cleaning: "???????",
  barista: "????????",
  shisha: "????????",
  other: "????",
};

export const employmentTypeLabels: Record<EmploymentType, string> = {
  full_time: "???? ????",
  part_time: "???? ????",
  temporary: "????",
};

export const shiftTypeLabels: Record<ShiftType, string> = {
  morning: "?????",
  evening: "?????",
  night: "????",
  rotating: "??????",
  fixed: "????",
};

export const staffStatusLabels: Record<StaffStatus, string> = {
  active: "???",
  on_leave: "?? ?????",
  inactive: "??? ???",
  terminated: "?????",
};
