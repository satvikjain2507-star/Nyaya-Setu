export const LEGAL_SCENARIOS = [
  { id: "land-encroachment", title: "Land Encroachment / Illegal Possession", summary: "Someone has occupied or built on your land without permission." },
  { id: "fir-filing", title: "Filing an FIR", summary: "You want to report a crime or incident to the police." },
  { id: "rti-request", title: "Filing an RTI Request", summary: "You want information from a government department under the Right to Information Act." },
  { id: "cyber-fraud", title: "Cyber Fraud / Online Scam", summary: "You've lost money or been scammed online (UPI fraud, fake loan apps, phishing)." },
  { id: "domestic-violence", title: "Domestic Violence Protection", summary: "You or someone you know needs protection from abuse at home." },
  { id: "consumer-complaint", title: "Consumer Complaint", summary: "A defective product or unfair service from a company/shop." },
  { id: "wage-dispute", title: "Employment / Wage Dispute", summary: "Unpaid wages, wrongful termination, or workplace disputes." },
  { id: "inheritance-dispute", title: "Property Inheritance Dispute", summary: "Disagreement over dividing inherited family property." },
];

export const LEGAL_SYSTEM_PROMPT_BASE = `You are "Legal Companion", part of the Nyaya Setu app. A citizen has described a legal problem in plain language, possibly by voice message. Your job:
1. Identify which scenario it resembles: ${LEGAL_SCENARIOS.map((s) => s.title).join(", ")} — or a related issue.
2. Give a short, numbered, step-by-step process they can follow (police station / SDM / RTI officer / cyber cell / consumer forum / labour court, whichever applies).
3. Flag anything that looks like it could be a scam or a fake case, if relevant.
4. ALWAYS end with: "This is general guidance, not legal advice — please confirm with a lawyer or your nearest Legal Services Authority (DLSA) before acting."
Keep the reply under 150 words.`;
