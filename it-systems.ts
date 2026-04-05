// lib/it-systems.ts — Mock Backend IT Systems Database

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  accountStatus: "active" | "locked" | "suspended";
  lastLogin: string;
  verified: boolean;
}

export interface VPNStatus {
  employeeId: string;
  connected: boolean;
  certificateExpiry: string;
  certificateStatus: "valid" | "expired" | "expiring_soon";
  lastAttempt: string;
  errorCode?: string;
}

export interface SoftwareLicense {
  software: string;
  totalLicenses: number;
  usedLicenses: number;
  assignedTo: string[];
}

export interface Ticket {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "account_lockout" | "vpn_issue" | "software_request" | "general";
  summary: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  actions: string[];
}

// ── Employees ────────────────────────────────────────────────────────────────
export const employees: Employee[] = [
  {
    id: "EMP001",
    name: "Sarah Chen",
    email: "s.chen@company.com",
    department: "Engineering",
    accountStatus: "locked",
    lastLogin: "2024-01-14T08:22:00Z",
    verified: false,
  },
  {
    id: "EMP002",
    name: "Marcus Webb",
    email: "m.webb@company.com",
    department: "Design",
    accountStatus: "active",
    lastLogin: "2024-01-15T09:10:00Z",
    verified: false,
  },
  {
    id: "EMP003",
    name: "Priya Nair",
    email: "p.nair@company.com",
    department: "Marketing",
    accountStatus: "active",
    lastLogin: "2024-01-13T14:55:00Z",
    verified: false,
  },
  {
    id: "EMP004",
    name: "Jordan Blake",
    email: "j.blake@company.com",
    department: "Sales",
    accountStatus: "locked",
    lastLogin: "2024-01-12T11:30:00Z",
    verified: false,
  },
  {
    id: "EMP005",
    name: "Alex Rivera",
    email: "a.rivera@company.com",
    department: "Finance",
    accountStatus: "active",
    lastLogin: "2024-01-15T07:45:00Z",
    verified: false,
  },
];

// ── VPN Status ────────────────────────────────────────────────────────────────
export const vpnStatus: VPNStatus[] = [
  {
    employeeId: "EMP001",
    connected: false,
    certificateExpiry: "2024-01-10T00:00:00Z",
    certificateStatus: "expired",
    lastAttempt: "2024-01-15T08:00:00Z",
    errorCode: "CERT_EXPIRED_801",
  },
  {
    employeeId: "EMP002",
    connected: false,
    certificateExpiry: "2024-01-18T00:00:00Z",
    certificateStatus: "expiring_soon",
    lastAttempt: "2024-01-15T09:05:00Z",
    errorCode: "CERT_WARN_802",
  },
  {
    employeeId: "EMP003",
    connected: true,
    certificateExpiry: "2024-06-01T00:00:00Z",
    certificateStatus: "valid",
    lastAttempt: "2024-01-15T14:50:00Z",
  },
  {
    employeeId: "EMP004",
    connected: false,
    certificateExpiry: "2023-12-01T00:00:00Z",
    certificateStatus: "expired",
    lastAttempt: "2024-01-15T10:00:00Z",
    errorCode: "CERT_EXPIRED_801",
  },
  {
    employeeId: "EMP005",
    connected: true,
    certificateExpiry: "2024-09-15T00:00:00Z",
    certificateStatus: "valid",
    lastAttempt: "2024-01-15T07:40:00Z",
  },
];

// ── Software Inventory ────────────────────────────────────────────────────────
export const softwareInventory: SoftwareLicense[] = [
  {
    software: "Adobe Creative Cloud",
    totalLicenses: 10,
    usedLicenses: 9,
    assignedTo: ["EMP001", "EMP002", "EMP003", "EMP004", "EMP005", "EMP006", "EMP007", "EMP008", "EMP009"],
  },
  {
    software: "Figma",
    totalLicenses: 15,
    usedLicenses: 11,
    assignedTo: ["EMP001", "EMP002", "EMP003", "EMP004", "EMP005", "EMP006", "EMP007", "EMP008", "EMP009", "EMP010", "EMP011"],
  },
  {
    software: "Slack",
    totalLicenses: 50,
    usedLicenses: 42,
    assignedTo: [],
  },
  {
    software: "GitHub Copilot",
    totalLicenses: 5,
    usedLicenses: 5,
    assignedTo: ["EMP001", "EMP002", "EMP003", "EMP004", "EMP005"],
  },
];

// ── Tickets (mutable — gets populated at runtime) ─────────────────────────────
export const tickets: Ticket[] = [];

// ── Helper: generate ticket ID ────────────────────────────────────────────────
export function generateTicketId(): string {
  return `TKT-${Date.now().toString(36).toUpperCase()}`;
}
