// Run from the project folder:  node scripts/selftest.cjs        (full, ~5 min)
//                               node scripts/selftest.cjs --quick (~2 min)
const fs = require("fs");
const path = require("path");
const envFile = path.join(__dirname, "..", ".env");
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
require("./selftest/bundle.cjs");
