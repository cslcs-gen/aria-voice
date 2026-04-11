// lib/vaping-systems.ts — Singapore Vaping Public Health Knowledge Base & Case Store

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

// ── Live case store (in-memory, resets on server restart) ─────────────────────
export const vapingCases: VapingCase[] = [];

// ── Generate case reference number ───────────────────────────────────────────
export function generateCaseId(): string {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VPG-${dateStr}-${rand}`;
}

// ── Singapore Vaping Knowledge Base ──────────────────────────────────────────
export const VAPING_KNOWLEDGE = `
## Singapore Vaping Laws & Penalties (as of 2024)

### Core Legislation
- Vaping and e-cigarettes are governed by the **Tobacco (Control of Advertisements and Sale) Act** and the **Poisons Act** in Singapore.
- The **Health Sciences Authority (HSA)** and the **National Environment Agency (NEA)** are the primary enforcement agencies.
- Under the Tobacco Act, vaping devices (e-cigarettes, vaporisers, heated tobacco products) are classified as **imitation tobacco products** and are **prohibited**.

### Key Prohibitions
- It is **illegal to use, possess, purchase, or import** any vaping device or e-cigarette in Singapore.
- It is **illegal to sell or distribute** vaping devices or e-liquids.
- It is **illegal to advertise** vaping products in Singapore.
- Bringing vaping devices into Singapore (even for personal use) is prohibited.

### Penalties
- **Use or possession**: Up to SGD 2,000 fine for first offence.
- **Importation**: Up to SGD 10,000 fine and/or up to 6 months imprisonment.
- **Sale/distribution**: Up to SGD 10,000 fine and/or up to 6 months imprisonment for first offence. Up to SGD 20,000 and/or 12 months for repeat offences.
- **Repeat offenders** face significantly higher fines and potential imprisonment.

### Enhanced Penalties for Minors
- Selling or supplying vaping products to persons under 21 years old carries **enhanced penalties**.
- Schools and educational institutions have zero-tolerance policies; students caught vaping face disciplinary action.

---

## Health Effects of Vaping

### Short-Term Effects
- Throat and mouth irritation, coughing, and wheezing.
- Increased heart rate and blood pressure.
- Dizziness and headaches from nicotine.
- Nausea and vomiting especially in new users.

### Long-Term Effects
- **Lung damage**: EVALI (E-cigarette or Vaping product use-Associated Lung Injury) — a serious lung condition.
- **Nicotine addiction**: Most e-liquids contain nicotine which is highly addictive.
- **Cardiovascular risk**: Increased risk of heart disease with long-term use.
- **Brain development**: Nicotine harms adolescent brain development affecting memory, attention and learning.
- **Cancer risk**: Some e-liquid flavourings contain chemicals linked to cancer when heated.

### Myths vs Facts
- MYTH: "Vaping is safe because it's just water vapour." FACT: E-cigarette aerosol contains harmful chemicals including heavy metals, ultrafine particles and volatile organic compounds.
- MYTH: "Vaping helps you quit smoking." FACT: HSA does not approve e-cigarettes as a smoking cessation tool in Singapore.
- MYTH: "Second-hand vape is harmless." FACT: Bystanders are exposed to nicotine and toxic chemicals from exhaled aerosol.

---

## How to Report Vaping Violations

### Who to Report To
- **Health Sciences Authority (HSA)**: For sale, import, and distribution of vaping products. Hotline: 1800-117-8333.
- **National Environment Agency (NEA)**: For public vaping in prohibited areas.
- **Singapore Police Force (SPF)**: For serious offences involving minors.

### What to Include in a Report
- Date, time, and location of the incident.
- Description of the violation (e.g., person vaping in public, shop selling vaping devices).
- If possible, photos or videos as evidence (ensure you are not violating privacy laws).
- Description of the person or establishment involved.

### Anonymous Reporting
- You can report anonymously via the **HSA Online Feedback Form** at hsa.gov.sg.
- Anonymous tip-offs are taken seriously and investigated.

---

## Vaping Regulations for Businesses

### Retail and F&B Establishments
- **Prohibited from selling** any form of vaping device, e-liquid, or accessories.
- Must display **no-vaping signs** in their premises.
- Staff must be trained to refuse service if customers attempt to purchase vaping-related products.
- Businesses found selling vaping products face **licence revocation** in addition to fines.

### Workplace Policy
- Under the Workplace Safety and Health Act, employers must maintain a safe environment.
- Vaping in air-conditioned workplaces is prohibited under the Smoking (Prohibition in Certain Places) Act which covers vaping devices.
- Employers should implement clear no-vaping policies and communicate them to all employees.

### Hospitality (Hotels, Resorts)
- Hotels must enforce no-vaping policies in all indoor areas.
- Vaping in hotel rooms is treated the same as smoking — subject to cleaning fees and potential fines.
- Designated outdoor smoking areas do NOT automatically permit vaping.

---

## Frequently Asked Questions

**Q: Can I bring my vape device into Singapore as a tourist?**
A: No. All vaping devices are prohibited entry into Singapore regardless of whether they are for personal use. They will be confiscated at the border and you may be fined.

**Q: Is heated tobacco (e.g. IQOS) legal in Singapore?**
A: No. Heated tobacco products are classified under the same prohibition as e-cigarettes in Singapore.

**Q: Where can I get help to quit vaping/smoking?**
A: Contact the **Health Promotion Board (HPB) QuitLine at 1800-438-2000** or visit heartbeat.health.gov.sg for cessation programmes.

**Q: My child's school has a vaping problem. Who do I call?**
A: Report to the school principal first, then contact HSA at 1800-117-8333. You may also file a police report if minors are being supplied vaping products.

**Q: I saw someone selling vapes online. Can I report this?**
A: Yes. Report to HSA via hsa.gov.sg/feedback. Provide the URL, screenshots, and any other details about the seller.
`;
