// lib/vaping-systems.ts — ARIA v4.0
// Includes: knowledge base, callback cases, offender cases, FAQ store

// ── Types ─────────────────────────────────────────────────────────────────────
export interface VapingCase {
  id: string;
  name: string;
  contact: string;
  email?: string;
  query: string;
  callbackTime?: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
}

export interface OffenderCase {
  caseRef: string;
  nric: string; // masked e.g. S****567A
  nricFull: string; // for lookup matching
  name: string;
  age: number;
  offenceType: string;
  offenceDate: string;
  location: string;
  description: string;
  penaltyTier: 1 | 2 | 3;
  penalties: {
    fine?: { amount: number; currency: string; dueDate: string; paid: boolean };
    rehabilitation?: { programme: string; sessions: number; startDate: string; completedSessions: number; status: "pending" | "ongoing" | "completed" };
    jailTerm?: { duration: string; facility: string; startDate: string; releaseDate: string; status: "serving" | "completed" | "suspended" };
  };
  status: "active" | "resolved" | "appealing";
  caseOfficer: string;
  courtDate?: string;
  nextAction: string;
  timeline: Array<{ date: string; event: string; completed: boolean }>;
}

export interface GeneratedFAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  relevantSection: string;
}

export interface FAQStore {
  faqs: GeneratedFAQ[];
  lastUpdated: string | null;
  actVersion: string;
  actSource: string;
  generatedBy: string;
  totalGenerated: number;
}

// ── Callback case store ───────────────────────────────────────────────────────
export const vapingCases: VapingCase[] = [];

export function generateCaseId(): string {
  const d = new Date();
  const ds = d.getFullYear().toString() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
  return `VPG-${ds}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

// ── Offender case database (pre-seeded for demo) ──────────────────────────────
export const offenderCases: OffenderCase[] = [
  {
    caseRef: "OFC-2024-0891",
    nric: "S****123A",
    nricFull: "S8712123A",
    name: "Tan Wei Ming",
    age: 24,
    offenceType: "Possession and Use of Vaping Device",
    offenceDate: "2024-10-15",
    location: "Orchard MRT Station, Exit B",
    description: "Subject was found in possession of one e-cigarette device and three refill cartridges. Subject admitted to personal use. First offence.",
    penaltyTier: 1,
    penalties: {
      fine: { amount: 1000, currency: "SGD", dueDate: "2024-12-15", paid: false },
    },
    status: "active",
    caseOfficer: "Senior Enforcement Officer Lim Siew Hua",
    nextAction: "Payment of SGD 1,000 fine by 15 December 2024.",
    timeline: [
      { date: "2024-10-15", event: "Offence detected by HSA enforcement officer at Orchard MRT", completed: true },
      { date: "2024-10-15", event: "Device and cartridges seized as evidence", completed: true },
      { date: "2024-10-22", event: "Formal notice issued — Composition fine of SGD 1,000", completed: true },
      { date: "2024-12-15", event: "Payment deadline for SGD 1,000 fine", completed: false },
    ],
  },
  {
    caseRef: "OFC-2024-0654",
    nric: "T****890B",
    nricFull: "T9234890B",
    name: "Priya Rajendran",
    age: 31,
    offenceType: "Repeat Possession — Second Offence",
    offenceDate: "2024-09-03",
    location: "Bugis Junction Food Court, Level 3",
    description: "Subject was found vaping in a food establishment. Subject has a prior offence in 2023 for possession. As a repeat offender, subject is referred to a cessation and rehabilitation programme in addition to an enhanced fine.",
    penaltyTier: 2,
    penalties: {
      fine: { amount: 2000, currency: "SGD", dueDate: "2024-11-03", paid: true },
      rehabilitation: {
        programme: "HPB Quit Vaping Programme — Group Counselling",
        sessions: 6,
        startDate: "2024-11-15",
        completedSessions: 4,
        status: "ongoing",
      },
    },
    status: "active",
    caseOfficer: "Enforcement Officer Ng Boon Kiat",
    nextAction: "Complete remaining 2 rehabilitation sessions by 28 February 2025.",
    timeline: [
      { date: "2024-09-03", event: "Second offence detected — vaping at Bugis Junction food court", completed: true },
      { date: "2024-09-03", event: "Device confiscated; subject warned of enhanced penalties for repeat offence", completed: true },
      { date: "2024-09-17", event: "Formal charge issued — SGD 2,000 fine and mandatory rehabilitation", completed: true },
      { date: "2024-11-03", event: "Fine of SGD 2,000 paid in full", completed: true },
      { date: "2024-11-15", event: "Enrolled in HPB Quit Vaping Programme — Session 1 completed", completed: true },
      { date: "2025-01-10", event: "Sessions 2, 3 and 4 completed", completed: true },
      { date: "2025-02-28", event: "Complete remaining sessions 5 and 6", completed: false },
      { date: "2025-03-15", event: "Case review — compliance verification", completed: false },
    ],
  },
  {
    caseRef: "OFC-2024-0312",
    nric: "S****456C",
    nricFull: "S7845456C",
    name: "Ahmad Farhan Bin Yusof",
    age: 38,
    offenceType: "Importation of Vaping Devices for Commercial Distribution",
    offenceDate: "2024-07-22",
    location: "Changi Airport Terminal 3 — Customs Checkpoint",
    description: "Subject was apprehended at Changi Airport Customs with 47 vaping devices and 120 bottles of e-liquid concealed within declared electronic goods. Investigation revealed devices were intended for sale. Subject charged under Section 16A of the Tobacco (Control of Advertisements and Sale) Act with intent to distribute.",
    penaltyTier: 3,
    penalties: {
      fine: { amount: 10000, currency: "SGD", dueDate: "2025-01-22", paid: false },
      jailTerm: {
        duration: "6 months",
        facility: "Changi Prison Complex",
        startDate: "2024-10-01",
        releaseDate: "2025-03-31",
        status: "serving",
      },
    },
    status: "active",
    caseOfficer: "Senior Investigator Chong Wei Liang, HSA Enforcement Division",
    courtDate: "2024-09-15",
    nextAction: "Serving custodial sentence. Fine of SGD 10,000 due upon release on 31 March 2025.",
    timeline: [
      { date: "2024-07-22", event: "Apprehended at Changi Airport Customs — 47 devices and 120 e-liquid bottles seized", completed: true },
      { date: "2024-07-22", event: "Arrested and brought in for investigation by HSA Enforcement Division", completed: true },
      { date: "2024-08-05", event: "Formal charges filed — importation with intent to distribute under Tobacco Act S.16A", completed: true },
      { date: "2024-09-15", event: "Court hearing — Subject pleaded guilty. Sentenced to 6 months imprisonment and SGD 10,000 fine", completed: true },
      { date: "2024-10-01", event: "Commenced custodial sentence at Changi Prison Complex", completed: true },
      { date: "2025-03-31", event: "Expected release date — fine of SGD 10,000 due upon release", completed: false },
    ],
  },
  {
    caseRef: "OFC-2024-1102",
    nric: "G****789D",
    nricFull: "G9912789D",
    name: "Jason Loh Kok Weng",
    age: 19,
    offenceType: "Supply of Vaping Products to a Minor",
    offenceDate: "2024-11-08",
    location: "Online — Carousell Platform",
    description: "Subject sold two vaping devices via Carousell to a buyer who was 16 years of age. HSA's online surveillance unit identified the transaction. Subject was unaware the buyer was a minor but is charged under the enhanced penalty provision for sale to persons under 21.",
    penaltyTier: 3,
    penalties: {
      fine: { amount: 5000, currency: "SGD", dueDate: "2025-03-08", paid: false },
      rehabilitation: {
        programme: "Community Work Order — 120 hours with HPB Health Education Unit",
        sessions: 12,
        startDate: "2025-01-15",
        completedSessions: 0,
        status: "pending",
      },
    },
    status: "appealing",
    caseOfficer: "Enforcement Officer Rachel Tan Pei Ling",
    courtDate: "2025-02-14",
    nextAction: "Appeal hearing scheduled 14 February 2025. Community service order pending appeal outcome.",
    timeline: [
      { date: "2024-11-08", event: "HSA online unit identified sale of vaping device to 16-year-old on Carousell", completed: true },
      { date: "2024-11-15", event: "Subject interviewed and device transaction records obtained", completed: true },
      { date: "2024-12-01", event: "Formal charge issued — sale to minor under Tobacco Act enhanced provisions", completed: true },
      { date: "2024-12-20", event: "Subject filed notice of appeal against conviction", completed: true },
      { date: "2025-02-14", event: "Appeal hearing at State Courts", completed: false },
      { date: "2025-03-08", event: "Fine of SGD 5,000 due (subject to appeal outcome)", completed: false },
    ],
  },
  {
    caseRef: "OFC-2023-0445",
    nric: "S****234E",
    nricFull: "S6523234E",
    name: "Siti Nur Aisyah Binte Ramlan",
    age: 42,
    offenceType: "Sale of Vaping Devices from Retail Premises",
    offenceDate: "2023-06-10",
    location: "Value Shop — Tampines Mall, #02-44",
    description: "Subject operated a retail store that was found selling e-cigarettes and vaping accessories. An undercover enforcement officer purchased two devices. Business licence was subsequently revoked. Case fully resolved.",
    penaltyTier: 2,
    penalties: {
      fine: { amount: 8000, currency: "SGD", dueDate: "2023-09-10", paid: true },
      rehabilitation: {
        programme: "Business Compliance and Health Education Workshop",
        sessions: 3,
        startDate: "2023-09-15",
        completedSessions: 3,
        status: "completed",
      },
    },
    status: "resolved",
    caseOfficer: "Senior Enforcement Officer Lim Siew Hua",
    nextAction: "Case resolved. All penalties fulfilled. Business licence reinstated with conditions on 15 January 2024.",
    timeline: [
      { date: "2023-06-10", event: "Undercover purchase of two vaping devices from subject's retail store", completed: true },
      { date: "2023-06-10", event: "Premises inspected — additional 34 devices found in stockroom", completed: true },
      { date: "2023-06-25", event: "Formal charge issued — retail sale of prohibited products", completed: true },
      { date: "2023-07-01", event: "Business licence suspended pending resolution", completed: true },
      { date: "2023-09-10", event: "Fine of SGD 8,000 paid in full", completed: true },
      { date: "2023-09-15", event: "Enrolled in Business Compliance and Health Education Workshop", completed: true },
      { date: "2023-11-30", event: "All 3 workshop sessions completed", completed: true },
      { date: "2024-01-15", event: "Business licence reinstated with conditions", completed: true },
    ],
  },
];

// ── FAQ Store (mutable — updated by generate endpoint) ────────────────────────
export const faqStore: FAQStore = {
  faqs: [],
  lastUpdated: null,
  actVersion: "Not yet generated",
  actSource: "Singapore Tobacco (Control of Advertisements and Sale) Act (Cap 309)",
  generatedBy: "ARIA AI — Powered by Claude",
  totalGenerated: 0,
};

// ── Singapore Tobacco Act source text (condensed for demo) ───────────────────
export const TOBACCO_ACT_TEXT = `
SINGAPORE STATUTES ONLINE
TOBACCO (CONTROL OF ADVERTISEMENTS AND SALE) ACT 1993
(CHAPTER 309)
Revised Edition 2011 — Current Version includes amendments up to 1 February 2023

PART 1 — PRELIMINARY
1. Short title
This Act may be cited as the Tobacco (Control of Advertisements and Sale) Act 1993.

2. Interpretation
"tobacco product" means any product made wholly or partly of tobacco leaf and includes cigarettes, cigars, beedis, ang hoon, and any other form of tobacco intended for smoking, sniffing, chewing or sucking.
"imitation tobacco product" means any product that resembles a tobacco product and is intended to be smoked, inhaled, or vaporised, including electronic cigarettes, vaporisers, and heated tobacco products.
"e-cigarette" or "electronic cigarette" means any device that produces vapour from a liquid or substance, including nicotine-containing or non-nicotine substances, intended for inhalation.

PART 2 — CONTROL OF TOBACCO ADVERTISEMENTS
3. Prohibition of advertisements
No person shall publish or cause to be published in Singapore any advertisement for tobacco products or imitation tobacco products.
Penalty: Fine not exceeding SGD 10,000 for first offence; SGD 20,000 for subsequent offences.

PART 3 — CONTROL OF SALE OF TOBACCO PRODUCTS
7. Prohibition on sale to persons below 21
(1) No person shall sell or supply any tobacco product or imitation tobacco product to any person who is below the age of 21 years.
(2) A retailer who fails to verify the age of a buyer may be held liable under this section.
Penalty: Fine not exceeding SGD 10,000. For sale to minors, fine not exceeding SGD 20,000.

8. Prohibition of sale of imitation tobacco products
(1) No person shall sell, offer for sale, or possess for sale any imitation tobacco product.
(2) No person shall import any imitation tobacco product for the purpose of sale or distribution.
Penalty for sale: Fine not exceeding SGD 10,000 and/or imprisonment not exceeding 6 months for first offence.
Penalty for importation with intent to distribute: Fine not exceeding SGD 20,000 and/or imprisonment not exceeding 12 months.

PART 3A — PROHIBITION ON ELECTRONIC CIGARETTES AND VAPORISERS
16A. Prohibition on possession and use
(1) No person shall have in their possession any electronic cigarette, vaporiser, or heated tobacco product.
(2) No person shall use, or permit the use of, any electronic cigarette, vaporiser, or heated tobacco product.
Penalty: Fine not exceeding SGD 2,000 for first offence.
For repeat offenders: Fine not exceeding SGD 4,000 and/or rehabilitation programme under HPB.

16B. Prohibition on importation
No person shall import into Singapore any electronic cigarette, vaporiser, heated tobacco product, or component parts thereof.
Penalty: Fine not exceeding SGD 10,000 and/or imprisonment not exceeding 6 months for first offence.
For second or subsequent offences: Fine not exceeding SGD 20,000 and/or imprisonment not exceeding 12 months.

16C. Enforcement powers
(1) An authorised officer may seize any electronic cigarette, vaporiser, or component found in the possession of any person.
(2) An authorised officer may enter and inspect any premises where there is reasonable cause to believe imitation tobacco products are stored or sold.

PART 4 — SMOKING CONTROL
16. Prohibition of smoking in prescribed places
(1) No person shall smoke in any specified place.
(2) The definition of "smoking" includes the use of electronic cigarettes and vaporisers.
Penalty: Fine not exceeding SGD 1,000.

PART 5 — MISCELLANEOUS
26. Composition of offences
Any offence may be compounded by an authorised officer where the maximum penalty is a fine only. Composition amounts shall not exceed half the maximum penalty for first offences.

27. Appeal
Any person aggrieved by a decision of an authorised officer may appeal to the Director within 14 days of the decision.

SCHEDULE — SPECIFIED PLACES WHERE SMOKING IS PROHIBITED
Includes: All air-conditioned premises, public transport vehicles and stations, healthcare institutions, educational institutions, places of worship, food establishments, government buildings, parks, and any place prescribed by the Minister.

ENFORCEMENT AGENCIES
- Health Sciences Authority (HSA): Primary regulator for vaping devices and imitation tobacco products.
- National Environment Agency (NEA): Enforcement of smoking prohibition in public places.
- Singapore Police Force (SPF): Handles criminal cases including importation offences.
- Singapore Customs: Enforcement at points of entry.
`;

// ── Vaping knowledge base ─────────────────────────────────────────────────────
export const VAPING_KNOWLEDGE = `
## Singapore Vaping Laws & Penalties (as of 2024)

### Core Legislation
- Vaping and e-cigarettes are governed by the Tobacco (Control of Advertisements and Sale) Act (Cap 309) and enforced primarily by the Health Sciences Authority (HSA).
- Vaping devices, e-cigarettes, and heated tobacco products are classified as imitation tobacco products and are prohibited.

### Key Prohibitions
- Illegal to use, possess, purchase, or import any vaping device or e-cigarette in Singapore.
- Illegal to sell or distribute vaping devices or e-liquids.
- Illegal to advertise vaping products.
- Bringing vaping devices into Singapore even for personal use is prohibited.

### Penalties
- Use or possession: Fine up to SGD 2,000 for first offence.
- Repeat possession: Fine up to SGD 4,000 and/or mandatory rehabilitation programme.
- Importation: Fine up to SGD 10,000 and/or up to 6 months imprisonment.
- Sale or distribution: Fine up to SGD 10,000 and/or 6 months for first offence. Up to SGD 20,000 and/or 12 months for repeat.
- Sale to persons under 21: Enhanced penalty up to SGD 20,000.

### Enhanced Penalties for Minors
- Selling or supplying vaping products to persons under 21 carries enhanced penalties.

---

## Health Effects of Vaping

### Short-Term Effects
- Throat and mouth irritation, coughing, and wheezing.
- Increased heart rate and blood pressure.
- Dizziness and headaches from nicotine.

### Long-Term Effects
- EVALI — E-cigarette or Vaping product use-Associated Lung Injury.
- Nicotine addiction — most e-liquids contain highly addictive nicotine.
- Cardiovascular risk — increased risk of heart disease.
- Brain development harm — nicotine harms adolescent brain development.

---

## How to Report Vaping Violations

### Who to Report To
- Health Sciences Authority (HSA): For sale, import, and distribution. Hotline: 1800-117-8333.
- National Environment Agency (NEA): For public vaping in prohibited areas.
- Singapore Police Force (SPF): For serious offences involving minors.

---

## Vaping Regulations for Businesses

### Retail and F&B Establishments
- Prohibited from selling any vaping device, e-liquid, or accessories.
- Must display no-vaping signs.
- Businesses found selling face licence revocation in addition to fines.

### Workplace Policy
- Vaping in air-conditioned workplaces is prohibited.
- Employers must implement clear no-vaping policies.

---

## Frequently Asked Questions

Q: Can I bring my vape device into Singapore as a tourist?
A: No. All vaping devices are prohibited entry regardless of personal use intent. They will be confiscated and you may be fined.

Q: Is heated tobacco such as IQOS legal in Singapore?
A: No. Heated tobacco products fall under the same prohibition as e-cigarettes.

Q: Where can I get help to quit vaping?
A: Contact the Health Promotion Board QuitLine at 1800-438-2000 or visit heartbeat.health.gov.sg.

Q: My child's school has a vaping problem. Who do I call?
A: Report to the school principal, then contact HSA at 1800-117-8333.
`;
