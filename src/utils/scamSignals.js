/**
 * Instant, offline red-flag scan for SMS / WhatsApp / call scripts / notices.
 * Runs in milliseconds before the live TinyFish check, so the citizen sees
 * warning signs immediately — and still gets a verdict if the internet drops.
 */
const RULES = [
  { re: /\b(otp|one[- ]time password|pin|cvv|password|upi pin)\b|ओटीपी|पिन/i, label: "Asks for OTP, PIN or password — no bank or government office ever asks for these" },
  { re: /digital arrest|\barrest\b|warrant|cbi|\bed\b officer|customs|narcotics|court case|legal action|fir (has been|will be)|गिरफ्तार|गिरफ़्तार/i, label: "Threatens arrest or legal action — a classic 'digital arrest' scare tactic" },
  { re: /disconnect|will be (cut|blocked|suspended|deactivated)|blocked today|account (is )?(blocked|suspended)|कट जाएगी|काट दिया जाएगा|बंद हो जाएगा|ब्लॉक/i, label: "Threatens to cut a service or block your account" },
  { re: /urgent|immediately|tonight|within (24|2|1) ?(hours?|hrs?)|today itself|last (chance|warning)|act now|तुरंत|आज रात|अभी/i, label: "Creates panic and urgency so you don't stop to think" },
  { re: /lottery|lucky draw|you (have )?won|winner|prize|\bkbc\b|cash ?back|reward points|gift|इनाम|लॉटरी/i, label: "Promises a prize, lottery or reward you never applied for" },
  { re: /processing fee|registration fee|pay (now|rs|₹)|deposit|advance (payment|fee)|send money|transfer (rs|₹)|refund|पैसे भेजें|शुल्क/i, label: "Asks you to pay a fee or send money first" },
  { re: /\b(kyc|e-?kyc)\b.*(update|expire|pending|block)|update your (pan|aadhaar|account|kyc)|pan (card )?(not )?linked/i, label: "Fake KYC / PAN / Aadhaar update request" },
  { re: /\.apk\b|install (this|the) app|anydesk|teamviewer|quick ?support|screen ?shar/i, label: "Asks you to install an app or share your screen — remote-access scam" },
  { re: /(part[- ]time|work from home|like (videos|youtube)|task).*(earn|income|₹|rs)/i, label: "Too-good-to-be-true job or task offer" },
];

const OFFICIAL_HOST = /(\.gov\.in|\.nic\.in|\.gov)$/i;

export function redFlags(text = "") {
  const s = String(text);
  const flags = RULES.filter((r) => r.re.test(s)).map((r) => r.label);

  const links = s.match(/\b((https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)/gi) || [];
  const hosts = links
    .map((l) => l.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase())
    .filter((h) => /\.[a-z]{2,}$/.test(h) && !/^\d+(\.\d+)+$/.test(h));
  const shortener = hosts.find((h) => /^(bit\.ly|tinyurl\.com|t\.co|cutt\.ly|rb\.gy|is\.gd|wa\.me|shorturl\.at)$/.test(h));
  const nonOfficial = hosts.find((h) => !OFFICIAL_HOST.test(h));
  if (shortener) flags.push(`Uses a hidden short link (${shortener}) — real government links end in .gov.in`);
  else if (nonOfficial) flags.push(`Link goes to ${nonOfficial}, which is not an official .gov.in website`);

  const digits = s.replace(/(\d)[\s-](?=\d)/g, "$1");
  if (/(?<!\d)(\+?91)?[6-9]\d{9}(?!\d)/.test(digits) && /call|contact|whatsapp|कॉल|संपर्क|फोन/i.test(s)) {
    flags.push("Asks you to call a personal mobile number instead of an official helpline");
  }
  return [...new Set(flags)];
}

/** Offline verdict used if the live check can't run (no internet / API busy). */
export function offlineVerdict(flags, language = "English") {
  const verdict = flags.length >= 2 ? "likely_scam" : flags.length === 1 ? "suspicious" : "unclear";
  return {
    kind: "scam",
    verdict,
    headline:
      verdict === "likely_scam"
        ? "Several scam warning signs found. Do not respond."
        : verdict === "suspicious"
        ? "One warning sign found. Be careful before you act."
        : "No obvious warning signs — still confirm with the official source.",
    reasons: flags.length ? flags : ["Could not run the live check right now. Confirm with the official website or helpline before acting."],
    whatToDo: [
      "Do not share OTP, PIN, Aadhaar or bank details.",
      "Do not click the link or pay any money.",
      "If money was lost, call 1930 immediately or report at cybercrime.gov.in.",
    ],
    sources: [],
    checkedAt: new Date().toISOString(),
    offline: true,
  };
}

export const SCAM_SAMPLES = [
  {
    icon: "⚡",
    label: "Electricity cut SMS",
    text: "Dear customer, your electricity will be disconnected tonight at 9:30 PM because your last bill was not updated. Call our officer immediately on 9876543210.",
  },
  {
    icon: "🚔",
    label: "'Digital arrest' call",
    text: "This is CBI officer. A parcel in your name has drugs. You are under digital arrest. Stay on video call and transfer Rs 50,000 for verification or police will come to arrest you today.",
  },
  {
    icon: "🎁",
    label: "KBC lottery WhatsApp",
    text: "Congratulations! Your number has won Rs 25,00,000 in KBC Lucky Draw. Pay processing fee Rs 4,500 to claim. Contact on WhatsApp 7012345678.",
  },
  {
    icon: "🌾",
    label: "Fake PM-KISAN link",
    text: "PM Kisan 21st installment of Rs 2000 is pending. Your eKYC is pending, update immediately at http://pmkisan-ekyc-update.in or your account will be blocked.",
  },
];
