const fs = require("fs");
let content = fs.readFileSync("js/app.js", "utf8");

const replacements = {
  "ยท": "·",
  "เน‚โ‚ฌโ€ ": "—",
  "โ€”": "—",
  "เน‚โ‚ฌเธ†": "…",
  "โ€ฆ": "…",
  "เน ยŸยŒย ": "🌍",
  "๐ŸŒ ": "🌍",
  "เน ยŸย เธ…": "🏥",
  "๐Ÿ ฅ": "🏥",
  "เน ยŸโ€™เธ ": "💡",
  "๐Ÿ’ก": "💡",
  "โ†’": "→",
  "โ† ": "←",
  "ฮ”": "Δ",
  "ร—": "×",
  "เน ยŸย“ยŠ": "📊",
  "๐Ÿ“Š": "📊",
  "เน ยŸย”ย ": "🔍",
  "๐Ÿ” ": "🔍",
  "เน ยŸโ€™ย ": "💰",
  "๐Ÿ’ ": "💰",
  "โซก": "⬡"
};

for (const [bad, good] of Object.entries(replacements)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync("js/app.js", content, "utf8");
console.log("Replaced mojibake");
