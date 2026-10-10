export const SCHEMES = [
  {
    id: "nsp-scholarship",
    name: "National Scholarship Portal — Pre/Post Matric Scholarship",
    category: "Education",
    eligibility: "Family income below ₹2.5 lakh/year; student in class 9-12 or higher education",
    documents: ["Income certificate", "Caste certificate (if applicable)", "Previous mark sheet", "Bank passbook copy"],
  },
  {
    id: "ayushman-bharat",
    name: "Ayushman Bharat — PM-JAY",
    category: "Health",
    eligibility: "Listed in SECC 2011 deprivation criteria; low-income families",
    documents: ["Aadhaar card", "Ration card", "SECC verification"],
  },
  {
    id: "pm-kisan",
    name: "PM-KISAN Samman Nidhi",
    category: "Agriculture",
    eligibility: "Small and marginal farmer families with cultivable landholding",
    documents: ["Land ownership papers", "Aadhaar card", "Bank account details"],
  },
  {
    id: "nsap-pension",
    name: "National Social Assistance Programme — Old Age Pension",
    category: "Pension",
    eligibility: "Age 60+, belonging to a BPL household",
    documents: ["Age proof", "BPL card", "Bank passbook"],
  },
  {
    id: "pmay",
    name: "Pradhan Mantri Awas Yojana (Gramin/Urban)",
    category: "Housing",
    eligibility: "Houseless or living in a kutcha house; falls under EWS/LIG income group",
    documents: ["Income certificate", "Aadhaar card", "Existing house proof (if any)"],
  },
  {
    id: "ujjwala",
    name: "Pradhan Mantri Ujjwala Yojana",
    category: "Household",
    eligibility: "BPL women without an existing LPG connection",
    documents: ["BPL certificate", "Aadhaar card", "Bank account details"],
  },
  {
    id: "sukanya-samriddhi",
    name: "Sukanya Samriddhi Yojana",
    category: "Girl Child Welfare",
    eligibility: "Parents/guardians of a girl child under 10 years old",
    documents: ["Girl child's birth certificate", "Guardian's ID proof", "Address proof"],
  },
  {
    id: "pmkvy",
    name: "Pradhan Mantri Kaushal Vikas Yojana (Skill India)",
    category: "Employment / Skill Training",
    eligibility: "Youth aged 15-45 seeking free skill training and certification",
    documents: ["Aadhaar card", "Educational certificates", "Bank passbook"],
  },
  {
    id: "atal-pension",
    name: "Atal Pension Yojana",
    category: "Pension",
    eligibility: "Age 18-40, especially unorganised sector workers, with a bank/post office account",
    documents: ["Aadhaar card", "Bank account details", "Age proof"],
  },
  {
    id: "antyodaya",
    name: "Antyodaya Anna Yojana (Ration Scheme)",
    category: "Food Security",
    eligibility: "Poorest of the poor households without stable income",
    documents: ["Existing ration card (if any)", "Income proof", "Aadhaar card"],
  },
  {
    id: "mudra-loan",
    name: "Pradhan Mantri MUDRA Yojana",
    category: "Small Business / Livelihood",
    eligibility: "Non-corporate, non-farm small/micro business owners needing loans up to ₹10 lakh",
    documents: ["Business plan", "Identity/address proof", "Bank statements"],
  },
  {
    id: "maternity-benefit",
    name: "Pradhan Mantri Matru Vandana Yojana",
    category: "Maternity Benefit",
    eligibility: "Pregnant and lactating women for their first living child",
    documents: ["MCP card", "Aadhaar card", "Bank account details"],
  },
];

export const SCHEME_SYSTEM_PROMPT_BASE = `You are "Scheme Navigator", part of the Nyaya Setu app. A citizen has described a problem in their own words, possibly in Hindi or a regional dialect, or sent it as a voice message. Your job:
1. Identify which government welfare scheme(s) from this list best match their situation: ${SCHEMES.map((s) => s.name).join(", ")}.
2. Explain in simple, plain language (avoid jargon) why it fits.
3. List the documents they will likely need.
4. Ask one clarifying question if eligibility is unclear.
Keep the reply under 150 words and easy to read aloud.`;
